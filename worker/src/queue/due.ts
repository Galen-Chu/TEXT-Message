/**
 * 排程佇列的純邏輯:到期判斷、退避重試、項目序列化。
 * KV 資料形狀(值為 JSON 字串,金鑰 `queue:<installId>:<itemId>`):
 *   { id, installId, platform, text, publishAt, status, attempts, lastError?, postId?, nextAttemptAt? }
 * status: pending → done | failed(重試耗盡)| cancelled
 */
import { BASE_BACKOFF_MS, MAX_ATTEMPTS, MAX_BACKOFF_MS } from '../config';

export type QueueStatus = 'pending' | 'done' | 'failed' | 'cancelled';

export interface QueueItem {
  id: string;
  installId: string;
  platform: string;
  text: string;
  /** 預定發佈時間(ms epoch)。 */
  publishAt: number;
  status: QueueStatus;
  attempts: number;
  lastError?: string;
  postId?: string;
  /** 失敗重試的下次可嘗試時間(ms epoch);無值 = 立即可重試。 */
  nextAttemptAt?: number;
}

export function queueKey(installId: string, itemId: string): string {
  return `queue:${installId}:${itemId}`;
}

export const QUEUE_PREFIX = 'queue:';

/** 從 KV list 的完整金鑰拆回 {installId, itemId}。 */
export function parseQueueKey(key: string): { installId: string; itemId: string } | null {
  const rest = key.startsWith(QUEUE_PREFIX) ? key.slice(QUEUE_PREFIX.length) : '';
  const sep = rest.indexOf(':');
  if (sep <= 0 || sep === rest.length - 1) return null;
  return { installId: rest.slice(0, sep), itemId: rest.slice(sep + 1) };
}

export function parseQueueItem(raw: string | null): QueueItem | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as Partial<QueueItem>;
    if (
      typeof v.id !== 'string' ||
      typeof v.installId !== 'string' ||
      typeof v.text !== 'string' ||
      typeof v.publishAt !== 'number' ||
      typeof v.status !== 'string' ||
      typeof v.attempts !== 'number'
    ) {
      return null;
    }
    return { ...(v as QueueItem) };
  } catch {
    return null;
  }
}

/** 此項目現在是否應該被處理(pending、到點、且不在退避冷卻中)。 */
export function isDue(item: QueueItem, now: number): boolean {
  if (item.status !== 'pending') return false;
  if (item.publishAt > now) return false;
  if (item.nextAttemptAt && item.nextAttemptAt > now) return false;
  return true;
}

/** 指數退避:第 n 次失敗後的下次可嘗試延遲(60s → 2m → 4m…上限 15 分鐘)。 */
export function backoffDelayMs(attempts: number): number {
  return Math.min(BASE_BACKOFF_MS * 2 ** Math.max(0, attempts - 1), MAX_BACKOFF_MS);
}

/** 套用一次失敗:退避或(耗盡重試)轉 failed。 */
export function applyFailure(item: QueueItem, error: string, now: number): QueueItem {
  const attempts = item.attempts + 1;
  if (attempts >= MAX_ATTEMPTS) {
    return { ...item, attempts, status: 'failed', lastError: error.slice(0, 200) };
  }
  return {
    ...item,
    attempts,
    nextAttemptAt: now + backoffDelayMs(attempts),
    lastError: error.slice(0, 200),
  };
}

export function applySuccess(item: QueueItem, postId: string): QueueItem {
  return { ...item, status: 'done', postId, lastError: undefined, nextAttemptAt: undefined };
}
