import { describe, expect, it } from 'vitest';
import { getWeekDates, shortDateLabel } from './date';

describe('shortDateLabel', () => {
  it('同年顯示 M/D', () => {
    const y = new Date().getFullYear();
    expect(shortDateLabel(new Date(y, 6, 13))).toBe('7/13');
  });

  it('跨年顯示 YYYY/M/D', () => {
    const y = new Date().getFullYear() - 1;
    expect(shortDateLabel(new Date(y, 6, 13))).toBe(`${y}/7/13`);
  });
});

describe('getWeekDates', () => {
  it('回傳 7 個日期且第一天是週一(以週一為首)', () => {
    const week = getWeekDates(new Date(2026, 7, 19)); // 2026-08-19 是週三
    expect(week).toHaveLength(7);
    expect(week[0]).toBe('2026-08-17'); // 該週週一
    expect(new Date(week[0] + 'T00:00:00').getDay()).toBe(1);
    expect(week[6]).toBe('2026-08-23'); // 該週週日
  });
});
