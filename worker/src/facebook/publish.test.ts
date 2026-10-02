import { describe, expect, it } from 'vitest';
import { FACEBOOK_API_BASE, FACEBOOK_TEXT_LIMIT } from '../config';
import { publishFacebookText, validateFacebookText } from './publish';
import type { Fetcher } from '../threads/oauth';

describe('validateFacebookText', () => {
  it('空白 → 不通過;超過上限 → 不通過', () => {
    expect(validateFacebookText('   ').ok).toBe(false);
    expect(validateFacebookText('x'.repeat(FACEBOOK_TEXT_LIMIT + 1)).ok).toBe(false);
    expect(validateFacebookText('hello').ok).toBe(true);
  });
});

describe('publishFacebookText(POST /{page-id}/feed)', () => {
  it('完整請求形狀:URL、POST、Bearer header;中文 message 以查詢字串百分號編碼送出(§6.1 #6)', async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    const fetcher: Fetcher = async (url, init) => {
      calls.push({ url: String(url), init });
      return new Response('{"id":"61595163560239_999888777"}', { status: 200 });
    };
    const r = await publishFacebookText(
      { pageId: '61595163560239', text: '早安,世界!\n第二行', accessToken: 'PAT-1' },
      fetcher,
    );
    expect(r).toEqual({ id: '61595163560239_999888777' });
    expect(calls).toHaveLength(1);
    const u = new URL(calls[0].url);
    expect(`${u.origin}${u.pathname}`).toBe(`${FACEBOOK_API_BASE}/61595163560239/feed`);
    expect(calls[0].init?.method).toBe('POST');
    expect((calls[0].init?.headers as Record<string, string>).Authorization).toBe('Bearer PAT-1');
    // message 僅出現在查詢字串(非 body),解碼後與原文一致
    expect(u.searchParams.get('message')).toBe('早安,世界!\n第二行');
    expect(calls[0].init?.body).toBeUndefined();
  });

  it('貼文 id 為字串時同樣抽取;缺 id → 丟錯', async () => {
    const ok: Fetcher = async () => new Response('{"id":"12345_67890"}', { status: 200 });
    expect(await publishFacebookText({ pageId: 'p', text: 't', accessToken: 'a' }, ok)).toEqual({ id: '12345_67890' });
    const missing: Fetcher = async () => new Response('{}', { status: 200 });
    await expect(
      publishFacebookText({ pageId: 'p', text: 't', accessToken: 'a' }, missing),
    ).rejects.toThrow('missing id');
  });

  it('API 錯誤回應 → 丟錯(附回應摘錄);空白文字 → 驗證先行丟錯', async () => {
    const err: Fetcher = async () =>
      new Response(JSON.stringify({ error: { message: 'insufficient permissions' } }), { status: 403 });
    await expect(
      publishFacebookText({ pageId: 'p', text: 't', accessToken: 'a' }, err),
    ).rejects.toThrow('feed failed');
    const noop: Fetcher = async () => {
      throw new Error('should not be called');
    };
    await expect(
      publishFacebookText({ pageId: 'p', text: '  ', accessToken: 'a' }, noop),
    ).rejects.toThrow('empty');
  });
});
