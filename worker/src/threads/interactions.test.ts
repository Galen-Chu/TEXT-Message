import { describe, expect, it } from 'vitest';
import {
  buildRepliesUrl,
  buildUserThreadsUrl,
  fetchThreadsInteractions,
  isPermissionError,
  parsePostList,
  parseReplies,
  parseTimestamp,
  ThreadsScopeError,
  MAX_INTERACTIONS,
} from './interactions';
import type { Fetcher } from './oauth';

describe('URL 組裝(斷言完整請求形狀)', () => {
  it('列自己貼文:端點、fields、limit 逐一對照', () => {
    const u = new URL(buildUserThreadsUrl('u1', 5));
    expect(u.origin + u.pathname).toBe('https://graph.threads.net/v1.0/u1/threads');
    expect(u.searchParams.get('fields')).toBe('id,text,permalink,timestamp');
    expect(u.searchParams.get('limit')).toBe('5');
  });

  it('列某篇回覆:用 /replies(頂層)且帶 is_reply_owned_by_me 以濾掉自己的回覆', () => {
    const u = new URL(buildRepliesUrl('m9', 20));
    expect(u.origin + u.pathname).toBe('https://graph.threads.net/v1.0/m9/replies');
    expect(u.searchParams.get('fields')).toBe(
      'id,text,username,permalink,timestamp,is_reply_owned_by_me',
    );
    expect(u.searchParams.get('limit')).toBe('20');
  });

  it('id 經過 URL 編碼(Meta id 理論上為數字字串,仍不假設)', () => {
    expect(buildRepliesUrl('a/b')).toContain('/a%2Fb/replies');
  });
});

describe('解析(防禦式:單筆壞不連坐整輪)', () => {
  it('貼文列表略過無 id 的項目,節錄壓掉換行並截斷', () => {
    const posts = parsePostList({
      data: [
        { id: 'p1', text: '第一行\n第二行' },
        { text: '沒有 id' },
        { id: 'p2', text: 'x'.repeat(50) },
      ],
    });
    expect(posts.map((p) => p.id)).toEqual(['p1', 'p2']);
    expect(posts[0].snippet).toBe('第一行 第二行');
    expect(posts[1].snippet).toBe(`${'x'.repeat(40)}…`);
  });

  it('data 不是陣列(或錯誤回應形狀)視為沒有資料', () => {
    expect(parsePostList({ data: 'nope' })).toEqual([]);
    expect(parsePostList(null)).toEqual([]);
    expect(parseReplies({}, { id: 'p1', snippet: '' })).toEqual([]);
  });

  it('回覆濾掉 is_reply_owned_by_me(自己的回覆不是別人的互動)', () => {
    const items = parseReplies(
      {
        data: [
          { id: 'r1', username: 'alice', text: '讚', timestamp: '2026-10-14T03:00:00+0000' },
          { id: 'r2', username: 'me', text: '謝謝', is_reply_owned_by_me: true },
          { id: 'r3' },
        ],
      },
      { id: 'p1', snippet: '原貼文' },
    );
    expect(items.map((i) => i.id)).toEqual(['r1', 'r3']);
    expect(items[0]).toEqual({
      id: 'r1',
      username: 'alice',
      text: '讚',
      permalink: '',
      timestamp: Date.parse('2026-10-14T03:00:00+0000'),
      postId: 'p1',
      postSnippet: '原貼文',
    });
  });

  it('壞時間戳回 0,不炸掉整輪', () => {
    expect(parseTimestamp('not-a-date')).toBe(0);
    expect(parseTimestamp(undefined)).toBe(0);
    expect(parseTimestamp('2026-10-14T03:00:00+0000')).toBe(Date.parse('2026-10-14T03:00:00+0000'));
  });
});

describe('權限錯誤判定', () => {
  it('code 190/200 或訊息含 permission/scope 皆視為權限問題', () => {
    expect(isPermissionError({ error: { code: 190, message: 'x' } })).toBe(true);
    expect(isPermissionError({ error: { code: 200, message: 'x' } })).toBe(true);
    expect(isPermissionError({ error: { code: 1, message: 'Missing Permission' } })).toBe(true);
    expect(isPermissionError({ error: { code: 1, message: 'invalid scope' } })).toBe(true);
  });

  it('其他錯誤與成功回應不是權限問題', () => {
    expect(isPermissionError({ error: { code: 4, message: 'rate limited' } })).toBe(false);
    expect(isPermissionError({ data: [] })).toBe(false);
    expect(isPermissionError(null)).toBe(false);
  });
});

