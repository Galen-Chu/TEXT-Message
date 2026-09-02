import { useCallback, useEffect, useRef, useState } from 'react';
import { useGmail } from './useGmail';
import { useYoutube } from './useYoutube';
import {
  DRAFT_AI_COPY,
  GEMINI_ERROR_COPY,
  LIBRARY_COPY,
  PLATFORM_LIST,
  PLATFORM_META,
  SCHEDULE_COPY,
  TONE_REWRITES,
  type LibraryMainTab,
  type Tone,
} from '../constants';
import {
  clearGeminiKey,
  loadGeminiKey,
  rewriteWithGemini,
  rewriteWithInstruction,
  saveGeminiKey,
  summarizeWithGemini,
} from '../services/gemini/rewrite';
import {
  initialCopyTemplates,
  initialEmails,
  initialSchedule,
  initialSocialHistory,
  initialTemplates,
} from '../data/mockData';
import type {
  Email,
  EmailTag,
  PlatformKey,
  ScheduleItem,
  SocialPost,
  Tab,
  Template,
} from '../types';
import { charCount, getWeekDates, toISODate } from '../utils/date';
import { buildPublishTarget } from '../utils/publish';
import { applyVariables } from '../utils/variables';

export type AppStore = ReturnType<typeof useAppStore>;

// 使用者建立的內容(範本/排程/已發佈記錄/草稿)存 localStorage,重新整理不消失;
// 讀寫失敗(隱私模式等)時靜默退回記憶體模式。
const STORAGE_KEY = 'text-message:v2';

function loadPersisted<T>(field: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const data = raw ? JSON.parse(raw) : null;
    return data && Array.isArray(data[field]) ? (data[field] as T) : fallback;
  } catch {
    return fallback;
  }
}

/** 同上,但供非陣列欄位(草稿文字/來源/平台選擇)使用,以 isValid 校驗形狀。 */
function loadPersistedValue<T>(field: string, fallback: T, isValid: (v: unknown) => v is T): T {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const data = raw ? JSON.parse(raw) : null;
    const v = data ? (data as Record<string, unknown>)[field] : undefined;
    return isValid(v) ? v : fallback;
  } catch {
    return fallback;
  }
}

function tomorrowISO(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return toISODate(d);
}

/** 新資料 id:crypto.randomUUID(防快速連續操作碰撞),不支援時退回時間戳+隨機。 */
function newId(prefix: string): string {
  const uuid = typeof crypto !== 'undefined' ? crypto.randomUUID?.() : undefined;
  return prefix + (uuid ?? Date.now().toString(36) + Math.random().toString(36).slice(2, 8));
}

