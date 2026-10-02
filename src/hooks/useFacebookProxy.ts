/**
 * Facebook 粉專發佈的前端狀態機(2026-09-30;鏡像 useThreadsProxy)。
 * - 未設 VITE_API_BASE = disabled(完整半自動模式,相關 UI 不出現)
 * - installId 對應 worker 保管的加密 page token;狀態查詢只回「是否已連線 + 粉專名稱」
 * - OAuth 完成後 worker 導回 ?facebook=connected|error,掛載時偵測、清參數並重查
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  checkFacebookStatus,
  facebookAuthStartUrl,
  publishFacebookNow,
  scheduleFacebookPost,
  type BackendResult,
} from '../services/backend/client';
import { BACKEND_API_BASE, BACKEND_ENABLED } from '../services/backend/config';
import { getInstallId } from '../services/backend/installId';

export type FacebookProxyStatus = 'disabled' | 'unknown' | 'connected' | 'disconnected' | 'error';
export type FbAuthReturn = 'connected' | 'error' | null;

export interface UseFacebookProxyResult {
  enabled: boolean;
  status: FacebookProxyStatus;
  /** 已連線時的粉專名稱(worker 保管的中繼資訊;未連線為 null)。 */
  pageName: string | null;
  /** OAuth 導回後的一次性回報(connected/error);重新查詢後清除。 */
  authReturn: FbAuthReturn;
  refresh: () => Promise<void>;
  /** 開新分頁進行 Meta 授權。 */
  connect: () => void;
  /** 回傳 null = 連點被同步鎖忽略(呼叫端靜默返回,不視為錯誤)。 */
  publish: (text: string) => Promise<BackendResult<{ id: string }> | null>;
  schedule: (text: string, publishAt: number) => Promise<BackendResult<{ itemId: string }> | null>;
  busy: boolean;
}

export function useFacebookProxy(): UseFacebookProxyResult {
  const installId = useRef(getInstallId()).current;
  const [status, setStatus] = useState<FacebookProxyStatus>(
    BACKEND_ENABLED ? 'unknown' : 'disabled',
  );
  const [pageName, setPageName] = useState<string | null>(null);
  const [authReturn, setAuthReturn] = useState<FbAuthReturn>(null);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const reqId = useRef(0);

  const refresh = useCallback(async () => {
    if (!BACKEND_ENABLED) return;
    const id = ++reqId.current;
    const r = await checkFacebookStatus({ base: BACKEND_API_BASE, installId });
    if (id !== reqId.current) return;
    setAuthReturn(null);
    if (r.ok) {
      setStatus(r.data.connected ? 'connected' : 'disconnected');
      setPageName(r.data.connected ? r.data.pageName : null);
    } else {
      setStatus('error');
    }
  }, [installId]);

  useEffect(() => {
    if (!BACKEND_ENABLED) return;
    // OAuth 回跳偵測:?facebook=connected|error(worker 導回前端時帶上)。
    // 本分頁若是由 connect() 開出的授權分頁,通知原分頁後自動關閉(使用者留在原頁);
    // 無 opener(如直接貼網址)則退回「通知分頁」行為,由原分頁的 focus 重查接手。
    const params = new URLSearchParams(window.location.search);
    const flag = params.get('facebook');
    if (flag === 'connected' || flag === 'error') {
      setAuthReturn(flag);
      params.delete('facebook');
      const qs = params.toString();
      window.history.replaceState(null, '', window.location.pathname + (qs ? `?${qs}` : ''));
      try {
        // 僅由 connect() 開出的授權分頁(opener 存在)回報並自動關閉;
        // 使用者自行開啟的分頁保留為通知頁,由原分頁的 focus 重查接手
        if (window.opener) {
          window.opener.postMessage({ type: 'facebook-auth', result: flag }, window.location.origin);
          window.close();
        }
      } catch {
        // 跨源或已被關閉的 opener:留在本頁顯示結果即可
      }
    }
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!BACKEND_ENABLED) return;
    // 原分頁:接收授權分頁的完成通知;或視窗重回前景時重查(接手手動關閉分頁的情況)
    const onMessage = (e: MessageEvent) => {
      if (e.origin !== window.location.origin) return;
      if (e.data && typeof e.data === 'object' && (e.data as { type?: string }).type === 'facebook-auth') {
        setAuthReturn((e.data as { result: 'connected' | 'error' }).result);
        void refresh();
      }
    };
    const onFocus = () => void refresh();
    window.addEventListener('message', onMessage);
    window.addEventListener('focus', onFocus);
    return () => {
      window.removeEventListener('message', onMessage);
      window.removeEventListener('focus', onFocus);
    };
  }, [refresh]);

  const connect = useCallback(() => {
    // 不加 noopener:授權分頁需要 window.opener 才能回報完成並自動關閉;
    // 安全性由訊息接收端的 origin 檢查把關
    window.open(facebookAuthStartUrl(BACKEND_API_BASE, installId), '_blank');
  }, [installId]);

  const publish = useCallback(
    async (text: string) => {
      // 同步鎖(busyRef):防同一影格內的快速連點在 React 重渲染前穿過 disabled 屬性
      if (busyRef.current) return null;
      busyRef.current = true;
      setBusy(true);
      try {
        return await publishFacebookNow({ base: BACKEND_API_BASE, installId, text });
      } finally {
        busyRef.current = false;
        setBusy(false);
      }
    },
    [installId],
  );

  const schedule = useCallback(
    async (text: string, publishAt: number) => {
      if (busyRef.current) return null;
      busyRef.current = true;
      setBusy(true);
      try {
        return await scheduleFacebookPost({ base: BACKEND_API_BASE, installId, text, publishAt });
      } finally {
        busyRef.current = false;
        setBusy(false);
      }
    },
    [installId],
  );

  return {
    enabled: BACKEND_ENABLED,
    status,
    pageName,
    authReturn,
    refresh,
    connect,
    publish,
    schedule,
    busy,
  };
}
