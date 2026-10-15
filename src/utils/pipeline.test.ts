import { describe, expect, it } from 'vitest';
import {
  buildDailyPlan,
  maxDate,
  needsTopUp,
  pickRotated,
  queuedLocalDates,
  remainingDays,
  tomorrowISO,
} from './pipeline';

describe('tomorrowISO(從明天起算)', () => {
  it('跨月/跨年正確', () => {
    expect(tomorrowISO(new Date('2026-10-31T23:00'))).toBe('2026-11-01');
    expect(tomorrowISO(new Date('2026-12-31T10:00'))).toBe('2027-01-01');
  });
});

describe('buildDailyPlan(本機時區鐵則)', () => {
  it('從 from 起排出 horizonDays 天,時間=本機 HH:mm 組 epoch', () => {
    const plan = buildDailyPlan({ from: '2026-10-16', horizonDays: 3, time: '09:30' });
    expect(plan.map((p) => p.date)).toEqual(['2026-10-16', '2026-10-17', '2026-10-18']);
    // 本機時間字串組出的 epoch,再用本機解回應得同一日期與時分
    const first = new Date(plan[0].publishAt);
    expect(first.getFullYear()).toBe(2026);
    expect(first.getHours()).toBe(9);
    expect(first.getMinutes()).toBe(30);
  });

  it('skipDates 略過已排日期;全被略過回空陣列(不湊數)', () => {
    const plan = buildDailyPlan({
      from: '2026-10-16',
      horizonDays: 3,
      time: '09:00',
      skipDates: ['2026-10-16', '2026-10-17', '2026-10-18'],
    });
    expect(plan).toEqual([]);
    const partial = buildDailyPlan({
      from: '2026-10-16',
      horizonDays: 3,
      time: '09:00',
      skipDates: ['2026-10-17'],
    });
    expect(partial.map((p) => p.date)).toEqual(['2026-10-16', '2026-10-18']);
  });

  it('壞輸入(from/time 格式錯)回空陣列不丟錯', () => {
    expect(buildDailyPlan({ from: 'not-a-date', horizonDays: 3, time: '09:00' })).toEqual([]);
    expect(buildDailyPlan({ from: '2026-10-16', horizonDays: 3, time: '99:99' })).toEqual([]);
  });
});

describe('冪等:佇列日期比對(架構 1 最容易出的 bug)', () => {
  it('publishAt 解回本機日期、去重;壞值略過', () => {
    const at = (s: string) => new Date(`${s}T09:00:00`).getTime();
    const dates = queuedLocalDates([
      { publishAt: at('2026-10-16') },
      { publishAt: at('2026-10-16') }, // 同日兩筆 → 去重
      { publishAt: at('2026-10-18') },
      { publishAt: NaN },
    ]);
    expect(dates.sort()).toEqual(['2026-10-16', '2026-10-18']);
  });

  it('maxDate 取最大;空陣列回空字串', () => {
    expect(maxDate(['2026-10-18', '2026-10-16'])).toBe('2026-10-18');
    expect(maxDate([])).toBe('');
  });
});

describe('needsTopUp / remainingDays(低水位)', () => {
  it('存量天數=queuedThrough 距 today 天數;當天與過期=0;未排=0', () => {
    expect(remainingDays('2026-10-19', '2026-10-16')).toBe(3);
    expect(remainingDays('2026-10-16', '2026-10-16')).toBe(0);
    expect(remainingDays('2026-10-15', '2026-10-16')).toBe(0);
    expect(remainingDays('', '2026-10-16')).toBe(0);
  });

  it('低水位:存量 ≤3 天即 true;≥4 天 false', () => {
    expect(needsTopUp({ queuedThrough: '2026-10-19', today: '2026-10-16' })).toBe(true); // 3
    expect(needsTopUp({ queuedThrough: '2026-10-20', today: '2026-10-16' })).toBe(false); // 4
    expect(needsTopUp({ queuedThrough: '', today: '2026-10-16' })).toBe(true); // 0
  });
});

describe('pickRotated(文庫範本輪替,P1 來源)', () => {
  const pool = [
    { id: 'a', title: 'A' },
    { id: 'b', title: 'B' },
    { id: 'c', title: 'C' },
  ];

  it('先取游標未用過者,數量足額時一次補糧內不重複', () => {
    const r = pickRotated(pool, ['a'], 2);
    expect(r.picked.map((p) => p.id)).toEqual(['b', 'c']);
    expect(r.nextUsedIds).toEqual(['a', 'b', 'c']);
  });

  it('游標全用盡且本輪尚未取 → 重置游標展開新輪', () => {
    const r = pickRotated(pool, ['a', 'b', 'c'], 2);
    expect(r.picked.map((p) => p.id)).toEqual(['a', 'b']);
    expect(r.nextUsedIds).toEqual(['a', 'b']);
  });

  it('pool < count:一輪取盡即停(不循環湊數,單次補糧不重複)', () => {
    const r = pickRotated(pool.slice(0, 2), [], 5);
    expect(r.picked.map((p) => p.id)).toEqual(['a', 'b']);
  });

  it('空 pool 或 count=0 → 不取,游標不動', () => {
    expect(pickRotated([], [], 3).picked).toEqual([]);
    expect(pickRotated(pool, [], 0).picked).toEqual([]);
  });
});
