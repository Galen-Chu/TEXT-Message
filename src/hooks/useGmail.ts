/**
 * Gmail 連線狀態機:唯一有狀態的 gmail 模組,由 useAppStore 持有。
 * - token 只存 useRef(不進 React render state、不進 localStorage)
 * - 過期前批次檢查;API 401 時靜默續約並整批重試一次
 * - request id 防競態(舊回應不覆蓋新狀態)
 * - 分頁:首頁載入後以 nextPageToken 提供 loadMore 附加載入
 * - 視窗重回前景時靜默刷新(有冷卻時間,不顯示載入中)
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { GMAIL_ENABLED } from '../services/gmail/config';
import { GmailError, toGmailError } from '../services/gmail/errors';
import { fetchMessages, fetchProfile, listMessageIds } from '../services/gmail/gmailApi';
import { acquireToken, loadGisScript, revokeToken } from '../services/gmail/gis';
import { mapGmailMessage } from '../services/gmail/mapToEmail';
import type { GmailMessage } from '../services/gmail/types';
import type { Email } from '../types';

export type GmailStatus = 'disabled' | 'disconnected' | 'connecting' | 'connected' | 'error';

export interface UseGmailResult {
  status: GmailStatus;
  accountEmail: string | null;
  error: GmailError | null;
  emails: Email[];
  loadingEmails: boolean;
  /** 依 Gmail nextPageToken 判斷還有下一頁可載入。 */
  canLoadMore: boolean;
  loadingMore: boolean;
  connect: () => Promise<void>;
  disconnect: () => void;
  refresh: () => Promise<void>;
  retry: () => Promise<void>;
  /** 附加載入下一頁(附加於現有清單之後,不重新整理)。 */
  loadMore: () => Promise<void>;
}

interface TokenState {
  accessToken: string;
  expiresAt: number;
}

/** 視窗重回前景的靜默刷新冷卻時間(避免分頁切換狂刷)。 */
const FOCUS_REFRESH_COOLDOWN_MS = 60_000;

async function runBatch(
  token: string,
  pageToken?: string,
): Promise<{
  profile: { emailAddress: string } | null;
  messages: GmailMessage[];
  nextPageToken: string | null;
}> {
  // 之後的分頁不需要再抓 profile(帳號已知)
  const profile = pageToken ? null : await fetchProfile(token);
  const page = await listMessageIds(token, pageToken);
  const messages = await fetchMessages(token, page.ids);
  return { profile, messages, nextPageToken: page.nextPageToken };
}

