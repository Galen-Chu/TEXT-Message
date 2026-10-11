/**
 * 家族排程摘要(U4,2026-10-12)。文管庫寫 `family:schedule-feed:text-message:v1`
 * (只寫自己的)、讀 `family:schedule-feed:media-message:v1`(只讀對方的)。
 *
 * 紅線:摘要只含平台、時間與 ≤60 字片段;貼文全文不必、token/媒體檔絕不進入。
 */
import type { ScheduleItem } from '../../types';
import { effectiveStatus, scheduleDateTime } from '../../utils/schedule';
import {
  FEED_MAX_ITEMS,
  FEED_SNIPPET_MAX,
  PEER_PRODUCT,
  STALE_MS,
  THIS_PRODUCT,
  scheduleFeedKey,
  type FamilyProduct,
} from './config';
import type { FamilyStorage } from './handoff';

export interface ScheduleFeedItem {
  platform: string;
  /** epoch ms */
  when: number;
  snippet: string;
}

export interface ScheduleFeed {
  v: 1;
  product: FamilyProduct;
  updatedAt: number;
  items: ScheduleFeedItem[];
}

function snippetOf(item: ScheduleItem): string {
  const source = (item.title || item.content || '').replace(/\s+/g, ' ').trim();
  return source.length > FEED_SNIPPET_MAX ? `${source.slice(0, FEED_SNIPPET_MAX)}…` : source;
}

/**
 * 由本機排程組出摘要:只取**未來且尚未發佈**的項目(逾期/已發佈對對方無意義),
 * 由近到遠取前 FEED_MAX_ITEMS 筆。
 */
export function buildScheduleFeed(items: ScheduleItem[], now: number): ScheduleFeed {
  const upcoming = items
    .filter((i) => effectiveStatus(i, now) === 'scheduled')
    .sort((a, b) => scheduleDateTime(a).getTime() - scheduleDateTime(b).getTime())
    .slice(0, FEED_MAX_ITEMS)
    .map((i) => ({
      platform: i.platform as string,
      when: scheduleDateTime(i).getTime(),
      snippet: snippetOf(i),
    }));
  return { v: 1, product: THIS_PRODUCT, updatedAt: now, items: upcoming };
}

function isFeedItem(v: unknown): v is ScheduleFeedItem {
  if (typeof v !== 'object' || v === null) return false;
  const o = v as Record<string, unknown>;
  return (
    typeof o.platform === 'string' &&
    typeof o.when === 'number' &&
    Number.isFinite(o.when) &&
    typeof o.snippet === 'string'
  );
}

/**
 * 解析對方的摘要。防禦式:版本不符/形狀壞/產品不符/`updatedAt` 超過 STALE_MS
 * 一律回 null——呼叫端據此**隱藏整個區塊**,而非顯示過期排程。
 */
export function parseScheduleFeed(
  raw: string | null,
  expectedProduct: FamilyProduct,
  now: number,
): ScheduleFeed | null {
  if (!raw) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof parsed !== 'object' || parsed === null) return null;
  const o = parsed as Record<string, unknown>;
  if (o.v !== 1 || o.product !== expectedProduct) return null;
  if (typeof o.updatedAt !== 'number' || !Number.isFinite(o.updatedAt)) return null;
  if (now - o.updatedAt > STALE_MS) return null;
  if (!Array.isArray(o.items)) return null;
  return {
    v: 1,
    product: expectedProduct,
    updatedAt: o.updatedAt,
    items: o.items.filter(isFeedItem),
  };
}

/** 發佈自己的摘要;儲存不可用時靜默略過(僅對方看不到我方排程,本站功能不受影響)。 */
export function publishOwnFeed(items: ScheduleItem[], deps: { storage: FamilyStorage; now: number }): void {
  try {
    deps.storage.setItem(scheduleFeedKey(THIS_PRODUCT), JSON.stringify(buildScheduleFeed(items, deps.now)));
  } catch {
    // 配額滿/隱私模式:摘要是輔助資訊,不提示(配額提示由 useAppStore 的主區塊負責)
  }
}

/** 讀對方的摘要(陳舊或不可用回 null)。 */
export function readPeerFeed(deps: { storage: FamilyStorage; now: number }): ScheduleFeed | null {
  try {
    return parseScheduleFeed(deps.storage.getItem(scheduleFeedKey(PEER_PRODUCT)), PEER_PRODUCT, deps.now);
  } catch {
    return null;
  }
}
