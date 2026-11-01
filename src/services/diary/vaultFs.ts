/**
 * 日記匯出的檔案系統層(DIARY-PLAN D7,2026-11-01)——唯一碰 DOM/瀏覽器 API 的一支,
 * markdown 組裝在 `vaultMarkdown.ts`(純函式、可測)。
 *
 * 用 File System Access API 直接寫進使用者自己挑的 Obsidian vault 資料夾:
 * **資料不出這台機器**(零後端、不經 worker、不進雲端備份),所以紅線零修訂。
 *
 * 誠實的三個限制(UI 必須標示):
 * ①**只有 Chromium 系支援**(Chrome/Edge);Firefox/Safari 退回「下載彙整檔」。
 * ②**handle 只存在記憶體**(刻意不用 IndexedDB 保存):重開網頁後首次匯出要再挑一次
 *   資料夾——這是 D7 說的「半自動」,非安裝式網頁的必然結果,不是 bug。
 * ③權限是使用者當下授予的 readwrite,隨時可在瀏覽器收回。
 */
import { VAULT_LIFE_PATH } from './vaultMarkdown';

/**
 * 最小必要的 ambient 型別:`showDirectoryPicker` 不在 TS 的 lib.dom 標準宣告裡
 * (規格仍在 WICG 階段),所以自己宣告而不是 `as any`——型別錯誤要在編譯期被抓到。
 */
interface DirectoryPickerOptions {
  id?: string;
  mode?: 'read' | 'readwrite';
  startIn?: string;
}
type PickerWindow = Window & {
  showDirectoryPicker?: (opts?: DirectoryPickerOptions) => Promise<FileSystemDirectoryHandle>;
};

export type VaultErrorCode = 'unsupported' | 'cancelled' | 'permission' | 'write_failed';

export class VaultError extends Error {
  constructor(public code: VaultErrorCode, message?: string) {
    super(message ?? code);
    this.name = 'VaultError';
  }
}

/** 這個瀏覽器能不能直接寫資料夾(決定 UI 顯示匯出流程還是下載退路)。 */
export function isVaultExportSupported(): boolean {
  return typeof window !== 'undefined' && typeof (window as PickerWindow).showDirectoryPicker === 'function';
}

/**
 * 讓使用者挑 vault 根目錄。取消 → 回 null(不是錯誤:按了「取消」是正常操作)。
 * `id` 讓瀏覽器記住上次挑的位置(下次 picker 直接開在那裡,減少半自動的摩擦)。
 */
export async function pickVaultDirectory(): Promise<FileSystemDirectoryHandle | null> {
  const picker = (window as PickerWindow).showDirectoryPicker;
  if (!picker) throw new VaultError('unsupported');
  try {
    return await picker({ id: 'text-message-vault', mode: 'readwrite' });
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') return null;
    if (err instanceof DOMException && err.name === 'SecurityError') throw new VaultError('permission');
    throw new VaultError('permission', err instanceof Error ? err.message : undefined);
  }
}

/**
 * 走到 `daily/life/`(不存在就建)。
 * **只建這條路徑上的資料夾**——vault 的禁止事項包含不動 `.obsidian/`、不刪 `archive/`,
 * 本模組從頭到尾只開這一個子樹、只讀寫 `YYYY-MM-DD.md`,其他一概不碰。
 */
export async function ensureLifeDirectory(
  root: FileSystemDirectoryHandle,
): Promise<FileSystemDirectoryHandle> {
  let dir = root;
  for (const seg of VAULT_LIFE_PATH) {
    try {
      dir = await dir.getDirectoryHandle(seg, { create: true });
    } catch (err) {
      throw new VaultError('permission', err instanceof Error ? err.message : seg);
    }
  }
  return dir;
}

/** 讀既有筆記內容;檔案不存在 → null(呼叫端據此決定 splice 還是新建)。 */
export async function readNote(
  dir: FileSystemDirectoryHandle,
  name: string,
): Promise<string | null> {
  try {
    const handle = await dir.getFileHandle(name);
    const file = await handle.getFile();
    return await file.text();
  } catch (err) {
    if (err instanceof DOMException && err.name === 'NotFoundError') return null;
    throw new VaultError('permission', err instanceof Error ? err.message : name);
  }
}

/** 寫入(覆蓋整檔)。內容必須是呼叫端 splice 過的完整檔案——本層不做組裝。 */
export async function writeNote(
  dir: FileSystemDirectoryHandle,
  name: string,
  content: string,
): Promise<void> {
  try {
    const handle = await dir.getFileHandle(name, { create: true });
    const writable = await handle.createWritable();
    await writable.write(content);
    await writable.close();
  } catch (err) {
    throw new VaultError('write_failed', err instanceof Error ? err.message : name);
  }
}

/**
 * Firefox/Safari 的退路:把彙整 markdown 當一般檔案下載(冷備份,非活體副本)。
 * 零依賴紅線下不引入 zip 套件,所以是單一 markdown 而非一天一檔。
 */
export function downloadMarkdown(text: string, filename: string): void {
  const blob = new Blob([text], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
