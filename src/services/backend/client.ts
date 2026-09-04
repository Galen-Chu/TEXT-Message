/**
 * 平台代發後端 client(階段三前端串接):URL 組裝為純函式,
 * fetch 可注入測試;所有錯誤統一為 BackendErrorCode(不向外拋例外)。
 * 資料邊界紅線:只送貼文內容與 installId,絕不送 emails/AI key。
 */

export type BackendErrorCode =
  | 'network'
  | 'not_connected'
  | 'invalid_text'
  | 'invalid_publish_at'
  | 'invalid_install_id'
  | 'not_found'
  | 'not_pending'
  | 'forbidden_origin'
  | 'publish_failed'
  | 'unknown';

export type BackendResult<T> = { ok: true; data: T } | { ok: false; code: BackendErrorCode };

export type Fetcher = (url: string, init?: RequestInit) => Promise<Response>;

export interface ThreadsQueueItemView {
  id: string;
  text: string;
  publishAt: number;
  status: 'pending' | 'done' | 'failed' | 'cancelled';
  attempts: number;
  lastError?: string;
  postId?: string;
}

/** OAuth 起始 URL(瀏覽器新分頁開啟;state 由 worker 簽章)。 */
export function threadsAuthStartUrl(base: string, installId: string): string {
  return `${base}/auth/threads/start?install=${encodeURIComponent(installId)}`;
}

async function requestJson<T>(
  url: string,
  init: RequestInit,
  fetcher: Fetcher,
): Promise<BackendResult<T>> {
  let resp: Response;
  try {
    resp = await fetcher(url, init);
  } catch {
    return { ok: false, code: 'network' };
  }
  let body: unknown = null;
  try {
    body = await resp.json();
  } catch {
    body = null;
  }
  if (!resp.ok) {
    const code = (body as { error?: string } | null)?.error;
    const known: BackendErrorCode[] = [
      'not_connected',
      'invalid_text',
      'invalid_publish_at',
      'invalid_install_id',
      'not_found',
      'not_pending',
      'forbidden_origin',
      'publish_failed',
    ];
    return {
      ok: false,
      code: resp.status >= 500 ? 'unknown' : known.includes(code as BackendErrorCode) ? (code as BackendErrorCode) : 'unknown',
    };
  }
  return { ok: true, data: body as T };
}

function jsonInit(method: 'GET' | 'POST', body?: unknown): RequestInit {
  return {
    method,
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  };
}

export function checkThreadsStatus(opts: {
  base: string;
  installId: string;
  fetcher?: Fetcher;
}): Promise<BackendResult<{ connected: boolean }>> {
  return requestJson(
    `${opts.base}/api/threads/status?install=${encodeURIComponent(opts.installId)}`,
    jsonInit('GET'),
    opts.fetcher ?? fetch,
  );
}

export function publishThreadsNow(opts: {
  base: string;
  installId: string;
  text: string;
  fetcher?: Fetcher;
}): Promise<BackendResult<{ id: string }>> {
  return requestJson(
    `${opts.base}/api/threads/publish`,
    jsonInit('POST', { installId: opts.installId, text: opts.text }),
    opts.fetcher ?? fetch,
  );
}

export function scheduleThreadsPost(opts: {
  base: string;
  installId: string;
  text: string;
  publishAt: number;
  fetcher?: Fetcher;
}): Promise<BackendResult<{ itemId: string }>> {
  return requestJson(
    `${opts.base}/api/schedule`,
    jsonInit('POST', { installId: opts.installId, text: opts.text, publishAt: opts.publishAt }),
    opts.fetcher ?? fetch,
  );
}

export function listThreadsQueue(opts: {
  base: string;
  installId: string;
  fetcher?: Fetcher;
}): Promise<BackendResult<{ items: ThreadsQueueItemView[] }>> {
  return requestJson(
    `${opts.base}/api/queue?install=${encodeURIComponent(opts.installId)}`,
    jsonInit('GET'),
    opts.fetcher ?? fetch,
  );
}

export function cancelThreadsQueueItem(opts: {
  base: string;
  installId: string;
  itemId: string;
  fetcher?: Fetcher;
}): Promise<BackendResult<{ ok: boolean }>> {
  return requestJson(
    `${opts.base}/api/queue/cancel`,
    jsonInit('POST', { installId: opts.installId, itemId: opts.itemId }),
    opts.fetcher ?? fetch,
  );
}
