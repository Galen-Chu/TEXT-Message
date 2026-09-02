// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useYoutube } from './useYoutube';
import { acquireYoutubeToken, revokeYoutubeToken } from '../services/youtube/gis';
import { uploadVideo } from '../services/youtube/uploadApi';
import { YoutubeError } from '../services/youtube/errors';

// 強制 YOUTUBE_ENABLED=true(不受本機 .env.local 影響);GIS 與上傳層全 mock,不觸網。
// 與 useGmail.test.ts 同一套路。
vi.mock('../services/youtube/config', () => ({
  YOUTUBE_ENABLED: true,
  YOUTUBE_CLIENT_ID: 'test-client',
  YOUTUBE_UPLOAD_SCOPE: 'https://www.googleapis.com/auth/youtube.upload',
  YOUTUBE_UPLOAD_URL: 'https://example.invalid/upload',
}));

vi.mock('../services/gmail/gis', () => ({
  loadGisScript: vi.fn(async () => {}),
}));

vi.mock('../services/youtube/gis', () => ({
  acquireYoutubeToken: vi.fn(),
  revokeYoutubeToken: vi.fn(),
}));

vi.mock('../services/youtube/uploadApi', () => ({
  uploadVideo: vi.fn(),
}));

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(acquireYoutubeToken).mockResolvedValue({ access_token: 'ytok', expires_in: 3600 });
});

describe('useYoutube 連線與上傳', () => {
  it('connect:取得 token 進入 connected;disconnect 撤銷 token 回 disconnected', async () => {
    const { result } = renderHook(() => useYoutube());
    expect(result.current.status).toBe('disconnected');

    await act(async () => {
      await result.current.connect();
    });
    expect(result.current.status).toBe('connected');
    expect(acquireYoutubeToken).toHaveBeenCalledWith('select_account');

    act(() => {
      result.current.disconnect();
    });
    expect(revokeYoutubeToken).toHaveBeenCalledWith('ytok');
    expect(result.current.status).toBe('disconnected');
  });

  it('upload:回傳 video id、回報進度、完成後 uploadState=done', async () => {
    vi.mocked(uploadVideo).mockImplementation(async ({ onProgress }) => {
      onProgress?.(0.5);
      return { id: 'vid123' };
    });
    const { result } = renderHook(() => useYoutube());
    await act(async () => {
      await result.current.connect();
    });

    let videoId = '';
    await act(async () => {
      videoId = await result.current.upload({
        file: new File(['x'], 'short.mp4', { type: 'video/mp4' }),
        title: '標題',
        description: '說明',
        privacyStatus: 'public',
      });
    });
    expect(videoId).toBe('vid123');
    expect(result.current.uploadState).toBe('done');
    expect(result.current.uploadProgress).toBe(0.5);
    expect(vi.mocked(uploadVideo).mock.calls[0][0].token).toBe('ytok');
  });

  it('upload 遇 unauthorized:靜默續約後重試一次成功', async () => {
    vi.mocked(uploadVideo)
      .mockRejectedValueOnce(new YoutubeError('unauthorized', 'expired'))
      .mockResolvedValueOnce({ id: 'vid456' });
    const { result } = renderHook(() => useYoutube());
    await act(async () => {
      await result.current.connect();
    });

    let videoId = '';
    await act(async () => {
      videoId = await result.current.upload({
        file: new File(['x'], 'short.mp4', { type: 'video/mp4' }),
        title: '標題',
        description: '說明',
        privacyStatus: 'public',
      });
    });
    expect(videoId).toBe('vid456');
    expect(uploadVideo).toHaveBeenCalledTimes(2);
    // connect 一次 + 401 後續約一次
    expect(acquireYoutubeToken).toHaveBeenCalledTimes(2);
    expect(result.current.uploadState).toBe('done');
  });

  it('upload 失敗(非 401):記錄錯誤、uploadState=error、重新拋出', async () => {
    vi.mocked(uploadVideo).mockRejectedValue(new YoutubeError('quota', 'daily limit'));
    const { result } = renderHook(() => useYoutube());
    await act(async () => {
      await result.current.connect();
    });

    await act(async () => {
      await expect(
        result.current.upload({
          file: new File(['x'], 'short.mp4', { type: 'video/mp4' }),
          title: '標題',
          description: '說明',
          privacyStatus: 'public',
        }),
      ).rejects.toBeInstanceOf(YoutubeError);
    });
    expect(result.current.uploadState).toBe('error');
    expect(result.current.error?.code).toBe('quota');
    expect(uploadVideo).toHaveBeenCalledTimes(1);
  });
});
