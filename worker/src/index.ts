/**
 * text-message-worker:平台代發後端(階段三,Cloudflare Workers + KV)。
 * 職責嚴格限定(資料邊界紅線):Threads/Facebook OAuth 代管、token 加密保存、代發文、排程 cron。
 * 不接收 emails、AI key 或任何其他前端資料。
 *
 * 路由:
 *   GET  /health
 *   GET  /auth/threads/start?install=<id>          → 302 至 Threads 授權頁
 *   GET  /auth/threads/callback?code&state         → 交換並加密保存 token,302 回前端
 *   GET  /auth/facebook/start?install=<id>         → 302 至 Facebook 授權頁(2026-09-30)
 *   GET  /auth/facebook/callback?code&state        → 換長效 token、取首個粉專 page token 加密保存
 *   GET  /auth/linkedin/start?install=<id>         → 302 至 LinkedIn 授權頁(2026-10-07)
 *   GET  /auth/linkedin/callback?code&state        → 交換 60 天 token+member id 加密保存
 *   POST /api/threads/publish   {installId, text}            → 立即代發
 *   POST /api/facebook/publish  {installId, text}            → FB 粉專立即發佈
 *   POST /api/linkedin/publish  {installId, text}            → LinkedIn 個人檔案立即發佈
 *   POST /api/schedule          {installId, text, publishAt, platform?} → 加入排程佇列(platform 預設 threads)
 *   GET  /api/queue?install=<id>                            → 檢視佇列
 *   POST /api/queue/cancel      {installId, itemId}          → 取消排程
 * cron(每分鐘):掃描到期項目並依 platform 代發,失敗指數退避重試(上限 3 次)。
 */
import type { Env } from './config';
import { facebookSystemUserMode } from './config';
import { isDue, applyFailure, applySuccess, QUEUE_PREFIX, type QueueItem } from './queue/due';
import { hmacHex } from './store/crypto';
import {
  listQueueItems,
  loadFacebookToken,
  loadLinkedInToken,
  loadQueueItem,
  loadThreadsToken,
  saveFacebookToken,
  saveLinkedInToken,
  saveQueueItem,
  saveThreadsToken,
} from './store/kv';
import { publishLinkedInText, validateLinkedInText } from './linkedin/publish';
import {
  buildLinkedInAuthorizeUrl,
  exchangeLinkedInCode,
  fetchLinkedInMember,
  needsLinkedInRefresh,
  refreshLinkedInToken,
} from './linkedin/oauth';
import { publishFacebookText, validateFacebookText } from './facebook/publish';
import { loadLibraryBlob, isValidCodeId, saveLibraryBlob, validateSaveRequest } from './library/store';
import {
  buildFbAuthorizeUrl,
  exchangeCode as exchangeFbCode,
  exchangeLongLivedUserToken,
  facebookDiagnostics,
  listFacebookPages,
} from './facebook/oauth';
import { publishThreadsText, validateThreadsText } from './threads/publish';
import {
  buildAuthorizeUrl,
  exchangeCode,
  exchangeLongLived,
  needsRefresh,
  parseState,
  refreshToken,
  serializeState,
} from './threads/oauth';

const INSTALL_ID_RE = /^[A-Za-z0-9_-]{8,64}$/;
/** 排程時間界線:未來 1 秒 ~ 90 天。 */
const MAX_SCHEDULE_AHEAD_MS = 90 * 24 * 60 * 60 * 1000;

/** Workers scheduled handler 的事件(避免依賴 @cloudflare/workers-types)。 */
interface ScheduledEventLike {
  scheduledTime: number;
  cron: string;
}

function json(data: unknown, status = 200, extraHeaders: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=UTF-8', ...extraHeaders },
  });
}

function corsHeaders(env: Env): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': new URL(env.FRONTEND_URL).origin,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
  };
}

/** /api/* 的 CORS 檢查:Origin 必須等於 FRONTEND_URL 的 origin(無 Origin 的非瀏覽器請求放行,如 curl 驗收)。 */
function checkCors(request: Request, env: Env): boolean {
  const origin = request.headers.get('Origin');
  if (!origin) return true;
  return origin === new URL(env.FRONTEND_URL).origin;
}

