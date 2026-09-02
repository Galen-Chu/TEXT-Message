import { describe, expect, it } from 'vitest';
import { createTextContainer, publishContainer, publishThreadsText, validateThreadsText, type PublishOutcome } from './publish';
import type { Fetcher } from './oauth';

describe('validateThreadsText', () => {
  it('空白或超過 500 字元拒絕', () => {
    expect(validateThreadsText('  ')).toEqual({ ok: false, reason: 'text is empty' });
    expect(validateThreadsText('a'.repeat(501)).ok).toBe(false);
    expect(validateThreadsText('哈'.repeat(501)).ok).toBe(false);
  });

  it('合法文字通過(500 字元界線,以 code point 計)', () => {
    expect(validateThreadsText('hello').ok).toBe(true);
    expect(validateThreadsText('a'.repeat(500)).ok).toBe(true);
  });
});

describe('container 發佈流程(fetcher 注入)', () => {
  it('createTextContainer → publishContainer 兩步,參數與端點正確', async () => {
    const calls: Array<{ url: string; params: URLSearchParams; auth: string }> = [];
    const fetcher: Fetcher = async (url, init) => {
      const headers = (init?.headers ?? {}) as Record<string, string>;
      calls.push({
        url: String(url),
        params: new URLSearchParams(String(init?.body ?? '')),
        auth: headers['Authorization'] ?? '',
      });
      const isContainer = String(url).endsWith('/threads');
      return new Response(JSON.stringify(isContainer ? { id: 'cont-1' } : { id: 'post-9' }));
    };

    const creationId = await createTextContainer(
      { userId: 'u1', text: '你好', accessToken: 'tok' },
      fetcher,
    );
    expect(creationId).toBe('cont-1');
    const postId = await publishContainer({ userId: 'u1', creationId, accessToken: 'tok' }, fetcher);
    expect(postId).toBe('post-9');

    expect(calls[0].url).toBe('https://graph.threads.net/v1.0/u1/threads');
    expect(calls[0].params.get('media_type')).toBe('TEXT');
    expect(calls[0].params.get('text')).toBe('你好');
    expect(calls[0].auth).toBe('Bearer tok');
    expect(calls[1].url).toBe('https://graph.threads.net/v1.0/u1/threads_publish');
    expect(calls[1].params.get('creation_id')).toBe('cont-1');
  });

  it('publishThreadsText:完整流程回傳貼文 id;非法文字先行拒絕', async () => {
    const fetcher: Fetcher = async () => new Response(JSON.stringify({ id: 'x' }));
    const out: PublishOutcome = await publishThreadsText(
      { userId: 'u1', text: '內容', accessToken: 'tok' },
      fetcher,
    );
    expect(out).toEqual({ id: 'x' });
    await expect(
      publishThreadsText({ userId: 'u1', text: '', accessToken: 'tok' }, fetcher),
    ).rejects.toThrow('text is empty');
  });

  it('API 錯誤(非 2xx)轉為明確錯誤', async () => {
    const fetcher: Fetcher = async () =>
      new Response(JSON.stringify({ error: { message: 'invalid token' } }), { status: 401 });
    await expect(
      createTextContainer({ userId: 'u1', text: 'x', accessToken: 'bad' }, fetcher),
    ).rejects.toThrow('threads api threads failed');
  });
});
