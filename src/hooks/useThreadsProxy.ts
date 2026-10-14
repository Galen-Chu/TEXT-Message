/**
 * Threads 平台代發的前端狀態機(階段三前端串接)。
 * - 未設 VITE_API_BASE = disabled(完整半自動模式,相關 UI 不出現)
 * - installId 對應 worker 保管的加密 token;狀態查詢只回「是否已連線」
 * - OAuth 完成後 worker 導回 ?threads=connected|error,掛載時偵測、清參數並重查
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  cancelThreadsQueueItem,
  checkThreadsStatus,
  fetchThreadsInteractions,
  listThreadsQueue,
  publishThreadsNow,
  scheduleThreadsPost,
  threadsAuthStartUrl,
  type BackendErrorCode,
  type BackendResult,
  type ThreadsInteractionView,
  type ThreadsQueueItemView,
} from '../services/backend/client';
import { BACKEND_API_BASE, BACKEND_ENABLED } from '../services/backend/config';
import { getInstallId } from '../services/backend/installId';
import { countUnseen, readSeenAt, writeSeenAt } from '../services/backend/interactionsSeen';

export type ThreadsProxyStatus = 'disabled' | 'unknown' | 'connected' | 'disconnected' | 'error';
export type AuthReturn = 'connected' | 'error' | null;

export interface UseThreadsProxyResult {
  enabled: boolean;
  status: ThreadsProxyStatus;
  /** OAuth 導回後的一次性回報(connected/error);重新查詢後清除。 */
  authReturn: AuthReturn;
  refresh: () => Promise<void>;
  /** 開新分頁進行 Meta 授權。 */
  connect: () => void;
  /** 回傳 null = 連點被同步鎖忽略(呼叫端靜默返回,不視為錯誤)。 */
  publish: (text: string) => Promise<BackendResult<{ id: string }> | null>;
  schedule: (text: string, publishAt: number) => Promise<BackendResult<{ itemId: string }> | null>;
  busy: boolean;
  queue: ThreadsQueueItemView[];
  queueLoading: boolean;
  loadQueue: () => Promise<void>;
  cancel: (itemId: string) => Promise<BackendResult<{ ok: boolean }>>;
  /** 互動唯讀代讀(2026-10-14):使用者按下才讀,worker 不儲存、每次都是當下結果。 */
  interactions: ThreadsInteractionView[];
  /** 本輪掃描的自己貼文篇數(UI 誠實標示讀取範圍)。 */
  interactionsScanned: number;
  interactionsLoading: boolean;
  /** 最近一次讀取的錯誤碼;scope_required = 需重新連接以補唯讀權限。 */
  interactionsError: BackendErrorCode | null;
  /** 已讀取過至少一次(用來區分「沒有互動」與「還沒讀過」)。 */
  interactionsLoaded: boolean;
  unseenCount: number;
  loadInteractions: () => Promise<void>;
  /** 標記為已讀(以本機時間為基準寫入時間戳;只落地時間戳,不落地互動內容)。 */
  markInteractionsSeen: () => void;
}