async function readJsonBody(request: Request): Promise<Record<string, unknown>> {
  try {
    const v = JSON.parse(await request.text()) as unknown;
    return v && typeof v === 'object' ? (v as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

function callbackUrl(request: Request, platform: 'threads' | 'facebook' | 'linkedin'): string {
  return `${new URL(request.url).origin}/auth/${platform}/callback`;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const cors = corsHeaders(env);

    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });

    if (url.pathname === '/health') {
      return json(
        {
          ok: true,
          threadsConfigured: !!env.THREADS_CLIENT_ID && !!env.THREADS_CLIENT_SECRET,
          facebookConfigured:
            facebookSystemUserMode(env) ||
            (!!env.FACEBOOK_CLIENT_ID && !!env.FACEBOOK_CLIENT_SECRET),
          linkedinConfigured: !!env.LINKEDIN_CLIENT_ID && !!env.LINKEDIN_CLIENT_SECRET,
        },
        200,
        cors,
      );
    }

    // ---- Threads OAuth(瀏覽器頂層導航,不走 CORS 檢查)----
    if (url.pathname === '/auth/threads/start' && request.method === 'GET') {
      const installId = url.searchParams.get('install') ?? '';
      if (!INSTALL_ID_RE.test(installId)) return json({ error: 'invalid_install_id' }, 400, cors);
      const hmac = await hmacHex(installId, env.TOKEN_ENCRYPTION_KEY);
      const authorizeUrl = buildAuthorizeUrl({
        clientId: env.THREADS_CLIENT_ID,
        redirectUri: callbackUrl(request, 'threads'),
        state: serializeState(installId, hmac),
      });
      return Response.redirect(authorizeUrl, 302);
    }

    if (url.pathname === '/auth/threads/callback' && request.method === 'GET') {
      const code = url.searchParams.get('code') ?? '';
      const state = url.searchParams.get('state') ?? '';
      const back = (q: string) => Response.redirect(`${env.FRONTEND_URL}?${q}`, 302);
      const verified = parseState(state, await hmacHex(state.slice(0, state.lastIndexOf('.')), env.TOKEN_ENCRYPTION_KEY));
      if (!code || !verified.ok) return back('threads=error');
      try {
        const short = await exchangeCode({
          code,
          clientId: env.THREADS_CLIENT_ID,
          clientSecret: env.THREADS_CLIENT_SECRET,
          redirectUri: callbackUrl(request, 'threads'),
        });
        const long = await exchangeLongLived({
          accessToken: short.accessToken,
          clientSecret: env.THREADS_CLIENT_SECRET,
        });
        await saveThreadsToken(env.QUEUE, verified.installId, {
          accessToken: long.accessToken,
          userId: short.userId,
          expiresAt: long.expiresIn > 0 ? Date.now() + long.expiresIn * 1000 : 0,
        }, env.TOKEN_ENCRYPTION_KEY);
        return back('threads=connected');
      } catch (err) {
        console.error('threads callback failed:', String(err));
        return back('threads=error');
      }
    }

    // ---- Facebook OAuth(瀏覽器頂層導航,不走 CORS 檢查;2026-09-30)----
    if (url.pathname === '/auth/facebook/start' && request.method === 'GET') {
      const installId = url.searchParams.get('install') ?? '';
      if (!INSTALL_ID_RE.test(installId)) return json({ error: 'invalid_install_id' }, 400, cors);
      const hmac = await hmacHex(installId, env.TOKEN_ENCRYPTION_KEY);
      const authorizeUrl = buildFbAuthorizeUrl({
        clientId: env.FACEBOOK_CLIENT_ID,
        redirectUri: callbackUrl(request, 'facebook'),
        state: serializeState(installId, hmac),
        ...(env.FACEBOOK_LOGIN_CONFIG_ID ? { configId: env.FACEBOOK_LOGIN_CONFIG_ID } : {}),
      });
      return Response.redirect(authorizeUrl, 302);
    }

    if (url.pathname === '/auth/facebook/callback' && request.method === 'GET') {
      const code = url.searchParams.get('code') ?? '';
      const state = url.searchParams.get('state') ?? '';
      const back = (q: string) => Response.redirect(`${env.FRONTEND_URL}?${q}`, 302);
      const verified = parseState(state, await hmacHex(state.slice(0, state.lastIndexOf('.')), env.TOKEN_ENCRYPTION_KEY));
      if (!code || !verified.ok) return back('facebook=error');
      try {
        // code → 短效 user token → 長效 → /me/accounts 取粉專 page token(單粉專場景取第一個;
        // 多粉專的選擇 UI 屬後續增量)。授權帳號無任何粉專時視為失敗,回 error 讓使用者重試。
        const short = await exchangeFbCode({
          code,
          clientId: env.FACEBOOK_CLIENT_ID,
          clientSecret: env.FACEBOOK_CLIENT_SECRET,
          redirectUri: callbackUrl(request, 'facebook'),
        });
        const long = await exchangeLongLivedUserToken({
          accessToken: short.accessToken,
          clientId: env.FACEBOOK_CLIENT_ID,
          clientSecret: env.FACEBOOK_CLIENT_SECRET,
        });
        const pages = await listFacebookPages({ userAccessToken: long.accessToken });
        const page = pages[0];
        if (!page) return back('facebook=error');
        await saveFacebookToken(env.QUEUE, verified.installId, page, env.TOKEN_ENCRYPTION_KEY);
        return back('facebook=connected');
      } catch (err) {
        console.error('facebook callback failed:', String(err));
        return back('facebook=error');
      }
    }

    // ---- LinkedIn OAuth(瀏覽器頂層導航,不走 CORS 檢查;2026-10-07)----
    if (url.pathname === '/auth/linkedin/start' && request.method === 'GET') {
      const installId = url.searchParams.get('install') ?? '';
      if (!INSTALL_ID_RE.test(installId)) return json({ error: 'invalid_install_id' }, 400, cors);
      const hmac = await hmacHex(installId, env.TOKEN_ENCRYPTION_KEY);
      const authorizeUrl = buildLinkedInAuthorizeUrl({
        clientId: env.LINKEDIN_CLIENT_ID,
        redirectUri: callbackUrl(request, 'linkedin'),
        state: serializeState(installId, hmac),
      });
      return Response.redirect(authorizeUrl, 302);
    }

    if (url.pathname === '/auth/linkedin/callback' && request.method === 'GET') {
      const code = url.searchParams.get('code') ?? '';
      const state = url.searchParams.get('state') ?? '';
      const back = (q: string) => Response.redirect(`${env.FRONTEND_URL}?${q}`, 302);
      const verified = parseState(state, await hmacHex(state.slice(0, state.lastIndexOf('.')), env.TOKEN_ENCRYPTION_KEY));
      if (!code || !verified.ok) return back('linkedin=error');
      try {
        // code → 60 天 access token(+選配 refresh)→ /v2/userinfo 取 member id(發文 author URN 用)
        const exchanged = await exchangeLinkedInCode({
          code,
          clientId: env.LINKEDIN_CLIENT_ID,
          clientSecret: env.LINKEDIN_CLIENT_SECRET,
          redirectUri: callbackUrl(request, 'linkedin'),
        });
        const member = await fetchLinkedInMember({ accessToken: exchanged.accessToken });
        await saveLinkedInToken(env.QUEUE, verified.installId, {
          accessToken: exchanged.accessToken,
          memberId: member.memberId,
          memberName: member.memberName,
          refreshToken: exchanged.refreshToken,
          expiresAt: exchanged.expiresIn > 0 ? Date.now() + exchanged.expiresIn * 1000 : 0,
          refreshExpiresAt: exchanged.refreshExpiresIn > 0 ? Date.now() + exchanged.refreshExpiresIn * 1000 : 0,
        }, env.TOKEN_ENCRYPTION_KEY);
        return back('linkedin=connected');
      } catch (err) {
        console.error('linkedin callback failed:', String(err));
        return back('linkedin=error');
      }
    }

    // ---- API(需通過 CORS 檢查)----
    if (!url.pathname.startsWith('/api/')) return json({ error: 'not_found' }, 404, cors);
    if (!checkCors(request, env)) return json({ error: 'forbidden_origin' }, 403);

    if (url.pathname === '/api/threads/status' && request.method === 'GET') {
      const installId = url.searchParams.get('install') ?? '';
      if (!INSTALL_ID_RE.test(installId)) return json({ error: 'invalid_install_id' }, 400, cors);
      const token = await loadThreadsToken(env.QUEUE, installId, env.TOKEN_ENCRYPTION_KEY);
      // 僅回報「是否已連線」,不揭露 token 內容
      return json({ connected: !!token }, 200, cors);
    }

    if (url.pathname === '/api/threads/publish' && request.method === 'POST') {
      const body = await readJsonBody(request);
      const installId = String(body.installId ?? '');
      const text = String(body.text ?? '');
      if (!INSTALL_ID_RE.test(installId)) return json({ error: 'invalid_install_id' }, 400, cors);
      if (!validateThreadsText(text).ok) return json({ error: 'invalid_text' }, 400, cors);
      const token = await loadThreadsToken(env.QUEUE, installId, env.TOKEN_ENCRYPTION_KEY);
      if (!token) return json({ error: 'not_connected' }, 404, cors);
      try {
        const outcome = await publishThreadsText({ userId: token.userId, text, accessToken: token.accessToken });
        return json(outcome, 200, cors);
      } catch (err) {
        return json({ error: 'publish_failed', detail: String(err).slice(0, 200) }, 502, cors);
      }
    }

    if (url.pathname === '/api/facebook/status' && request.method === 'GET') {
      const installId = url.searchParams.get('install') ?? '';
      if (!INSTALL_ID_RE.test(installId)) return json({ error: 'invalid_install_id' }, 400, cors);
      // 系統工作人員模式:token 由 worker secret 保管,全站直接可用(不經 per-install OAuth)
      if (facebookSystemUserMode(env)) {
        return json({ connected: true, pageName: null, mode: 'system' }, 200, cors);
      }
      const token = await loadFacebookToken(env.QUEUE, installId, env.TOKEN_ENCRYPTION_KEY);
      // 僅回報「是否已連線」與粉專名稱,不揭露 token 內容
      return json({ connected: !!token, pageName: token?.pageName ?? null, mode: 'oauth' }, 200, cors);
    }

    if (url.pathname === '/api/facebook/diag' && request.method === 'GET') {
      // 系統模式診斷(2026-10-02,排查 #200):回 token 實際權限與粉專存取任務。
      // 僅在被明確要求時用於維運排查;不揭露 token 本體。
      const installId = url.searchParams.get('install') ?? '';
      if (!INSTALL_ID_RE.test(installId)) return json({ error: 'invalid_install_id' }, 400, cors);
      if (!facebookSystemUserMode(env)) return json({ error: 'not_system_mode' }, 400, cors);
      try {
        const d = await facebookDiagnostics({ accessToken: env.FACEBOOK_PAGE_TOKEN as string });
        return json(d, 200, cors);
      } catch (err) {
        return json({ error: 'diag_failed', detail: String(err).slice(0, 300) }, 502, cors);
      }
    }

    if (url.pathname === '/api/facebook/publish' && request.method === 'POST') {
      const body = await readJsonBody(request);
      const installId = String(body.installId ?? '');
      const text = String(body.text ?? '');
      if (!INSTALL_ID_RE.test(installId)) return json({ error: 'invalid_install_id' }, 400, cors);
      if (!validateFacebookText(text).ok) return json({ error: 'invalid_text' }, 400, cors);
      let pageId: string;
      let accessToken: string;
      if (facebookSystemUserMode(env)) {
        pageId = env.FACEBOOK_PAGE_ID as string;
        accessToken = env.FACEBOOK_PAGE_TOKEN as string;
      } else {
        const token = await loadFacebookToken(env.QUEUE, installId, env.TOKEN_ENCRYPTION_KEY);
        if (!token) return json({ error: 'not_connected' }, 404, cors);
        pageId = token.pageId;
        accessToken = token.accessToken;
      }
      try {
        const outcome = await publishFacebookText({ pageId, text, accessToken });
        return json(outcome, 200, cors);
      } catch (err) {
        return json({ error: 'publish_failed', detail: String(err).slice(0, 200) }, 502, cors);
      }
    }

    if (url.pathname === '/api/schedule' && request.method === 'POST') {
      const body = await readJsonBody(request);
      const installId = String(body.installId ?? '');
      const text = String(body.text ?? '');
      const publishAt = Number(body.publishAt ?? 0);
      // platform:'threads'(預設,回溯相容既有前端)| 'facebook' | 'linkedin'
      const platform =
        body.platform === 'facebook' ? 'facebook' : body.platform === 'linkedin' ? 'linkedin' : 'threads';
      if (!INSTALL_ID_RE.test(installId)) return json({ error: 'invalid_install_id' }, 400, cors);
      const valid =
        platform === 'facebook'
          ? validateFacebookText(text)
          : platform === 'linkedin'
            ? validateLinkedInText(text)
            : validateThreadsText(text);
      if (!valid.ok) return json({ error: 'invalid_text' }, 400, cors);
      if (!Number.isFinite(publishAt) || publishAt <= Date.now() || publishAt > Date.now() + MAX_SCHEDULE_AHEAD_MS) {
        return json({ error: 'invalid_publish_at' }, 400, cors);
      }
      const item: QueueItem = {
        id: crypto.randomUUID(),
        installId,
        platform,
        text,
        publishAt,
        status: 'pending',
        attempts: 0,
      };
      await saveQueueItem(env.QUEUE, item);
      return json({ itemId: item.id }, 201, cors);
    }

    // ---- 文庫雲端備份(方案 A,2026-10-05;payload 為瀏覽器加密之密文,worker 不解析)----
    if (url.pathname === '/api/linkedin/status' && request.method === 'GET') {
      const installId = url.searchParams.get('install') ?? '';
      if (!INSTALL_ID_RE.test(installId)) return json({ error: 'invalid_install_id' }, 400, cors);
      const token = await loadLinkedInToken(env.QUEUE, installId, env.TOKEN_ENCRYPTION_KEY);
      // 僅回報「是否已連線」與會員名稱,不揭露 token 內容
      return json({ connected: !!token, memberName: token?.memberName ?? null }, 200, cors);
    }

    if (url.pathname === '/api/linkedin/publish' && request.method === 'POST') {
      const body = await readJsonBody(request);
      const installId = String(body.installId ?? '');
      const text = String(body.text ?? '');
      if (!INSTALL_ID_RE.test(installId)) return json({ error: 'invalid_install_id' }, 400, cors);
      if (!validateLinkedInText(text).ok) return json({ error: 'invalid_text' }, 400, cors);
      const token = await loadLinkedInToken(env.QUEUE, installId, env.TOKEN_ENCRYPTION_KEY);
      if (!token) return json({ error: 'not_connected' }, 404, cors);
      try {
        const outcome = await publishLinkedInText({
          memberId: token.memberId,
          text,
          accessToken: token.accessToken,
        });
        return json(outcome, 200, cors);
      } catch (err) {
        return json({ error: 'publish_failed', detail: String(err).slice(0, 200) }, 502, cors);
      }
    }

    if (url.pathname === '/api/library/save' && request.method === 'POST') {
      const body = await readJsonBody(request) as { codeId?: unknown; data?: unknown; iv?: unknown; savedAt?: unknown };
      const valid = validateSaveRequest(body);
      if (!valid.ok) return json({ error: valid.reason }, 400, cors);
      await saveLibraryBlob(env.QUEUE, body.codeId as string, valid.blob);
      return json({ savedAt: valid.blob.savedAt }, 201, cors);
    }

    if (url.pathname === '/api/library/load' && request.method === 'POST') {
      const body = await readJsonBody(request);
      if (!isValidCodeId(body.codeId)) return json({ error: 'invalid_code_id' }, 400, cors);
      const blob = await loadLibraryBlob(env.QUEUE, body.codeId);
      if (!blob) return json({ error: 'not_found' }, 404, cors);
      return json(blob, 200, cors);
    }

    if (url.pathname === '/api/queue' && request.method === 'GET') {
      const installId = url.searchParams.get('install') ?? '';
      if (!INSTALL_ID_RE.test(installId)) return json({ error: 'invalid_install_id' }, 400, cors);
      const items = await listQueueItems(env.QUEUE, `${QUEUE_PREFIX}${installId}:`);
      return json({ items }, 200, cors);
    }

    if (url.pathname === '/api/queue/cancel' && request.method === 'POST') {
      const body = await readJsonBody(request);
      const installId = String(body.installId ?? '');
      const itemId = String(body.itemId ?? '');
      if (!INSTALL_ID_RE.test(installId) || !itemId) return json({ error: 'invalid_request' }, 400, cors);
      const item = await loadQueueItem(env.QUEUE, installId, itemId);
      if (!item) return json({ error: 'not_found' }, 404, cors);
      if (item.status !== 'pending') return json({ error: 'not_pending' }, 409, cors);
      await saveQueueItem(env.QUEUE, { ...item, status: 'cancelled' });
      return json({ ok: true }, 200, cors);
    }

    return json({ error: 'not_found' }, 404, cors);
  },

  /** cron(每分鐘):掃描到期項目依 platform 代發;單項失敗不影響其他項目。 */
  async scheduled(_event: ScheduledEventLike, env: Env): Promise<void> {
    const now = Date.now();
    const items = await listQueueItems(env.QUEUE, QUEUE_PREFIX);
    const due = items.filter((i) => isDue(i, now));
    for (const item of due) {
      try {
        if (item.platform === 'facebook') {
          // FB page token 不隨時間過期(無刷新邏輯);系統工作人員模式用 worker secret,
          // OAuth 模式讀 KV——失效由發佈失敗的退避重試反映
          let pageId: string;
          let accessToken: string;
          if (facebookSystemUserMode(env)) {
            pageId = env.FACEBOOK_PAGE_ID as string;
            accessToken = env.FACEBOOK_PAGE_TOKEN as string;
          } else {
            const token = await loadFacebookToken(env.QUEUE, item.installId, env.TOKEN_ENCRYPTION_KEY);
            if (!token) {
              await saveQueueItem(env.QUEUE, applyFailure(item, 'not_connected', now));
              continue;
            }
            pageId = token.pageId;
            accessToken = token.accessToken;
          }
          const outcome = await publishFacebookText({ pageId, text: item.text, accessToken });
          await saveQueueItem(env.QUEUE, applySuccess(item, outcome.id));
          continue;
        }
        if (item.platform === 'linkedin') {
          const token = await loadLinkedInToken(env.QUEUE, item.installId, env.TOKEN_ENCRYPTION_KEY);
          if (!token) {
            await saveQueueItem(env.QUEUE, applyFailure(item, 'not_connected', now));
            continue;
          }
          let accessToken = token.accessToken;
          if (needsLinkedInRefresh(token, now)) {
            // 盡力刷新:程式化 refresh token 僅部分 App 有——無則沿用舊 token,失敗由退避反映
            const refreshed = await refreshLinkedInToken({ refreshToken: token.refreshToken });
            if (refreshed) {
              accessToken = refreshed.accessToken;
              await saveLinkedInToken(
                env.QUEUE,
                item.installId,
                {
                  ...token,
                  accessToken,
                  refreshToken: refreshed.refreshToken || token.refreshToken,
                  expiresAt: refreshed.expiresIn > 0 ? now + refreshed.expiresIn * 1000 : 0,
                  refreshExpiresAt: refreshed.refreshExpiresIn > 0 ? now + refreshed.refreshExpiresIn * 1000 : 0,
                },
                env.TOKEN_ENCRYPTION_KEY,
              );
            }
          }
          const outcome = await publishLinkedInText({
            memberId: token.memberId,
            text: item.text,
            accessToken,
          });
          await saveQueueItem(env.QUEUE, applySuccess(item, outcome.id));
          continue;
        }
        const token = await loadThreadsToken(env.QUEUE, item.installId, env.TOKEN_ENCRYPTION_KEY);
        if (!token) {
          await saveQueueItem(env.QUEUE, applyFailure(item, 'not_connected', now));
          continue;
        }
        let accessToken = token.accessToken;
        if (needsRefresh(token, now)) {
          const refreshed = await refreshToken({
            accessToken: token.accessToken,
          });
          accessToken = refreshed.accessToken;
          await saveThreadsToken(
            env.QUEUE,
            item.installId,
            { accessToken, userId: token.userId, expiresAt: refreshed.expiresIn > 0 ? now + refreshed.expiresIn * 1000 : 0 },
            env.TOKEN_ENCRYPTION_KEY,
          );
        }
        const outcome = await publishThreadsText({ userId: token.userId, text: item.text, accessToken });
        await saveQueueItem(env.QUEUE, applySuccess(item, outcome.id));
      } catch (err) {
        await saveQueueItem(env.QUEUE, applyFailure(item, String(err), now));
      }
    }
  },
};
