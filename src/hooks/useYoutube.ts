/**
 * YouTube 連線狀態機(鏡像 useGmail 的設計):
 * - token 只存 useRef(不進 React render state、不進 localStorage)
 * - 401 時靜默續約並重試一次
 * - 上傳進度以 0–1 分數回報;影片內容不經任何第三方,直傳 Google
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { YOUTUBE_ENABLED } from '../services/youtube/config';
import { YoutubeError, toYoutubeError } from '../services/youtube/errors';
import { acquireYoutubeToken, revokeYoutubeToken } from '../services/youtube/gis';
import { uploadVideo } from '../services/youtube/uploadApi';
import { buildVideoMetadata, type PrivacyStatus } from '../services/youtube/video';
import { loadGisScript } from '../services/gmail/gis';

export type YoutubeStatus = 'disabled' | 'disconnected' | 'connecting' | 'connected' | 'error';
export type UploadState = 'idle' | 'uploading' | 'done' | 'error';

export interface UseYoutubeResult {
  status: YoutubeStatus;
  error: YoutubeError | null;
  connect: () => Promise<void>;
  disconnect: () => void;
  /** 上傳影片;回傳 YouTube video id。 */
  upload: (opts: {
    file: File;
    title: string;
    description: string;
    privacyStatus: PrivacyStatus;
    publishAt?: string;
  }) => Promise<string>;
  uploadState: UploadState;
  /** 0–1(僅 uploading 期間有意義)。 */
  uploadProgress: number;
}

interface TokenState {
  accessToken: string;
  expiresAt: number;
}

export function useYoutube(): UseYoutubeResult {
  const [status, setStatus] = useState<YoutubeStatus>(
    YOUTUBE_ENABLED ? 'disconnected' : 'disabled',
  );
  const [error, setError] = useState<YoutubeError | null>(null);
  const [uploadState, setUploadState] = useState<UploadState>('idle');
  const [uploadProgress, setUploadProgress] = useState(0);

  const tokenRef = useRef<TokenState | null>(null);

  useEffect(() => {
    if (!YOUTUBE_ENABLED) return;
    // 預熱 GIS script,讓點擊連線保持在瀏覽器使用者手勢有效期內(防彈窗封鎖)
    loadGisScript().catch(() => {
      /* 載入失敗在使用者實際連接時才回報 */
    });
  }, []);

  const ensureToken = useCallback(async (prompt: '' | 'select_account'): Promise<string> => {
    const t = tokenRef.current;
    if (t && Date.now() < t.expiresAt) return t.accessToken;
    const resp = await acquireYoutubeToken(prompt);
    tokenRef.current = {
      accessToken: resp.access_token,
      expiresAt: Date.now() + Math.max(resp.expires_in - 60, 60) * 1000,
    };
    return resp.access_token;
  }, []);

  const connect = useCallback(async () => {
    setError(null);
    setStatus('connecting');
    try {
      await loadGisScript();
      await ensureToken('select_account');
      setStatus('connected');
    } catch (err) {
      const yerr = toYoutubeError(err);
      if (yerr.code === 'cancelled') {
        setStatus(tokenRef.current ? 'connected' : 'disconnected');
        return;
      }
      setError(yerr);
      setStatus('error');
      tokenRef.current = null;
    }
  }, [ensureToken]);

  const disconnect = useCallback(() => {
    const t = tokenRef.current;
    if (t) revokeYoutubeToken(t.accessToken);
    tokenRef.current = null;
    setError(null);
    setUploadState('idle');
    setUploadProgress(0);
    setStatus(YOUTUBE_ENABLED ? 'disconnected' : 'disabled');
  }, []);

  const upload = useCallback<UseYoutubeResult['upload']>(
    async (opts) => {
      const metadata = buildVideoMetadata(opts);
      setUploadState('uploading');
      setUploadProgress(0);
      setError(null);
      try {
        let token = await ensureToken('');
        let result;
        try {
          result = await uploadVideo({
            token,
            file: opts.file,
            metadata,
            onProgress: (f) => setUploadProgress(f),
          });
        } catch (err) {
          if (!(err instanceof YoutubeError) || err.code !== 'unauthorized') throw err;
          // token 失效:靜默續約後重試一次
          tokenRef.current = null;
          token = await ensureToken('');
          result = await uploadVideo({
            token,
            file: opts.file,
            metadata,
            onProgress: (f) => setUploadProgress(f),
          });
        }
        setUploadState('done');
        return result.id;
      } catch (err) {
        const yerr = toYoutubeError(err);
        setError(yerr);
        setUploadState('error');
        if (yerr.code === 'unauthorized' || yerr.code === 'access_denied') {
          tokenRef.current = null;
        }
        throw yerr;
      }
    },
    [ensureToken],
  );

  return { status, error, connect, disconnect, upload, uploadState, uploadProgress };
}
