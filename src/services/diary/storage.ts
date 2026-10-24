import type { DiaryEntry } from '../../types';

/**
 * 日記本機儲存(DIARY-PLAN D1,2026-10-24):獨立鍵 `text-message:diary:v1`——
 * 不進 `text-message:v2`(避免高頻寫日記觸發主區塊整包重新序列化)、不進 `family:*`
 * (私密資料,契約明確排除)、絕不進 worker/KV(零後端)。
 * 讀寫失敗(隱私模式等)由呼叫端靜默退回記憶體模式,同主 store 慣例。
 */
export const DIARY_KEY = 'text-message:diary:v1';

/** 可注入儲存介面(測試以 memStorage 注入,不依賴真 localStorage)。 */
export interface DiaryStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** mood 選填:UI 限定 DIARY_MOODS,儲存層只驗非空字串與長度上限(不 import UI 常數)。 */
function moodOk(m: unknown): boolean {
  return m === undefined || (typeof m === 'string' && m.length > 0 && m.length <= 20);
}

export function isDiaryEntry(v: unknown): v is DiaryEntry {
  if (!v || typeof v !== 'object') return false;
  const e = v as Partial<DiaryEntry>;
  return (
    typeof e.id === 'string' &&
    typeof e.date === 'string' &&
    DATE_RE.test(e.date) &&
    typeof e.title === 'string' &&
    typeof e.body === 'string' &&
    moodOk(e.mood) &&
    typeof e.createdAt === 'number' &&
    Number.isFinite(e.createdAt) &&
    typeof e.updatedAt === 'number' &&
    Number.isFinite(e.updatedAt)
  );
}

/** 解析 `{version:1, entries}`:版本不符/形狀壞 → [];單筆壞只丟那筆(防禦式,同 family)。 */
export function parseDiary(raw: string | null): DiaryEntry[] {
  if (!raw) return [];
  try {
    const data = JSON.parse(raw) as { version?: unknown; entries?: unknown };
    if (!data || typeof data !== 'object' || data.version !== 1 || !Array.isArray(data.entries)) {
      return [];
    }
    return data.entries.filter(isDiaryEntry);
  } catch {
    return [];
  }
}

export function loadDiaryEntries(storage: Pick<DiaryStorage, 'getItem'>): DiaryEntry[] {
  try {
    return parseDiary(storage.getItem(DIARY_KEY));
  } catch {
    return [];
  }
}

export type SaveDiaryResult = { ok: true } | { ok: false; quota: boolean };

export function saveDiaryEntries(
  entries: DiaryEntry[],
  storage: Pick<DiaryStorage, 'setItem'>,
): SaveDiaryResult {
  try {
    storage.setItem(DIARY_KEY, JSON.stringify({ version: 1, entries }));
    return { ok: true };
  } catch (err) {
    const name = err instanceof DOMException ? err.name : '';
    return {
      ok: false,
      quota: name === 'QuotaExceededError' || name === 'NS_ERROR_DOM_QUOTA_REACHED',
    };
  }
}

/** 排序:日期新→舊('YYYY-MM-DD' 字典序即時間序);同日以建立時間新→舊。不原地變動。 */
export function sortDiaryEntries(entries: DiaryEntry[]): DiaryEntry[] {
  return [...entries].sort((a, b) => {
    if (a.date !== b.date) return a.date > b.date ? -1 : 1;
    return b.createdAt - a.createdAt;
  });
}

/** 搜尋:標題+內容+心情不分大小寫子字串;空白查詢=全部。 */
export function searchDiaryEntries(entries: DiaryEntry[], query: string): DiaryEntry[] {
  const q = query.trim().toLowerCase();
  if (!q) return entries;
  return entries.filter((e) => `${e.title} ${e.body} ${e.mood ?? ''}`.toLowerCase().includes(q));
}
