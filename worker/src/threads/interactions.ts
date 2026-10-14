/**
 * Threads 互動唯讀代讀(2026-10-14;NOTIFY-PLAN 方案 A 改版定案:**即時唯讀代讀、零儲存**)。
 *
 * 資料邊界:worker 以代管 token 呼叫 Threads 唯讀 API,回應**直接轉傳前端、不寫入 KV**。
 * 互動內容(留言文字、留言者帳號)不經過任何儲存媒介;「未讀」判定在前端(localStorage
 * 只記最後查看時間,不存互動內容)。不走 cron,故不佔 KV 額度。
 *
 * 官方文件(2026-10-14 查證;升版或端點異動時改此處註解):
 * - 列自己的貼文:`GET /{threads-user-id}/threads`
 *   https://developers.facebook.com/documentation/threads/retrieve-and-discover-posts/retrieve-posts
 * - 列某篇的回覆:`GET /{media-id}/replies`(僅頂層)、`GET /{media-id}/conversation`(全層)
 *   https://developers.facebook.com/documentation/threads/retrieve-and-manage-replies/replies-and-conversations
 * - 權限:`threads_basic`(所有端點必備)+ `threads_read_replies`(GET 讀回覆)
 *   https://developers.facebook.com/documentation/threads/retrieve-and-manage-replies
 *
 * **陷阱(查證時實際踩到的理解錯誤)**:`GET /{threads-user-id}/replies` 回的是
 * 「**使用者自己發出的**回覆」(文件原文 "all replies created by a user"),不是收到的回覆。
 * 要拿別人回在我貼文下的留言,只能先列自己的貼文、再逐篇取回覆——無單一端點可用。
 *
 * webhook 替代方案(同日查證):Threads 已有 webhooks(`replies`/`mentions`/`delete`/`publish`),
 * 但需 App Review 取得 Advanced Access + 商家驗證才會推送,自用單租戶門檻高於輪詢,故不採用。
 */
import { THREADS_API_BASE } from '../config';
import type { Fetcher } from './oauth';

/** 掃描最近幾篇自己的貼文(每篇一次 replies 請求;6 次請求內完成一輪)。 */
export const MAX_POSTS_SCANNED = 5;
/** 回傳互動筆數上限(前端只顯示最近幾筆,過多無益且放大回應體積)。 */
export const MAX_INTERACTIONS = 20;

/** 自己貼文列表需要的欄位(只取顯示與連結所需,不多拿)。 */
export const POST_FIELDS = 'id,text,permalink,timestamp';
/** 回覆需要的欄位;`is_reply_owned_by_me` 用來濾掉自己的回覆。 */
export const REPLY_FIELDS = 'id,text,username,permalink,timestamp,is_reply_owned_by_me';

export interface ThreadsInteraction {
  /** 回覆 id。 */
  id: string;
  /** 回覆者帳號(無則空字串)。 */
  username: string;
  /** 回覆文字(可能為空,例如純圖片回覆)。 */
  text: string;
  /** 回覆的永久連結(前端「到 Threads 回覆」用)。 */
  permalink: string;
  /** 回覆時間(ms epoch;無法解析時為 0)。 */
  timestamp: number;
  /** 被回覆的貼文 id。 */
  postId: string;
  /** 被回覆貼文的節錄(前端顯示脈絡)。 */
  postSnippet: string;
}

/** 權限不足(缺 threads_read_replies 等);呼叫端據此要求使用者重新連接。 */
export class ThreadsScopeError extends Error {
  constructor(detail: string) {
    super(`threads scope insufficient: ${detail}`);
    this.name = 'ThreadsScopeError';
  }
}

export function buildUserThreadsUrl(userId: string, limit = MAX_POSTS_SCANNED): string {
  const params = new URLSearchParams({ fields: POST_FIELDS, limit: String(limit) });
  return `${THREADS_API_BASE}/${encodeURIComponent(userId)}/threads?${params.toString()}`;
}

export function buildRepliesUrl(mediaId: string, limit = MAX_INTERACTIONS): string {
  const params = new URLSearchParams({ fields: REPLY_FIELDS, limit: String(limit) });
  return `${THREADS_API_BASE}/${encodeURIComponent(mediaId)}/replies?${params.toString()}`;
}

/**
 * Meta 錯誤回應是否為權限問題。
 * code 190=token 失效/權限變更、200=權限不足(FB 側已有實錄,BACKEND.md §6.1 #8);
 * 另保留訊息字樣比對,避免 Threads 側回不同碼時誤判為一般讀取失敗。
 */
