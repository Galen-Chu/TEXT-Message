import { describe, expect, it } from 'vitest';
import {
  LINKEDIN_API_BASE,
  LINKEDIN_AUTHORIZE_URL,
  LINKEDIN_TOKEN_URL,
} from '../config';
import {
  buildLinkedInAuthorizeUrl,
  exchangeLinkedInCode,
  fetchLinkedInMember,
  needsLinkedInRefresh,
  refreshLinkedInToken,
} from './oauth';
import type { Fetcher } from '../threads/oauth';

describe('buildLinkedInAuthorizeUrl(2026-10-07 官方文件形狀)', () => {
  it('完整參數:response_type/client_id/redirect_uri/state/scope(空格分隔)', () => {
    const url = new URL(
      buildLinkedInAuthorizeUrl({
        clientId: 'li-app-1',
        redirectUri: 'https://worker.example.com/auth/linkedin/callback',
        state: 'install-1.abc',
      }),
    );
    expect(`${url.origin}${url.pathname}`).toBe(LINKEDIN_AUTHORIZE_URL);
    expect(url.searchParams.get('response_type')).toBe('code');
    expect(url.searchParams.get('client_id')).toBe('li-app-1');
    expect(url.searchParams.get('redirect_uri')).toBe('https://worker.example.com/auth/linkedin/callback');
    // 空格分隔(編碼為 + 或 %20 皆為官方規格的 URL 編碼形式);openid 必須搭配
    // profile/email 之一(LinkedIn 授權頁的隱藏規則,2026-10-08 探針實證)
    expect(url.searchParams.get('scope')?.split(/[+\s%20]+/)).toEqual(['openid', 'profile', 'w_member_social']);
    expect(url.searchParams.get('state')).toBe('install-1.abc');
  });
});

describe('exchangeLinkedInCode(POST /oauth/v2/accessToken,x-www-form-urlencoded)', () => {
  it('完整請求形狀與回應解析(60 天 token+選配 refresh)', async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    const fetcher: Fetcher = async (url, init) => {
      calls.push({ url: String(url), init });
      return new Response(
        JSON.stringify({
          access_token: 'li-at',
          expires_in: 5184000,
          refresh_token: 'li-rt',
          refresh_token_expires_in: 31536000,
        }),
        { status: 200 },
      );
    };
    const r = await exchangeLinkedInCode(
      { code: 'c1', clientId: 'li-app-1', clientSecret: 'sec', redirectUri: 'https://w.example/auth/linkedin/callback' },
      fetcher,
    );
    expect(r).toEqual({
      accessToken: 'li-at',
      refreshToken: 'li-rt',
      expiresIn: 5184000,
      refreshExpiresIn: 31536000,
    });
    expect(calls[0].url).toBe(LINKEDIN_TOKEN_URL);
    expect(calls[0].init?.method).toBe('POST');
    expect((calls[0].init?.headers as Record<string, string>)['Content-Type']).toBe('application/x-www-form-urlencoded');
    const body = new URLSearchParams(String(calls[0].init?.body));
    expect(body.get('grant_type')).toBe('authorization_code');
    expect(body.get('code')).toBe('c1');
    expect(body.get('client_id')).toBe('li-app-1');
    expect(body.get('client_secret')).toBe('sec');
    expect(body.get('redirect_uri')).toBe('https://w.example/auth/linkedin/callback');
  });

  it('無 refresh_token 欄位 → refreshToken 為空字串(不丟錯;非夥伴 App 的官方行為)', async () => {
    const fetcher: Fetcher = async () =>
      new Response(JSON.stringify({ access_token: 'li-at', expires_in: 5184000 }), { status: 200 });
    const r = await exchangeLinkedInCode(
      { code: 'c', clientId: 'a', clientSecret: 'b', redirectUri: 'r' },
      fetcher,
    );
    expect(r.refreshToken).toBe('');
  });

  it('API 錯誤 → 丟錯(附回應摘錄)', async () => {
    const fetcher: Fetcher = async () =>
      new Response(JSON.stringify({ error: 'invalid_request', error_description: 'bad code' }), { status: 401 });
    await expect(
      exchangeLinkedInCode({ code: 'x', clientId: 'a', clientSecret: 'b', redirectUri: 'r' }, fetcher),
    ).rejects.toThrow('code exchange failed');
  });
});

describe('refreshLinkedInToken(僅在有 refresh token 時嘗試)', () => {
  it('無 refresh token → null(不發請求)', async () => {
    const fetcher: Fetcher = async () => {
      throw new Error('should not be called');
    };
    expect(await refreshLinkedInToken({ refreshToken: '' }, fetcher)).toBeNull();
  });

  it('有 refresh token → grant_type=refresh_token;失敗丟錯', async () => {
    const calls: string[] = [];
    const fetcher: Fetcher = async (url, init) => {
      calls.push(String(url));
      const body = new URLSearchParams(String(init?.body));
      expect(body.get('grant_type')).toBe('refresh_token');
      expect(body.get('refresh_token')).toBe('li-rt');
      return new Response(JSON.stringify({ access_token: 'li-at-2', expires_in: 5184000 }), { status: 200 });
    };
    const r = await refreshLinkedInToken({ refreshToken: 'li-rt' }, fetcher);
    expect(r?.accessToken).toBe('li-at-2');
    expect(calls[0]).toBe(LINKEDIN_TOKEN_URL);
  });
});

describe('fetchLinkedInMember(GET /v2/userinfo,openid)', () => {
  it('完整請求形狀;sub=memberId、name=顯示名', async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    const fetcher: Fetcher = async (url, init) => {
      calls.push({ url: String(url), init });
      return new Response(JSON.stringify({ sub: 'abc123', name: 'Galen Chu' }), { status: 200 });
    };
    const m = await fetchLinkedInMember({ accessToken: 'li-at' }, fetcher);
    expect(m).toEqual({ memberId: 'abc123', memberName: 'Galen Chu' });
    expect(calls[0].url).toBe(`${LINKEDIN_API_BASE}/v2/userinfo`);
    expect((calls[0].init?.headers as Record<string, string>).Authorization).toBe('Bearer li-at');
  });

  it('缺 sub → 丟錯', async () => {
    const fetcher: Fetcher = async () => new Response(JSON.stringify({ name: 'x' }), { status: 200 });
    await expect(fetchLinkedInMember({ accessToken: 't' }, fetcher)).rejects.toThrow('missing sub');
  });
});

describe('needsLinkedInRefresh', () => {
  it('到期前 7 天內或未知(0)→ true', () => {
    const now = 1700000000000;
    expect(needsLinkedInRefresh({ expiresAt: 0 } as never, now)).toBe(true);
    expect(needsLinkedInRefresh({ expiresAt: now + 3 * 24 * 3600 * 1000 } as never, now)).toBe(true);
    expect(needsLinkedInRefresh({ expiresAt: now + 30 * 24 * 3600 * 1000 } as never, now)).toBe(false);
  });
});
