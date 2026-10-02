import { describe, expect, it } from 'vitest';
import { resolveActiveTab } from './PublishCard';

describe('resolveActiveTab(D14 頁簽解析)', () => {
  it('上次頁簽仍在已選清單 → 保持', () => {
    expect(resolveActiveTab(['fb', 'threads'], 'threads')).toBe('threads');
  });

  it('上次頁簽被取消勾選 → 退回第一個已選平台', () => {
    expect(resolveActiveTab(['fb', 'threads', 'yt'], 'ig')).toBe('fb');
    expect(resolveActiveTab(['line'], 'threads')).toBe('line');
  });

  it('無已選平台 → null;prev=null → 第一個', () => {
    expect(resolveActiveTab([], 'fb')).toBeNull();
    expect(resolveActiveTab([], null)).toBeNull();
    expect(resolveActiveTab(['yt', 'fb'], null)).toBe('yt');
  });
});
