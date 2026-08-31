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
