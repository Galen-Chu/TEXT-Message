import { describe, expect, it } from 'vitest';
import { pickJournalEntries } from '../gemini/journal';
import type { DiaryEntry } from '../../types';
import { diaryToJournalEntries } from './pipelineSource';

/** 最小 DiaryEntry(測試只需這些欄位;sections 故意帶上驗證不進素材)。 */
function entry(over: Partial<DiaryEntry> & Pick<DiaryEntry, 'date' | 'body'>): DiaryEntry {
  return { id: 'id', title: '', createdAt: 1, updatedAt: 1, ...over };
}

describe('diaryToJournalEntries(管線 A:本機日記→日誌同構素材)', () => {
  it('基本對映:保留 date/title/body/mood,依日期新→舊排序', () => {
    const out = diaryToJournalEntries([
      entry({ date: '2026-11-10', body: '較早的內容', title: '晨走', mood: '😊 開心' }),
      entry({ date: '2026-11-20', body: '較新的內容' }),
    ]);
    expect(out).toEqual([
      { date: '2026-11-20', title: undefined, body: '較新的內容', mood: undefined },
      { date: '2026-11-10', title: '晨走', body: '較早的內容', mood: '😊 開心' },
    ]);
  });

  it('同日多筆合併:body 依 createdAt 早→晚以空行串接,標題取第一個非空者', () => {
    const out = diaryToJournalEntries([
      entry({ date: '2026-11-20', body: '晚寫的', title: '', createdAt: 300 }),
      entry({ date: '2026-11-20', body: '早寫的', title: '早晨', createdAt: 100 }),
      entry({ date: '2026-11-20', body: '中午補的', createdAt: 200 }),
    ]);
    expect(out).toHaveLength(1);
    expect(out[0].title).toBe('早晨');
    expect(out[0].body).toBe('早寫的\n\n中午補的\n\n晚寫的');
  });

  it('同日心情合併:依時序去重以「、」連接;無心情不加', () => {
    const out = diaryToJournalEntries([
      entry({ date: '2026-11-20', body: 'a', mood: '😊 開心', createdAt: 100 }),
      entry({ date: '2026-11-20', body: 'b', mood: '😌 平靜', createdAt: 200 }),
      entry({ date: '2026-11-20', body: 'c', mood: '😊 開心', createdAt: 300 }),
      entry({ date: '2026-11-20', body: 'd', createdAt: 400 }),
    ]);
    expect(out[0].mood).toBe('😊 開心、😌 平靜');
  });

  it('sections(沉澱小節)不進素材——輸出形狀只有 date/title/body/mood(D9)', () => {
    const out = diaryToJournalEntries([
      entry({
        date: '2026-11-20',
        body: '有沉澱小節的日記',
        sections: { moment: '今日片刻的值', grateful: '感謝的值' },
      }),
    ]);
    expect(Object.keys(out[0]).sort()).toEqual(['body', 'date', 'mood', 'title']);
  });

  it('空內文(防禦路徑)跳過,不連坐其他日期', () => {
    const out = diaryToJournalEntries([
      entry({ date: '2026-11-20', body: '   ' }),
      entry({ date: '2026-11-19', body: '正常內容' }),
    ]);
    expect(out.map((e) => e.date)).toEqual(['2026-11-19']);
  });

  it('未來日期保留(選料端 pickJournalEntries 負責跳過,與 parseJournal 同構)', () => {
    const out = diaryToJournalEntries([
      entry({ date: '2026-11-20', body: '今天' }),
      entry({ date: '2026-12-25', body: '未來寫的(日期筆誤或預寫)' }),
    ]);
    expect(out.map((e) => e.date)).toEqual(['2026-12-25', '2026-11-20']);
  });

  it('與 pickJournalEntries 整合:D6 選料零改動——跳過已用與未來、新→舊取滿 count', () => {
    const entries = diaryToJournalEntries([
      entry({ date: '2026-11-18', body: '三天前' }),
      entry({ date: '2026-11-19', body: '兩天前' }),
      entry({ date: '2026-11-20', body: '昨天' }),
      entry({ date: '2026-11-26', body: '未來' }),
    ]);
    const picked = pickJournalEntries(entries, {
      today: '2026-11-20',
      usedDates: ['2026-11-19'],
      count: 2,
    });
    expect(picked.map((e) => e.date)).toEqual(['2026-11-20', '2026-11-18']);
    // 泛型保留 mood(供生成入口帶 moodHint)
    const withMood = pickJournalEntries(
      diaryToJournalEntries([entry({ date: '2026-11-20', body: 'x', mood: '😌 平靜' })]),
      { today: '2026-11-20', usedDates: [], count: 1 },
    );
    expect(withMood[0].mood).toBe('😌 平靜');
  });
});
