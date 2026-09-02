/**
 * Threads OAuth(純邏輯部分,可注入 fetcher 測試):
 * - authorize URL 組裝(注意:Threads 對 redirect_uri 的 host 有額外限制,
 *   部署前須在 Meta App 後台確認可用的 callback host,見 docs/BACKEND.md)
 * - code → 短效 token → 長效 token(60 天)交換
 * - 長效 token 刷新
 */
import { THREADS_AUTHORIZE_URL, THREADS_TOKEN_URL, TOKEN_REFRESH_LEAD_MS } from '../config';

export type Fetcher = (url: string, init?: RequestInit) => Promise<Response>;

export const THREADS_SCOPES = ['threads_basic', 'threads_content_publish'];

export interface ThreadsToken {
  accessToken: string;
  userId: string;
  /** 長效 token 到期時間(ms epoch;0 = 未知,保守視為需要刷新)。 */
  expiresAt: number;
}

export function buildAuthorizeUrl(opts: {
  clientId: string;
  redirectUri: string;
  state: string;
}): string {
  const params = new URLSearchParams({
    client_id: opts.clientId,
    redirect_uri: opts.redirectUri,
    response_type: 'code',
    scope: THREADS_SCOPES.join(','),
    state: opts.state,
  });
  return `${THREADS_AUTHORIZE_URL}?${params.toString()}`;
}

/** state = `<installId>.<hmac>`:callback 端驗證簽章防竄改。 */
export function serializeState(installId: string, hmac: string): string {
  return `${installId}.${hmac}`;
}

export function parseState(
  state: string,
  expectedHmac: string,
): { ok: true; installId: string } | { ok: false } {
  const dot = state.lastIndexOf('.');
  if (dot <= 0) return { ok: false };
  const installId = state.slice(0, dot);
  const hmac = state.slice(dot + 1);
  // 長度與常數時間比較(hmac 均 hex,先比長度再逐位元 XOR 累積)
  if (hmac.length !== expectedHmac.length) return { ok: false };
  let diff = 0;
  for (let i = 0; i < hmac.length; i++) diff |= hmac.charCodeAt(i) ^ expectedHmac.charCodeAt(i);
  return diff === 0 && installId.length > 0 ? { ok: true, installId } : { ok: false };
}

function formUrlencoded(body: Record<string, string>): string {
  return new URLSearchParams(body).toString();
}

async function readJson(resp: Response): Promise<Record<string, unknown>> {
  const text = await resp.text();
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    throw new Error(`threads oauth non-json response: ${text.slice(0, 200)}`);
  }
}

/** code → 短效 access token + user id。 */
export async function exchangeCode(
  opts: { code: string; clientId: string; clientSecret: string; redirectUri: string },
  fetcher: Fetcher = fetch,
): Promise<{ accessToken: string; userId: string }> {
  const resp = await fetcher(THREADS_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: formUrlencoded({
      client_id: opts.clientId,
      clientSecret: opts.clientSecret,
      grant_type: 'authorization_code',
      redirect_uri: opts.redirectUri,
      code: opts.code,
    }),
  });
  const data = await readJson(resp);
  if (!resp.ok) {
    throw new Error(`threads code exchange failed: ${JSON.stringify(data).slice(0, 200)}`);
  }
  const userId = data.user_id as string | undefined;
  if (typeof data.access_token !== 'string' || !userId) {
    throw new Error('threads code exchange: missing access_token/user_id');
  }
  return { accessToken: data.access_token, userId };
}

/** 短效 → 長效 token(約 60 天)。 */
export async function exchangeLongLived(
  opts: { accessToken: string; clientSecret: string },
  fetcher: Fetcher = fetch,
): Promise<{ accessToken: string; expiresIn: number }> {
  const params = new URLSearchParams({
    grant_type: 'th_exchange_token',
    client_secret: opts.clientSecret,
    access_token: opts.accessToken,
  });
  const resp = await fetcher(`${THREADS_TOKEN_URL}?${params.toString()}`);
  const data = await readJson(resp);
  if (!resp.ok || typeof data.access_token !== 'string') {
    throw new Error(`threads long-lived exchange failed: ${JSON.stringify(data).slice(0, 200)}`);
  }
  return { accessToken: data.access_token, expiresIn: Number(data.expires_in ?? 0) };
}

/** 刷新長效 token(回新的 60 天 token)。 */
export async function refreshToken(
  opts: { accessToken: string; clientSecret: string },
  fetcher: Fetcher = fetch,
): Promise<{ accessToken: string; expiresIn: number }> {
  const resp = await fetcher(THREADS_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: formUrlencoded({
      grant_type: 'th_refresh_token',
      clientSecret: opts.clientSecret,
      access_token: opts.accessToken,
    }),
  });
  const data = await readJson(resp);
  if (!resp.ok || typeof data.access_token !== 'string') {
    throw new Error(`threads token refresh failed: ${JSON.stringify(data).slice(0, 200)}`);
  }
  return { accessToken: data.access_token, expiresIn: Number(data.expires_in ?? 0) };
}

/** token 是否應刷新(到期前 7 天內,或到期時間未知)。 */
export function needsRefresh(token: ThreadsToken, now = Date.now()): boolean {
  return token.expiresAt === 0 || token.expiresAt - now < TOKEN_REFRESH_LEAD_MS;
}
