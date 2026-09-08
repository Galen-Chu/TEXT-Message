// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useThreadsProxy } from './useThreadsProxy';
import {
  cancelThreadsQueueItem,
  checkThreadsStatus,
  listThreadsQueue,
  publishThreadsNow,
  scheduleThreadsPost,
} from '../services/backend/client';

// 強制 BACKEND_ENABLED(不受環境影響);client 層全 mock,不觸網
vi.mock('../services/backend/config', () => ({
  BACKEND_API_BASE: 'https://worker.test',
  BACKEND_ENABLED: true,
}));

vi.mock('../services/backend/client', () => ({
  threadsAuthStartUrl: (base: string, install: string) => `${base}/auth/threads/start?install=${install}`,
  checkThreadsStatus: vi.fn(),
  publishThreadsNow: vi.fn(),
  scheduleThreadsPost: vi.fn(),
  listThreadsQueue: vi.fn(),
  cancelThreadsQueueItem: vi.fn(),
}));

beforeEach(() => {
  vi.clearAllMocks();
  window.history.replaceState(null, '', '/');
});

describe('useThreadsProxy', () => {
  it('掛載時查詢狀態:已連線 → connected', async () => {
    vi.mocked(checkThreadsStatus).mockResolvedValue({ ok: true, data: { connected: true } });
    vi.mocked(listThreadsQueue).mockResolvedValue({ ok: true, data: { items: [] } });
    const { result } = renderHook(() => useThreadsProxy());
    await act(async () => {});
    expect(result.current.status).toBe('connected');
    expect(result.current.enabled).toBe(true);
  });

  it('未連線 → disconnected;API 失敗 → error', async () => {
    vi.mocked(checkThreadsStatus).mockResolvedValue({ ok: true, data: { connected: false } });
    const { result } = renderHook(() => useThreadsProxy());
    await act(async () => {});
    expect(result.current.status).toBe('disconnected');

    vi.mocked(checkThreadsStatus).mockResolvedValue({ ok: false, code: 'network' });
    const second = renderHook(() => useThreadsProxy());
    await act(async () => {});
    expect(second.result.current.status).toBe('error');
  });

  it('OAuth 回跳參數:偵測 ?threads=connected、清除網址參數並重查', async () => {
    window.history.replaceState(null, '', '/TEXT-Message/?threads=connected');
    vi.mocked(checkThreadsStatus).mockResolvedValue({ ok: true, data: { connected: true } });
    vi.mocked(listThreadsQueue).mockResolvedValue({ ok: true, data: { items: [] } });
    renderHook(() => useThreadsProxy());
    await act(async () => {});
    expect(window.location.search).toBe('');
  });

  it('授權分頁回報(2026-09-07 popup 返回):同源 message 事件重查連線;非同源忽略', async () => {
    vi.mocked(checkThreadsStatus).mockResolvedValue({ ok: true, data: { connected: false } });
    const { result } = renderHook(() => useThreadsProxy());
    await act(async () => {});
    expect(result.current.status).toBe('disconnected');

    vi.mocked(checkThreadsStatus).mockResolvedValue({ ok: true, data: { connected: true } });
    await act(async () => {
      window.dispatchEvent(
        new MessageEvent('message', {
          origin: window.location.origin,
          data: { type: 'threads-auth', result: 'connected' },
        }),
      );
    });
    expect(result.current.status).toBe('connected');

    // 非同源訊息一律忽略:mock 翻轉為未連線,若被處理會重查成 disconnected;狀態維持即為忽略
    vi.mocked(checkThreadsStatus).mockResolvedValue({ ok: true, data: { connected: false } });
    await act(async () => {
      window.dispatchEvent(
        new MessageEvent('message', { origin: 'https://evil.example', data: { type: 'threads-auth', result: 'error' } }),
      );
    });
    expect(result.current.status).toBe('connected');
  });

  it('連點鎖定(2026-09-08 防呆):操作進行中重複呼叫回 null,完成後解鎖', async () => {
    let release: (v: unknown) => void = () => {};
    vi.mocked(publishThreadsNow).mockImplementation(
      () => new Promise((res) => { release = res; }) as unknown as Promise<{ ok: true; data: { id: string } }>,
    );
    const { result } = renderHook(() => useThreadsProxy());
    const first = result.current.publish('文字');
    const second = result.current.publish('文字'); // 第一次仍在進行中
    await expect(second).resolves.toBeNull();
    release({ ok: true, data: { id: 'p9' } });
    await expect(first).resolves.toEqual({ ok: true, data: { id: 'p9' } });

    vi.mocked(publishThreadsNow).mockResolvedValue({ ok: true, data: { id: 'p10' } });
    await expect(result.current.publish('再來')).resolves.toEqual({ ok: true, data: { id: 'p10' } });
  });

  it('publish / schedule / loadQueue / cancel 流經 client', async () => {
    vi.mocked(checkThreadsStatus).mockResolvedValue({ ok: true, data: { connected: true } });
    vi.mocked(publishThreadsNow).mockResolvedValue({ ok: true, data: { id: 'p1' } });
    vi.mocked(scheduleThreadsPost).mockResolvedValue({ ok: true, data: { itemId: 'q1' } });
    vi.mocked(listThreadsQueue).mockResolvedValue({
      ok: true,
      data: { items: [{ id: 'q1', text: 'a', publishAt: 1, status: 'pending', attempts: 0 }] },
    });
    vi.mocked(cancelThreadsQueueItem).mockResolvedValue({ ok: true, data: { ok: true } });

    const { result } = renderHook(() => useThreadsProxy());
    await act(async () => {});

    let r: { ok: boolean } | undefined | null;
    await act(async () => {
      r = await result.current.publish('貼文');
    });
    expect(r).toEqual({ ok: true, data: { id: 'p1' } });
    await act(async () => {
      r = await result.current.schedule('貼文', 1893456000000);
    });
    expect(r).toEqual({ ok: true, data: { itemId: 'q1' } });

    await act(async () => {
      await result.current.loadQueue();
    });
    expect(result.current.queue).toHaveLength(1);
    await act(async () => {
      r = await result.current.cancel('q1');
    });
    expect(r?.ok).toBe(true);
    expect(cancelThreadsQueueItem).toHaveBeenCalledWith(
      expect.objectContaining({ itemId: 'q1' }),
    );
  });
});
