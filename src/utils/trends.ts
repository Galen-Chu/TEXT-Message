/**
 * 發文趨勢計算(文管庫深化第三期)——純邏輯,node 環境可測。
 * 資料來源僅限 publishedHistory(真實記錄);示範資料永不傳入(呼叫端負責)。
 */
import { PLATFORM_LIST } from '../constants';
import type { PlatformKey, SocialPost } from '../types';
import { toISODate } from './date';

/** 顯示門檻:真實記錄少於此數時不出趨勢,改提示累積中。 */
export const TRENDS_THRESHOLD = 5;

const DAY_MS = 86_400_000;

export interface TrendSummary {
  total: number;
  /** 近 30/90 天各平台發文數(所有平台鍵值都會出現,無資料為 0)。 */
  counts30: Record<PlatformKey, number>;
  counts90: Record<PlatformKey, number>;
  /** 發文時段四桶:[0–6, 6–12, 12–18, 18–24](以記錄的 HH:mm 判斷)。 */
  hourBuckets: [number, number, number, number];
  /** 發文日形態:單平台日 / 跨平台日(同日 ≥2 個不同平台)。 */
  singlePlatformDays: number;
  crossPlatformDays: number;
  /** 連續發文天數(今天有發文計入;今天尚未發則自昨天回推)。 */
  currentStreak: number;
  longestStreak: number;
}

function postTimestamp(post: SocialPost): number {
  return new Date(`${post.date}T${post.time}:00`).getTime();
}

function dayNumber(dateStr: string): number {
  return Math.floor(new Date(`${dateStr}T00:00:00`).getTime() / DAY_MS);
}

function emptyCounts(): Record<PlatformKey, number> {
  return Object.fromEntries(PLATFORM_LIST.map((p) => [p.key, 0])) as Record<PlatformKey, number>;
}

export function buildTrendSummary(posts: SocialPost[], now: number = Date.now()): TrendSummary {
  const counts30 = emptyCounts();
  const counts90 = emptyCounts();
  const hourBuckets: [number, number, number, number] = [0, 0, 0, 0];
  const platformsByDay = new Map<string, Set<string>>();

  const valid = posts.filter((p) => postTimestamp(p) <= now); // 未來時間的異常資料完全不計
  for (const post of valid) {
    const ts = postTimestamp(post);
    if (now - ts < 90 * DAY_MS) counts90[post.platform] = (counts90[post.platform] ?? 0) + 1;
    if (now - ts < 30 * DAY_MS) counts30[post.platform] = (counts30[post.platform] ?? 0) + 1;
    const hour = Number(post.time.slice(0, 2));
    const bucket = Number.isFinite(hour) ? Math.min(3, Math.max(0, Math.floor(hour / 6))) : 0;
    hourBuckets[bucket] += 1;
    if (!platformsByDay.has(post.date)) platformsByDay.set(post.date, new Set());
    platformsByDay.get(post.date)!.add(post.platform);
  }

  let singlePlatformDays = 0;
  let crossPlatformDays = 0;
  for (const set of platformsByDay.values()) {
    if (set.size >= 2) crossPlatformDays += 1;
    else singlePlatformDays += 1;
  }

  // streak:以「日」為單位的連續區間
  const daySet = new Set([...platformsByDay.keys()].map(dayNumber));
  const dayNums = [...daySet].sort((a, b) => a - b);
  let longestStreak = 0;
  let run = 0;
  for (let i = 0; i < dayNums.length; i++) {
    run = i > 0 && dayNums[i] === dayNums[i - 1] + 1 ? run + 1 : 1;
    longestStreak = Math.max(longestStreak, run);
  }
  let currentStreak = 0;
  {
    let anchor = dayNumber(toISODate(new Date(now)));
    if (!daySet.has(anchor)) anchor -= 1; // 今天還沒發,自昨天回推
    while (daySet.has(anchor)) {
      currentStreak += 1;
      anchor -= 1;
    }
  }

  return {
    total: valid.length,
    counts30,
    counts90,
    hourBuckets,
    singlePlatformDays,
    crossPlatformDays,
    currentStreak,
    longestStreak,
  };
}