export function useAppStore() {
  const weekDates = getWeekDates();
  const gmail = useGmail();
  const youtube = useYoutube();

  const [activeTab, setActiveTab] = useState<Tab>('dashboard');
  const [demoEmails] = useState<Email[]>(initialEmails);
  // 已連線 Gmail → 真實郵件(即使為空也不退回示範資料);否則示範模式
  const emails = gmail.status === 'connected' ? gmail.emails : demoEmails;
  const [templates, setTemplates] = useState<Template[]>(() =>
    loadPersisted('templates', initialTemplates()),
  );
  const [copyTemplates, setCopyTemplates] = useState<Template[]>(() =>
    loadPersisted('copyTemplates', initialCopyTemplates()),
  );
  // 已發佈記錄:由「標記已發佈」產生的真實資料,隨其他使用者內容持久化;
  // 有真實記錄時 socialHistory 完全取代示範資料(同 emails 的連線分流哲學)。
  const [publishedHistory, setPublishedHistory] = useState<SocialPost[]>(() =>
    loadPersisted('publishedHistory', [] as SocialPost[]),
  );
  const socialHistory = publishedHistory.length ? publishedHistory : initialSocialHistory();
  const socialHistoryIsDemo = publishedHistory.length === 0;
  const [scheduleItems, setScheduleItems] = useState<ScheduleItem[]>(() =>
    loadPersisted('scheduleItems', initialSchedule()),
  );

  // 草稿:來源郵件 id、'blank'(空白草稿)或 null(尚未開始)。
  // 與範本/排程一併持久化(草稿屬使用者內容;emails 與 token 仍不落地)。
  const [selectedMailId, setSelectedMailId] = useState<string | null>(() =>
    loadPersistedValue('draftSourceId', null, (v): v is string => typeof v === 'string'),
  );
  const [draftText, setDraftText] = useState(() =>
    loadPersistedValue('draftText', '', (v): v is string => typeof v === 'string'),
  );
  const [draftPlatforms, setDraftPlatforms] = useState<Record<PlatformKey, boolean>>(() => {
    const stored = loadPersistedValue<Partial<Record<PlatformKey, boolean>>>(
      'draftPlatforms',
      {},
      (v): v is Partial<Record<PlatformKey, boolean>> =>
        !!v && typeof v === 'object' && Object.values(v).every((x) => typeof x === 'boolean'),
    );
    return { fb: true, ig: true, threads: false, line: false, yt: false, ...stored };
  });

  useEffect(() => {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          templates,
          copyTemplates,
          scheduleItems,
          publishedHistory,
          draftText,
          draftPlatforms,
          draftSourceId: selectedMailId,
        }),
      );
    } catch {
      // localStorage 不可用時僅退回記憶體模式,不影響操作
    }
  }, [templates, copyTemplates, scheduleItems, publishedHistory, draftText, draftPlatforms, selectedMailId]);

  const [inboxSearch, setInboxSearch] = useState('');
  const [inboxFilter, setInboxFilter] = useState<'全部' | EmailTag>('全部');
  const [libraryMainTab, setLibraryMainTab] = useState<LibraryMainTab>('message');
  const [librarySearch, setLibrarySearch] = useState('');
  const [libraryCategory, setLibraryCategory] = useState('全部');
  const [copySearch, setCopySearch] = useState('');
  const [copyCategory, setCopyCategory] = useState('全部');
  const [socialFilter, setSocialFilter] = useState('全部');
  const [selectedDay, setSelectedDay] = useState(toISODate(new Date()));

  const [toastMessage, setToastMessage] = useState('');
  const toastTimer = useRef<ReturnType<typeof setTimeout>>();

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToastMessage(''), 2200);
  }, []);

  /** 草稿可能發佈到多個平台:字數上限取「已選平台中最嚴格者」。 */
  const strictestSelectedLimit = (): number | undefined => {
    const limits = PLATFORM_LIST.filter((p) => draftPlatforms[p.key]).map(
      (p) => PLATFORM_META[p.key].limit,
    );
    return limits.length ? Math.min(...limits) : undefined;
  };

  /**
   * 郵件 → 草稿:先以節錄內容立即開啟草稿頁;有 Gemini key 時再以真實 AI
   * 摘要取代(使用者已手動編輯則不覆蓋),失敗時草稿保持節錄內容、僅 toast。
   */
  const convertToDraft = async (mail: Email) => {
    setSelectedMailId(mail.id);
    const fallback = mail.snippet + '\n\n' + DRAFT_AI_COPY.convertFallbackNote;
    setDraftText(fallback);
    setActiveTab('draft');
    showToast('已將郵件轉換為草稿 ✨');
    if (!geminiKey || aiBusy) return;
    setAiBusy(true);
    const result = await summarizeWithGemini({
      apiKey: geminiKey,
      subject: mail.subject,
      from: mail.sender,
      body: mail.fullBody,
      limit: strictestSelectedLimit(),
    });
    setAiBusy(false);
    if (result.ok) {
      const text = result.text;
      setDraftText((t) => (t === fallback ? text : t));
      showToast(DRAFT_AI_COPY.convertDoneToast);
    } else {
      showToast(GEMINI_ERROR_COPY[result.code] ?? GEMINI_ERROR_COPY.unknown);
    }
  };

  const startBlankDraft = () => {
    setSelectedMailId('blank');
    setDraftText('');
  };

  /** 捨棄草稿:清空內容與來源,回到「尚未選擇內容來源」空狀態(持久化隨之清除)。 */
  const discardDraft = () => {
    setSelectedMailId(null);
    setDraftText('');
    setDraftPlatforms({ fb: true, ig: true, threads: false, line: false, yt: false });
    showToast('已捨棄草稿');
  };

  // Gemini BYOK:key 僅存使用者瀏覽器;未設定 → 規則示範路徑
  const [geminiKey, setGeminiKeyState] = useState(() => loadGeminiKey());
  const [aiBusy, setAiBusy] = useState(false);

  const setGeminiKey = (key: string) => {
    if (key) saveGeminiKey(key);
    else clearGeminiKey();
    setGeminiKeyState(key);
  };

  const applyTone = async (tone: Tone) => {
    if (aiBusy) return;
    const limit = strictestSelectedLimit();
    if (!geminiKey) {
      const next = TONE_REWRITES[tone](draftText);
      setDraftText(next);
      // 規則示範不懂字數:超過所選平台最嚴格上限時明確告知,而不是默默通過
      if (limit && charCount(next) > limit) {
        showToast(DRAFT_AI_COPY.overLimitHint(limit));
      } else {
        showToast(`已套用「${tone}」語氣(規則示範;於「AI 設定」輸入 key 可啟用真實 AI)`);
      }
      return;
    }
    setAiBusy(true);
    const result = await rewriteWithGemini({ apiKey: geminiKey, text: draftText, tone, limit });
    setAiBusy(false);
    if (result.ok) {
      setDraftText(result.text);
      showToast(`Gemini 已套用「${tone}」語氣 ✨`);
    } else {
      showToast(GEMINI_ERROR_COPY[result.code] ?? GEMINI_ERROR_COPY.unknown);
    }
  };

  /** 自訂指令改寫(僅真實 AI 路徑;規則示範無法對應任意指令)。 */
  const applyCustomInstruction = async (instruction: string) => {
    const inst = instruction.trim();
    if (!inst) {
      showToast(DRAFT_AI_COPY.customInstructionEmpty);
      return;
    }
    if (!draftText.trim()) {
      showToast(DRAFT_AI_COPY.customInstructionEmptyDraft);
      return;
    }
    if (aiBusy) return;
    if (!geminiKey) {
      showToast(DRAFT_AI_COPY.customInstructionNeedKey);
      return;
    }
    setAiBusy(true);
    const result = await rewriteWithInstruction({
      apiKey: geminiKey,
      text: draftText,
      instruction: inst,
      limit: strictestSelectedLimit(),
    });
    setAiBusy(false);
    if (result.ok) {
      setDraftText(result.text);
      showToast(DRAFT_AI_COPY.customInstructionDoneToast);
    } else {
      showToast(GEMINI_ERROR_COPY[result.code] ?? GEMINI_ERROR_COPY.unknown);
    }
  };

  const togglePlatform = (key: PlatformKey) => {
    setDraftPlatforms((p) => ({ ...p, [key]: !p[key] }));
  };

  /** 使用統計:套用/複製成功時遞增(文管庫深化第一期)。 */
  const markTemplateApplied = (id: string) => {
    const patch = (t: Template): Template => ({
      ...t,
      appliedCount: (t.appliedCount ?? 0) + 1,
      lastAppliedAt: new Date().toISOString(),
    });
    if (templates.some((t) => t.id === id)) {
      setTemplates((list) => list.map((t) => (t.id === id ? patch(t) : t)));
    }
    if (copyTemplates.some((t) => t.id === id)) {
      setCopyTemplates((list) => list.map((t) => (t.id === id ? patch(t) : t)));
    }
  };

  const insertTemplateIntoDraft = (tpl: Template, values?: Record<string, string>) => {
    setDraftText((t) => (t ? t + '\n\n' : '') + applyVariables(tpl.text, values ?? {}));
    markTemplateApplied(tpl.id);
    showToast('已插入文管庫內容');
  };

  /** 套用社群媒體歷史貼文到草稿(附加到尾端),若尚無草稿目標則視為空白草稿開始。 */
  const pickSocialPost = (post: SocialPost) => {
    setSelectedMailId((id) => id ?? 'blank');
    setDraftText((t) => (t ? t + '\n\n' : '') + post.content);
    setActiveTab('draft');
    showToast('已套用社群媒體歷史貼文');
  };

  const applyTemplateToDraft = (tpl: Template, values?: Record<string, string>) => {
    setSelectedMailId((id) => id ?? 'blank');
    setDraftText((t) => (t ? t + '\n\n' : '') + applyVariables(tpl.text, values ?? {}));
    setActiveTab('draft');
    markTemplateApplied(tpl.id);
    showToast('已套用範本到草稿');
  };

  const copyTemplate = async (tpl: Template, values?: Record<string, string>) => {
    try {
      await navigator.clipboard.writeText(applyVariables(tpl.text, values ?? {}));
      markTemplateApplied(tpl.id);
      showToast('已複製到剪貼簿');
    } catch {
      showToast('複製失敗,請手動選取複製');
    }
  };

  /** 「+ 新增內容」:依文管庫當前分頁寫入對應資料集,分類取該分頁當前選取分類。 */
  const addTemplate = (title: string, text: string) => {
    if (libraryMainTab === 'copy') {
      const tpl: Template = {
        id: newId('nc'),
        category: copyCategory === '全部' ? '其他' : copyCategory,
        title,
        text,
      };
      setCopyTemplates((list) => [tpl, ...list]);
      showToast('已新增至文案管理');
      return;
    }
    const tpl: Template = {
      id: newId('nt'),
      category: libraryCategory === '全部' ? '其他' : libraryCategory,
      title,
      text,
    };
    setTemplates((list) => [tpl, ...list]);
    showToast('已新增至訊息管理');
  };

  /** 編輯範本:依 id 找到所屬資料集(訊息/文案)更新標題與內容;分類維持原值。 */
  const updateTemplate = (id: string, patch: { title: string; text: string }) => {
    const inTemplates = templates.some((t) => t.id === id);
    const inCopy = copyTemplates.some((t) => t.id === id);
    if (!inTemplates && !inCopy) return;
    const map = (list: Template[]) => list.map((t) => (t.id === id ? { ...t, ...patch } : t));
    if (inTemplates) setTemplates(map);
    if (inCopy) setCopyTemplates(map);
    showToast('已更新內容');
  };

  /** 刪除範本:兩個資料集皆以 id 過濾(mock 與新增 id 前綴互不重疊)。 */
  const deleteTemplate = (id: string) => {
    setTemplates((list) => list.filter((t) => t.id !== id));
    setCopyTemplates((list) => list.filter((t) => t.id !== id));
    showToast('已刪除內容');
  };

  /** 以社群發文記錄建立文案範本(文管庫深化第一期:F2)。 */
  const saveSocialPostAsTemplate = (post: SocialPost, title: string, category: string) => {
    const tpl: Template = {
      id: newId('sc'),
      category: category || '日常分享',
      title,
      text: post.content,
    };
    setCopyTemplates((list) => [tpl, ...list]);
    showToast(LIBRARY_COPY.savedToast);
  };

  // 草稿已隨內容變動自動持久化(見上方 effect);按鈕僅回饋確認
  const saveDraft = () => showToast('草稿已儲存');

  /** 「加入排程」:依已選平台各建立一筆排程(附全文供發佈輔助),並跳轉排程頁。 */
  const confirmSchedule = (date: string, time: string) => {
    const platforms = PLATFORM_LIST.filter((p) => draftPlatforms[p.key]).map((p) => p.key);
    const title = (draftText || '未命名草稿').split('\n')[0].slice(0, 24);
    const newItems: ScheduleItem[] = (platforms.length ? platforms : ['fb' as const]).map(
      (p, i) => ({
        id: newId('ns' + i + '-'),
        date,
        time,
        platform: p,
        title,
        content: draftText,
        status: 'scheduled',
      }),
    );
    setScheduleItems((list) => [...list, ...newItems]);
    setSelectedDay(date);
    setActiveTab('schedule');
    showToast('已加入排程 🎉');
  };

  const addManualSchedule = (
    title: string,
    date: string,
    time: string,
    platform: PlatformKey,
    content = '',
  ) => {
    const item: ScheduleItem = {
      id: newId('ms'),
      date,
      time,
      platform,
      title,
      content,
      status: 'scheduled',
    };
    setScheduleItems((list) => [...list, item]);
    setSelectedDay(date);
    showToast(SCHEDULE_COPY.addedToast);
  };

  /** 編輯排程:更新標題/內容/日期/時間/平台;狀態維持原值。 */
  const updateScheduleItem = (
    id: string,
    patch: Partial<Pick<ScheduleItem, 'title' | 'content' | 'date' | 'time' | 'platform'>>,
  ) => {
    setScheduleItems((list) => list.map((i) => (i.id === id ? { ...i, ...patch } : i)));
    if (patch.date) setSelectedDay(patch.date);
    showToast(SCHEDULE_COPY.updatedToast);
  };

  /** 以「現在」寫入一筆真實已發佈記錄(標記已發佈/YouTube 立即公開共用)。 */
  const appendPublishedHistory = (platform: PlatformKey, title: string, content: string) => {
    const now = new Date();
    const post: SocialPost = {
      id: newId('hp'),
      platform,
      title,
      content: content.trim() || title,
      date: toISODate(now),
      time: now.toTimeString().slice(0, 5),
    };
    setPublishedHistory((list) => [post, ...list]);
  };

  /** 標記已發佈:狀態轉為 published,並以實際發佈時間寫入社群媒體歷史(真實資料)。 */
  const markSchedulePublished = (id: string) => {
    const item = scheduleItems.find((i) => i.id === id);
    if (!item || item.status === 'published') return;
    setScheduleItems((list) =>
      list.map((i) => (i.id === id ? { ...i, status: 'published' as const } : i)),
    );
    appendPublishedHistory(item.platform, item.title, item.content ?? '');
    showToast(SCHEDULE_COPY.publishedToast);
  };

  /** 發佈輔助:複製排程貼文內容(無全文時退回標題)。 */
  const copyScheduleText = async (item: ScheduleItem) => {
    const text = item.content?.trim() || item.title;
    try {
      await navigator.clipboard.writeText(text);
      showToast(SCHEDULE_COPY.copyDoneToast);
    } catch {
      showToast(SCHEDULE_COPY.copyFailToast);
    }
  };

  /**
   * 發佈輔助:開啟平台發佈頁——Threads/X 以 intent 預填文字;
   * FB/IG/LINE 無法預填,先複製到剪貼簿再開啟平台,由使用者貼上(半自動模式)。
   */
  const openSchedulePublish = async (item: ScheduleItem) => {
    const label = PLATFORM_META[item.platform].label;
    const text = item.content?.trim() || item.title;
    const target = buildPublishTarget(item.platform, text);
    if (!target.canPrefill) {
      try {
        await navigator.clipboard.writeText(text);
      } catch {
        // 複製失敗仍開啟平台頁,toast 提示改走手動
        showToast(SCHEDULE_COPY.copyFailToast);
        window.open(target.url, '_blank', 'noopener');
        return;
      }
      window.open(target.url, '_blank', 'noopener');
      showToast(SCHEDULE_COPY.openPasteToast(label));
      return;
    }
    window.open(target.url, '_blank', 'noopener');
    showToast(SCHEDULE_COPY.openPrefillToast(label));
  };

  const deleteScheduleItem = (id: string) => {
    setScheduleItems((list) => list.filter((i) => i.id !== id));
    showToast(SCHEDULE_COPY.deletedToast);
  };

  return {
    weekDates,
    activeTab,
    setActiveTab,
    gmail,
    youtube,
    emails,
    templates,
    copyTemplates,
    socialHistory,
    socialHistoryIsDemo,
    scheduleItems,
    selectedMailId,
    draftText,
    setDraftText,
    draftPlatforms,
    inboxSearch,
    setInboxSearch,
    inboxFilter,
    setInboxFilter,
    libraryMainTab,
    setLibraryMainTab,
    librarySearch,
    setLibrarySearch,
    libraryCategory,
    setLibraryCategory,
    copySearch,
    setCopySearch,
    copyCategory,
    setCopyCategory,
    socialFilter,
    setSocialFilter,
    selectedDay,
    setSelectedDay,
    toastMessage,
    showToast,
    convertToDraft,
    startBlankDraft,
    applyTone,
    applyCustomInstruction,
    geminiKey,
    setGeminiKey,
    aiBusy,
    togglePlatform,
    insertTemplateIntoDraft,
    pickSocialPost,
    applyTemplateToDraft,
    copyTemplate,
    addTemplate,
    updateTemplate,
    deleteTemplate,
    saveSocialPostAsTemplate,
    saveDraft,
    discardDraft,
    confirmSchedule,
    addManualSchedule,
    updateScheduleItem,
    markSchedulePublished,
    appendPublishedHistory,
    copyScheduleText,
    openSchedulePublish,
    deleteScheduleItem,
    tomorrowISO,
  };
}
