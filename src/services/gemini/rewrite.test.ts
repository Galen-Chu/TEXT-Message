import { describe, expect, it } from 'vitest';
import { buildRewritePrompt, parseGeminiReply, statusToCode } from './rewrite';

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
  it('400/401/403 → invalid_key;429 → quota;5xx → server;其他 → unknown', () => {
    expect(statusToCode(400)).toBe('invalid_key');
    expect(statusToCode(401)).toBe('invalid_key');
    expect(statusToCode(403)).toBe('invalid_key');
    expect(statusToCode(429)).toBe('quota');
    expect(statusToCode(503)).toBe('server');
    expect(statusToCode(302)).toBe('unknown');
  });
});
