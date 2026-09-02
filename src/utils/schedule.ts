import type { ScheduleItem } from '../types';

/** 排程項目的排定時間(以瀏覽器本地時區解析)。 */
export function scheduleDateTime(item: Pick<ScheduleItem, 'date' | 'time'>): Date {
  return new Date(`${item.date}T${item.time}:00`);
}

export type EffectiveStatus = 'draft' | 'scheduled' | 'overdue' | 'published';

/**
 * 即時生效的狀態:published/draft 照儲存值;已過排定時間仍未發佈的 scheduled
 * 顯示為 overdue(逾期是推導結果,不寫回資料——補標記發佈即消除)。
 */
export function effectiveStatus(item: ScheduleItem, now: number = Date.now()): EffectiveStatus {
  if (item.status === 'published') return 'published';
  if (item.status === 'draft') return 'draft';
  return scheduleDateTime(item).getTime() <= now ? 'overdue' : 'scheduled';
}

/** 逾期未發佈的排程(依日期時間排序,最早逾期的在前)。 */
export function overdueItems(items: ScheduleItem[], now: number = Date.now()): ScheduleItem[] {
  return items
    .filter((i) => effectiveStatus(i, now) === 'overdue')
    .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
}
