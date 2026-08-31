import { useCallback, useEffect, useRef, useState } from 'react';
import { useGmail } from './useGmail';
import {
  DRAFT_AI_COPY,
  GEMINI_ERROR_COPY,
  PLATFORM_LIST,
  PLATFORM_META,
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

export type AppStore = ReturnType<typeof useAppStore>;

// 使用者建立的內容(範本/排程)存 localStorage,重新整理不消失;
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

function tomorrowISO(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return toISODate(d);
}

/** 新資料 id:crypto.randomUUID(防快速連續操作碰撞),不支援時���回時間戳+隨機。 */
function newId(prefix: string): string {
  const uuid = typeof crypto !== 'undefined' ? crypto.randomUUID?.() : undefined;
  return prefix + (uuid ?? Date.now().toString(36) + Math.random().toString(36).slice(2, 8));
}

export function useAppStore() {
  const weekDates = getWeekDates();
  const gmail = useGmail();

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
  const [socialHistory] = useState<SocialPost[]>(initialSocialHistory);
  const [scheduleItems, setScheduleItems] = useState<ScheduleItem[]>(() =>
    loadPersisted('scheduleItems', initialSchedule()),
  );

  useEffect(() => {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ templates, copyTemplates, scheduleItems }),
      );
    } catch {
      // localStorage 不可用時僅退回記憶體模式,不影響操作
    }
  }, [templates, copyTemplates, scheduleItems]);

  // 草稿:來源郵件 id、'blank'(空白草稿)或 null(尚未開始)
  const [selectedMailId, setSelectedMailId] = useState<string | null>(null);
  const [draftText, setDraftText] = useState('');
  const [draftPlatforms, setDraftPlatforms] = useState<Record<PlatformKey, boolean>>({
    fb: true,
    ig: true,
    threads: false,
    line: false,
  });

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

  const insertTemplateIntoDraft = (tpl: Template) => {
    setDraftText((t) => (t ? t + '\n\n' : '') + tpl.text);
    showToast('已插入文管庫內容');
  };

  /** 套用社群媒體歷史貼文到草稿(附加到尾端),若尚無草稿目標則視為空白草稿開始。 */
  const pickSocialPost = (post: SocialPost) => {
    setSelectedMailId((id) => id ?? 'blank');
    setDraftText((t) => (t ? t + '\n\n' : '') + post.content);
    setActiveTab('draft');
    showToast('已套用社群媒體歷史貼文');
  };

  const applyTemplateToDraft = (tpl: Template) => {
    setSelectedMailId((id) => id ?? 'blank');
    setDraftText((t) => (t ? t + '\n\n' : '') + tpl.text);
    setActiveTab('draft');
    showToast('已套用範本到草稿');
  };

  const copyTemplate = async (tpl: Template) => {
    try {
      await navigator.clipboard.writeText(tpl.text);
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

  const saveDraft = () => showToast('草稿已儲存');

  /** 「加入排程」:依已選平台各建立一筆排程,並跳轉排程頁。 */
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
        status: 'scheduled',
      }),
    );
    setScheduleItems((list) => [...list, ...newItems]);
    setSelectedDay(date);
    setActiveTab('schedule');
    showToast('已加入排程 🎉');
  };

  const addManualSchedule = (title: string, date: string, time: string, platform: PlatformKey) => {
    const item: ScheduleItem = {
      id: newId('ms'),
      date,
      time,
      platform,
      title,
      status: 'scheduled',
    };
    setScheduleItems((list) => [...list, item]);
    setSelectedDay(date);
    showToast('已新增排程');
  };

  const deleteScheduleItem = (id: string) => {
    setScheduleItems((list) => list.filter((i) => i.id !== id));
    showToast('已刪除排程');
  };

  return {
    weekDates,
    activeTab,
    setActiveTab,
    gmail,
    emails,
    templates,
    copyTemplates,
    socialHistory,
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
    saveDraft,
    confirmSchedule,
    addManualSchedule,
    deleteScheduleItem,
    tomorrowISO,
  };
}
