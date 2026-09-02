import { describe, expect, it } from 'vitest';
import {
  applyFailure,
  applySuccess,
  backoffDelayMs,
  isDue,
  parseQueueItem,
  parseQueueKey,
  queueKey,
  type QueueItem,
} from './due';

const NOW = 1_000_000_000_000;

function item(overrides: Partial<QueueItem> = {}): QueueItem {
  return {
    id: 'item-1',
    installId: 'install-1',
    platform: 'threads',
    text: '貼文內容',
    publishAt: NOW - 1000,
    status: 'pending',
    attempts: 0,
    ...overrides,
  };
}

describe('queue key', () => {
  it('組合與拆解互為反函數', () => {
    expect(queueKey('install-1', 'item-9')).toBe('queue:install-1:item-9');
    expect(parseQueueKey('queue:install-1:item-9')).toEqual({ installId: 'install-1', itemId: 'item-9' });
    expect(parseQueueKey('queue:nocolon')).toBeNull();
    expect(parseQueueKey('queue::x')).toBeNull();
    expect(parseQueueKey('other:install-1:item-9')).toBeNull();
  });
});

describe('parseQueueItem', () => {
  it('完整 JSON 還原;缺欄位或非 JSON 回 null', () => {
    const it = item();
    expect(parseQueueItem(JSON.stringify(it))).toEqual(it);
    expect(parseQueueItem(null)).toBeNull();
    expect(parseQueueItem('not json')).toBeNull();
    expect(parseQueueItem(JSON.stringify({ id: 'x' }))).toBeNull();
  });
});

describe('isDue', () => {
  it('pending 且過排定時間 → due;未到、非 pending、退避中 → not due', () => {
    expect(isDue(item(), NOW)).toBe(true);
    expect(isDue(item({ publishAt: NOW + 1000 }), NOW)).toBe(false);
    expect(isDue(item({ status: 'done' }), NOW)).toBe(false);
    expect(isDue(item({ nextAttemptAt: NOW + 5000 }), NOW)).toBe(false);
    expect(isDue(item({ nextAttemptAt: NOW - 1 }), NOW)).toBe(true);
  });
});

describe('退避與狀態轉移', () => {
  it('backoffDelayMs 指數成長,上限 15 分鐘', () => {
    expect(backoffDelayMs(1)).toBe(60_000);
    expect(backoffDelayMs(2)).toBe(120_000);
    expect(backoffDelayMs(3)).toBe(240_000);
    expect(backoffDelayMs(20)).toBe(900_000);
  });

  it('applyFailure:未耗盡 → 退避;第 3 次 → failed(不再重試)', () => {
    const once = applyFailure(item(), 'boom', NOW);
    expect(once.status).toBe('pending');
    expect(once.attempts).toBe(1);
    expect(once.nextAttemptAt).toBe(NOW + 60_000);
    expect(once.lastError).toBe('boom');

    const twice = applyFailure(once, 'boom2', NOW);
    expect(twice.attempts).toBe(2);
    expect(twice.status).toBe('pending');

    const thrice = applyFailure(twice, 'boom3', NOW);
    expect(thrice.status).toBe('failed');
    expect(thrice.attempts).toBe(3);
    expect(isDue(thrice, NOW + 10_000_000)).toBe(false);
  });

  it('applySuccess:轉 done 並記下貼文 id', () => {
    const done = applySuccess(item(), 'post-1');
    expect(done.status).toBe('done');
    expect(done.postId).toBe('post-1');
    expect(done.nextAttemptAt).toBeUndefined();
  });
});
