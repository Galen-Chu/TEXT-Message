import type { NoteExportStamps } from './vaultMarkdown';

/**
 * 便條匯出戳記的本機儲存(POST-PLAN P3,2026-11-12)——鏡像日記的 exportStore:
 * **獨立鍵、刻意不進雲端備份**(機器本地狀態:每台機器挑的 vault 資料夾不同,
 * 同步過去只會讓另一台誤判已寫過)。遺失戳記不壞資料——splice 冪等,最壞多寫幾個檔。
 */
export const NOTES_EXPORT_KEY = 'text-message:notes-export:v1';

export interface NotesExportState {
  /** `noteId → 上次匯出時的 updatedAt`。 */
  stamps: NoteExportStamps;
  /** 最後一次成功匯出的時間(epoch ms);沒匯出過=undefined。 */
  lastExportAt?: number;
  /** 上次挑的資料夾名稱,只為 UI 顯示;**不是**權限憑證(與日記匯出共用同一個 handle)。 */
  folderName?: string;
}

export const EMPTY_NOTES_EXPORT_STATE: NotesExportState = { stamps: {} };

/** 解析 `{version:1, …}`:版本不符/形狀壞 → 空狀態;單筆戳記壞只丟那筆(防禦式)。 */
export function parseNotesExportState(raw: string | null): NotesExportState {
  if (!raw) return EMPTY_NOTES_EXPORT_STATE;
  try {
    const data = JSON.parse(raw) as {
      version?: unknown;
      stamps?: unknown;
      lastExportAt?: unknown;
      folderName?: unknown;
    };
    if (!data || typeof data !== 'object' || data.version !== 1) return EMPTY_NOTES_EXPORT_STATE;
    const stamps: NoteExportStamps = {};
    if (data.stamps && typeof data.stamps === 'object' && !Array.isArray(data.stamps)) {
      for (const [id, v] of Object.entries(data.stamps as Record<string, unknown>)) {
        if (typeof v === 'number' && Number.isFinite(v)) stamps[id] = v;
      }
    }
    return {
      stamps,
      lastExportAt:
        typeof data.lastExportAt === 'number' && Number.isFinite(data.lastExportAt)
          ? data.lastExportAt
          : undefined,
      folderName: typeof data.folderName === 'string' && data.folderName ? data.folderName : undefined,
    };
  } catch {
    return EMPTY_NOTES_EXPORT_STATE;
  }
}

export function loadNotesExportState(storage: Pick<Storage, 'getItem'>): NotesExportState {
  try {
    return parseNotesExportState(storage.getItem(NOTES_EXPORT_KEY));
  } catch {
    return EMPTY_NOTES_EXPORT_STATE;
  }
}

/** 寫入失敗一律靜默(戳記遺失只是多寫幾次,不打斷匯出流程)。 */
export function saveNotesExportState(
  state: NotesExportState,
  storage: Pick<Storage, 'setItem'>,
): boolean {
  try {
    storage.setItem(NOTES_EXPORT_KEY, JSON.stringify({ version: 1, ...state }));
    return true;
  } catch {
    return false;
  }
}
