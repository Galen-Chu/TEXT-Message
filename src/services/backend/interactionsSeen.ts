/**
 * 互動「未讀」判定(2026-10-14,Threads 互動唯讀代讀的前端一半)。
 *
 * 設計要點:後端**不儲存**任何互動資料,所以未讀狀態只能在前端。這裡落地的**只有一個
 * 時間戳**(最後查看時間)——互動內容、留言者帳號一律不寫 localStorage,離開頁面即消失。
 * 鍵刻意獨立於 `text-message:v2`(內容資料),與 install-id / gemini-key / library-code
 * 同慣例:非內容、不進文庫雲端備份。
 */
const KEY = 'text-message:threads-seen-at';

/** 最後查看時間(ms epoch);未查看過或讀取失敗回 0。 */
export function readSeenAt(): number {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return 0;
    const n = Number(raw);
    return Number.isFinite(n) && n > 0 ? n : 0;
  } catch {
    return 0;
  }
}

/** 寫入最後查看時間;儲存不可用時靜默忽略(未讀計數退化為每次都算新,不影響正確性)。 */
export function writeSeenAt(ms: number): void {
  try {
    localStorage.setItem(KEY, String(ms));
  } catch {
    // 私密模式/配額用盡:未讀計數失效即可,不值得打斷使用者
  }
}

/**
 * 未讀筆數 = 時間戳**嚴格晚於**最後查看時間的互動數。
 * 時間戳為 0(平台給了壞值)者不計為未讀——否則每次整理都會有永遠消不掉的紅點。
 */
export function countUnseen(items: Array<{ timestamp: number }>, seenAt: number): number {
  return items.filter((i) => i.timestamp > 0 && i.timestamp > seenAt).length;
}
