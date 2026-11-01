import type { ExportStamps } from './vaultMarkdown';

/**
 * 匯出戳記的本機儲存(DIARY-PLAN D7,2026-11-01)。
 *
 * **獨立於日記鍵、也刻意不進雲端備份**:戳記回答的是「**這台機器**上那個 vault
 * 資料夾收到哪一版了」——每台機器挑的資料夾不同(甚至沒有 vault),把它同步到
 * 別台只會讓另一台誤判「已經寫過了」而跳過該寫的天。純機器本地狀態。
 *
 * 遺失戳記不會壞資料:下次匯出只是把範圍內每天都重寫一遍,而 splice 是冪等的
 * (同樣內容寫回去結果相同),所以最壞情況是多寫幾個檔案。
 */
export const DIARY_EXPORT_KEY = 'text-message:diary-export:v1';

export interface DiaryExportState {
  /** `date → 當時那天的最大 updatedAt`(見 `vaultMarkdown.dateVersion`)。 */
  stamps: ExportStamps;
  /** 最後一次成功匯出的時間(epoch ms);沒匯出過=undefined。 */
  lastExportAt?: number;
  /** 上次挑的資料夾名稱,只為了 UI 顯示「上次寫到:<名稱>」;**不是**權限憑證。 */
  folderName?: string;
}

export const EMPTY_EXPORT_STATE: DiaryExportState = { stamps: {} };

/** 解析 `{version:1, …}`:版本不符/形狀壞 → 空狀態;單筆戳記壞只丟那筆(同日記防禦式紀律)。 */
export function parseDiaryExportState(raw: string | null): DiaryExportState {
  if (!raw) return EMPTY_EXPORT_STATE;
  try {
    const data = JSON.parse(raw) as {
      version?: unknown;
      stamps?: unknown;
      lastExportAt?: unknown;
      folderName?: unknown;
    };
    if (!data || typeof data !== 'object' || data.version !== 1) return EMPTY_EXPORT_STATE;
    const stamps: ExportStamps = {};
    if (data.stamps && typeof data.stamps === 'object' && !Array.isArray(data.stamps)) {
      for (const [date, v] of Object.entries(data.stamps as Record<string, unknown>)) {
        if (typeof v === 'number' && Number.isFinite(v)) stamps[date] = v;
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
    return EMPTY_EXPORT_STATE;
  }
}

export function loadDiaryExportState(storage: Pick<Storage, 'getItem'>): DiaryExportState {
  try {
    return parseDiaryExportState(storage.getItem(DIARY_EXPORT_KEY));
  } catch {
    return EMPTY_EXPORT_STATE;
  }
}

/** 寫入失敗一律靜默(戳記遺失只是多寫幾次,不值得打斷匯出流程或彈提示)。 */
export function saveDiaryExportState(
  state: DiaryExportState,
  storage: Pick<Storage, 'setItem'>,
): boolean {
  try {
    storage.setItem(DIARY_EXPORT_KEY, JSON.stringify({ version: 1, ...state }));
    return true;
  } catch {
    return false;
  }
}
