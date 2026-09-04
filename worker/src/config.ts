/**
 * Worker 環境設定與共用常數。
 * secrets(THREADS_CLIENT_ID/SECRET、TOKEN_ENCRYPTION_KEY)以 `wrangler secret put` 設定;
 * ALLOWED_ORIGIN 為 var(wrangler.toml),= 前端 GitHub Pages 網址(CORS 白名單,僅一個)。
 */

/** Workers KV 的最小介面(足以支撐本 worker;測試以此注入假實作)。 */
export interface KvLike {
  get(key: string): Promise<string | null>;
  put(key: string, value: string, opts?: { expirationTtl?: number }): Promise<void>;
  delete(key: string): Promise<void>;
  list(opts?: { prefix?: string; limit?: number; cursor?: string }): Promise<{
    keys: Array<{ name: string }>;
    list_complete: boolean;
    cursor?: string;
  }>;
}

export interface Env {
  THREADS_CLIENT_ID: string;
  THREADS_CLIENT_SECRET: string;
  /** 32 bytes,hex(64 個十六進位字);用於 AES-GCM 加密 token 與 state 簽章。 */
  TOKEN_ENCRYPTION_KEY: string;
  /** 前端完整網址(含路徑),如 https://galen-chu.github.io/TEXT-Message/;CORS 白名單與 OAuth 回跳皆用它。 */
  FRONTEND_URL: string;
  QUEUE: KvLike;
}

/** Threads 文字貼文上限(API 限制,以字元計)。 */
export const THREADS_TEXT_LIMIT = 500;

/** Threads OAuth 端點(code→短效 token 為 POST;長效交換與刷新各有獨立端點,皆 GET)。 */
export const THREADS_AUTHORIZE_URL = 'https://threads.net/oauth/authorize';
export const THREADS_TOKEN_URL = 'https://graph.threads.net/oauth/access_token';
export const THREADS_EXCHANGE_URL = 'https://graph.threads.net/access_token';
export const THREADS_REFRESH_URL = 'https://graph.threads.net/refresh_access_token';

/** Threads Graph API base。 */
export const THREADS_API_BASE = 'https://graph.threads.net/v1.0';

/** 發佈失敗重試上限與退避(指數,上限 15 分鐘)。 */
export const MAX_ATTEMPTS = 3;
export const BASE_BACKOFF_MS = 60_000;
export const MAX_BACKOFF_MS = 15 * 60_000;

/** 長效 token(60 天)到期前刷新的提前量。 */
export const TOKEN_REFRESH_LEAD_MS = 7 * 24 * 60 * 60 * 1000;
