import { describe, expect, it } from 'vitest';
import { aesDecrypt, aesEncrypt, hmacHex } from './store/crypto';

const KEY = 'a'.repeat(64); // 32 bytes hex

describe('AES-GCM 加解密', () => {
  it('roundtrip:加密後可解回原文,且每次 IV 不同(密文不同)', async () => {
    const plain = '{"accessToken":"tok","userId":"123"}';
    const c1 = await aesEncrypt(plain, KEY);
    const c2 = await aesEncrypt(plain, KEY);
    expect(await aesDecrypt(c1, KEY)).toBe(plain);
    expect(c1).not.toBe(c2);
    expect(c1.startsWith('v1.')).toBe(true);
  });

  it('金鑰錯誤時解密失敗(丟錯而非回原文)', async () => {
    const c = await aesEncrypt('secret', KEY);
    await expect(aesDecrypt(c, 'b'.repeat(64))).rejects.toThrow();
  });

  it('金鑰格式錯誤直接拒絕', async () => {
    await expect(aesEncrypt('x', 'not-hex')).rejects.toThrow();
    await expect(aesEncrypt('x', 'abc')).rejects.toThrow();
  });
});

describe('HMAC state 簽章', () => {
  it('同一訊息同一金鑰簽章一致(hex 64 字)', async () => {
    const a = await hmacHex('install-1', KEY);
    const b = await hmacHex('install-1', KEY);
    expect(a).toBe(b);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
    expect(await hmacHex('install-2', KEY)).not.toBe(a);
  });
});
