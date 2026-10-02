/**
 * Facebook Pages OAuth(純邏輯,可注入 fetcher 測試;鏡像 threads/oauth.ts):
 * - authorize URL 組裝(Facebook Login for Web 手動流程,GET /dialog/oauth)
 * - code → 短效 user token(GET /oauth/access_token)→ 長效 user token(約 60 天)
 * - GET /me/accounts 取使用者管理的粉專(各頁附 page access token)
 * 文件(2026-09-30 查證):https://developers.facebook.com/docs/facebook-login/guides/advanced/manual-flow
 */
import {
  FACEBOOK_API_BASE,
  FACEBOOK_AUTHORIZE_URL,
  FACEBOOK_TOKEN_URL,
} from '../config';
import type { Fetcher } from '../threads/oauth';

export { serializeState, parseState } from '../threads/oauth';

/**
 * Pages API 發文所需權限(後台建立「組態」時勾選這三項;開發模式下 app 角色帳號即可自用)。
 * 注意:授權網址不以 scope 帶出——本 App 僅有 Facebook Login for Business,
 * 權限綁在組態上,dialog 以 config_id 選組態(2026-09-30 查證+實測)。
 */
export const FACEBOOK_SCOPES = [
  'pages_show_list',
  'pages_read_engagement',
  'pages_manage_posts',
];

/**
 * 代管的粉專發佈憑證:page access token(由長效 user token 經 /me/accounts 取得,
 * 每個「粉專×使用者×app」組合各一枚)。Meta 未保證其效期,實務上通常不隨時間過期;
 * 失效(改密碼/收回權限)時重新授權即可,故不做刷新邏輯。
 */
export interface FacebookToken {
  pageId: string;
  pageName: string;
  accessToken: string;
}

export function buildFbAuthorizeUrl(opts: {
  clientId: string;
  redirectUri: string;
  state: string;
  /** 商家版組態 id:有設 → dialog 以 config_id 選組態;未設(標準版 Facebook Login)→ 以 scope 帶權限。 */
  configId?: string;
}): string {
  const params = new URLSearchParams({
    client_id: opts.clientId,
    redirect_uri: opts.redirectUri,
    response_type: 'code',
    ...(opts.configId
      ? { config_id: opts.configId }
      : { scope: FACEBOOK_SCOPES.join(',') }),
    state: opts.state,
  });
  return `${FACEBOOK_AUTHORIZE_URL}?${params.toString()}`;
}

async function getJson(
  url: string,
  fetcher: Fetcher,
  label: string,
): Promise<{ resp: Response; text: string; data: Record<string, unknown> }> {
  const resp = await fetcher(url);
  const text = await resp.text();
  let data: Record<string, unknown>;
  try {
    data = JSON.parse(text) as Record<string, unknown>;
  } catch {
    throw new Error(`facebook ${label} non-json response: ${text.slice(0, 200)}`);
  }
  if (!resp.ok) {
    throw new Error(`facebook ${label} failed: ${JSON.stringify(data).slice(0, 200)}`);
  }
  return { resp, text, data };
}

/** code → 短效 user access token(GET;回 {access_token, token_type, expires_in})。 */
export async function exchangeCode(
  opts: { code: string; clientId: string; clientSecret: string; redirectUri: string },
  fetcher: Fetcher = fetch,
): Promise<{ accessToken: string }> {
  const params = new URLSearchParams({
    client_id: opts.clientId,
    redirect_uri: opts.redirectUri,
    client_secret: opts.clientSecret,
    code: opts.code,
  });
  const { data } = await getJson(`${FACEBOOK_TOKEN_URL}?${params.toString()}`, fetcher, 'code exchange');
  if (typeof data.access_token !== 'string') {
    throw new Error('facebook code exchange: missing access_token');
  }
  return { accessToken: data.access_token };
}

/** 短效 user token → 長效(約 60 天;grant_type=fb_exchange_token,同 /oauth/access_token 端點)。 */
export async function exchangeLongLivedUserToken(
  opts: { accessToken: string; clientId: string; clientSecret: string },
  fetcher: Fetcher = fetch,
): Promise<{ accessToken: string; expiresIn: number }> {
  const params = new URLSearchParams({
    grant_type: 'fb_exchange_token',
    client_id: opts.clientId,
    client_secret: opts.clientSecret,
    fb_exchange_token: opts.accessToken,
  });
  const { data } = await getJson(`${FACEBOOK_TOKEN_URL}?${params.toString()}`, fetcher, 'long-lived exchange');
  if (typeof data.access_token !== 'string') {
    throw new Error('facebook long-lived exchange: missing access_token');
  }
  return { accessToken: data.access_token, expiresIn: Number(data.expires_in ?? 0) };
}

/**
 * 使用者管理的粉專清單(fields=id,name,access_token)。
 * page id 依串接紀律從原始回應文字抽取(可能超 JS 安全整數;BACKEND.md §6)——
 * 以每頁唯一的 access_token 錨定,向前找同一物件內的 "id";抽取失敗僅接受
 * 「JSON 即為字串」的 id,絕不 String(數字)。
 */
export async function listFacebookPages(
  opts: { userAccessToken: string },
  fetcher: Fetcher = fetch,
): Promise<FacebookToken[]> {
  const params = new URLSearchParams({
    fields: 'id,name,access_token',
    access_token: opts.userAccessToken,
  });
  const { text, data } = await getJson(
    `${FACEBOOK_API_BASE}/me/accounts?${params.toString()}`,
    fetcher,
    'me/accounts',
  );
  const items = Array.isArray(data.data) ? (data.data as Array<Record<string, unknown>>) : [];
  const pages: FacebookToken[] = [];
  for (const item of items) {
    if (typeof item.access_token !== 'string' || typeof item.name !== 'string') continue;
    // 以此頁唯一的 access_token 在原始文字中的位置為錨,向前找「最近的 id」=同一物件內的 id
    // (fields=id,name,access_token 的物件形狀;JSON 字串內的引號皆為 \" 轉義,不會假匹配)
    const anchor = text.indexOf(`"access_token":"${item.access_token}"`);
    let pageId: string | null = null;
    if (anchor > 0) {
      const ids = [...text.slice(0, anchor).matchAll(/"id"\s*:\s*"?(\d+)"?/g)];
      pageId = ids.length ? (ids[ids.length - 1][1] as string) : null;
    }
    if (!pageId) pageId = typeof item.id === 'string' && /^\d+$/.test(item.id) ? item.id : null;
    if (!pageId) continue;
    pages.push({ pageId, pageName: item.name, accessToken: item.access_token });
  }
  return pages;
}