export function useGmail(): UseGmailResult {
  const [status, setStatus] = useState<GmailStatus>(GMAIL_ENABLED ? 'disconnected' : 'disabled');
  const [accountEmail, setAccountEmail] = useState<string | null>(null);
  const [error, setError] = useState<GmailError | null>(null);
  const [emails, setEmails] = useState<Email[]>([]);
  const [loadingEmails, setLoadingEmails] = useState(false);
  const [canLoadMore, setCanLoadMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  const tokenRef = useRef<TokenState | null>(null);
  const reqIdRef = useRef(0);
  const lastActionRef = useRef<'connect' | 'refresh'>('connect');
  const pageTokenRef = useRef<string | null>(null);
  const lastLoadedAtRef = useRef(0);
  const busyRef = useRef(false);
  const statusRef = useRef(status);
  statusRef.current = status;

  useEffect(() => {
    if (!GMAIL_ENABLED) return;
    // 預熱:讓「點擊 → 開授權視窗」保持在瀏覽器使用者手勵有效期內(防彈窗封鎖)
    loadGisScript().catch(() => {
      /* 載入失敗在使用者實際連接時才回報 */
    });
  }, []);

  /** 取得有效 token;過期則以指定 prompt 重新取得。 */
  const ensureToken = useCallback(async (prompt: '' | 'select_account'): Promise<string> => {
    const t = tokenRef.current;
    if (t && Date.now() < t.expiresAt) return t.accessToken;
    const resp = await acquireToken(prompt);
    tokenRef.current = {
      accessToken: resp.access_token,
      expiresAt: Date.now() + Math.max(resp.expires_in - 60, 60) * 1000,
    };
    return resp.access_token;
  }, []);

  /**
   * 載入郵件。無 pageToken = 從第一頁重新整理(取代清單);有 pageToken = 附加下一頁。
   * silent = 不顯示載入中(前景刷新用)。
   */
  const loadEmails = useCallback(
    async (opts?: { pageToken?: string; silent?: boolean }) => {
      const pageToken = opts?.pageToken;
      const silent = opts?.silent ?? false;
      const append = !!pageToken;
      const reqId = ++reqIdRef.current;
      busyRef.current = true;
      if (append) setLoadingMore(true);
      else if (!silent) setLoadingEmails(true);
      try {
        let token = await ensureToken('');
        let result;
        try {
          result = await runBatch(token, pageToken);
        } catch (err) {
          if (!(err instanceof GmailError) || err.code !== 'unauthorized') throw err;
          // token 失效:靜默續約後整批重試一次
          tokenRef.current = null;
          token = await ensureToken('');
          result = await runBatch(token, pageToken);
        }
        if (reqIdRef.current !== reqId) return; // 已有較新的操作,丟棄過期結果
        if (result.profile) setAccountEmail(result.profile.emailAddress);
        // Gmail 依 newest first 分頁:第二頁必全為較舊郵件,附加即維持排序;id 去重防邊界重疊
        const mapped = [...result.messages]
          .sort((a, b) => Number(b.internalDate ?? 0) - Number(a.internalDate ?? 0))
          .map(mapGmailMessage);
        setEmails((prev) => {
          const base = append ? prev : [];
          const seen = new Set(base.map((e) => e.id));
          return [...base, ...mapped.filter((m) => !seen.has(m.id))];
        });
        pageTokenRef.current = result.nextPageToken;
        setCanLoadMore(!!result.nextPageToken);
        lastLoadedAtRef.current = Date.now();
        setStatus('connected');
        setError(null);
      } catch (err) {
        if (reqIdRef.current !== reqId) return;
        const gerr = toGmailError(err);
        if (gerr.code === 'cancelled') {
          // 使用者關閉彈窗:軟處理,回到前一狀態不顯示錯誤
          setStatus(tokenRef.current ? 'connected' : 'disconnected');
          return;
        }
        setError(gerr);
        setStatus('error');
        if (gerr.code === 'unauthorized' || gerr.code === 'access_denied') {
          tokenRef.current = null;
        }
      } finally {
        if (reqIdRef.current === reqId) {
          busyRef.current = false;
          setLoadingEmails(false);
          setLoadingMore(false);
        }
      }
    },
    [ensureToken],
  );

  const connect = useCallback(async () => {
    lastActionRef.current = 'connect';
    setError(null);
    setStatus('connecting');
    try {
      await loadGisScript();
      await ensureToken('select_account');
    } catch (err) {
      const gerr = toGmailError(err);
      if (gerr.code === 'cancelled') {
        setStatus('disconnected');
        return;
      }
      setError(gerr);
      setStatus('error');
      tokenRef.current = null;
      return;
    }
    await loadEmails();
  }, [ensureToken, loadEmails]);

  const disconnect = useCallback(() => {
    reqIdRef.current++; // 使任何進行中的請求結果失效
    const t = tokenRef.current;
    if (t) revokeToken(t.accessToken);
    tokenRef.current = null;
    setEmails([]);
    setAccountEmail(null);
    setError(null);
    setLoadingEmails(false);
    setLoadingMore(false);
    setCanLoadMore(false);
    pageTokenRef.current = null;
    busyRef.current = false;
    setStatus(GMAIL_ENABLED ? 'disconnected' : 'disabled');
  }, []);

  const refresh = useCallback(async () => {
    if (status !== 'connected' && status !== 'error') return;
    lastActionRef.current = 'refresh';
    await loadEmails();
  }, [status, loadEmails]);

  const retry = useCallback(async () => {
    if (lastActionRef.current === 'refresh') {
      await refresh();
    } else {
      await connect();
    }
  }, [connect, refresh]);

  const loadMore = useCallback(async () => {
    if (status !== 'connected' || !pageTokenRef.current || busyRef.current) return;
    await loadEmails({ pageToken: pageTokenRef.current });
  }, [status, loadEmails]);

  // 視窗重回前景:已連線且離上次載入超過冷卻時間 → 靜默刷新(不出現載入中畫面)
  useEffect(() => {
    const onFocus = () => {
      if (document.visibilityState !== 'visible') return;
      if (statusRef.current !== 'connected' || busyRef.current) return;
      if (Date.now() - lastLoadedAtRef.current < FOCUS_REFRESH_COOLDOWN_MS) return;
      void loadEmails({ silent: true });
    };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onFocus);
    return () => {
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onFocus);
    };
  }, [loadEmails]);

  return {
    status,
    accountEmail,
    error,
    emails,
    loadingEmails,
    canLoadMore,
    loadingMore,
    connect,
    disconnect,
    refresh,
    retry,
    loadMore,
  };
}
