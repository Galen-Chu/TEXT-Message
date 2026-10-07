/**
 * LinkedIn OAuth(純邏輯,可注入 fetcher 測試;2026-10-07 依當下官方文件實作):
 * - authorize:GET /oauth/v2/authorization(scope 以「空格」分隔、URL 編碼)
 * - code 交換:POST /oauth/v2/accessToken(x-www-form-urlencoded;回 60 天 access token
 *   與可有可無的 refresh token——程式化 refresh token 僅限合作夥伴,故 refresh 為盡力而為)
 * - member id:GET /v2/userinfo(openid scope)→ {sub,name},sub 即 urn:li:person:{id} 的 id
 * 文件:https://learn.microsoft.com/en-us/linkedin/shared/authentication/authorization-code-flow
 */
import { LINKEDIN_API_BASE, LINKEDIN_AUTHORIZE_URL, LINKEDIN_TOKEN_URL } from '../config';
import type { Fetcher } from '../threads/oauth';

export { serializeState, parseState } from '../threads/oauth';

/** 個人檔案發文所需權限(openid 取 member id;w_member_social 發文)。 */
export const LINKEDIN_SCOPES = ['openid', 'w_member_social'];

export interface LinkedInToken {
  accessToken: string;
  /** urn:li:person:{memberId} 的 memberId(/v2/userinfo 的 sub)。 */
  memberId: string;
  memberName: string;
  /** 程式化 refresh token(可有可無——無則到期由使用者重新授權,LinkedIn 官方行為)。 */
  refreshToken: string;
  /** access token 到期時間(ms epoch;0 = 未知,保守視為需要刷新)。 */
  expiresAt: number;
  refreshExpiresAt: number;
}

export function buildLinkedInAuthorizeUrl(opts: {
  clientId: string;
  redirectUri: string;
  state: string;
}): string {
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: opts.clientId,
    redirect_uri: opts.redirectUri,
    state: opts.state,
    // LinkedIn 的 scope 以空格分隔(URLSearchParams 會將空格編碼為 +,官方規格為 URL 編碼,相容)
    scope: LINKEDIN_SCOPES.join(' '),
  });
  return `${LINKEDIN_AUTHORIZE_URL}?${params.toString()}`;
}

function formUrlencoded(body: Record<string, string>): string {
  return new URLSearchParams(body).toString();
}

async function postForm(
  url: string,
  body: Record<string, string>,
  fetcher: Fetcher,
  label: string,
): Promise<{ resp: Response; text: string; data: Record<string, unknown> }> {
  const resp = await fetcher(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: formUrlencoded(body),
  });
  const text = await resp.text();
  let data: Record<string, unknown>;
  try {
    data = JSON.parse(text) as Record<string, unknown>;
  } catch {
    throw new Error(`linkedin ${label} non-json response: ${text.slice(0, 200)}`);
  }
  if (!resp.ok) {
    throw new Error(`linkedin ${label} failed: ${JSON.stringify(data).slice(0, 200)}`);
  }
  return { resp, text, data };
}

/** code → access token(60 天;refresh_token 為選配欄位,存在即一併保管)。 */
export async function exchangeLinkedInCode(
  opts: { code: string; clientId: string; clientSecret: string; redirectUri: string },
  fetcher: Fetcher = fetch,
): Promise<{ accessToken: string; refreshToken: string; expiresIn: number; refreshExpiresIn: number }> {
  const { data } = await postForm(
    LINKEDIN_TOKEN_URL,
    {
      grant_type: 'authorization_code',
      code: opts.code,
      client_id: opts.clientId,
      client_secret: opts.clientSecret,
      redirect_uri: opts.redirectUri,
    },
    fetcher,
    'code exchange',
  );
  if (typeof data.access_token !== 'string') {
    throw new Error('linkedin code exchange: missing access_token');
  }
  return {
    accessToken: data.access_token,
    refreshToken: typeof data.refresh_token === 'string' ? data.refresh_token : '',
    expiresIn: Number(data.expires_in ?? 0),
    refreshExpiresIn: Number(data.refresh_token_expires_in ?? 0),
  };
}

/** 盡力刷新(僅合作夥伴 App 有程式化 refresh token;無則回 null,呼叫端導向重新授權)。 */
export async function refreshLinkedInToken(
  opts: { refreshToken: string },
  fetcher: Fetcher = fetch,
): Promise<{ accessToken: string; refreshToken: string; expiresIn: number; refreshExpiresIn: number } | null> {
  if (!opts.refreshToken) return null;
  const { data } = await postForm(
    LINKEDIN_TOKEN_URL,
    {
      grant_type: 'refresh_token',
      refresh_token: opts.refreshToken,
    },
    fetcher,
    'token refresh',
  );
  if (typeof data.access_token !== 'string') return null;
  return {
    accessToken: data.access_token,
    refreshToken: typeof data.refresh_token === 'string' ? data.refresh_token : opts.refreshToken,
    expiresIn: Number(data.expires_in ?? 0),
    refreshExpiresIn: Number(data.refresh_token_expires_in ?? 0),
  };
}

/** member 識別:GET /v2/userinfo(openid)→ {sub,name};sub 即 author URN 的 id。 */
export async function fetchLinkedInMember(
  opts: { accessToken: string },
  fetcher: Fetcher = fetch,
): Promise<{ memberId: string; memberName: string }> {
  const resp = await fetcher(`${LINKEDIN_API_BASE}/v2/userinfo`, {
    headers: { Authorization: `Bearer ${opts.accessToken}` },
  });
  const text = await resp.text();
  let data: Record<string, unknown>;
  try {
    data = JSON.parse(text) as Record<string, unknown>;
  } catch {
    throw new Error(`linkedin userinfo non-json response: ${text.slice(0, 200)}`);
  }
  if (!resp.ok) {
    throw new Error(`linkedin userinfo failed: ${JSON.stringify(data).slice(0, 200)}`);
  }
  if (typeof data.sub !== 'string') {
    throw new Error('linkedin userinfo: missing sub');
  }
  return { memberId: data.sub, memberName: typeof data.name === 'string' ? data.name : '' };
}

/** token 是否應刷新(到期前 7 天內,或到期時間未知)。 */
export function needsLinkedInRefresh(token: LinkedInToken, now = Date.now()): boolean {
  return token.expiresAt === 0 || token.expiresAt - now < 7 * 24 * 60 * 60 * 1000;
}
