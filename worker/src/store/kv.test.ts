import { describe, expect, it } from 'vitest';
import type { KvLike } from '../config';
import { aesEncrypt } from './crypto';
import { loadThreadsToken, saveThreadsToken } from './kv';

const KEY = 'ab'.repeat(32);

/** 記憶體假 KV(僅覆蓋本模組用到的介面)。 */
function memKv(initial: Record<string, string> = {}): KvLike {
  return {
    get: async (k) => initial[k] ?? null,
    put: async (k, v) => {
      initial[k] = v;
    },
    delete: async (k) => {
      delete initial[k];
    },
    list: async () => ({ keys: [], list_complete: true }),
  };
}

describe('threads token KV 讀寫', () => {
  it('加密 round-trip:存後讀回一致', async () => {
    const kv = memKv();
    const token = { accessToken: 't', userId: 'u1', expiresAt: 123 };
    await saveThreadsToken(kv, 'install-12345678', token, KEY);
    expect(await loadThreadsToken(kv, 'install-12345678', KEY)).toEqual(token);
  });

  it('容錯:舊格式數字型 userId 讀取時轉字串', async () => {
    const legacy = await aesEncrypt(
      JSON.stringify({ accessToken: 't', userId: 123456789012, expiresAt: 0 }),
      KEY,
    );
    const kv = memKv({ 'token:threads:install-12345678': legacy });
    expect(await loadThreadsToken(kv, 'install-12345678', KEY)).toEqual({
      accessToken: 't',
      userId: '123456789012',
      expiresAt: 0,
    });
  });

  it('無資料或無法解密的 payload 回 null', async () => {
    const kv = memKv();
    expect(await loadThreadsToken(kv, 'install-12345678', KEY)).toBeNull();
    const bad = memKv({ 'token:threads:install-12345678': 'v1.not-a-valid-payload' });
    expect(await loadThreadsToken(bad, 'install-12345678', KEY)).toBeNull();
  });
});
