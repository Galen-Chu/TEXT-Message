// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAppStore } from './useAppStore';
import { generatePlatformVariants, suggestHashtagsFor } from '../services/gemini/variants';

// 第四期(Gemini 產出)僅 mock 服務層;BYOK 分流與 UI 狀態走真實 store 邏輯
vi.mock('../services/gemini/variants', () => ({
  generatePlatformVariants: vi.fn(),
  suggestHashtagsFor: vi.fn(),
}));

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

describe('useAppStore:文管庫深化第一期', () => {
  it('applyTemplateToDraft 帶填值:變數替換、未填保留、統計遞增並持久化', () => {
    const { result } = renderHook(() => useAppStore());
    const target = result.current.copyTemplates.find((t) => t.text.includes('{{品牌名稱}}'))!;

    act(() => {
      result.current.applyTemplateToDraft(target, { 品牌名稱: '光影香氛' });
    });
    // 草稿含替換後文字與未填變數的原樣佔位符
    expect(result.current.draftText).toContain('光影香氛');
    expect(result.current.draftText).toContain('{{產品名稱}}');
    expect(result.current.draftText).not.toContain('{{品牌名稱}}');
    expect(result.current.activeTab).toBe('draft');
    // 統計
    const after = result.current.copyTemplates.find((t) => t.id === target.id)!;
    expect(after.appliedCount).toBe(1);
    expect(after.lastAppliedAt).toBeTruthy();
    expect(readStore().copyTemplates).toEqual(result.current.copyTemplates);
  });

  it('insertTemplateIntoDraft 帶填值附加到草稿並計數', () => {
    const { result } = renderHook(() => useAppStore());
    act(() => {
      result.current.startBlankDraft();
    });
    act(() => {
      result.current.setDraftText('既有內容');
    });
    const target = result.current.copyTemplates.find((t) => t.text.includes('{{品牌名稱}}'))!;
    act(() => {
      result.current.insertTemplateIntoDraft(target, { 品牌名稱: 'B', 產品名稱: 'P' });
    });
    expect(result.current.draftText.startsWith('既有內容')).toBe(true);
    expect(result.current.draftText).toContain('B');
    expect(result.current.draftText).toContain('P');
    expect(result.current.draftText).not.toContain('{{');
    expect(
      result.current.copyTemplates.find((t) => t.id === target.id)!.appliedCount,
    ).toBe(1);
  });

  it('saveSocialPostAsTemplate:以記錄內容建立文案範本並持久化', () => {
    const { result } = renderHook(() => useAppStore());
    const post = result.current.socialHistory[0];
    const before = result.current.copyTemplates.length;

    act(() => {
      result.current.saveSocialPostAsTemplate(post, '我的新範本', '日常分享');
    });
    const saved = result.current.copyTemplates[0];
    expect(saved.title).toBe('我的新範本');
    expect(saved.category).toBe('日常分享');
    expect(saved.text).toBe(post.content);
    expect(saved.appliedCount).toBeUndefined();
    expect(result.current.copyTemplates.length).toBe(before + 1);
    expect(readStore().copyTemplates).toEqual(result.current.copyTemplates);
  });
});

describe('useAppStore:文管庫深化第二期(平台變體)', () => {
  it('applyTemplateToDraft 依勾選平台插入變體段([平台名 版] 與 [通用版])', () => {
    const { result } = renderHook(() => useAppStore());
    act(() => {
      result.current.updateTemplate(result.current.copyTemplates[0].id, {
        title: 'T',
        text: '通用文字',
        platformVariants: { threads: '短版' },
      });
    });
    // 預設勾選 fb+ig(皆無變體)→ 通用文字(第一期行為)
    act(() => {
      result.current.applyTemplateToDraft(result.current.copyTemplates[0]);
    });
    expect(result.current.draftText).toBe('通用文字');

    act(() => {
      result.current.togglePlatform('threads');
    });
    act(() => {
      result.current.applyTemplateToDraft(result.current.copyTemplates[0]);
    });
    // 附加段落:threads 變體 + 其餘勾選平台共用通用版
    expect(result.current.draftText.endsWith('[Threads 版]\n短版\n\n[通用版]\n通用文字')).toBe(
      true,
    );
  });

  it('copyTemplate 指定平台版本:複製該變體(含填值)', async () => {
    const writeText = vi.fn(async () => {});
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    const { result } = renderHook(() => useAppStore());
    act(() => {
      result.current.updateTemplate(result.current.copyTemplates[0].id, {
        title: 'T',
        text: '通用',
        platformVariants: { threads: '短版 {{x}}' },
      });
    });
    await act(async () => {
      await result.current.copyTemplate(result.current.copyTemplates[0], { x: '填值' }, 'threads');
    });
    expect(writeText).toHaveBeenCalledWith('短版 填值');
  });

  it('addTemplate/updateTemplate 帶平台變體並持久化;清空變體則移除欄位', () => {
    const { result } = renderHook(() => useAppStore());
    act(() => {
      result.current.setLibraryMainTab('copy');
    });
    act(() => {
      result.current.addTemplate('V', 'text', { threads: 't 版' });
    });
    const added = result.current.copyTemplates[0];
    expect(added.platformVariants).toEqual({ threads: 't 版' });
    expect(readStore().copyTemplates).toEqual(result.current.copyTemplates);

    act(() => {
      result.current.updateTemplate(added.id, { title: 'V', text: 'text', platformVariants: {} });
    });
    expect(result.current.copyTemplates[0].platformVariants).toBeUndefined();
    expect(
      (readStore().copyTemplates as Array<Record<string, unknown>>)[0].platformVariants,
    ).toBeUndefined();
  });
});

