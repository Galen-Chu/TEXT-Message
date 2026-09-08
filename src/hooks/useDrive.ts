/**
 * 雲端列 Drive 連線狀態機(鏡像 useGmail/useYoutube 的設計,DRIVE-PLAN D2/D3):
 * - token 只存 useRef(不進 render state、不進 localStorage);中斷連線即 revoke
 * - 未設 Client ID = disabled(該建置不出現連接按鈕,顯示示範文檔)
 * - 搜尋清單與純文字匯出;401 時靜默續約並重試一次
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { DRIVE_ENABLED } from '../services/drive/config';
import { DriveError, toDriveError } from '../services/drive/errors';
import { acquireDriveToken, revokeDriveToken } from '../services/drive/gis';
import {
  exportDocText,
  listDriveDocs,
  type DriveDocSummary,
} from '../services/drive/driveApi';
import { loadGisScript } from '../services/gmail/gis';

export type DriveStatus = 'disabled' | 'disconnected' | 'connecting' | 'connected' | 'error';

export interface UseDriveResult {
  enabled: boolean;
  status: DriveStatus;
  error: DriveError | null;
  connect: () => Promise<void>;
  disconnect: () => void;
  /** 依名稱關鍵字搜尋(空字串=全部,新→舊);成功取代目前清單。 */
  search: (query: string) => Promise<void>;
  searchLoading: boolean;
  docs: DriveDocSummary[];
  /** 匯出文檔純文字(預覽/引用用);進行中時 loadingDocId 為該檔 id。 */
  previewText: (doc: DriveDocSummary) => Promise<string>;
  loadingDocId: string | null;
}

interface TokenState {
  accessToken: string;
  expiresAt: number;
}

export function useDrive(): UseDriveResult {
  const [status, setStatus] = useState<DriveStatus>(DRIVE_ENABLED ? 'disconnected' : 'disabled');
  const [error, setError] = useState<DriveError | null>(null);
  const [docs, setDocs] = useState<DriveDocSummary[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [loadingDocId, setLoadingDocId] = useState<string | null>(null);

  const tokenRef = useRef<TokenState | null>(null);

  useEffect(() => {
    if (!DRIVE_ENABLED) return;
    // 預熱 GIS script,讓點擊連線保持在瀏覽器使用者手勢有效期內(防彈窗封鎖)
    loadGisScript().catch(() => {
      /* 載入失敗在使用者實際連接時才回報 */
    });
  }, []);

  const ensureToken = useCallback(async (prompt: '' | 'select_account'): Promise<string> => {
    const t = tokenRef.current;
    if (t && Date.now() < t.expiresAt) return t.accessToken;
    const resp = await acquireDriveToken(prompt);
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
      const derr = toDriveError(err);
      if (derr.code === 'cancelled') {
        setStatus(tokenRef.current ? 'connected' : 'disconnected');
        return;
      }
      setError(derr);
      setStatus('error');
      tokenRef.current = null;
    }
  }, [ensureToken]);

  const disconnect = useCallback(() => {
    const t = tokenRef.current;
    if (t) revokeDriveToken(t.accessToken);
    tokenRef.current = null;
    setError(null);
    setDocs([]);
    setStatus(DRIVE_ENABLED ? 'disconnected' : 'disabled');
  }, []);

  const search = useCallback(
    async (query: string) => {
      setSearchLoading(true);
      setError(null);
      try {
        const r = await listDriveDocs({ token: await ensureToken(''), query });
        setDocs(r.docs);
      } catch (err) {
        const derr = toDriveError(err);
        if (derr.code === 'unauthorized') {
          // token 失效:靜默續約後重試一次
          tokenRef.current = null;
          try {
            const r = await listDriveDocs({ token: await ensureToken(''), query });
            setDocs(r.docs);
            setSearchLoading(false);
            return;
          } catch (err2) {
            setError(toDriveError(err2));
            setStatus('error');
          }
        } else {
          setError(derr);
        }
      } finally {
        setSearchLoading(false);
      }
    },
    [ensureToken],
  );

  const previewText = useCallback(
    async (doc: DriveDocSummary): Promise<string> => {
      setLoadingDocId(doc.id);
      try {
        return await exportDocText({ token: await ensureToken(''), doc });
      } finally {
        setLoadingDocId(null);
      }
    },
    [ensureToken],
  );

  return {
    enabled: DRIVE_ENABLED,
    status,
    error,
    connect,
    disconnect,
    search,
    searchLoading,
    docs,
    previewText,
    loadingDocId,
  };
}
