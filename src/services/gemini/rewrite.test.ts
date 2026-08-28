import { beforeAll, describe, expect, it } from 'vitest';
import {
  buildRewritePrompt,
  parseGeminiReply,
  rewriteWithGemini,
  statusToCode,
} from './rewrite';

// node 環境沒有 localStorage:注入最小 stub 供模型快取測試
beforeAll(() => {
  const store = new Map<string, string>();
  globalThis.localStorage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
    clear: () => store.clear(),
    length: 0,
    key: () => null,
  } as unknown as Storage;
});

describe('buildRewritePrompt', () => {
  it('包含語氣指引、原文與規則', () => {
    const p = buildRewritePrompt('早安大家好', '親切');
    expect(p).toContain('親切');
    expect(p).toContain('早安大家好');
    expect(p).toContain('只輸出改寫後的全文');
    expect(p).not.toContain('不得超過');
  });

  it('有限制字數時附加上限規則', () => {
    const p = buildRewritePrompt('x', '簡短', 500);
    expect(p).toContain('不得超過 500 字');
  });
});

describe('parseGeminiReply', () => {
  it('取出 candidates 內的文字並串接', () => {
    const json = { candidates: [{ content: { parts: [{ text: '改寫' }, { text: '結果' }] } }] };
    expect(parseGeminiReply(json)).toBe('改寫結果');
  });

  it('結構不符或空內容回 null', () => {
    expect(parseGeminiReply({})).toBeNull();
    expect(parseGeminiReply({ candidates: [] })).toBeNull();
    expect(parseGeminiReply({ candidates: [{ content: { parts: [{ text: '  ' }] } }] })).toBeNull();
  });
});

describe('statusToCode', () => {
  it('400/401/403 → invalid_key;404 → model_unavailable;429 → quota;5xx → server', () => {
    expect(statusToCode(400)).toBe('invalid_key');
    expect(statusToCode(401)).toBe('invalid_key');
    expect(statusToCode(403)).toBe('invalid_key');
    expect(statusToCode(404)).toBe('model_unavailable');
    expect(statusToCode(429)).toBe('quota');
    expect(statusToCode(503)).toBe('server');
    expect(statusToCode(302)).toBe('unknown');
  });
});

describe('rewriteWithGemini 模型降級', () => {
  const realFetch = globalThis.fetch;
  const calls: string[] = [];

  async function fakeFetchSequence(responses: Array<{ status: number; body?: unknown }>) {
    let i = 0;
    return (async (url: RequestInfo | URL) => {
      calls.push(String(url));
      const r = responses[Math.min(i++, responses.length - 1)];
      return new Response(r.body ? JSON.stringify(r.body) : null, { status: r.status });
    }) as typeof fetch;
  }

  it('404 換下一個候選,成功後記住該模型', async () => {
    localStorage.clear();
    calls.length = 0;
    globalThis.fetch = await fakeFetchSequence([
      { status: 404 },
      {
        status: 200,
        body: { candidates: [{ content: { parts: [{ text: '改寫結果' }] } }] },
      },
    ]);
    const res = await rewriteWithGemini({ apiKey: 'k', text: 'x', tone: '親切' });
    globalThis.fetch = realFetch;
    expect(res.ok && res.text).toBe('改寫結果');
    expect(calls[0]).toContain('gemini-2.5-flash');
    expect(calls[1]).toContain('gemini-flash-latest');
    // 記住的模型會被優先使用
    calls.length = 0;
    globalThis.fetch = await fakeFetchSequence([
      { status: 200, body: { candidates: [{ content: { parts: [{ text: '再一次' }] } }] } },
    ]);
    const res2 = await rewriteWithGemini({ apiKey: 'k', text: 'x', tone: '親切' });
    globalThis.fetch = realFetch;
    expect(res2.ok && res2.text).toBe('再一次');
    expect(calls[0]).toContain('gemini-flash-latest');
    localStorage.clear();
  });

  it('key 錯誤(403)不嘗試其他模型,直接回 invalid_key', async () => {
    localStorage.clear();
    calls.length = 0;
    globalThis.fetch = await fakeFetchSequence([{ status: 403 }]);
    const res = await rewriteWithGemini({ apiKey: 'k', text: 'x', tone: '親切' });
    globalThis.fetch = realFetch;
    expect(res).toEqual({ ok: false, code: 'invalid_key' });
    expect(calls.length).toBe(1);
  });
});
