/**
 * 自動同步的同步碼保管(方案 A 二期,2026-10-06)。
 * 存 localStorage 的便利取捨(維護者拍板):加密金鑰仍由同步碼在瀏覽器**每次**衍生,
 * 風險面不變;清瀏覽器資料會一併消失,屆時重新輸入即可。獨立於內容資料的
 * `text-message:v2`(比照 Gemini key 的另鍵慣例)。
 */
const CODE_KEY = 'text-message:library-code';

export function loadStoredSyncCode(): string {
  try {
    return localStorage.getItem(CODE_KEY) ?? '';
  } catch {
    return '';
  }
}

export function saveStoredSyncCode(code: string): void {
  try {
    localStorage.setItem(CODE_KEY, code);
  } catch {
    // 隱私模式等情境靜默略過(僅失去自動同步,手動流程不受影響)
  }
}

export function clearStoredSyncCode(): void {
  try {
    localStorage.removeItem(CODE_KEY);
  } catch {
    // 同上
  }
}
