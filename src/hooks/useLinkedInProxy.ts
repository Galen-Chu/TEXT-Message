/**
 * LinkedIn 發佈的前端狀態機(2026-10-07;鏡像 useLinkedIn 即 useFacebookProxy 形態)。
 * - 未設 VITE_API_BASE = disabled(相關 UI 不出現)
 * - installId 對應 worker 保管的加密 token;狀態查詢只回「是否已連線 + 會員名稱」
 * - OAuth 完成後 worker 導回 ?linkedin=connected|error,掛載時偵測、清參數並重查
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  checkLinkedInStatus,
  linkedinAuthStartUrl,
  publishLinkedInNow,
  scheduleLinkedInPost,
  type BackendResult,
} from '../services/backend/client';
import { BACKEND_API_BASE, BACKEND_ENABLED } from '../services/backend/config';
import { getInstallId } from '../services/backend/installId';

export type LinkedInProxyStatus = 'disabled' | 'unknown' | 'connected' | 'disconnected' | 'error';
export type LinkedInAuthReturn = 'connected' | 'error' | null;

export interface UseLinkedInProxyResult {
  enabled: boolean;
  status: LinkedInProxyStatus;
  /** 已連線時的會員名稱(worker 保管的中繼資訊;未連線為 null)。 */
  memberName: string | null;
  authReturn: LinkedInAuthReturn;
  refresh: () => Promise<void>;
  connect: () => void;
  /** 回傳 null = 連點被同步鎖忽略(呼叫端靜默返回,不視為錯誤)。 */
  publish: (text: string) => Promise<BackendResult<{ id: string }> | null>;
  schedule: (text: string, publishAt: number) => Promise<BackendResult<{ itemId: string }> | null>;
  busy: boolean;
}

export function useLinkedInProxy(): UseLinkedInProxyResult {
  const installId = useRef(getInstallId()).current;
  const [status, setStatus] = useState<LinkedInProxyStatus>(
    BACKEND_ENABLED ? 'unknown' : 'disabled',
  );
  const [memberName, setMemberName] = useState<string | null>(null);
  const [authReturn, setAuthReturn] = useState<LinkedInAuthReturn>(null);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const reqId = useRef(0);

  const refresh = useCallback(async () => {
    if (!BACKEND_ENABLED) return;
    const id = ++reqId.current;
    const r = await checkLinkedInStatus({ base: BACKEND_API_BASE, installId });
    if (id !== reqId.current) return;
    setAuthReturn(null);
    if (r.ok) {
      setStatus(r.data.connected ? 'connected' : 'disconnected');
      setMemberName(r.data.connected ? r.data.memberName : null);
    } else {
      setStatus('error');
    }
  }, [installId]);

  useEffect(() => {
    if (!BACKEND_ENABLED) return;
    // OAuth 回跳偵測:?linkedin=connected|error(worker 導回前端時帶上)。
    // 由 connect() 開出的授權分頁通知原分頁後自動關閉;無 opener 則留為通知頁。
    const params = new URLSearchParams(window.location.search);
    const flag = params.get('linkedin');
    if (flag === 'connected' || flag === 'error') {
      setAuthReturn(flag);
      params.delete('linkedin');
      const qs = params.toString();
      window.history.replaceState(null, '', window.location.pathname + (qs ? `?${qs}` : ''));
      try {
        if (window.opener) {
          window.opener.postMessage({ type: 'linkedin-auth', result: flag }, window.location.origin);
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
    const onMessage = (e: MessageEvent) => {
      if (e.origin !== window.location.origin) return;
      if (e.data && typeof e.data === 'object' && (e.data as { type?: string }).type === 'linkedin-auth') {
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
    // 不加 noopener:授權分頁需要 window.opener 才能回報完成並自動關閉
    window.open(linkedinAuthStartUrl(BACKEND_API_BASE, installId), '_blank');
  }, [installId]);

  const publish = useCallback(
    async (text: string) => {
      if (busyRef.current) return null;
      busyRef.current = true;
      setBusy(true);
      try {
        return await publishLinkedInNow({ base: BACKEND_API_BASE, installId, text });
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
        return await scheduleLinkedInPost({ base: BACKEND_API_BASE, installId, text, publishAt });
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
    memberName,
    authReturn,
    refresh,
    connect,
    publish,
    schedule,
    busy,
  };
}
