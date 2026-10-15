/**
 * 自動發文管線 P1 純邏輯(docs/PIPELINE-PLAN.md 架構 1:前端批次預排)。
 * 時區鐵則:使用者填的 HH:mm 是**本機時間**——用 `new Date('YYYY-MM-DDTHH:mm:ss')`
 * 組 epoch(ES 規格:無時區標記的 date-time 字串=本機時間),不自行換算 UTC。
 */
import { toISODate } from './date';

export type PipelineSource = 'journal-ai' | 'templates' | 'manual';

/** 每日預排單元:date=本機 YYYY-MM-DD,publishAt=該日本機 time 的 epoch ms。 */
export interface DailyPlanItem {
  date: string;
  publishAt: number;
}

/** 明天的本機 YYYY-MM-DD(冪等補糧一律從明天起算,§3.4:發佈前必然看得見)。 */
export function tomorrowISO(now = new Date()): string {
  const d = new Date(now);
  d.setDate(d.getDate() + 1);
  return toISODate(d);
}

/**
 * 算出 from 起 horizonDays 天的預排(略過 skipDates——已排/不想排的日期)。
 * 備糧不足(horizon 內全被略過)回空陣列,呼叫端誠實提示,不湊數。
 */
export function buildDailyPlan(opts: {
  from: string; // YYYY-MM-DD(本機)
  horizonDays: number;
  time: string; // HH:mm
  skipDates?: string[];
  now?: Date;
}): DailyPlanItem[] {
  const skip = new Set(opts.skipDates ?? []);
  const plan: DailyPlanItem[] = [];
  const base = new Date(`${opts.from}T00:00:00`);
  if (Number.isNaN(base.getTime())) return [];
  for (let i = 0; i < opts.horizonDays; i++) {
    const day = new Date(base);
    day.setDate(day.getDate() + i);
    const date = toISODate(day);
    if (skip.has(date)) continue;
    // 本機時間組 epoch:字串無時區標記=本機(時區鐵則,見檔頭)
    const at = new Date(`${date}T${opts.time}:00`).getTime();
    if (Number.isNaN(at)) continue;
    plan.push({ date, publishAt: at });
  }
  return plan;
}

/** 把佇列項目的 publishAt(epoch)解回本機 YYYY-MM-DD 字串(過濾重複)。 */
export function queuedLocalDates(items: Array<{ publishAt: number }>): string[] {
  const set = new Set<string>();
  for (const item of items) {
    if (typeof item.publishAt === 'number' && Number.isFinite(item.publishAt)) {
      set.add(toISODate(new Date(item.publishAt)));
    }
  }
  return [...set];
}

/** 佇列實際已排到哪天(輸入日期的 max;空陣列回 '')。 */
export function maxDate(dates: string[]): string {
  return dates.length ? dates.reduce((a, b) => (a > b ? a : b)) : '';
}

/** 存量天數:queuedThrough 距 today 還幾天(含 today 當天;未排過=0)。 */
export function remainingDays(queuedThrough: string, today: string): number {
  if (!queuedThrough || queuedThrough <= today) return 0;
  const from = new Date(`${today}T00:00:00`).getTime();
  const to = new Date(`${queuedThrough}T00:00:00`).getTime();
  if (Number.isNaN(from) || Number.isNaN(to)) return 0;
  return Math.round((to - from) / (24 * 60 * 60 * 1000));
}

/** 低水位判斷:存量 ≤ threshold 天即需補糧/提醒(P1 threshold=3)。 */
export function needsTopUp(opts: { queuedThrough: string; today: string; threshold?: number }): boolean {
  return remainingDays(opts.queuedThrough, opts.today) <= (opts.threshold ?? 3);
}

/**
 * 文庫範本輪替(P1 來源,D2 之前的 fallback):先取游標(usedIds)未用過者,
 * 用盡則重置游標展開新輪(範本可重用,與日誌的「不重用」規則不同——見 §3.3);
 * pool < count 時允許循環補足(A B A B…),呼叫端以此保證天天有內容。
 */
export function pickRotated<T extends { id: string }>(
  pool: T[],
  usedIds: string[],
  count: number,
): { picked: T[]; nextUsedIds: string[] } {
  if (!pool.length || count <= 0) return { picked: [], nextUsedIds: usedIds };
  const picked: T[] = [];
  let cursorUsed = [...usedIds];
  while (picked.length < count) {
    const fresh = pool.filter((t) => !cursorUsed.includes(t.id));
    if (!fresh.length) {
      // 本輪用盡:重置游標展開新輪(僅在還沒取到任何東西時重置,
      // 已取的不吐回——維持「一次補糧內不重複」)
      if (picked.length) break;
      cursorUsed = [];
      continue;
    }
    const next = fresh[0];
    picked.push(next);
    cursorUsed.push(next.id);
  }
  return { picked, nextUsedIds: cursorUsed };
}
