import { describe, expect, it } from 'vitest';
import type { DiaryEntry } from '../../types';
import {
  DIARY_KEY,
  isDiaryEntry,
  loadDiaryEntries,
  parseDiary,
  saveDiaryEntries,
  searchDiaryEntries,
  sortDiaryEntries,
} from './storage';

function entry(patch: Partial<DiaryEntry> = {}): DiaryEntry {
  return {
    id: 'diary-1',
    date: '2026-10-24',
    title: '',
    body: '今天的內容',
    createdAt: 100,
    updatedAt: 100,
    ...patch,
  };
}

/** 注入式記憶體儲存(比照 services/family 測試模式);getItem/setItem 可模擬丟錯。 */
function memStorage(opts?: { failWith?: Error }): { dump(): string | null; lastKey(): string | null } & Pick<Storage, 'getItem' | 'setItem'> {
  let value: string | null = null;
  let key: string | null = null;
  return {
    getItem: () => {
      if (opts?.failWith) throw opts.failWith;
      return value;
    },
    setItem: (k: string, v: string) => {
      if (opts?.failWith) throw opts.failWith;
      if (k !== DIARY_KEY) throw new Error('unexpected key ' + k);
      key = k;
      value = v;
    },
    dump: () => value,
    lastKey: () => key,
  };
}

describe('parseDiary(防禦式解析)', () => {
  it('null/空字串/非 JSON → []', () => {
    expect(parseDiary(null)).toEqual([]);
    expect(parseDiary('')).toEqual([]);
    expect(parseDiary('not json')).toEqual([]);
  });

  it('版本不符或形狀壞 → [](整組退回空,不猜測)', () => {
    expect(parseDiary('{"version":2,"entries":[]}')).toEqual([]);
    expect(parseDiary('{"entries":[]}')).toEqual([]);
    expect(parseDiary('{"version":1,"entries":"nope"}')).toEqual([]);
    expect(parseDiary('{"version":1}')).toEqual([]);
  });

  it('單筆壞只丟那筆,不連坐整包', () => {
    const good = entry();
    const raw = JSON.stringify({
      version: 1,
      entries: [
        good,
        { id: 'x', date: '2026-1-01', title: '', body: 'b', createdAt: 1, updatedAt: 1 }, // 日期格式壞
        { id: 'y', date: '2026-01-01' }, // 缺欄位
        { id: 'z', date: '2026-01-01', title: '', body: 'b', createdAt: NaN, updatedAt: 1 }, // 非 finite
        'not an object',
      ],
    });
    expect(parseDiary(raw)).toEqual([good]);
  });

  it('isDiaryEntry 日期邊界:YYYY-MM-DD 才過', () => {
    expect(isDiaryEntry(entry({ date: '2026-01-01' }))).toBe(true);
    expect(isDiaryEntry(entry({ date: '2026-1-1' }))).toBe(false);
    expect(isDiaryEntry(entry({ date: '2026/01/01' }))).toBe(false);
    expect(isDiaryEntry(entry({ date: '' }))).toBe(false);
  });

  it('mood 選填:非空短字串可過,缺漏/空字串/非字串/超長不過', () => {
    expect(isDiaryEntry(entry({ mood: '😊 開心' }))).toBe(true);
    expect(isDiaryEntry(entry({}))).toBe(true);
    expect(isDiaryEntry(entry({ mood: '' }))).toBe(false);
    expect(isDiaryEntry(entry({ mood: 7 as unknown as string }))).toBe(false);
    expect(isDiaryEntry(entry({ mood: 'x'.repeat(21) }))).toBe(false);
  });
});

describe('saveDiaryEntries / loadDiaryEntries', () => {
  it('roundtrip:存入帶 version:1,讀回同序同值', () => {
    const storage = memStorage();
    const list = [entry({ id: 'a', mood: '😌 平靜' }), entry({ id: 'b', date: '2026-10-23' })];
    expect(saveDiaryEntries(list, storage)).toEqual({ ok: true });
    expect(JSON.parse(storage.dump() ?? '')).toEqual({ version: 1, entries: list });
    expect(loadDiaryEntries(storage)).toEqual(list);
  });

  it('寫入鍵為 DIARY_KEY(獨立於 text-message:v2)', () => {
    const storage = memStorage();
    saveDiaryEntries([entry()], storage);
    expect(storage.lastKey()).toBe(DIARY_KEY);
    expect(storage.lastKey()).not.toBe('text-message:v2');
  });

  it('QuotaExceededError → {ok:false, quota:true};其他錯誤 → quota:false', () => {
    const quota = memStorage({ failWith: new DOMException('full', 'QuotaExceededError') });
    expect(saveDiaryEntries([entry()], quota)).toEqual({ ok: false, quota: true });
    const other = memStorage({ failWith: new Error('private mode') });
    expect(saveDiaryEntries([entry()], other)).toEqual({ ok: false, quota: false });
  });

  it('讀取丟錯 → [](靜默退回記憶體模式)', () => {
    const storage = memStorage({ failWith: new Error('unavailable') });
    expect(loadDiaryEntries(storage)).toEqual([]);
  });
});

describe('sortDiaryEntries', () => {
  it('日期新→舊;同日以建立時間新→舊;不原地變動', () => {
    const a = entry({ id: 'a', date: '2026-10-22', createdAt: 1 });
    const b = entry({ id: 'b', date: '2026-10-24', createdAt: 5 });
    const c = entry({ id: 'c', date: '2026-10-24', createdAt: 9 });
    const list = [a, b, c];
    expect(sortDiaryEntries(list).map((e) => e.id)).toEqual(['c', 'b', 'a']);
    expect(list.map((e) => e.id)).toEqual(['a', 'b', 'c']);
  });
});

describe('searchDiaryEntries', () => {
  const list = [
    entry({ id: 'a', title: '晨間散步', body: '公園的雀鳥', mood: '😊 開心' }),
    entry({ id: 'b', title: '', body: 'Read a book about ORM' }),
  ];

  it('空白查詢=全部', () => {
    expect(searchDiaryEntries(list, '  ')).toHaveLength(2);
  });

  it('標題、內容與心情皆可比對,不分大小寫', () => {
    expect(searchDiaryEntries(list, '散步').map((e) => e.id)).toEqual(['a']);
    expect(searchDiaryEntries(list, '雀鳥').map((e) => e.id)).toEqual(['a']);
    expect(searchDiaryEntries(list, 'orm').map((e) => e.id)).toEqual(['b']);
    expect(searchDiaryEntries(list, '開心').map((e) => e.id)).toEqual(['a']);
  });

  it('無命中 → []', () => {
    expect(searchDiaryEntries(list, '查無此字')).toEqual([]);
  });
});
