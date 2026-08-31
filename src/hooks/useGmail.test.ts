// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useGmail } from './useGmail';
import { acquireToken, revokeToken } from '../services/gmail/gis';
import { fetchMessages, fetchProfile, listMessageIds } from '../services/gmail/gmailApi';
import type { Email } from '../types';

// 讓 GMAIL_ENABLED 為 true 以測試連線狀態機;GIS 與 REST 層全 mock,不觸網
vi.mock('../services/gmail/config', () => ({
  GMAIL_ENABLED: true,
  GMAIL_SCOPE: 'https://www.googleapis.com/auth/gmail.readonly',
}));

vi.mock('../services/gmail/gis', () => ({
  loadGisScript: vi.fn(async () => {}),
  acquireToken: vi.fn(),
  revokeToken: vi.fn(),
}));

vi.mock('../services/gmail/gmailApi', () => ({
  fetchProfile: vi.fn(),
  listMessageIds: vi.fn(),
  fetchMessages: vi.fn(),
}));

vi.mock('../services/gmail/mapToEmail', () => ({
  mapGmailMessage: vi.fn((m: { id: string }) => ({ id: m.id }) as Email),
}));

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(acquireToken).mockResolvedValue({ access_token: 'tok', expires_in: 3600 });
  vi.mocked(fetchProfile).mockResolvedValue({ emailAddress: 'me@example.com' });
});

describe('useGmail 連線狀態機', () => {
  it('connect:取得 token、載入第一頁並進入 connected', async () => {
    vi.mocked(listMessageIds).mockResolvedValue({ ids: ['m1', 'm2'], nextPageToken: 'p2' });
    vi.mocked(fetchMessages).mockResolvedValue([
      { id: 'm1', internalDate: '1000' },
      { id: 'm2', internalDate: '2000' },
    ] as never[]);

    const { result } = renderHook(() => useGmail());
    await act(async () => {
      await result.current.connect();
    });

    expect(result.current.status).toBe('connected');
    expect(result.current.accountEmail).toBe('me@example.com');
    expect(result.current.emails.map((e) => e.id)).toEqual(['m2', 'm1']); // newest first
    expect(result.current.canLoadMore).toBe(true);
  });

  it('loadMore:附加下一頁並去重,nextPageToken 用盡後關閉', async () => {
    vi.mocked(listMessageIds)
      .mockResolvedValueOnce({ ids: ['m1'], nextPageToken: 'p2' })
      .mockResolvedValueOnce({ ids: ['m2', 'm1'], nextPageToken: null });
    vi.mocked(fetchMessages).mockResolvedValue([
      { id: 'm1' },
      { id: 'm2' },
    ] as never[]);

    const { result } = renderHook(() => useGmail());
    await act(async () => {
      await result.current.connect();
    });
    await act(async () => {
      await result.current.loadMore();
    });

    expect(result.current.emails.map((e) => e.id)).toEqual(['m1', 'm2']); // m1 去重
    expect(result.current.canLoadMore).toBe(false);
    expect(vi.mocked(listMessageIds).mock.calls[1][1]).toBe('p2'); // 第二次帶 pageToken
  });

  it('disconnect:撤銷 token、清空郵件、回到 disconnected', async () => {
    vi.mocked(listMessageIds).mockResolvedValue({ ids: ['m1'], nextPageToken: null });
    vi.mocked(fetchMessages).mockResolvedValue([{ id: 'm1' }] as never[]);

    const { result } = renderHook(() => useGmail());
    await act(async () => {
      await result.current.connect();
    });
    act(() => {
      result.current.disconnect();
    });

    expect(revokeToken).toHaveBeenCalledWith('tok');
    expect(result.current.status).toBe('disconnected');
    expect(result.current.emails).toEqual([]);
    expect(result.current.canLoadMore).toBe(false);
  });
});
