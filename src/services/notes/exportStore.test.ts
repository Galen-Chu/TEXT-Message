import { describe, expect, it } from 'vitest';
import {
  EMPTY_NOTES_EXPORT_STATE,
  loadNotesExportState,
  NOTES_EXPORT_KEY,
  parseNotesExportState,
  saveNotesExportState,
} from './exportStore';

function memStorage(opts?: { failWith?: Error }) {
  let value: string | null = null;
  return {
    getItem: () => {
      if (opts?.failWith) throw opts.failWith;
      return value;
    },
    setItem: (_k: string, v: string) => {
      if (opts?.failWith) throw opts.failWith;
      value = v;
    },
    dump: () => value,
  };
}

describe('便條匯出戳記(exportStore,POST-PLAN P3)', () => {
  it('獨立鍵:不等於日記戳記鍵、不等於內容資料鍵', () => {
    expect(NOTES_EXPORT_KEY).toBe('text-message:notes-export:v1');
    expect(NOTES_EXPORT_KEY).not.toBe('text-message:diary-export:v1');
    expect(NOTES_EXPORT_KEY).not.toBe('text-message:notes:v1');
    expect(NOTES_EXPORT_KEY).not.toBe('text-message:v2');
  });

  it('roundtrip:存入帶 version:1,讀回同值', () => {
    const storage = memStorage();
    expect(
      saveNotesExportState({ stamps: { 'note-a': 123 }, lastExportAt: 456, folderName: 'Journal' }, storage),
    ).toBe(true);
    expect(JSON.parse(storage.dump() ?? '')).toEqual({
      version: 1,
      stamps: { 'note-a': 123 },
      lastExportAt: 456,
      folderName: 'Journal',
    });
    expect(loadNotesExportState(storage)).toEqual({
      stamps: { 'note-a': 123 },
      lastExportAt: 456,
      folderName: 'Journal',
    });
  });

  it('防禦式解析:null/非 JSON/版本不符/形狀壞 → 空狀態;單筆戳記壞只丟那筆', () => {
    expect(parseNotesExportState(null)).toEqual(EMPTY_NOTES_EXPORT_STATE);
    expect(parseNotesExportState('not json')).toEqual(EMPTY_NOTES_EXPORT_STATE);
    expect(parseNotesExportState('{"version":2,"stamps":{}}')).toEqual(EMPTY_NOTES_EXPORT_STATE);
    expect(parseNotesExportState('{"version":1,"stamps":"nope"}')).toEqual(EMPTY_NOTES_EXPORT_STATE);
    expect(
      parseNotesExportState('{"version":1,"stamps":{"a":1,"b":"x","c":2}}'),
    ).toEqual({ stamps: { a: 1, c: 2 } });
  });

  it('讀寫丟錯靜默:讀→空狀態、寫→false(不打斷匯出流程)', () => {
    const fail = memStorage({ failWith: new Error('private mode') });
    expect(loadNotesExportState(fail)).toEqual(EMPTY_NOTES_EXPORT_STATE);
    expect(saveNotesExportState({ stamps: {} }, fail)).toBe(false);
  });
});
