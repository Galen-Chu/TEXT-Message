import { describe, expect, it } from 'vitest';
import { hmacHex } from '../store/crypto';
import {
  buildAuthorizeUrl,
  exchangeCode,
  exchangeLongLived,
  needsRefresh,
  parseState,
  refreshToken,
  serializeState,
  type Fetcher,
} from './oauth';

function jsonResponse(data: unknown, ok = true): Response {
  return new Response(JSON.stringify(data), { status: ok ? 200 : 400 });
}

describe('authorize URL 與 state', () => {
  it('URL 含 client_id、redirect_uri、scope 與 state', () => {
    const url = new URL(
      buildAuthorizeUrl({
        clientId: 'cid',
        redirectUri: 'https://worker.example/auth/threads/callback',
        state: 'install-1.abc',
      }),
    );
    expect(url.origin + url.pathname).toBe('https://threads.net/oauth/authorize');
    expect(url.searchParams.get('client_id')).toBe('cid');
    expect(url.searchParams.get('response_type')).toBe('code');
    expect(url.searchParams.get('scope')).toBe('threads_basic,threads_content_publish');
    expect(url.searchParams.get('state')).toBe('install-1.abc');
  });

  it('state 驗證:正確簽章通過,竄改/缺簽拒絕', async () => {
    const installId = 'install-12345678';
    const sig = await hmacHex(installId, 'ab'.repeat(32));
    const state = serializeState(installId, sig);
    expect(parseState(state, sig)).toEqual({ ok: true, installId });
    expect(parseState(state, await hmacHex('other', 'ab'.repeat(32)))).toEqual({ ok: false });
    expect(parseState('no-dot-here', sig)).toEqual({ ok: false });
    // 換掉 installId 但沿用別人的簽章 → 拒絕(worker 以「從 state 解出的 installId」重算簽章比對)
    expect(parseState(`evil.${sig}`, await hmacHex('evil', 'ab'.repeat(32)))).toEqual({ ok: false });
  });
});

describe('token 交換(fetcher 注入)', () => {
  it('exchangeCode 組出正確請求並解析回應', async () => {
    let captured = { url: '', body: '' };
    const fetcher: Fetcher = async (url, init) => {
      captured = { url: String(url), body: String(init?.body ?? '') };
      return jsonResponse({ access_token: 'short', user_id: 'u1', token_type: 'bearer' });
    };
    const out = await exchangeCode(
      { code: 'c1', clientId: 'cid', clientSecret: 'cs', redirectUri: 'https://cb' },
      fetcher,
    );
    expect(out).toEqual({ accessToken: 'short', userId: 'u1' });
    expect(captured.url).toBe('https://graph.threads.net/oauth/access_token');
    expect(captured.body).toContain('grant_type=authorization_code');
    expect(captured.body).toContain('code=c1');
  });

  it('exchangeCode 失敗(非 JSON / 非 2xx / 缺欄位)都轉為錯誤', async () => {
    const badStatus: Fetcher = async () => jsonResponse({ error: 'x' }, false);
    await expect(
      exchangeCode({ code: 'c', clientId: 'i', clientSecret: 's', redirectUri: 'r' }, badStatus),
    ).rejects.toThrow('code exchange failed');
    const missing: Fetcher = async () => jsonResponse({ access_token: 't' });
    await expect(
      exchangeCode({ code: 'c', clientId: 'i', clientSecret: 's', redirectUri: 'r' }, missing),
    ).rejects.toThrow('missing access_token/user_id');
  });

  it('exchangeLongLived / refreshToken 解析新 token 與效期', async () => {
    const fetcher: Fetcher = async () =>
      jsonResponse({ access_token: 'long', token_type: 'bearer', expires_in: 5184000 });
    const long = await exchangeLongLived({ accessToken: 's', clientSecret: 'cs' }, fetcher);
    expect(long).toEqual({ accessToken: 'long', expiresIn: 5184000 });
    const refreshed = await refreshToken({ accessToken: 'long', clientSecret: 'cs' }, fetcher);
    expect(refreshed.accessToken).toBe('long');
  });
});

describe('needsRefresh', () => {
  const DAY = 24 * 60 * 60 * 1000;
  it('到期時間未知或 7 天內到期 → 需要;更遠 → 不需要', () => {
    const now = 1_000_000_000;
    expect(needsRefresh({ accessToken: 't', userId: 'u', expiresAt: 0 }, now)).toBe(true);
    expect(needsRefresh({ accessToken: 't', userId: 'u', expiresAt: now + 6 * DAY }, now)).toBe(true);
    expect(needsRefresh({ accessToken: 't', userId: 'u', expiresAt: now + 8 * DAY }, now)).toBe(false);
  });
});
