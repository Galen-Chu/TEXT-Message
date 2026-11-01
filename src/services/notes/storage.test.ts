import { describe, expect, it } from 'vitest';
import type { Note } from '../../types';
import {
  NOTES_KEY,
  collectTags,
  filterNotesByKind,
  isNote,
  loadNotes,
  noteInsertText,
  parseNotes,
  parseTagsInput,
  saveNotes,
  searchNotes,
  sortNotes,
} from './storage';

function note(patch: Partial<Note> = {}): Note {
  return {
    id: 'note-1',
    kind: 'note',
    title: '',
    body: '一段小筆記',
    tags: [],
    createdAt: 100,
    updatedAt: 100,
    ...patch,
  };
}

/** 注入式記憶體儲存(沿日記測試模式);getItem/setItem 可模擬丟錯。 */
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
      if (k !== NOTES_KEY) throw new Error('unexpected key ' + k);
      key = k;
      value = v;
    },
    dump: () => value,
    lastKey: () => key,
  };
}

describe('parseNotes(防禦式解析)', () => {
  it('null/空字串/非 JSON → []', () => {
    expect(parseNotes(null)).toEqual([]);
    expect(parseNotes('')).toEqual([]);
    expect(parseNotes('not json')).toEqual([]);
  });

  it('版本不符或形狀壞 → [](整組退回空,不猜測)', () => {
    expect(parseNotes('{"version":2,"notes":[]}')).toEqual([]);
    expect(parseNotes('{"notes":[]}')).toEqual([]);
    expect(parseNotes('{"version":1,"notes":"nope"}')).toEqual([]);
    expect(parseNotes('{"version":1}')).toEqual([]);
  });

  it('單筆壞只丟那筆,不連坐整包', () => {
    const raw = JSON.stringify({
      version: 1,
      notes: [note({ id: 'ok' }), { id: 'bad' }, note({ id: 'ok2', kind: 'nope' as Note['kind'] })],
    });
    expect(parseNotes(raw).map((n) => n.id)).toEqual(['ok']);
  });

  it('isNote:kind 限三種、tags 必為字串陣列、url 選填', () => {
    expect(isNote(note({ kind: 'article', url: 'https://example.com' }))).toBe(true);
    expect(isNote(note({ kind: 'idea' }))).toBe(true);
    expect(isNote({ ...note(), kind: 'other' })).toBe(false);
    expect(isNote({ ...note(), tags: ['ok', 1] })).toBe(false);
    expect(isNote({ ...note(), url: 5 })).toBe(false);
    expect(isNote({ ...note(), updatedAt: Number.NaN })).toBe(false);
  });
});

describe('saveNotes / loadNotes', () => {
  it('寫入後讀回同一份,且寫在獨立鍵(不是 text-message:v2)', () => {
    const storage = memStorage();
    const list = [note({ id: 'a', tags: ['靈感'] })];
    expect(saveNotes(list, storage)).toEqual({ ok: true });
    expect(storage.lastKey()).toBe(NOTES_KEY);
    expect(storage.lastKey()).not.toBe('text-message:v2');
    expect(loadNotes(storage)).toEqual(list);
  });

  it('QuotaExceededError → {ok:false, quota:true};其他錯誤 → quota:false', () => {
    const quota = memStorage({ failWith: new DOMException('full', 'QuotaExceededError') });
    expect(saveNotes([note()], quota)).toEqual({ ok: false, quota: true });
    const other = memStorage({ failWith: new Error('private mode') });
    expect(saveNotes([note()], other)).toEqual({ ok: false, quota: false });
  });

  it('讀取丟錯 → [](靜默退回記憶體模式)', () => {
    expect(loadNotes(memStorage({ failWith: new Error('unavailable') }))).toEqual([]);
  });
});

describe('sortNotes / filterNotesByKind', () => {
  it('依更新時間新→舊,不原地變動', () => {
    const list = [note({ id: 'a', updatedAt: 1 }), note({ id: 'b', updatedAt: 9 })];
    expect(sortNotes(list).map((n) => n.id)).toEqual(['b', 'a']);
    expect(list.map((n) => n.id)).toEqual(['a', 'b']);
  });

  it('類型篩選;null=全部', () => {
    const list = [note({ id: 'a', kind: 'note' }), note({ id: 'b', kind: 'article' })];
    expect(filterNotesByKind(list, 'article').map((n) => n.id)).toEqual(['b']);
    expect(filterNotesByKind(list, null)).toHaveLength(2);
  });
});

describe('searchNotes', () => {
  const list = [
    note({ id: 'a', title: '寫作習慣', body: '每天先寫三行', tags: ['寫作'] }),
    note({ id: 'b', kind: 'article', body: '很好的訪談', url: 'https://example.com/interview' }),
  ];

  it('空白查詢=全部', () => {
    expect(searchNotes(list, '  ')).toHaveLength(2);
  });

  it('標題、內容、連結與標籤皆可比對,不分大小寫', () => {
    expect(searchNotes(list, '習慣').map((n) => n.id)).toEqual(['a']);
    expect(searchNotes(list, '三行').map((n) => n.id)).toEqual(['a']);
    expect(searchNotes(list, '寫作').map((n) => n.id)).toEqual(['a']);
    expect(searchNotes(list, 'INTERVIEW').map((n) => n.id)).toEqual(['b']);
  });

  it('無命中 → []', () => {
    expect(searchNotes(list, '查無此字')).toEqual([]);
  });
});

describe('parseTagsInput', () => {
  it('半角/全角逗號、頓號與空白皆為分隔;去重、保留順序', () => {
    expect(parseTagsInput('寫作, 靈感、寫作  行銷,,')).toEqual(['寫作', '靈感', '行銷']);
  });

  it('空輸入 → []', () => {
    expect(parseTagsInput('   ')).toEqual([]);
  });
});

describe('collectTags', () => {
  // 同次數的 tie-break 用拉丁字母斷言,避免中文排序結果隨執行環境 collation 浮動
  it('次數多→少,同次數依字典序', () => {
    const list = [
      note({ id: 'a', tags: ['ai', 'writing'] }),
      note({ id: 'b', tags: ['writing'] }),
      note({ id: 'c', tags: ['biz'] }),
    ];
    expect(collectTags(list)).toEqual([
      { tag: 'writing', count: 2 },
      { tag: 'ai', count: 1 },
      { tag: 'biz', count: 1 },
    ]);
  });
});

describe('noteInsertText', () => {
  it('標題+內容+連結以空行相接;缺的欄位不留空行', () => {
    expect(noteInsertText(note({ title: '標題', body: '內文', url: 'https://e.com' }))).toBe(
      '標題\n\n內文\n\nhttps://e.com',
    );
    expect(noteInsertText(note({ title: '', body: '只有內文' }))).toBe('只有內文');
  });

  it('不帶標籤與類型(整理用的中繼資料不進貼文)', () => {
    const text = noteInsertText(note({ body: '內文', tags: ['靈感'], kind: 'idea' }));
    expect(text).toBe('內文');
  });
});
