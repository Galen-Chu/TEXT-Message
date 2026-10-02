import { describe, expect, it } from 'vitest';
import {
  FACEBOOK_API_BASE,
  FACEBOOK_AUTHORIZE_URL,
  FACEBOOK_TOKEN_URL,
} from '../config';
import {
  buildFbAuthorizeUrl,
  exchangeCode,
  exchangeLongLivedUserToken,
  listFacebookPages,
} from './oauth';
import type { Fetcher } from '../threads/oauth';

describe('buildFbAuthorizeUrl(雙模式:商家版組態 config_id / 標準版 scope)', () => {
  const base = {
    clientId: 'app-123',
    redirectUri: 'https://worker.example.com/auth/facebook/callback',
    state: 'install-1.abc',
  };

  it('商家版:config_id 帶出,不帶 scope', () => {
    const url = new URL(buildFbAuthorizeUrl({ ...base, configId: 'cfg-987' }));
    expect(`${url.origin}${url.pathname}`).toBe(FACEBOOK_AUTHORIZE_URL);
    expect(url.searchParams.get('client_id')).toBe('app-123');
    expect(url.searchParams.get('redirect_uri')).toBe('https://worker.example.com/auth/facebook/callback');
    expect(url.searchParams.get('response_type')).toBe('code');
    expect(url.searchParams.get('config_id')).toBe('cfg-987');
    expect(url.searchParams.get('scope')).toBeNull();
    expect(url.searchParams.get('state')).toBe('install-1.abc');
  });

  it('標準版(未設組態):scope 帶出三個 pages 權限,不帶 config_id', () => {
    const url = new URL(buildFbAuthorizeUrl(base));
    expect(`${url.origin}${url.pathname}`).toBe(FACEBOOK_AUTHORIZE_URL);
    expect(url.searchParams.get('scope')).toBe('pages_show_list,pages_read_engagement,pages_manage_posts');
    expect(url.searchParams.get('config_id')).toBeNull();
    expect(url.searchParams.get('state')).toBe('install-1.abc');
  });
});

describe('exchangeCode(GET /oauth/access_token)', () => {
  it('完整請求形狀:GET、四個查詢參數逐一對照;回傳短效 token', async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    const fetcher: Fetcher = async (url, init) => {
      calls.push({ url: String(url), init });
      return new Response(JSON.stringify({ access_token: 'short-tok', token_type: 'bearer', expires_in: 5100 }), { status: 200 });
    };
    const r = await exchangeCode(
      { code: 'c1', clientId: 'app-123', clientSecret: 'sec', redirectUri: 'https://w.example/auth/facebook/callback' },
      fetcher,
    );
    expect(r).toEqual({ accessToken: 'short-tok' });
    expect(calls).toHaveLength(1);
    const u = new URL(calls[0].url);
    expect(`${u.origin}${u.pathname}`).toBe(FACEBOOK_TOKEN_URL);
    expect(calls[0].init?.method).toBeUndefined(); // GET:不帶 method 覆寫
    expect(u.searchParams.get('client_id')).toBe('app-123');
    expect(u.searchParams.get('client_secret')).toBe('sec');
    expect(u.searchParams.get('redirect_uri')).toBe('https://w.example/auth/facebook/callback');
    expect(u.searchParams.get('code')).toBe('c1');
  });

  it('非 JSON 或缺 access_token → 丟錯', async () => {
    const bad: Fetcher = async () => new Response('<html>', { status: 200 });
    await expect(exchangeCode({ code: 'c', clientId: 'a', clientSecret: 'b', redirectUri: 'r' }, bad)).rejects.toThrow();
    const noToken: Fetcher = async () => new Response('{}', { status: 200 });
    await expect(exchangeCode({ code: 'c', clientId: 'a', clientSecret: 'b', redirectUri: 'r' }, noToken)).rejects.toThrow();
  });
});

describe('exchangeLongLivedUserToken(grant_type=fb_exchange_token)', () => {
  it('完整請求形狀:grant_type/client_id/client_secret/fb_exchange_token', async () => {
    const calls: string[] = [];
    const fetcher: Fetcher = async (url) => {
      calls.push(String(url));
      return new Response(JSON.stringify({ access_token: 'long-tok', token_type: 'bearer', expires_in: 5184000 }), { status: 200 });
    };
    const r = await exchangeLongLivedUserToken({ accessToken: 'short-tok', clientId: 'app-123', clientSecret: 'sec' }, fetcher);
    expect(r).toEqual({ accessToken: 'long-tok', expiresIn: 5184000 });
    const u = new URL(calls[0]);
    expect(`${u.origin}${u.pathname}`).toBe(FACEBOOK_TOKEN_URL);
    expect(u.searchParams.get('grant_type')).toBe('fb_exchange_token');
    expect(u.searchParams.get('client_id')).toBe('app-123');
    expect(u.searchParams.get('client_secret')).toBe('sec');
    expect(u.searchParams.get('fb_exchange_token')).toBe('short-tok');
  });
});

describe('listFacebookPages(GET /me/accounts)', () => {
  it('完整請求形狀:fields=id,name,access_token + access_token 查詢參數', async () => {
    const calls: string[] = [];
    const fetcher: Fetcher = async (url) => {
      calls.push(String(url));
      return new Response(JSON.stringify({ data: [] }), { status: 200 });
    };
    await listFacebookPages({ userAccessToken: 'ut' }, fetcher);
    const u = new URL(calls[0]);
    expect(`${u.origin}${u.pathname}`).toBe(`${FACEBOOK_API_BASE}/me/accounts`);
    expect(u.searchParams.get('fields')).toBe('id,name,access_token');
    expect(u.searchParams.get('access_token')).toBe('ut');
  });

  it('page id 從原始文字抽取:JSON number 超 2^53 也不失真(串接紀律)', async () => {
    // 9007199254740993 = 2^53+1,JSON.parse 會四捨五入成 ...992
    const raw = '{"data":[{"id":9007199254740993,"name":"我的粉專","access_token":"PAT1"}],"paging":{}}';
    const fetcher: Fetcher = async () => new Response(raw, { status: 200 });
    const pages = await listFacebookPages({ userAccessToken: 'ut' }, fetcher);
    expect(pages).toEqual([{ pageId: '9007199254740993', pageName: '我的粉專', accessToken: 'PAT1' }]);
  });

  it('id 為 JSON 字串時直接採用;多粉專逐一解析', async () => {
    const raw = JSON.stringify({
      data: [
        { id: '61595163560239', name: '粉專A', access_token: 'PAT-A' },
        { id: '100234567890123', name: '粉專B', access_token: 'PAT-B' },
      ],
    });
    const fetcher: Fetcher = async () => new Response(raw, { status: 200 });
    const pages = await listFacebookPages({ userAccessToken: 'ut' }, fetcher);
    expect(pages).toHaveLength(2);
    expect(pages[0]).toEqual({ pageId: '61595163560239', pageName: '粉專A', accessToken: 'PAT-A' });
    expect(pages[1].pageId).toBe('100234567890123');
  });

  it('沒有粉專 → 空陣列;API 錯誤 → 丟錯', async () => {
    const empty: Fetcher = async () => new Response('{"data":[]}', { status: 200 });
    expect(await listFacebookPages({ userAccessToken: 'ut' }, empty)).toEqual([]);
    const err: Fetcher = async () =>
      new Response(JSON.stringify({ error: { message: 'bad' } }), { status: 400 });
    await expect(listFacebookPages({ userAccessToken: 'ut' }, err)).rejects.toThrow('me/accounts failed');
  });
});
