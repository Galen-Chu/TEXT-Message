// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { useAppStore } from './useAppStore';

// 測試環境未設 VITE_GMAIL_CLIENT_ID → Gmail 為 disabled(示範模式),不需 mock Google 服務

const STORAGE_KEY = 'text-message:v2';

function readStore(): Record<string, unknown> {
  return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') as Record<string, unknown>;
}

beforeEach(() => {
  localStorage.clear();
});

describe('useAppStore:文管庫範本', () => {
  it('addTemplate 依當前分頁寫入對應資料集並持久化', () => {
    const { result } = renderHook(() => useAppStore());
    const before = result.current.templates.length;

    act(() => {
      result.current.addTemplate('測試範本', '內容');
    });
    expect(result.current.templates.length).toBe(before + 1);
    expect(readStore().templates).toEqual(result.current.templates);

    act(() => {
      result.current.setLibraryMainTab('copy');
    });
    act(() => {
      result.current.addTemplate('測試文案', '內容');
    });
    expect(
      (result.current.copyTemplates.find((t) => t.title === '測試文案') as { text: string }).text,
    ).toBe('內容');
  });

  it('updateTemplate 更新標題內容(分類不變),deleteTemplate 移除', () => {
    const { result } = renderHook(() => useAppStore());
    const target = result.current.templates[0];

    act(() => {
      result.current.updateTemplate(target.id, { title: '改標題', text: '改內容' });
    });
    const updated = result.current.templates.find((t) => t.id === target.id);
    expect(updated?.title).toBe('改標題');
    expect(updated?.text).toBe('改內容');
    expect(updated?.category).toBe(target.category);
    expect(readStore().templates).toEqual(result.current.templates);

    act(() => {
      result.current.deleteTemplate(target.id);
    });
    expect(result.current.templates.some((t) => t.id === target.id)).toBe(false);
    expect(readStore().templates).toEqual(result.current.templates);
  });
});

describe('useAppStore:草稿持久化', () => {
  it('草稿內容/平台選擇/來源在重新掛載後還原', () => {
    const first = renderHook(() => useAppStore());
    act(() => {
      first.result.current.startBlankDraft();
      first.result.current.setDraftText('未完成的草稿');
      first.result.current.togglePlatform('threads');
    });
    first.unmount();
    expect(readStore().draftText).toBe('未完成的草稿');

    const second = renderHook(() => useAppStore());
    expect(second.result.current.selectedMailId).toBe('blank');
    expect(second.result.current.draftText).toBe('未完成的草稿');
    expect(second.result.current.draftPlatforms).toEqual({
      fb: true,
      ig: true,
      threads: true,
      line: false,
      yt: false,
    });
  });

  it('discardDraft 清空草稿並同步清除持久化內容', () => {
    const first = renderHook(() => useAppStore());
    act(() => {
      first.result.current.startBlankDraft();
      first.result.current.setDraftText('將被捨棄');
    });
    first.unmount();

    const second = renderHook(() => useAppStore());
    expect(second.result.current.draftText).toBe('將被捨棄');
    act(() => {
      second.result.current.discardDraft();
    });
    expect(second.result.current.selectedMailId).toBeNull();
    expect(second.result.current.draftText).toBe('');
    expect(readStore().draftText).toBe('');
    expect(readStore().draftSourceId).toBeNull();
  });

  it('舊版持久化資料(無草稿欄位)載入不爆錯,草稿為預設空值', () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ templates: [], copyTemplates: [], scheduleItems: [] }),
    );
    const { result } = renderHook(() => useAppStore());
    expect(result.current.draftText).toBe('');
    expect(result.current.selectedMailId).toBeNull();
    expect(result.current.draftPlatforms).toEqual({
      fb: true,
      ig: true,
      threads: false,
      line: false,
      yt: false,
    });
  });
});