export function isPermissionError(data: unknown): boolean {
  const err = (data as { error?: { code?: unknown; message?: unknown } } | null)?.error;
  if (!err) return false;
  if (err.code === 190 || err.code === 200) return true;
  const msg = typeof err.message === 'string' ? err.message.toLowerCase() : '';
  return msg.includes('permission') || msg.includes('scope');
}

async function getJson(url: string, accessToken: string, fetcher: Fetcher): Promise<Record<string, unknown>> {
  const resp = await fetcher(url, {
    method: 'GET',
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const raw = await resp.text();
  let data: Record<string, unknown>;
  try {
    data = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    throw new Error(`threads api non-json response: ${raw.slice(0, 200)}`);
  }
  if (!resp.ok) {
    if (isPermissionError(data)) throw new ThreadsScopeError(JSON.stringify(data).slice(0, 200));
    throw new Error(`threads read failed: ${JSON.stringify(data).slice(0, 200)}`);
  }
  return data;
}

function asString(v: unknown): string {
  return typeof v === 'string' ? v : '';
}

/** ISO 8601 → ms epoch;無法解析回 0(不讓壞時間戳炸掉整輪)。 */
export function parseTimestamp(v: unknown): number {
  if (typeof v !== 'string') return 0;
  const ms = Date.parse(v);
  return Number.isFinite(ms) ? ms : 0;
}

export interface ThreadsPostRef {
  id: string;
  snippet: string;
}

/** 貼文節錄上限(僅供顯示脈絡)。 */
export const POST_SNIPPET_MAX = 40;

export function parsePostList(data: unknown): ThreadsPostRef[] {
  const items = (data as { data?: unknown } | null)?.data;
  if (!Array.isArray(items)) return [];
  const out: ThreadsPostRef[] = [];
  for (const raw of items) {
    const id = asString((raw as { id?: unknown })?.id);
    if (!id) continue; // 單筆壞不連坐整輪
    const text = asString((raw as { text?: unknown })?.text).replace(/\s+/g, ' ').trim();
    out.push({
      id,
      snippet: text.length > POST_SNIPPET_MAX ? `${text.slice(0, POST_SNIPPET_MAX)}…` : text,
    });
  }
  return out;
}

/** 解析某篇貼文的回覆;**濾掉自己的回覆**(`is_reply_owned_by_me`)——那不是「別人的互動」。 */
export function parseReplies(data: unknown, post: ThreadsPostRef): ThreadsInteraction[] {
  const items = (data as { data?: unknown } | null)?.data;
  if (!Array.isArray(items)) return [];
  const out: ThreadsInteraction[] = [];
  for (const raw of items) {
    const row = raw as Record<string, unknown>;
    const id = asString(row.id);
    if (!id) continue;
    if (row.is_reply_owned_by_me === true) continue;
    out.push({
      id,
      username: asString(row.username),
      text: asString(row.text),
      permalink: asString(row.permalink),
      timestamp: parseTimestamp(row.timestamp),
      postId: post.id,
      postSnippet: post.snippet,
    });
  }
  return out;
}

export interface InteractionsOutcome {
  items: ThreadsInteraction[];
  /** 本輪掃描了幾篇自己的貼文(前端誠實標示「只看最近 N 篇」)。 */
  scanned: number;
}

/**
 * 完整流程:列最近貼文 → 逐篇取回覆 → 合併、濾己、依時間新到舊排序、截上限。
 * 單篇回覆讀取失敗不中斷整輪(該篇略過);權限錯誤例外——那是要使用者重新授權的訊號,直接往外拋。
 */
export async function fetchThreadsInteractions(
  opts: { userId: string; accessToken: string; maxPosts?: number },
  fetcher: Fetcher = fetch,
): Promise<InteractionsOutcome> {
  const maxPosts = opts.maxPosts ?? MAX_POSTS_SCANNED;
  const listed = await getJson(buildUserThreadsUrl(opts.userId, maxPosts), opts.accessToken, fetcher);
  const posts = parsePostList(listed).slice(0, maxPosts);

  const all: ThreadsInteraction[] = [];
  for (const post of posts) {
    try {
      const data = await getJson(buildRepliesUrl(post.id), opts.accessToken, fetcher);
      all.push(...parseReplies(data, post));
    } catch (err) {
      if (err instanceof ThreadsScopeError) throw err;
      // 單篇失敗(已刪除/權限個案)不毀整輪
    }
  }
  all.sort((a, b) => b.timestamp - a.timestamp);
  return { items: all.slice(0, MAX_INTERACTIONS), scanned: posts.length };
}
