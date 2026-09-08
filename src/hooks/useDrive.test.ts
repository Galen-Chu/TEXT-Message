// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useDrive } from './useDrive';
import { exportDocText, listDriveDocs } from '../services/drive/driveApi';
import { acquireDriveToken, revokeDriveToken } from '../services/drive/gis';

// 強制 ENABLED;gis 與 API 層全 mock,不觸網
vi.mock('../services/drive/config', () => ({
  DRIVE_CLIENT_ID: 'test-client',
  DRIVE_ENABLED: true,
  DRIVE_READONLY_SCOPE: 'https://www.googleapis.com/auth/drive.readonly',
}));

vi.mock('../services/drive/gis', () => ({
  acquireDriveToken: vi.fn(),
  revokeDriveToken: vi.fn(),
}));

vi.mock('../services/drive/driveApi', () => ({
  listDriveDocs: vi.fn(),
  exportDocText: vi.fn(),
}));

vi.mock('../services/gmail/gis', () => ({
  loadGisScript: vi.fn().mockResolvedValue(undefined),
  revokeToken: vi.fn(),
}));

const TOKEN = { access_token: 'tok', expires_in: 3600, scope: '', token_type: 'Bearer' };
const docs = [
  { id: 'd1', name: 'A', mimeType: 'application/vnd.google-apps.document' },
  { id: 'd2', name: 'B', mimeType: 'text/plain' },
];

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(acquireDriveToken).mockResolvedValue(TOKEN);
});

describe('useDrive', () => {
  it('未連線 → connect 取得 token 後 connected', async () => {
    const { result } = renderHook(() => useDrive());
    expect(result.current.status).toBe('disconnected');
    await act(async () => {
      await result.current.connect();
    });
    expect(result.current.status).toBe('connected');
  });

  it('search 填入清單;previewText 匯出文字', async () => {
    vi.mocked(listDriveDocs).mockResolvedValue({ docs });
    vi.mocked(exportDocText).mockResolvedValue('文章內容');

    const { result } = renderHook(() => useDrive());
    await act(async () => {
      await result.current.connect();
    });
    await act(async () => {
      await result.current.search('關鍵字');
    });
    expect(listDriveDocs).toHaveBeenCalledWith(
      expect.objectContaining({ query: '關鍵字', token: 'tok' }),
    );
    expect(result.current.docs).toEqual(docs);

    let text = '';
    await act(async () => {
      text = await result.current.previewText(docs[0]);
    });
    expect(text).toBe('文章內容');
    expect(result.current.loadingDocId).toBeNull();
  });

  it('disconnect 清單清空、狀態回 disconnected 並 revoke token', async () => {
    vi.mocked(listDriveDocs).mockResolvedValue({ docs });
    const { result } = renderHook(() => useDrive());
    await act(async () => {
      await result.current.connect();
    });
    await act(async () => {
      await result.current.search('');
    });
    expect(result.current.docs).toHaveLength(2);

    act(() => {
      result.current.disconnect();
    });
    expect(result.current.status).toBe('disconnected');
    expect(result.current.docs).toHaveLength(0);
    expect(revokeDriveToken).toHaveBeenCalledWith('tok');
  });
});
