/**
 * 文庫雲端備份的 KV 存取與請求驗證(方案 A,2026-10-05)。
 * 資料邊界:payload 由瀏覽器以同步碼衍生金鑰(PBKDF2→AES-GCM)加密後上傳——
 * worker 僅保管密文 blob,**不解析內容、不經手同步碼原文**(請求僅帶 codeId=同步碼的
 * SHA-256 hex,作為 KV 鍵;金鑰與解密能力只在使用者瀏覽器)。
 */
import type { KvLike } from '../config';
import { LIBRARY_BLOB_LIMIT_BYTES } from '../config';

const LIBRARY_PREFIX = 'library:';

export interface LibraryBlob {
  /** 版本(目前 1)。 */
  v: 1;
  /** 瀏覽器加密後的密文(base64)。 */
  data: string;
  /** AES-GCM IV(base64)。 */
  iv: string;
  /** 備份時間(ms epoch,由客戶端宣告)。 */
  savedAt: number;
}

export function libraryKey(codeId: string): string {
  return `${LIBRARY_PREFIX}${codeId}`;
}

/** codeId 必須是 64 個十六進位字(SHA-256 hex)。 */
export function isValidCodeId(codeId: unknown): codeId is string {
  return typeof codeId === 'string' && /^[0-9a-f]{64}$/.test(codeId);
}

/** 儲存請求的形狀與大小驗證;不通過回原因字串。 */
export function validateSaveRequest(body: {
  codeId?: unknown;
  data?: unknown;
  iv?: unknown;
  savedAt?: unknown;
}): { ok: true; blob: LibraryBlob } | { ok: false; reason: string } {
  if (!isValidCodeId(body.codeId)) return { ok: false, reason: 'invalid_code_id' };
  if (typeof body.data !== 'string' || !body.data) return { ok: false, reason: 'invalid_data' };
  if (typeof body.iv !== 'string' || !body.iv) return { ok: false, reason: 'invalid_iv' };
  const savedAt = Number(body.savedAt ?? 0);
  if (!Number.isFinite(savedAt) || savedAt <= 0) return { ok: false, reason: 'invalid_saved_at' };
  const size = body.data.length + body.iv.length;
  if (size > LIBRARY_BLOB_LIMIT_BYTES) return { ok: false, reason: 'payload_too_large' };
  return { ok: true, blob: { v: 1, data: body.data, iv: body.iv, savedAt } };
}

export async function saveLibraryBlob(kv: KvLike, codeId: string, blob: LibraryBlob): Promise<void> {
  await kv.put(libraryKey(codeId), JSON.stringify(blob));
}

export async function loadLibraryBlob(kv: KvLike, codeId: string): Promise<LibraryBlob | null> {
  const raw = await kv.get(libraryKey(codeId));
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as Partial<LibraryBlob>;
    if (v.v !== 1 || typeof v.data !== 'string' || typeof v.iv !== 'string' || typeof v.savedAt !== 'number') {
      return null;
    }
    return { v: 1, data: v.data, iv: v.iv, savedAt: v.savedAt };
  } catch {
    return null;
  }
}
