/**
 * AES-GCM 加解密(WebCrypto;Workers 與 node 18+ 皆內建)。
 * 金鑰為 32 bytes hex(64 字);輸出格式 `v1.<iv-b64>.<ciphertext-b64>`,自帶版本前綴以便未來換演算法。
 */

function hexToBytes(hex: string): Uint8Array {
  if (hex.length % 2 !== 0 || !/^[0-9a-fA-F]+$/.test(hex)) {
    throw new Error('TOKEN_ENCRYPTION_KEY 必須是 hex 字串');
  }
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

function toB64(bytes: Uint8Array): string {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}

function fromB64(b64: string): Uint8Array {
  const s = atob(b64);
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

async function importKey(hexKey: string): Promise<CryptoKey> {
  return crypto.subtle.importKey('raw', hexToBytes(hexKey) as unknown as ArrayBuffer, 'AES-GCM', false, [
    'encrypt',
    'decrypt',
  ]);
}

export async function aesEncrypt(plaintext: string, hexKey: string): Promise<string> {
  const key = await importKey(hexKey);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv as unknown as ArrayBuffer },
    key,
    new TextEncoder().encode(plaintext) as unknown as ArrayBuffer,
  );
  return `v1.${toB64(iv)}.${toB64(new Uint8Array(ct))}`;
}

export async function aesDecrypt(payload: string, hexKey: string): Promise<string> {
  const [version, ivB64, ctB64] = payload.split('.');
  if (version !== 'v1' || !ivB64 || !ctB64) throw new Error('unknown encrypted payload version');
  const key = await importKey(hexKey);
  const pt = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: fromB64(ivB64) as unknown as ArrayBuffer },
    key,
    fromB64(ctB64) as unknown as ArrayBuffer,
  );
  return new TextDecoder().decode(pt);
}

/** 以金鑰對訊息做 HMAC-SHA256(hex 輸出);用於 OAuth state 防竄改。 */
export async function hmacHex(message: string, hexKey: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    hexToBytes(hexKey) as unknown as ArrayBuffer,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode(message) as unknown as ArrayBuffer,
  );
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}
