// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { getInstallId } from './installId';

describe('getInstallId', () => {
  it('產生符合格式的 id、同工作階段一致,並持久化於 localStorage', () => {
    const a = getInstallId();
    expect(a).toMatch(/^ins-[A-Za-z0-9_-]{4,}$/);
    // 模組內快取:同工作階段回同一個 id
    expect(getInstallId()).toBe(a);
    // 持久化:寫入 localStorage(下次工作階段讀回同一個)
    expect(localStorage.getItem('text-message:install-id')).toBe(a);
  });
});
