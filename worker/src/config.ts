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
  /** FB 粉專 OAuth(可與 Threads 同一個 Meta app 的 id/secret;未設=FB 功能停用)。 */
  FACEBOOK_CLIENT_ID: string;
  FACEBOOK_CLIENT_SECRET: string;
  /** 商家版組態 id(僅 Facebook Login for Business 的 App 需要;標準版 Facebook Login 可不設,
   *  授權改以 scope 帶權限)。2026-09-30/10-01 實測:本 App 商家版組態型錄無 pages 發文權限。 */
  FACEBOOK_LOGIN_CONFIG_ID?: string;
  /** 系統工作人員模式(2026-10-01 採用,優先於 OAuth):商業組合後台產生的系統用戶 token
   *  直接作為 worker secret,免 OAuth 流程、永不過期(撤銷=商業後台撤銷權限)。
   *  兩個 secret 齊備即啟用;單租戶(全站共用此發佈通道)。 */
  FACEBOOK_PAGE_TOKEN?: string;
  FACEBOOK_PAGE_ID?: string;
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

/**
 * Facebook Pages API(2026-09-30 依當下官方文件查證;版本刻意固定,升級時改此處):
 * - OAuth 手動流程(對話框與 code 交換):
 *   https://developers.facebook.com/docs/facebook-login/guides/advanced/manual-flow
 * - 短效→長效交換(grant_type=fb_exchange_token,同 /oauth/access_token 端點)
 * - /me/accounts(粉專清單+各頁 page token):
 *   https://developers.facebook.com/docs/graph-api/reference/user/accounts/
 * - POST /{page-id}/feed(message;回 {id}):
 *   https://developers.facebook.com/docs/graph-api/reference/page/feed/
 * 查證時點官方文件已渲染 v26.0;v25.0(2026-02 發佈)仍在支援期內,先固定於 v25.0。
 */
export const FACEBOOK_GRAPH_VERSION = 'v25.0';
export const FACEBOOK_AUTHORIZE_URL = `https://www.facebook.com/${FACEBOOK_GRAPH_VERSION}/dialog/oauth`;
export const FACEBOOK_TOKEN_URL = `https://graph.facebook.com/${FACEBOOK_GRAPH_VERSION}/oauth/access_token`;
export const FACEBOOK_API_BASE = `https://graph.facebook.com/${FACEBOOK_GRAPH_VERSION}`;

/** FB 貼文字數上限(與前端 PLATFORM_META.fb.limit 一致)。 */
export const FACEBOOK_TEXT_LIMIT = 63206;

/** 文庫雲端備份(方案 A,2026-10-05):單一 blob 上限(KV 值建議 < 1MB;內容由瀏覽器以
 *  同步碼衍生金鑰加密,worker 僅存密文、不解析內容、不經手同步碼原文)。 */
export const LIBRARY_BLOB_LIMIT_BYTES = 512 * 1024;

/** FB 是否走系統工作人員模式(兩個 secret 齊備;優先於 OAuth 模式)。 */
export function facebookSystemUserMode(env: Env): boolean {
  return !!env.FACEBOOK_PAGE_TOKEN && !!env.FACEBOOK_PAGE_ID;
}

/** 發佈失敗重試上限與退避(指數,上限 15 分鐘)。 */
export const MAX_ATTEMPTS = 3;
export const BASE_BACKOFF_MS = 60_000;
export const MAX_BACKOFF_MS = 15 * 60_000;

/** 長效 token(60 天)到期前刷新的提前量。 */
export const TOKEN_REFRESH_LEAD_MS = 7 * 24 * 60 * 60 * 1000;
