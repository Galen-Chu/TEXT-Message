/** 回傳包含 base 當天、以週一為首的一週日期(YYYY-MM-DD ×7)。 */
export function getWeekDates(base: Date = new Date()): string[] {
  const d = new Date(base.getFullYear(), base.getMonth(), base.getDate());
  const offsetToMonday = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - offsetToMonday);
  return Array.from({ length: 7 }, (_, i) => {
    const day = new Date(d);
    day.setDate(d.getDate() + i);
    return toISODate(day);
  });
}

export function toISODate(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

/** '2026-07-13' → '7/13' */
export function dateLabel(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

/** 郵件日期顯示用:同年 M/D,跨年 YYYY/M/D。 */
export function shortDateLabel(d: Date): string {
  const md = `${d.getMonth() + 1}/${d.getDate()}`;
  return d.getFullYear() === new Date().getFullYear() ? md : `${d.getFullYear()}/${md}`;
}

const FULL_WEEKDAYS = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];

/** '2026年7月14日 星期二' */
export function fullDateLabel(d: Date = new Date()): string {
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日 ${FULL_WEEKDAYS[d.getDay()]}`;
}

export function greeting(d: Date = new Date()): string {
  const h = d.getHours();
  if (h < 12) return '早安';
  if (h < 18) return '午安';
  return '晚安';
}

/** 字數計算(以 code point 計,避免 emoji 被算成兩字)。 */
export function charCount(text: string): number {
  return Array.from(text).length;
}