describe('fetchThreadsInteractions(fetcher 注入)', () => {
  function makeFetcher(
    handler: (u: URL) => { status?: number; body: unknown },
  ): { fetcher: Fetcher; calls: Array<{ url: string; method: string; auth: string }> } {
    const calls: Array<{ url: string; method: string; auth: string }> = [];
    const fetcher: Fetcher = async (url, init) => {
      const u = new URL(String(url));
      const headers = (init?.headers ?? {}) as Record<string, string>;
      calls.push({
        url: u.origin + u.pathname,
        method: String(init?.method ?? 'GET'),
        auth: headers['Authorization'] ?? '',
      });
      const { status = 200, body } = handler(u);
      return new Response(JSON.stringify(body), { status });
    };
    return { fetcher, calls };
  }

  it('列貼文 → 逐篇取回覆 → 合併後依時間新到舊排序;請求皆 GET + Bearer', async () => {
    const { fetcher, calls } = makeFetcher((u) => {
      if (u.pathname === '/v1.0/u1/threads') {
        return { body: { data: [{ id: 'p1', text: '甲' }, { id: 'p2', text: '乙' }] } };
      }
      if (u.pathname === '/v1.0/p1/replies') {
        return { body: { data: [{ id: 'r1', username: 'a', timestamp: '2026-10-14T01:00:00+0000' }] } };
      }
      return { body: { data: [{ id: 'r2', username: 'b', timestamp: '2026-10-14T05:00:00+0000' }] } };
    });

    const out = await fetchThreadsInteractions(
      { userId: 'u1', accessToken: 'tok', maxPosts: 2 },
      fetcher,
    );

    expect(out.scanned).toBe(2);
    expect(out.items.map((i) => i.id)).toEqual(['r2', 'r1']); // 新到舊
    expect(out.items[0].postSnippet).toBe('乙');
    expect(calls.map((c) => c.url)).toEqual([
      'https://graph.threads.net/v1.0/u1/threads',
      'https://graph.threads.net/v1.0/p1/replies',
      'https://graph.threads.net/v1.0/p2/replies',
    ]);
    expect(calls.every((c) => c.method === 'GET')).toBe(true);
    expect(calls.every((c) => c.auth === 'Bearer tok')).toBe(true);
  });

  it('單篇回覆讀取失敗(非權限)只略過該篇,其餘仍回傳', async () => {
    const { fetcher } = makeFetcher((u) => {
      if (u.pathname === '/v1.0/u1/threads') {
        return { body: { data: [{ id: 'p1' }, { id: 'p2' }] } };
      }
      if (u.pathname === '/v1.0/p1/replies') {
        return { status: 500, body: { error: { code: 4, message: 'temporary' } } };
      }
      return { body: { data: [{ id: 'r2', timestamp: '2026-10-14T05:00:00+0000' }] } };
    });

    const out = await fetchThreadsInteractions({ userId: 'u1', accessToken: 'tok' }, fetcher);
    expect(out.items.map((i) => i.id)).toEqual(['r2']);
  });

  it('權限錯誤往外拋 ThreadsScopeError(要求使用者重新連接,不可偽裝成一般失敗)', async () => {
    const { fetcher } = makeFetcher((u) => {
      if (u.pathname === '/v1.0/u1/threads') return { body: { data: [{ id: 'p1' }] } };
      return { status: 403, body: { error: { code: 200, message: 'missing threads_read_replies' } } };
    });

    await expect(
      fetchThreadsInteractions({ userId: 'u1', accessToken: 'tok' }, fetcher),
    ).rejects.toBeInstanceOf(ThreadsScopeError);
  });

  it('列貼文本身權限不足時也是 ThreadsScopeError', async () => {
    const { fetcher } = makeFetcher(() => ({
      status: 400,
      body: { error: { code: 190, message: 'token expired' } },
    }));
    await expect(
      fetchThreadsInteractions({ userId: 'u1', accessToken: 'tok' }, fetcher),
    ).rejects.toBeInstanceOf(ThreadsScopeError);
  });

  it('回傳筆數截至上限', async () => {
    const many = Array.from({ length: MAX_INTERACTIONS + 5 }, (_, i) => ({
      id: `r${i}`,
      timestamp: `2026-10-14T0${i % 10}:00:00+0000`,
    }));
    const { fetcher } = makeFetcher((u) =>
      u.pathname === '/v1.0/u1/threads' ? { body: { data: [{ id: 'p1' }] } } : { body: { data: many } },
    );
    const out = await fetchThreadsInteractions({ userId: 'u1', accessToken: 'tok' }, fetcher);
    expect(out.items).toHaveLength(MAX_INTERACTIONS);
  });

  it('非 JSON 回應給出可診斷的錯誤(不是靜默空清單)', async () => {
    const fetcher: Fetcher = async () => new Response('<html>502</html>', { status: 502 });
    await expect(
      fetchThreadsInteractions({ userId: 'u1', accessToken: 'tok' }, fetcher),
    ).rejects.toThrow(/non-json/);
  });
});
