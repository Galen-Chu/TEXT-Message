import { describe, expect, it } from 'vitest';
import {
  DIARY_EXPORT_KEY,
  EMPTY_EXPORT_STATE,
  loadDiaryExportState,
  parseDiaryExportState,
  saveDiaryExportState,
} from './exportStore';

const memStorage = (init: Record<string, string> = {}) => {
  const data = { ...init };
  return {
    data,
    getItem: (k: string) => data[k] ?? null,
    setItem: (k: string, v: string) => {
      data[k] = v;
    },
  };
};

describe('日記匯出戳記儲存', () => {
  it('獨立鍵,與日記內容分開(機器本地狀態,不進雲端備份)', () => {
    expect(DIARY_EXPORT_KEY).toBe('text-message:diary-export:v1');
    expect(DIARY_EXPORT_KEY).not.toBe('text-message:diary:v1');
  });

  it('沒資料/空字串 → 空狀態', () => {
    expect(parseDiaryExportState(null)).toEqual(EMPTY_EXPORT_STATE);
    expect(parseDiaryExportState('')).toEqual(EMPTY_EXPORT_STATE);
  });

  it('壞 JSON、版本不符、形狀壞 → 空狀態(不丟例外)', () => {
    expect(parseDiaryExportState('{{{')).toEqual(EMPTY_EXPORT_STATE);
    expect(parseDiaryExportState(JSON.stringify({ version: 2, stamps: { a: 1 } }))).toEqual(
      EMPTY_EXPORT_STATE,
    );
    expect(parseDiaryExportState(JSON.stringify({ version: 1, stamps: 'nope' })).stamps).toEqual({});
    expect(parseDiaryExportState(JSON.stringify({ version: 1, stamps: [1, 2] })).stamps).toEqual({});
  });

  it('單筆戳記壞只丟那筆(防禦式,不連坐整批)', () => {
    const raw = JSON.stringify({
      version: 1,
      stamps: { '2026-11-01': 123, '2026-10-24': 'bad', '2026-10-23': null, '2026-10-22': 456 },
    });
    expect(parseDiaryExportState(raw).stamps).toEqual({ '2026-11-01': 123, '2026-10-22': 456 });
  });

  it('lastExportAt / folderName 選用且驗型別', () => {
    const good = parseDiaryExportState(
      JSON.stringify({ version: 1, stamps: {}, lastExportAt: 999, folderName: 'MyVault' }),
    );
    expect(good.lastExportAt).toBe(999);
    expect(good.folderName).toBe('MyVault');

    const bad = parseDiaryExportState(
      JSON.stringify({ version: 1, stamps: {}, lastExportAt: 'soon', folderName: '' }),
    );
    expect(bad.lastExportAt).toBeUndefined();
    expect(bad.folderName).toBeUndefined();
  });

  it('round-trip:存了就讀得回來', () => {
    const s = memStorage();
    saveDiaryExportState({ stamps: { '2026-11-01': 7 }, lastExportAt: 42, folderName: 'V' }, s);
    expect(JSON.parse(s.data[DIARY_EXPORT_KEY]).version).toBe(1);
    expect(loadDiaryExportState(s)).toEqual({
      stamps: { '2026-11-01': 7 },
      lastExportAt: 42,
      folderName: 'V',
    });
  });

  it('寫入失敗回 false 不丟例外(戳記遺失只是下次多寫幾次)', () => {
    const broken = {
      setItem: () => {
        throw new DOMException('full', 'QuotaExceededError');
      },
    };
    expect(saveDiaryExportState({ stamps: {} }, broken)).toBe(false);
  });

  it('讀取丟例外(停用 storage)→ 空狀態', () => {
    const broken = {
      getItem: () => {
        throw new Error('disabled');
      },
    };
    expect(loadDiaryExportState(broken)).toEqual(EMPTY_EXPORT_STATE);
  });
});
