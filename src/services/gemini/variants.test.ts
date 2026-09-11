import { describe, expect, it } from 'vitest';
import {
  buildHashtagsPrompt,
  buildVariantsPrompt,
  parseHashtagsResponse,
  parseVariantsResponse,
} from './variants';

describe('buildVariantsPrompt', () => {
  it('含各平台代碼/名稱/上限與原始草稿', () => {
    const p = buildVariantsPrompt('草稿內容', [
      { key: 'threads', label: 'Threads', limit: 500 },
      { key: 'ig', label: 'Instagram', limit: 2200 },
    ]);
    expect(p).toContain('- threads(Threads):上限 500 字');
    expect(p).toContain('- ig(Instagram):上限 2200 字');
    expect(p).toContain('JSON 物件');
    expect(p.endsWith('草稿內容')).toBe(true);
  });

  it('角色與語言(B2/B3):角色覆寫 persona、語言帶入開頭與規則行', () => {
    const p = buildVariantsPrompt('草稿內容', [{ key: 'threads', label: 'Threads', limit: 500 }], undefined, {
      role: '行銷小編',
      language: '日文',
    });
    expect(p).toContain('你是行銷小編');
    expect(p).not.toContain('社群媒體文案編輯');
    expect(p).toContain('請以日文把「原始草稿」改寫');
    expect(p).toContain('輸出語言:日文');
  });
});

describe('parseVariantsResponse', () => {
  it('合法 JSON:取屬於平台清單的非空欄位', () => {
    expect(parseVariantsResponse('{"threads":"短版","ig":"長版"}', ['threads', 'ig'])).toEqual({
      threads: '短版',
      ig: '長版',
    });
  });

  it('容忍 ```json 圍欄與多餘欄位;空白值丟棄', () => {
    const raw = '```json\n{"threads":"短版","ig":"   ","fb":"f","junk":"x"}\n```';
    expect(parseVariantsResponse(raw, ['threads', 'ig', 'fb'])).toEqual({
      threads: '短版',
      fb: 'f',
    });
  });

  it('非 JSON / 非物件 / 完全無有效欄位 → null', () => {
    expect(parseVariantsResponse('好的,這是版本…', ['threads'])).toBeNull();
    expect(parseVariantsResponse('["threads"]', ['threads'])).toBeNull();
    expect(parseVariantsResponse('{"fb":""}', ['fb'])).toBeNull();
  });
});

describe('buildHashtagsPrompt', () => {
  it('要求 JSON 陣列並附上內容', () => {
    const p = buildHashtagsPrompt('貼文');
    expect(p).toContain('JSON 字串陣列');
    expect(p.endsWith('貼文')).toBe(true);
  });
});

describe('parseHashtagsResponse', () => {
  it('統一 # 前綴、去空白、去重、上限 5', () => {
    expect(parseHashtagsResponse('["生活"," #旅遊 ", "生活", "a b", "#美食"]')).toEqual([
      '#生活',
      '#旅遊',
      '#ab',
      '#美食',
    ]);
    expect(parseHashtagsResponse('```json\n["#1","#2","#3","#4","#5","#6"]\n```')).toHaveLength(5);
  });

  it('非 JSON / 非陣列 / 空陣列 → 空陣列', () => {
    expect(parseHashtagsResponse('標籤:生活')).toEqual([]);
    expect(parseHashtagsResponse('{"a":1}')).toEqual([]);
    expect(parseHashtagsResponse('[]')).toEqual([]);
  });
});
