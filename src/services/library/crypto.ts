/**
 * 文庫雲端備份的加密層(方案 A,2026-10-05)。
 * 同步碼 → PBKDF2(固定鹽)→ AES-GCM 金鑰:金鑰、加密、解密**只在使用者瀏覽器**;
 * 後端僅存密文,且只收到 codeId(同步碼的 SHA-256 hex)作為 KV 鍵——不經手同步碼原文。
 */
export const LIBRARY_KDF_ITERATIONS = 150_000;
/** 固定鹽:單人產品的取捨(無 per-user 鹽),強度由同步碼本身承擔——備份說明會誠實標示。 */
const KDF_SALT = 'text-message/library/v1';

type SubtleLike = Pick<SubtleCrypto, 'importKey' | 'deriveBits' | 'encrypt' | 'decrypt' | 'digest'>;

/** 使用環境原生 WebCrypto(現代瀏覽器與 Node ≥18/vitest 皆有全域 crypto.subtle)。 */
async function subtle(): Promise<SubtleLike> {
  const s = globalThis.crypto?.subtle;
  if (!s) throw new Error('此環境不支援 WebCrypto(crypto.subtle),無法執行文庫雲端備份');
  return s;
}

function bufToB64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

function b64ToBuf(b64: string): Uint8Array {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

function bytesToHex(buf: ArrayBuffer): string {
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** 同步碼的 KV 鍵識別碼:SHA-256 hex(64 字)。 */
export async function codeIdOf(code: string): Promise<string> {
  const s = await subtle();
  return bytesToHex(await s.digest('SHA-256', new TextEncoder().encode(code)));
}

async function deriveKey(code: string): Promise<CryptoKey> {
  const s = await subtle();
  const material = await s.importKey('raw', new TextEncoder().encode(code), 'PBKDF2', false, [
    'deriveBits',
  ]);
  const bits = await s.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: new TextEncoder().encode(KDF_SALT), iterations: LIBRARY_KDF_ITERATIONS },
    material,
    256,
  );
  return s.importKey('raw', bits, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
}

/** 加密備份內容 → { codeId, data, iv }(base64)。 */
export async function encryptLibraryBlob(
  code: string,
  plaintext: string,
): Promise<{ codeId: string; data: string; iv: string }> {
  const s = await subtle();
  const key = await deriveKey(code);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cipher = await s.encrypt(
    { name: 'AES-GCM', iv },
    key,
    new TextEncoder().encode(plaintext),
  );
  return { codeId: await codeIdOf(code), data: bufToB64(cipher), iv: bufToB64(iv.buffer as ArrayBuffer) };
}

/** 解密備份內容;同步碼錯誤(AES-GCM 驗證失敗)會 throw——呼叫端以 try/catch 對應文案。 */
export async function decryptLibraryBlob(
  code: string,
  blob: { data: string; iv: string },
): Promise<string> {
  const s = await subtle();
  const key = await deriveKey(code);
  const plain = await s.decrypt(
    { name: 'AES-GCM', iv: b64ToBuf(blob.iv) },
    key,
    b64ToBuf(blob.data),
  );
  return new TextDecoder().decode(plain);
}
