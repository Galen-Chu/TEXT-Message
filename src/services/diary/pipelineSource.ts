/**
 * 管線 A(DIARY-PLAN P2 路徑 A / PIPELINE-PLAN §6,2026-11-25):本機日記 → 日誌素材。
 * DiaryEntry[] 依日期分組合併成與 parseJournal 產出**同構**的 JournalEntry,
 * 直接餵既有 pickJournalEntries(D6 選料零改動)——型別上多帶 mood 供 moodHint。
 * 合併慣例沿用 parseJournal:同日多筆依寫入時序 body 以空行串接、標題取第一個非空者;
 * sections(沉澱小節)刻意不進素材(D9:管線素材只取 body)。純函式、零 DOM。
 */
import type { DiaryEntry } from '../../types';
import type { JournalEntry } from '../gemini/journal';

/** JournalEntry + mood:同日多筆的心情依時序去重後以「、」合併(單筆=原值)。 */
export interface DiaryJournalEntry extends JournalEntry {
  mood?: string;
}

export function diaryToJournalEntries(entries: DiaryEntry[]): DiaryJournalEntry[] {
  const byDate = new Map<string, DiaryJournalEntry>();
  // 主排序:日期新→舊(餵 pickJournalEntries 的慣例);同日次要排序:createdAt 早→晚(合併時序)
  const sorted = [...entries].sort((a, b) =>
    a.date === b.date ? a.createdAt - b.createdAt : a.date < b.date ? 1 : -1,
  );
  for (const e of sorted) {
    const body = e.body.trim();
    if (!body) continue; // 防禦:空內文不連坐(UI 層有 100 字門檻,這裡雙保險)
    const title = e.title.trim();
    const prev = byDate.get(e.date);
    if (!prev) {
      byDate.set(e.date, { date: e.date, title: title || undefined, body, mood: e.mood });
      continue;
    }
    prev.body = prev.body ? `${prev.body}\n\n${body}` : body;
    if (!prev.title && title) prev.title = title;
    if (e.mood && !(prev.mood ?? '').split('、').includes(e.mood)) {
      prev.mood = prev.mood ? `${prev.mood}、${e.mood}` : e.mood;
    }
  }
  return [...byDate.values()].sort((a, b) => (a.date > b.date ? -1 : 1));
}