describe('useAppStore:其他操作', () => {
  it('無 key 時 applyTone 走規則示範(親切附加文字)', () => {
    const { result } = renderHook(() => useAppStore());
    act(() => {
      result.current.startBlankDraft();
    });
    act(() => {
      result.current.setDraftText('早安');
    });
    act(() => {
      result.current.applyTone('親切');
    });
    expect(result.current.draftText).toContain('早安');
    expect(result.current.draftText).toContain('謝謝你一直以來的陪伴');
  });

  it('confirmSchedule 依已選平台建立排程(預設 fb+ig 兩筆)並持久化', () => {
    const { result } = renderHook(() => useAppStore());
    act(() => {
      result.current.startBlankDraft();
    });
    act(() => {
      result.current.setDraftText('排程來源草稿');
    });
    act(() => {
      result.current.confirmSchedule('2030-01-01', '09:30');
    });
    const items = result.current.scheduleItems.filter((i) => i.date === '2030-01-01');
    expect(items.map((i) => i.platform).sort()).toEqual(['fb', 'ig']);
    expect(result.current.activeTab).toBe('schedule');
    expect(readStore().scheduleItems).toEqual(result.current.scheduleItems);
  });
});

describe('useAppStore:排程狀態流轉與發佈記錄', () => {
  it('confirmSchedule 建立的排程附帶貼文全文,addManualSchedule 可帶內容', () => {
    const { result } = renderHook(() => useAppStore());
    act(() => {
      result.current.startBlankDraft();
    });
    act(() => {
      result.current.setDraftText('第一行標題\n第二行內容');
    });
    act(() => {
      result.current.confirmSchedule('2030-01-01', '09:00');
    });
    const fromDraft = result.current.scheduleItems.find((i) => i.date === '2030-01-01');
    expect(fromDraft?.title).toBe('第一行標題');
    expect(fromDraft?.content).toBe('第一行標題\n第二行內容');

    act(() => {
      result.current.addManualSchedule('手動排程', '2030-01-02', '10:00', 'threads', '手動內容');
    });
    const manual = result.current.scheduleItems.find((i) => i.title === '手動排程');
    expect(manual?.content).toBe('手動內容');
  });

  it('markSchedulePublished:狀態轉 published,以真實記錄寫入 socialHistory 並持久化', () => {
    const { result } = renderHook(() => useAppStore());
    act(() => {
      result.current.addManualSchedule('將發佈的排程', '2030-01-01', '09:00', 'threads', '實際發佈內容');
    });
    expect(result.current.socialHistoryIsDemo).toBe(true);

    const target = result.current.scheduleItems.find((i) => i.title === '將發佈的排程');
    act(() => {
      result.current.markSchedulePublished(target!.id);
    });
    expect(
      result.current.scheduleItems.find((i) => i.id === target!.id)?.status,
    ).toBe('published');
    expect(result.current.socialHistoryIsDemo).toBe(false);
    const record = result.current.socialHistory[0];
    expect(record.platform).toBe('threads');
    expect(record.title).toBe('將發佈的排程');
    expect(record.content).toBe('實際發佈內容');
    expect(readStore().publishedHistory).toEqual([record]);
    // 重複標記不重複寫入
    act(() => {
      result.current.markSchedulePublished(target!.id);
    });
    expect(result.current.socialHistory.length).toBe(1);
  });

  it('publishedHistory 在重新掛載後還原,socialHistory 維持真實記錄(不退回示範)', () => {
    const first = renderHook(() => useAppStore());
    act(() => {
      first.result.current.addManualSchedule('持久化發佈', '2030-01-01', '09:00', 'fb', '內容');
    });
    const target = first.result.current.scheduleItems.find((i) => i.title === '持久化發佈');
    act(() => {
      first.result.current.markSchedulePublished(target!.id);
    });
    first.unmount();

    const second = renderHook(() => useAppStore());
    expect(second.result.current.socialHistoryIsDemo).toBe(false);
    expect(second.result.current.socialHistory.some((p) => p.title === '持久化發佈')).toBe(true);
  });

  it('updateScheduleItem 更新欄位且狀態不變,日期變動時 selectedDay 跟隨', () => {
    const { result } = renderHook(() => useAppStore());
    act(() => {
      result.current.addManualSchedule('原始標題', '2030-01-01', '09:00', 'fb');
    });
    const target = result.current.scheduleItems.find((i) => i.title === '原始標題')!;

    act(() => {
      result.current.updateScheduleItem(target.id, {
        title: '新標題',
        time: '14:00',
        platform: 'ig',
        date: '2030-02-02',
      });
    });
    const updated = result.current.scheduleItems.find((i) => i.id === target.id)!;
    expect(updated.title).toBe('新標題');
    expect(updated.time).toBe('14:00');
    expect(updated.platform).toBe('ig');
    expect(updated.status).toBe('scheduled');
    expect(result.current.selectedDay).toBe('2030-02-02');
    expect(readStore().scheduleItems).toEqual(result.current.scheduleItems);
  });
});
