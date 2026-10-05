import { describe, expect, it } from 'vitest';
import { codeIdOf, decryptLibraryBlob, encryptLibraryBlob } from './crypto';

describe('文庫雲端備份:加密層(方案 A)', () => {
  it('roundtrip:加密後可解回原文;每次 IV 不同(密文不同)', async () => {
    const code = 'my-sync-code-2026';
    const text = JSON.stringify({ hello: '文庫', n: 42 });
    const a = await encryptLibraryBlob(code, text);
    const b = await encryptLibraryBlob(code, text);
    expect(await decryptLibraryBlob(code, a)).toBe(text);
    expect(await decryptLibraryBlob(code, b)).toBe(text);
    expect(a.data).not.toBe(b.data);
    expect(a.iv).not.toBe(b.iv);
  });

  it('同步碼錯誤 → 解密 throw(AES-GCM 驗證失敗)', async () => {
    const enc = await encryptLibraryBlob('正確的同步碼', '秘密內容');
    await expect(decryptLibraryBlob('錯誤的同步碼', enc)).rejects.toThrow();
  });

  it('codeId=同步碼的 SHA-256 hex(64 字);不同碼不同 id', async () => {
    const id = await codeIdOf('abc');
    expect(id).toMatch(/^[0-9a-f]{64}$/);
    expect(await codeIdOf('abd')).not.toBe(id);
  });
});
