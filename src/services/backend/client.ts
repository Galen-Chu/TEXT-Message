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
  /** 佇列項目平台:'threads' | 'facebook'(舊資料無此欄位 = threads)。 */
  platform?: string;
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

/** Facebook OAuth 起始 URL(2026-09-30;同款簽章 state)。 */
export function facebookAuthStartUrl(base: string, installId: string): string {
  return `${base}/auth/facebook/start?install=${encodeURIComponent(installId)}`;
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

/** FB 粉專狀態(2026-09-30):connected + pageName(未連線時 null)。 */
export function checkFacebookStatus(opts: {
  base: string;
  installId: string;
  fetcher?: Fetcher;
}): Promise<BackendResult<{ connected: boolean; pageName: string | null }>> {
  return requestJson(
    `${opts.base}/api/facebook/status?install=${encodeURIComponent(opts.installId)}`,
    jsonInit('GET'),
    opts.fetcher ?? fetch,
  );
}

export function publishFacebookNow(opts: {
  base: string;
  installId: string;
  text: string;
  fetcher?: Fetcher;
}): Promise<BackendResult<{ id: string }>> {
  return requestJson(
    `${opts.base}/api/facebook/publish`,
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

/** FB 粉專排程(platform='facebook';佇列與 Threads 共用,由 worker cron 依平台代發)。 */
export function scheduleFacebookPost(opts: {
  base: string;
  installId: string;
  text: string;
  publishAt: number;
  fetcher?: Fetcher;
}): Promise<BackendResult<{ itemId: string }>> {
  return requestJson(
    `${opts.base}/api/schedule`,
    jsonInit('POST', {
      installId: opts.installId,
      text: opts.text,
      publishAt: opts.publishAt,
      platform: 'facebook',
    }),
    opts.fetcher ?? fetch,
  );
}

/** LinkedIn(2026-10-07):狀態(connected+memberName)、立即發佈、排程(platform='linkedin')。 */
export function linkedinAuthStartUrl(base: string, installId: string): string {
  return `${base}/auth/linkedin/start?install=${encodeURIComponent(installId)}`;
}

export function checkLinkedInStatus(opts: {
  base: string;
  installId: string;
  fetcher?: Fetcher;
}): Promise<BackendResult<{ connected: boolean; memberName: string | null }>> {
  return requestJson(
    `${opts.base}/api/linkedin/status?install=${encodeURIComponent(opts.installId)}`,
    jsonInit('GET'),
    opts.fetcher ?? fetch,
  );
}

export function publishLinkedInNow(opts: {
  base: string;
  installId: string;
  text: string;
  fetcher?: Fetcher;
}): Promise<BackendResult<{ id: string }>> {
  return requestJson(
    `${opts.base}/api/linkedin/publish`,
    jsonInit('POST', { installId: opts.installId, text: opts.text }),
    opts.fetcher ?? fetch,
  );
}

export function scheduleLinkedInPost(opts: {
  base: string;
  installId: string;
  text: string;
  publishAt: number;
  fetcher?: Fetcher;
}): Promise<BackendResult<{ itemId: string }>> {
  return requestJson(
    `${opts.base}/api/schedule`,
    jsonInit('POST', {
      installId: opts.installId,
      text: opts.text,
      publishAt: opts.publishAt,
      platform: 'linkedin',
    }),
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

/** 文庫雲端備份(方案 A,2026-10-05):存/取瀏覽器加密後的密文 blob(以 codeId 定位,不帶同步碼原文)。 */
export function librarySave(opts: {
  base: string;
  codeId: string;
  data: string;
  iv: string;
  savedAt: number;
  fetcher?: Fetcher;
}): Promise<BackendResult<{ savedAt: number }>> {
  return requestJson(
    `${opts.base}/api/library/save`,
    jsonInit('POST', { codeId: opts.codeId, data: opts.data, iv: opts.iv, savedAt: opts.savedAt }),
    opts.fetcher ?? fetch,
  );
}

export function libraryLoad(opts: {
  base: string;
  codeId: string;
  fetcher?: Fetcher;
}): Promise<BackendResult<{ v: 1; data: string; iv: string; savedAt: number }>> {
  return requestJson(
    `${opts.base}/api/library/load`,
    jsonInit('POST', { codeId: opts.codeId }),
    opts.fetcher ?? fetch,
  );
}
