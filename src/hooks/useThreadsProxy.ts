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
  listThreadsQueue,
  publishThreadsNow,
  scheduleThreadsPost,
  threadsAuthStartUrl,
  type BackendResult,
  type ThreadsQueueItemView,
} from '../services/backend/client';
import { BACKEND_API_BASE, BACKEND_ENABLED } from '../services/backend/config';
import { getInstallId } from '../services/backend/installId';

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
  publish: (text: string) => Promise<BackendResult<{ id: string }>>;
  schedule: (text: string, publishAt: number) => Promise<BackendResult<{ itemId: string }>>;
  busy: boolean;
  queue: ThreadsQueueItemView[];
  queueLoading: boolean;
  loadQueue: () => Promise<void>;
  cancel: (itemId: string) => Promise<BackendResult<{ ok: boolean }>>;
}

export function useThreadsProxy(): UseThreadsProxyResult {
  const installId = useRef(getInstallId()).current;
  const [status, setStatus] = useState<ThreadsProxyStatus>(
    BACKEND_ENABLED ? 'unknown' : 'disabled',
  );
  const [authReturn, setAuthReturn] = useState<AuthReturn>(null);
  const [busy, setBusy] = useState(false);
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
    // OAuth 回跳偵測:?threads=connected|error(worker 導回前端時帶上)
    const params = new URLSearchParams(window.location.search);
    const flag = params.get('threads');
    if (flag === 'connected' || flag === 'error') {
      setAuthReturn(flag);
      params.delete('threads');
      const qs = params.toString();
      window.history.replaceState(null, '', window.location.pathname + (qs ? `?${qs}` : ''));
    }
    void refresh();
  }, [refresh]);

  const connect = useCallback(() => {
    window.open(threadsAuthStartUrl(BACKEND_API_BASE, installId), '_blank', 'noopener');
  }, [installId]);

  const publish = useCallback(
    async (text: string) => {
      setBusy(true);
      const r = await publishThreadsNow({ base: BACKEND_API_BASE, installId, text });
      setBusy(false);
      return r;
    },
    [installId],
  );

  const schedule = useCallback(
    async (text: string, publishAt: number) => {
      setBusy(true);
      const r = await scheduleThreadsPost({ base: BACKEND_API_BASE, installId, text, publishAt });
      setBusy(false);
      return r;
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
  };
}
