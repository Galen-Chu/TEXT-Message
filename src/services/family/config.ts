/**
 * 家族串接設定(U2–U4,2026-10-12)。文管庫與媒管庫同為 `galen-chu.github.io`
 * (origin 只看 scheme+host+port,路徑不計)→ 共用 localStorage,零後端即可交接。
 *
 * 契約設計(媒管庫 `docs/IA-PLAN.md` IA-D4/§3.2,兩 repo 各複製一份、文件記載同一份):
 * **不互讀對方內部鍵**(`text-message:v2` / `media-message:v1`)——那會把對方的 schema
 * 變成自己的依賴,對方一次遷移就連帶壞掉。改為另立版本化的小型契約鍵,各自只寫自己
 * 產出的部分。
 *
 * 紅線(兩邊一致):契約內**只有文字與 metadata**;媒體檔、平台 token、Gemini key、
 * emails 絕不進入 `family:*` 任何鍵。
 */

/** 產品識別字(契約欄位值,勿隨 UI 命名變動)。 */
export type FamilyProduct = 'text-message' | 'media-message';

export const THIS_PRODUCT: FamilyProduct = 'text-message';
export const PEER_PRODUCT: FamilyProduct = 'media-message';

/** 一次性交接佇列(雙向共用一把鍵,項目以 `to` 定址)。 */
export const HANDOFF_KEY = 'family:handoff:v1';

/** 唯讀排程摘要:只寫自己的、只讀對方的。 */
export function scheduleFeedKey(product: FamilyProduct): string {
  return `family:schedule-feed:${product}:v1`;
}

/** 佇列上限,超量淘汰最舊(避免交接一直沒被取用而無限成長)。 */
export const HANDOFF_MAX_ITEMS = 20;

/** 排程摘要的 snippet 上限字數。 */
export const FEED_SNIPPET_MAX = 60;

/** 排程摘要筆數上限(對方只需「近期」,不是全量)。 */
export const FEED_MAX_ITEMS = 5;

/**
 * 陳舊判定:7 天。交接超過 7 天讀取時視為不存在並刪除——使用者按了送出卻一直沒開
 * 對方產品,幾週後冒出早就忘掉的文案,體感是 bug 不是功能;排程摘要超過 7 天
 * 則隱藏整個區塊(過期排程比沒有更誤導)。
 */
export const STALE_MS = 7 * 24 * 60 * 60 * 1000;

/** 媒管庫入口(同帳號 Pages 子路徑;`#handoff` 讓對方開站即切到交接收件匣)。 */
export const PEER_URL = 'https://galen-chu.github.io/MEDIA-Message/';
export const PEER_HANDOFF_URL = `${PEER_URL}#handoff`;