describe('useAppStore:文管庫深化第四期(AI 平台版本與標籤,BYOK)', () => {
  function prepareDraft(result: { current: ReturnType<typeof useAppStore> }, text: string) {
    act(() => {
      result.current.startBlankDraft();
    });
    act(() => {
      result.current.setDraftText(text);
    });
  }

  it('無 key:產生平台版本僅提示不動作(D5 決議),不呼叫服務', async () => {
    const { result } = renderHook(() => useAppStore());
    prepareDraft(result, '草稿內容');
    await act(async () => {
      await result.current.generateDraftVariants();
    });
    expect(generatePlatformVariants).not.toHaveBeenCalled();
    expect(result.current.draftVariants).toBeNull();
    expect(result.current.toastMessage).toContain('Gemini key');
  });

  it('有 key:生成結果進入可編輯面板;附加到草稿採 [平台名 版] 格式', async () => {
    vi.mocked(generatePlatformVariants).mockResolvedValue({
      ok: true,
      variants: { fb: 'F 版', threads: 'T 版' },
    });
    const { result } = renderHook(() => useAppStore());
    act(() => {
      result.current.setGeminiKey('test-key');
    });
    prepareDraft(result, '原始草稿');
    act(() => {
      result.current.togglePlatform('threads');
    });
    await act(async () => {
      await result.current.generateDraftVariants();
    });
    expect(result.current.draftVariants).toEqual({ fb: 'F 版', threads: 'T 版' });

    act(() => {
      result.current.setDraftVariant('threads', '編輯後版本');
    });
    act(() => {
      result.current.appendDraftVariantsToDraft();
    });
    expect(result.current.draftText).toBe(
      '原始草稿\n\n[Facebook 版]\nF 版\n\n[Threads 版]\n編輯後版本',
    );
    expect(result.current.draftVariants).toBeNull();
  });

  it('平台版本可存為文案範本(通用內容=草稿全文)並持久化', async () => {
    vi.mocked(generatePlatformVariants).mockResolvedValue({
      ok: true,
      variants: { threads: '短版' },
    });
    const { result } = renderHook(() => useAppStore());
    act(() => {
      result.current.setGeminiKey('test-key');
    });
    prepareDraft(result, '通用內容全文');
    await act(async () => {
      await result.current.generateDraftVariants();
    });
    act(() => {
      result.current.saveDraftVariantsAsTemplate('AI 範本', '日常分享');
    });
    const saved = result.current.copyTemplates[0];
    expect(saved.title).toBe('AI 範本');
    expect(saved.text).toBe('通用內容全文');
    expect(saved.platformVariants).toEqual({ threads: '短版' });
    expect(result.current.draftVariants).toBeNull();
    expect(readStore().copyTemplates).toEqual(result.current.copyTemplates);
  });

  it('hashtag:無 key 僅提示;有 key 生成後可逐個/全部加入草稿', async () => {
    const { result } = renderHook(() => useAppStore());
    prepareDraft(result, '貼文內容');
    await act(async () => {
      await result.current.requestHashtags();
    });
    expect(suggestHashtagsFor).not.toHaveBeenCalled();
    expect(result.current.toastMessage).toContain('Gemini key');

    act(() => {
      result.current.setGeminiKey('test-key');
    });
    vi.mocked(suggestHashtagsFor).mockResolvedValue({ ok: true, hashtags: ['#生活', '#旅遊'] });
    await act(async () => {
      await result.current.requestHashtags();
    });
    expect(result.current.hashtagSuggestions).toEqual(['#生活', '#旅遊']);

    act(() => {
      result.current.addHashtagsToDraft(['#生活']);
    });
    expect(result.current.draftText).toBe('貼文內容\n\n#生活');
    act(() => {
      result.current.clearHashtagSuggestions();
    });
    expect(result.current.hashtagSuggestions).toEqual([]);
  });
});
