import { describe, expect, it } from 'vitest';
import { LIBRARY_BLOB_LIMIT_BYTES } from '../config';
import { isValidCodeId, libraryKey, loadLibraryBlob, saveLibraryBlob, validateSaveRequest } from './store';
import type { KvLike } from '../config';

function fakeKv(): KvLike & { map: Map<string, string> } {
  const map = new Map<string, string>();
  return {
    map,
    get: async (k) => map.get(k) ?? null,
    put: async (k, v) => void map.set(k, v),
    delete: async (k) => void map.delete(k),
    list: async () => ({ keys: [...map.keys()].map((name) => ({ name })), list_complete: true }),
  };
}

const CODE_ID = 'a'.repeat(64);

describe('文庫雲端備份:驗證(方案 A)', () => {
  it('codeId 須為 64 hex', () => {
    expect(isValidCodeId(CODE_ID)).toBe(true);
    expect(isValidCodeId('a'.repeat(63))).toBe(false);
    expect(isValidCodeId('Z'.repeat(64))).toBe(false);
    expect(isValidCodeId(123)).toBe(false);
    expect(isValidCodeId(null)).toBe(false);
  });

  it('儲存請求:欄位齊且在大小限內 → ok;缺欄位/超限 → 對應原因', () => {
    const ok = validateSaveRequest({ codeId: CODE_ID, data: 'YWJj', iv: 'aXY=', savedAt: 1696500000000 });
    expect(ok.ok).toBe(true);
    if (ok.ok) expect(ok.blob).toEqual({ v: 1, data: 'YWJj', iv: 'aXY=', savedAt: 1696500000000 });

    expect(validateSaveRequest({ codeId: 'x', data: 'd', iv: 'i', savedAt: 1 })).toEqual({ ok: false, reason: 'invalid_code_id' });
    expect(validateSaveRequest({ codeId: CODE_ID, data: '', iv: 'i', savedAt: 1 })).toEqual({ ok: false, reason: 'invalid_data' });
    expect(validateSaveRequest({ codeId: CODE_ID, data: 'd', iv: 'i', savedAt: 'x' })).toEqual({ ok: false, reason: 'invalid_saved_at' });
    const tooBig = 'x'.repeat(LIBRARY_BLOB_LIMIT_BYTES + 1);
    expect(validateSaveRequest({ codeId: CODE_ID, data: tooBig, iv: 'i', savedAt: 1 })).toEqual({ ok: false, reason: 'payload_too_large' });
  });
});

describe('文庫雲端備份:KV 存取', () => {
  it('roundtrip:存後可取;鍵為 library:<codeId>;形狀不符回 null;無資料回 null', async () => {
    const kv = fakeKv();
    const blob = { v: 1 as const, data: 'ZW5jcnlwdGVk', iv: 'aXY=', savedAt: 1696500000000 };
    await saveLibraryBlob(kv, CODE_ID, blob);
    expect(kv.map.has(libraryKey(CODE_ID))).toBe(true);
    expect(await loadLibraryBlob(kv, CODE_ID)).toEqual(blob);

    expect(await loadLibraryBlob(kv, 'b'.repeat(64))).toBeNull();
    kv.map.set(libraryKey('c'.repeat(64)), '{"v":2,"data":"x","iv":"y","savedAt":1}');
    expect(await loadLibraryBlob(kv, 'c'.repeat(64))).toBeNull();
    kv.map.set(libraryKey('d'.repeat(64)), 'not-json');
    expect(await loadLibraryBlob(kv, 'd'.repeat(64))).toBeNull();
  });
});
