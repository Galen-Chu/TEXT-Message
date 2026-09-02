import { describe, expect, it } from 'vitest';
import type { SocialPost } from '../types';
import { buildTrendSummary } from './trends';
import { toISODate } from './date';

const NOW = new Date('2026-09-02T15:00:00').getTime();
const DAY = 86_400_000;

function post(overrides: Partial<SocialPost>): SocialPost {
  return {
    id: 'p',
    platform: 'fb',
    title: 't',
    content: 'c',
    date: '2026-09-02',
    time: '09:00',
    ...overrides,
  };
}

function daysAgoISO(n: number): string {
  const d = new Date(NOW - n * DAY);
  return toISODate(d);
}

describe('buildTrendSummary', () => {
  it('空記錄:全為 0,無趨勢', () => {
    const s = buildTrendSummary([], NOW);
    expect(s.total).toBe(0);
    expect(s.hourBuckets).toEqual([0, 0, 0, 0]);
    expect(s.currentStreak).toBe(0);
    expect(s.longestStreak).toBe(0);
  });

  it('各平台近 30/90 天計數;邊界(恰 30 天前)計入 30 天桶', () => {
    const posts = [
      post({ platform: 'fb', date: daysAgoISO(0), time: '09:00' }),
      post({ platform: 'fb', date: daysAgoISO(29), time: '10:00' }),
      post({ platform: 'threads', date: daysAgoISO(31), time: '11:00' }),
      post({ platform: 'yt', date: daysAgoISO(89), time: '12:00' }),
      post({ platform: 'ig', date: daysAgoISO(120), time: '13:00' }),
    ];
    const s = buildTrendSummary(posts, NOW);
    expect(s.counts30).toMatchObject({ fb: 2 });
    expect(s.counts30.threads).toBe(0);
    expect(s.counts90).toMatchObject({ fb: 2, threads: 1, yt: 1 });
    expect(s.counts90.ig).toBe(0);
    expect(s.total).toBe(5);
  });

  it('時段四桶依 HH 分類(0–6/6–12/12–18/18–24)', () => {
    // 用昨天的日期,避免「今天的 18:00/23:30」被未來時間過濾(NOW=15:00)
    const posts = [
      post({ date: '2026-09-01', time: '03:30' }),
      post({ date: '2026-09-01', time: '05:59' }),
      post({ date: '2026-09-01', time: '06:00' }),
      post({ date: '2026-09-01', time: '11:59' }),
      post({ date: '2026-09-01', time: '12:00' }),
      post({ date: '2026-09-01', time: '18:00' }),
      post({ date: '2026-09-01', time: '23:30' }),
    ];
    expect(buildTrendSummary(posts, NOW).hourBuckets).toEqual([2, 2, 1, 2]);
  });

  it('發文日形態:同日多平台 = 跨平台日', () => {
    const posts = [
      post({ platform: 'fb', date: '2026-09-01' }),
      post({ platform: 'ig', date: '2026-09-01' }),
      post({ platform: 'threads', date: '2026-08-20' }),
    ];
    const s = buildTrendSummary(posts, NOW);
    expect(s.crossPlatformDays).toBe(1);
    expect(s.singlePlatformDays).toBe(1);
  });

  it('連續天數:今天有發文計入;今天未發自昨天回推;中斷即停', () => {
    // 昨天+今天連續 → 2;再加前天 → 3;跳過大前天
    const posts = [
      post({ date: '2026-09-02' }),
      post({ date: '2026-09-01' }),
      post({ date: '2026-08-31' }),
      post({ date: '2026-08-29' }),
    ];
    expect(buildTrendSummary(posts, NOW).currentStreak).toBe(3);
    expect(buildTrendSummary(posts, NOW).longestStreak).toBe(3);

    // 今天未發:自昨天回推
    const posts2 = [post({ date: '2026-09-01' }), post({ date: '2026-08-31' })];
    expect(buildTrendSummary(posts2, NOW).currentStreak).toBe(2);

    // 久未發文:currentStreak 歸零
    const posts3 = [post({ date: '2026-08-01' }), post({ date: '2026-07-31' })];
    const s3 = buildTrendSummary(posts3, NOW);
    expect(s3.currentStreak).toBe(0);
    expect(s3.longestStreak).toBe(2);
  });

  it('最長紀錄取所有連續區間最大值,與 currentStreak 獨立', () => {
    const posts = [
      post({ date: '2026-09-02' }),
      post({ date: '2026-08-10' }),
      post({ date: '2026-08-09' }),
      post({ date: '2026-08-08' }),
      post({ date: '2026-08-07' }),
    ];
    const s = buildTrendSummary(posts, NOW);
    expect(s.currentStreak).toBe(1);
    expect(s.longestStreak).toBe(4);
  });

  it('未來時間的異常資料不計入', () => {
    const posts = [post({ date: '2027-01-01', time: '09:00' }), post({ date: '2026-09-02' })];
    const s = buildTrendSummary(posts, NOW);
    expect(s.total).toBe(1);
    expect(s.counts30.fb).toBe(1);
    expect(s.currentStreak).toBe(1);
  });
});
