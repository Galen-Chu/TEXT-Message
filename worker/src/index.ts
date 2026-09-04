/**
 * text-message-worker:平台代發後端(階段三,Cloudflare Workers + KV)。
 * 職責嚴格限定(資料邊界紅線):Threads OAuth 代管、token 加密保存、代發文、排程 cron。
 * 不接收 emails、AI key 或任何其他前端資料。
 *
 * 路由:
 *   GET  /health
 *   GET  /auth/threads/start?install=<id>          → 302 至 Threads 授權頁
 *   GET  /auth/threads/callback?code&state         → 交換並加密保存 token,302 回前端
 *   POST /api/threads/publish   {installId, text}           → 立即代發
 *   POST /api/schedule          {installId, text, publishAt} → 加入排程佇列
 *   GET  /api/queue?install=<id>                            → 檢視佇列
 *   POST /api/queue/cancel      {installId, itemId}          → 取消排程
 * cron(每分鐘):掃描到期項目並代發,失敗指數退避重試(上限 3 次)。
 */
import type { Env } from './config';
import { isDue, applyFailure, applySuccess, QUEUE_PREFIX, type QueueItem } from './queue/due';
import { hmacHex } from './store/crypto';
import {
  listQueueItems,
  loadQueueItem,
  loadThreadsToken,
  saveQueueItem,
  saveThreadsToken,
} from './store/kv';
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

function callbackUrl(request: Request): string {
  return `${new URL(request.url).origin}/auth/threads/callback`;
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
        redirectUri: callbackUrl(request),
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
          redirectUri: callbackUrl(request),
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

    if (url.pathname === '/api/schedule' && request.method === 'POST') {
      const body = await readJsonBody(request);
      const installId = String(body.installId ?? '');
      const text = String(body.text ?? '');
      const publishAt = Number(body.publishAt ?? 0);
      if (!INSTALL_ID_RE.test(installId)) return json({ error: 'invalid_install_id' }, 400, cors);
      if (!validateThreadsText(text).ok) return json({ error: 'invalid_text' }, 400, cors);
      if (!Number.isFinite(publishAt) || publishAt <= Date.now() || publishAt > Date.now() + MAX_SCHEDULE_AHEAD_MS) {
        return json({ error: 'invalid_publish_at' }, 400, cors);
      }
      const item: QueueItem = {
        id: crypto.randomUUID(),
        installId,
        platform: 'threads',
        text,
        publishAt,
        status: 'pending',
        attempts: 0,
      };
      await saveQueueItem(env.QUEUE, item);
      return json({ itemId: item.id }, 201, cors);
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

  /** cron(每分鐘):掃描到期項目代發;單項失敗不影響其他項目。 */
  async scheduled(_event: ScheduledEventLike, env: Env): Promise<void> {
    const now = Date.now();
    const items = await listQueueItems(env.QUEUE, QUEUE_PREFIX);
    const due = items.filter((i) => isDue(i, now));
    for (const item of due) {
      try {
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