export function useThreadsProxy(): UseThreadsProxyResult {
  const installId = useRef(getInstallId()).current;
  const [status, setStatus] = useState<ThreadsProxyStatus>(
    BACKEND_ENABLED ? 'unknown' : 'disabled',
  );
  const [authReturn, setAuthReturn] = useState<AuthReturn>(null);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [queue, setQueue] = useState<ThreadsQueueItemView[]>([]);
  const [queueLoading, setQueueLoading] = useState(false);
  const reqId = useRef(0);

  const refresh = useCallback(async () => {
    if (!BACKEND_ENABLED) return;
    const id = ++reqId.current;
    const r = await checkThreadsStatus({ base: BACKEND_API_BASE, installId });
    if (id !== reqId.current) return;
    setAuthReturn(null);
    if (r.ok) setStatus(r.data.connected ? 'connected' : 'disconnected');
    else setStatus('error');
  }, [installId]);

  useEffect(() => {
    if (!BACKEND_ENABLED) return;
    // OAuth 回跳偵測:?threads=connected|error(worker 導回前端時帶上)。
    // 本分頁若是由 connect() 開出的授權分頁,通知原分頁後自動關閉(使用者留在原頁);
    // 無 opener(如直接貼網址)則退回「通知分頁」行為,由原分頁的 focus 重查接手。
    const params = new URLSearchParams(window.location.search);
    const flag = params.get('threads');
    if (flag === 'connected' || flag === 'error') {
      setAuthReturn(flag);
      params.delete('threads');
      const qs = params.toString();
      window.history.replaceState(null, '', window.location.pathname + (qs ? `?${qs}` : ''));
      try {
        // 僅由 connect() 開出的授權分頁(opener 存在)回報並自動關閉;
        // 使用者自行開啟的分頁保留為通知頁,由原分頁的 focus 重查接手
        if (window.opener) {
          window.opener.postMessage({ type: 'threads-auth', result: flag }, window.location.origin);
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
      if (e.data && typeof e.data === 'object' && (e.data as { type?: string }).type === 'threads-auth') {
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
    window.open(threadsAuthStartUrl(BACKEND_API_BASE, installId), '_blank');
  }, [installId]);

  const publish = useCallback(
    async (text: string) => {
      // 同步鎖(busyRef):防同一影格內的快速連點在 React 重渲染前穿過 disabled 屬性
      if (busyRef.current) return null;
      busyRef.current = true;
      setBusy(true);
      try {
        return await publishThreadsNow({ base: BACKEND_API_BASE, installId, text });
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
        return await scheduleThreadsPost({ base: BACKEND_API_BASE, installId, text, publishAt });
      } finally {
        busyRef.current = false;
        setBusy(false);
      }
    },
    [installId],
  );

  const loadQueue = useCallback(async () => {
    if (!BACKEND_ENABLED) return;
    setQueueLoading(true);
    const r = await listThreadsQueue({ base: BACKEND_API_BASE, installId });
    setQueueLoading(false);
    if (r.ok) setQueue(r.data.items);
  }, [installId]);

  const cancel = useCallback(
    async (itemId: string) => {
      const r = await cancelThreadsQueueItem({ base: BACKEND_API_BASE, installId, itemId });
      if (r.ok) await loadQueue();
      return r;
    },
    [installId, loadQueue],
  );

  // ── 互動唯讀代讀(2026-10-14)──
  // 刻意不在掛載時自動讀:每次讀都是真的打平台 API,背景自動讀會變成無人看的額度消耗。
  const [interactions, setInteractions] = useState<ThreadsInteractionView[]>([]);
  const [interactionsScanned, setInteractionsScanned] = useState(0);
  const [interactionsLoading, setInteractionsLoading] = useState(false);
  const [interactionsError, setInteractionsError] = useState<BackendErrorCode | null>(null);
  const [interactionsLoaded, setInteractionsLoaded] = useState(false);
  const [seenAt, setSeenAt] = useState(() => (BACKEND_ENABLED ? readSeenAt() : 0));
  const interactionsReqId = useRef(0);

  const loadInteractions = useCallback(async () => {
    if (!BACKEND_ENABLED) return;
    const id = ++interactionsReqId.current;
    setInteractionsLoading(true);
    const r = await fetchThreadsInteractions({ base: BACKEND_API_BASE, installId });
    // 連點兩次只認最後一次的結果(避免舊回應覆蓋新回應)
    if (id !== interactionsReqId.current) return;
    setInteractionsLoading(false);
    setInteractionsLoaded(true);
    if (r.ok) {
      setInteractions(r.data.items);
      setInteractionsScanned(r.data.scanned);
      setInteractionsError(null);
    } else {
      // 讀取失敗時保留上一次成功的內容(清空會讓畫面在暫時性錯誤下閃爛掉)
      setInteractionsError(r.code);
    }
  }, [installId]);

  const markInteractionsSeen = useCallback(() => {
    const now = Date.now();
    writeSeenAt(now);
    setSeenAt(now);
  }, []);

  return {
    enabled: BACKEND_ENABLED,
    status,
    authReturn,
    refresh,
    connect,
    publish,
    schedule,
    busy,
    queue,
    queueLoading,
    loadQueue,
    cancel,
    interactions,
    interactionsScanned,
    interactionsLoading,
    interactionsError,
    interactionsLoaded,
    unseenCount: countUnseen(interactions, seenAt),
    loadInteractions,
    markInteractionsSeen,
  };
}
