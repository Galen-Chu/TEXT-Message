/**
 * Gmail 連線狀態機:唯一有狀態的 gmail 模組,由 useAppStore 持有。
 * - token 只存 useRef(不進 React render state、不進 localStorage)
 * - 過期前批次檢查;API 401 時靜默續約並整批重試一次
 * - request id 防競態(舊回應不覆蓋新狀態)
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
  connect: () => Promise<void>;
  disconnect: () => void;
  refresh: () => Promise<void>;
  retry: () => Promise<void>;
}

interface TokenState {
  accessToken: string;
  expiresAt: number;
}

async function runBatch(token: string): Promise<{ profile: { emailAddress: string }; messages: GmailMessage[] }> {
  const profile = await fetchProfile(token);
  const ids = await listMessageIds(token);
  const messages = await fetchMessages(token, ids);
  return { profile, messages };
}

export function useGmail(): UseGmailResult {
  const [status, setStatus] = useState<GmailStatus>(GMAIL_ENABLED ? 'disconnected' : 'disabled');
  const [accountEmail, setAccountEmail] = useState<string | null>(null);
  const [error, setError] = useState<GmailError | null>(null);
  const [emails, setEmails] = useState<Email[]>([]);
  const [loadingEmails, setLoadingEmails] = useState(false);

  const tokenRef = useRef<TokenState | null>(null);
  const reqIdRef = useRef(0);
  const lastActionRef = useRef<'connect' | 'refresh'>('connect');

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

  const loadEmails = useCallback(async () => {
    const reqId = ++reqIdRef.current;
    setLoadingEmails(true);
    try {
      let token = await ensureToken('');
      let result;
      try {
        result = await runBatch(token);
      } catch (err) {
        if (!(err instanceof GmailError) || err.code !== 'unauthorized') throw err;
        // token 失效:靜默續約後整批重試一次
        tokenRef.current = null;
        token = await ensureToken('');
        result = await runBatch(token);
      }
      if (reqIdRef.current !== reqId) return; // 已有較新的操作,丟棄過期結果
      setAccountEmail(result.profile.emailAddress);
      setEmails(
        [...result.messages]
          .sort((a, b) => Number(b.internalDate ?? 0) - Number(a.internalDate ?? 0))
          .map(mapGmailMessage),
      );
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
      if (reqIdRef.current === reqId) setLoadingEmails(false);
    }
  }, [ensureToken]);

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

  return {
    status,
    accountEmail,
    error,
    emails,
    loadingEmails,
    connect,
    disconnect,
    refresh,
    retry,
  };
}
