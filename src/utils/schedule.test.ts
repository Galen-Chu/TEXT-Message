import { describe, expect, it } from 'vitest';
import type { ScheduleItem } from '../types';
import { effectiveStatus, overdueItems, scheduleDateTime } from './schedule';

const NOW = new Date('2026-09-02T12:00:00').getTime();

function item(overrides: Partial<ScheduleItem>): ScheduleItem {
  return {
    id: 'test',
    date: '2026-09-03',
    time: '09:00',
    platform: 'fb',
    title: '測試排程',
    status: 'scheduled',
    ...overrides,
  };
}

describe('effectiveStatus', () => {
  it('published 與 draft 照儲存值,不受時間影響', () => {
    expect(effectiveStatus(item({ status: 'published', date: '2020-01-01' }), NOW)).toBe('published');
    expect(effectiveStatus(item({ status: 'draft', date: '2020-01-01' }), NOW)).toBe('draft');
  });

  it('scheduled 且排定時間已過 → overdue;未到 → scheduled', () => {
    expect(effectiveStatus(item({ date: '2026-09-02', time: '11:59' }), NOW)).toBe('overdue');
    expect(effectiveStatus(item({ date: '2026-09-02', time: '12:00' }), NOW)).toBe('overdue');
    expect(effectiveStatus(item({ date: '2026-09-02', time: '12:01' }), NOW)).toBe('scheduled');
    expect(effectiveStatus(item({ date: '2026-09-03', time: '09:00' }), NOW)).toBe('scheduled');
  });

  it('scheduleDateTime 以本地時區解析日期字串', () => {
    const dt = scheduleDateTime({ date: '2026-09-03', time: '09:05' });
    expect(dt.getFullYear()).toBe(2026);
    expect(dt.getMonth()).toBe(8);
    expect(dt.getDate()).toBe(3);
    expect(dt.getHours()).toBe(9);
    expect(dt.getMinutes()).toBe(5);
  });
});

describe('overdueItems', () => {
  it('只取逾期的 scheduled 項目,依排定時間由早到晚', () => {
    const items = [
      item({ id: 'a', date: '2026-09-01', time: '08:00' }),
      item({ id: 'b', date: '2026-08-31', time: '20:00' }),
      item({ id: 'c', date: '2026-09-02', time: '11:00' }),
      item({ id: 'd', date: '2026-09-01', time: '09:00', status: 'published' }),
      item({ id: 'e', date: '2026-09-05', time: '09:00' }),
    ];
    expect(overdueItems(items, NOW).map((i) => i.id)).toEqual(['b', 'a', 'c']);
  });

  it('無逾期時回傳空陣列', () => {
    expect(overdueItems([item({ date: '2026-09-05' })], NOW)).toEqual([]);
  });
});
