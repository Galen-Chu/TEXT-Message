// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useFacebookProxy } from './useFacebookProxy';
import {
  checkFacebookStatus,
  publishFacebookNow,
  scheduleFacebookPost,
} from '../services/backend/client';

// 強制 BACKEND_ENABLED(不受環境影響);client 層全 mock,不觸網
vi.mock('../services/backend/config', () => ({
  BACKEND_API_BASE: 'https://worker.test',
  BACKEND_ENABLED: true,
}));

vi.mock('../services/backend/client', () => ({
  facebookAuthStartUrl: (base: string, install: string) => `${base}/auth/facebook/start?install=${install}`,
  checkFacebookStatus: vi.fn(),
  publishFacebookNow: vi.fn(),
  scheduleFacebookPost: vi.fn(),
}));

beforeEach(() => {
  vi.clearAllMocks();
  window.history.replaceState(null, '', '/');
});

// vitest 未開 globals → RTL 不自動 cleanup:hook 跨測試存活(掛著 message/focus
// 監聽)會放大「jsdom 拆除後才執行」的風險(2026-10-24 CI 紅燈即此模式)。
afterEach(() => {
  cleanup();
});

describe('useFacebookProxy(2026-09-30,鏡像 useThreadsProxy)', () => {
  it('掛載時查詢狀態:已連線 → connected 並帶粉專名稱', async () => {
    vi.mocked(checkFacebookStatus).mockResolvedValue({
      ok: true,
      data: { connected: true, pageName: '我的粉專' },
    });
    const { result } = renderHook(() => useFacebookProxy());
    await act(async () => {});
    expect(result.current.status).toBe('connected');
    expect(result.current.enabled).toBe(true);
    expect(result.current.pageName).toBe('我的粉專');
  });

  it('未連線 → disconnected 且 pageName 清空;API 失敗 → error', async () => {
    vi.mocked(checkFacebookStatus).mockResolvedValue({
      ok: true,
      data: { connected: false, pageName: null },
    });
    const { result } = renderHook(() => useFacebookProxy());
    await act(async () => {});
    expect(result.current.status).toBe('disconnected');
    expect(result.current.pageName).toBeNull();

    vi.mocked(checkFacebookStatus).mockResolvedValue({ ok: false, code: 'network' });
    const second = renderHook(() => useFacebookProxy());
    await act(async () => {});
    expect(second.result.current.status).toBe('error');
  });

  it('OAuth 回跳參數:偵測 ?facebook=connected、清除網址參數並重查', async () => {
    window.history.replaceState(null, '', '/TEXT-Message/?facebook=connected');
    vi.mocked(checkFacebookStatus).mockResolvedValue({
      ok: true,
      data: { connected: true, pageName: '我的粉專' },
    });
    renderHook(() => useFacebookProxy());
    await act(async () => {});
    expect(window.location.search).toBe('');
  });

  it('授權分頁回報:同源 message 事件重查連線;非同源忽略', async () => {
    vi.mocked(checkFacebookStatus).mockResolvedValue({
      ok: true,
      data: { connected: false, pageName: null },
    });
    const { result } = renderHook(() => useFacebookProxy());
    await act(async () => {});
    expect(result.current.status).toBe('disconnected');

    vi.mocked(checkFacebookStatus).mockResolvedValue({
      ok: true,
      data: { connected: true, pageName: '我的粉專' },
    });
    await act(async () => {
      window.dispatchEvent(
        new MessageEvent('message', {
          origin: window.location.origin,
          data: { type: 'facebook-auth', result: 'connected' },
        }),
      );
    });
    expect(result.current.status).toBe('connected');

    // 非同源訊息一律忽略:mock 翻轉為未連線,若被處理會重查成 disconnected;狀態維持即為忽略
    vi.mocked(checkFacebookStatus).mockResolvedValue({
      ok: true,
      data: { connected: false, pageName: null },
    });
    await act(async () => {
      window.dispatchEvent(
        new MessageEvent('message', {
          origin: 'https://evil.example',
          data: { type: 'facebook-auth', result: 'error' },
        }),
      );
    });
    expect(result.current.status).toBe('connected');
  });

  it('連點鎖定:操作進行中重複呼叫回 null,完成後解鎖;publish/schedule 流經 client', async () => {
    let release: (v: unknown) => void = () => {};
    vi.mocked(checkFacebookStatus).mockResolvedValue({
      ok: true,
      data: { connected: true, pageName: '我的粉專' },
    });
    vi.mocked(publishFacebookNow).mockImplementation(
      () => new Promise((res) => { release = res; }) as unknown as Promise<{ ok: true; data: { id: string } }>,
    );
    const { result } = renderHook(() => useFacebookProxy());
    await act(async () => {});
    const first = result.current.publish('文字');
    const second = result.current.publish('文字'); // 第一次仍在進行中
    await expect(second).resolves.toBeNull();
    // promise 鏡像(含 finally 的 setBusy)必須在 act 內走完:否則 setState 排程
    // 可能在 jsdom 環境拆除後才執行,react-dom 撈 window 炸 ReferenceError(2026-10-24 CI)。
    await act(async () => {
      release({ ok: true, data: { id: 'p9' } });
      await expect(first).resolves.toEqual({ ok: true, data: { id: 'p9' } });
    });

    vi.mocked(scheduleFacebookPost).mockResolvedValue({ ok: true, data: { itemId: 'q1' } });
    await act(async () => {
      await expect(result.current.schedule('文字', 1893456000000)).resolves.toEqual({
        ok: true,
        data: { itemId: 'q1' },
      });
    });
  });
});
