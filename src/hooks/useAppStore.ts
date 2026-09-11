import { useCallback, useEffect, useRef, useState } from 'react';
import { useDrive } from './useDrive';
import { useGmail } from './useGmail';
import { useThreadsProxy } from './useThreadsProxy';
import { useYoutube } from './useYoutube';
import {
  BACKEND_COPY,
  BACKEND_ERROR_COPY,
  DOC_KIND_LABELS,
  DRAFT_AI_COPY,
  DRAFT_LIBRARY_COPY,
  DRAFT_SAVE_COPY,
  DRAFT_VARIANTS_COPY,
  DRIVE_COPY,
  GEMINI_ERROR_COPY,
  LANGUAGE_OPTIONS,
  LIBRARY_COPY,
  PLATFORM_LIST,
  PLATFORM_META,
  ROLE_OPTIONS,
  SCHEDULE_COPY,
  TONE_REWRITES,
  type LibraryMainTab,
  type RewriteLanguage,
  type Role,
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
import { generatePlatformVariants, suggestHashtagsFor } from '../services/gemini/variants';
import {
  DEMO_DRIVE_DOC_TEXT,
  initialCopyTemplates,
  initialDrafts,
  initialEmails,
  initialSchedule,
  initialSocialHistory,
  initialTemplates,
} from '../data/mockData';
import type {
  DocKind,
  DraftDoc,
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
import { buildTemplateInsertText, templateCopyText } from '../utils/variants';

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

const DEFAULT_DRAFT_PLATFORMS: Record<PlatformKey, boolean> = {
  fb: true,
  ig: true,
  threads: false,
  line: false,
  yt: false,
};

/**
 * 草稿集合載入(IA Phase 2 D8;2026-09-07 增預設範本):
 * 1. 已有 drafts 欄位 → 照儲存值(尊重「清空過」的狀態,不重新種入預設)
 * 2. 無欄位但有舊版單一草稿緩衝(draftText)→ 遷移一筆 kind='draft'
 * 3. 全新使用者 → 預設電子郵件範本(mockData.initialDrafts)
 */
function loadDrafts(): DraftDoc[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const data = raw ? (JSON.parse(raw) as Record<string, unknown> | null) : null;
    if (Array.isArray(data?.drafts)) return data.drafts as DraftDoc[];
    const legacyText = typeof data?.draftText === 'string' ? (data.draftText as string) : '';
    if (legacyText.trim()) {
      const storedPlatforms =
        data?.draftPlatforms && typeof data.draftPlatforms === 'object'
          ? (data.draftPlatforms as Partial<Record<PlatformKey, boolean>>)
          : {};
      return [
        {
          id: newId('doc-'),
          kind: 'draft',
          title: legacyText.trim().slice(0, 12),
          text: legacyText,
          platforms: { ...DEFAULT_DRAFT_PLATFORMS, ...storedPlatforms },
          sourceId: typeof data?.draftSourceId === 'string' ? (data.draftSourceId as string) : null,
          updatedAt: new Date().toISOString(),
        },
      ];
    }
  } catch {
    // 解析失敗退回預設範本
  }
  return initialDrafts();
}

/** 平台變體清理:移除空白內容;全空回 undefined(不落地該欄位,維持舊資料形狀)。 */
function cleanVariants(
  variants?: Partial<Record<PlatformKey, string>>,
): Partial<Record<PlatformKey, string>> | undefined {
  if (!variants) return undefined;
  const cleaned = Object.fromEntries(
    Object.entries(variants).filter(([, v]) => typeof v === 'string' && v.trim()),
  ) as Partial<Record<PlatformKey, string>>;
  return Object.keys(cleaned).length ? cleaned : undefined;
}

export function useAppStore() {
  const weekDates = getWeekDates();
  const gmail = useGmail();
  const youtube = useYoutube();
  const threadsProxy = useThreadsProxy();
  const drive = useDrive();

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
  // 文檔類型(IA Phase 3 D9):影響 AI 生成文體與「儲存文體」的文庫歸檔;預設 'copy'(編輯器主產出是貼文)。
  const [draftKind, setDraftKind] = useState<DocKind>(() =>
    loadPersistedValue<DocKind>(
      'draftKind',
      'copy',
      (v): v is DocKind => v === 'draft' || v === 'copy' || v === 'message',
    ),
  );
  // AI 角色與語言(2026-09-11 B2/B3):語氣/自訂指令/平台版本生成的共同維度,隨偏好持久化。
  const [aiRole, setAiRole] = useState<Role | null>(() =>
    loadPersistedValue<Role | null>(
      'aiRole',
      null,
      (v): v is Role | null => v === null || (ROLE_OPTIONS as readonly string[]).includes(v as Role),
    ),
  );
  const [aiLanguage, setAiLanguage] = useState<RewriteLanguage>(() =>
    loadPersistedValue<RewriteLanguage>(
      'aiLanguage',
      '繁體中文',
      (v): v is RewriteLanguage =>
        (LANGUAGE_OPTIONS as readonly string[]).includes(v as RewriteLanguage),
    ),
  );
  // Drive 風格樣本(DRIVE-PLAN D6):**僅存中繼資料(id/name/mimeType)**——文檔內容不落地,
  // 生成時即時自 Drive API 匯出(未連線時示範文檔用內建文案)。
  const [driveStyleSamples, setDriveStyleSamples] = useState<
    Array<{ id: string; name: string; mimeType: string }>
  >(() =>
    loadPersisted('driveStyleSamples', [] as Array<{ id: string; name: string; mimeType: string }>),
  );
  const [driveStyleEnabled, setDriveStyleEnabled] = useState(() =>
    loadPersistedValue('driveStyleEnabled', true, (v): v is boolean => typeof v === 'boolean'),
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

  // 草稿管理集合(IA Phase 2 D8):多筆可管理文檔;activeDraftId 標示編輯緩衝對應的
  // 集合文檔(「儲存文體」選草稿體時更新該筆;null = 下次儲存建立新文檔)。
  const [drafts, setDrafts] = useState<DraftDoc[]>(() => loadDrafts());
  const [activeDraftId, setActiveDraftId] = useState<string | null>(() =>
    loadPersistedValue('activeDraftId', null, (v): v is string => typeof v === 'string'),
  );
  // 「儲存文體」選文案/訊息體時追蹤的範本 id(B4,2026-09-11):同緩衝再儲存即原地更新;
  // null = 下次儲存建立新範本。切換文體儲存後追蹤會改指新目標。
  const [activeTemplateId, setActiveTemplateId] = useState<string | null>(() =>
    loadPersistedValue('activeTemplateId', null, (v): v is string => typeof v === 'string'),
  );

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
          draftKind,
          aiRole,
          aiLanguage,
          driveStyleSamples,
          driveStyleEnabled,
          drafts,
          activeDraftId,
          activeTemplateId,
        }),
      );
    } catch {
      // localStorage 不可用時僅退回記憶體模式,不影響操作
    }
  }, [templates, copyTemplates, scheduleItems, publishedHistory, draftText, draftPlatforms, selectedMailId, draftKind, aiRole, aiLanguage, driveStyleSamples, driveStyleEnabled, drafts, activeDraftId, activeTemplateId]);

  const [inboxSearch, setInboxSearch] = useState('');
  const [inboxFilter, setInboxFilter] = useState<'全部' | EmailTag>('全部');
  /** Gmail 使用者標籤篩選(label id;null = 不套用)——僅已連線時生效。 */
  const [inboxLabelId, setInboxLabelId] = useState<string | null>(null);
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
    setActiveDraftId(null);
    setActiveTemplateId(null);
    setDraftKind('copy');
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
    setActiveDraftId(null);
    setActiveTemplateId(null);
    setDraftKind('copy');
    setDraftText('');
  };

  /** 刪除內容(原「捨棄草稿」,2026-09-11 B4 更名):清空編輯緩衝與來源,回到空狀態(持久化隨之清除)。 */
  const discardDraft = () => {
    setSelectedMailId(null);
    setActiveDraftId(null);
    setActiveTemplateId(null);
    setDraftKind('copy');
    setDraftText('');
    setDraftPlatforms({ ...DEFAULT_DRAFT_PLATFORMS });
    showToast(DRAFT_SAVE_COPY.deletedToast);
  };

  // Gemini BYOK:key 僅存使用者瀏覽器;未設定 → 規則示範路徑
  const [geminiKey, setGeminiKeyState] = useState(() => loadGeminiKey());
  const [aiBusy, setAiBusy] = useState(false);

  // 第四期:平台變體生成結果(可編輯)與 hashtag 建議(工作階段狀態,不落地)
  const [draftVariants, setDraftVariants] = useState<Partial<Record<PlatformKey, string>> | null>(
    null,
  );
  const [hashtagSuggestions, setHashtagSuggestions] = useState<string[]>([]);

  const setGeminiKey = (key: string) => {
    if (key) saveGeminiKey(key);
    else clearGeminiKey();
    setGeminiKeyState(key);
  };

  /** 角色與語言選擇(2026-09-11 B2/B3):僅影響真實 AI 路徑;無 key 時選了即提示(角色/翻譯無法規則示範)。 */
  const selectAiRole = (role: Role | null) => {
    setAiRole(role);
    if (role && !geminiKey) showToast(DRAFT_AI_COPY.roleLangNeedKey);
  };

  const selectAiLanguage = (language: RewriteLanguage) => {
    setAiLanguage(language);
    if (language !== '繁體中文' && !geminiKey) showToast(DRAFT_AI_COPY.roleLangNeedKey);
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
      } else if (aiRole || aiLanguage !== '繁體中文') {
        showToast(DRAFT_AI_COPY.toneDemoExtrasToast(tone));
      } else {
        showToast(DRAFT_AI_COPY.toneDemoToast(tone));
      }
      return;
    }
    setAiBusy(true);
    const styleSamples = driveStyleEnabled ? await getDriveStyleSampleTexts() : [];
    const result = await rewriteWithGemini({
      apiKey: geminiKey,
      text: draftText,
      tone,
      limit,
      kind: draftKind,
      styleSamples,
      role: aiRole,
      language: aiLanguage,
    });
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
    const styleSamples = driveStyleEnabled ? await getDriveStyleSampleTexts() : [];
    const result = await rewriteWithInstruction({
      apiKey: geminiKey,
      text: draftText,
      instruction: inst,
      limit: strictestSelectedLimit(),
      kind: draftKind,
      styleSamples,
      role: aiRole,
      language: aiLanguage,
    });
    setAiBusy(false);
    if (result.ok) {
      setDraftText(result.text);
      showToast(DRAFT_AI_COPY.customInstructionDoneToast);
    } else {
      showToast(GEMINI_ERROR_COPY[result.code] ?? GEMINI_ERROR_COPY.unknown);
    }
  };

  /** 產生平台版本(第四期 F6,BYOK;無 key 依 D5 決議顯示按鈕但點擊僅提示)。 */
  const generateDraftVariants = async () => {
    if (!draftText.trim()) {
      showToast(DRAFT_VARIANTS_COPY.variantsEmptyDraftToast);
      return;
    }
    const platforms = PLATFORM_LIST.filter((p) => draftPlatforms[p.key]);
    if (!platforms.length) {
      showToast(DRAFT_VARIANTS_COPY.variantsNoPlatformToast);
      return;
    }
    if (aiBusy) return;
    if (!geminiKey) {
      showToast(DRAFT_VARIANTS_COPY.variantsNeedKeyToast);
      return;
    }
    setAiBusy(true);
    const styleSamples = driveStyleEnabled ? await getDriveStyleSampleTexts() : [];
    const result = await generatePlatformVariants({
      apiKey: geminiKey,
      text: draftText,
      platforms: platforms.map((p) => ({ key: p.key, label: p.label, limit: p.limit })),
      styleSamples,
      role: aiRole,
      language: aiLanguage,
    });
    setAiBusy(false);
    if (result.ok) {
      setDraftVariants(result.variants);
      setHashtagSuggestions([]);
      showToast(DRAFT_VARIANTS_COPY.variantsDoneToast);
    } else {
      showToast(GEMINI_ERROR_COPY[result.code] ?? GEMINI_ERROR_COPY.unknown);
    }
  };

  const setDraftVariant = (key: PlatformKey, text: string) => {
    setDraftVariants((v) => (v ? { ...v, [key]: text } : v));
  };

  /** 附加平台版本到草稿尾端(沿用 D3 的 [平台名 版] 段落格式)。 */
  const appendDraftVariantsToDraft = () => {
    if (!draftVariants) return;
    const segments = PLATFORM_LIST.filter((p) => (draftVariants[p.key] ?? '').trim()).map(
      (p) => `[${p.label} 版]\n${draftVariants[p.key]}`,
    );
    if (!segments.length) return;
    setDraftText((t) => (t ? t + '\n\n' : '') + segments.join('\n\n'));
    setDraftVariants(null);
    showToast(DRAFT_VARIANTS_COPY.variantsAppendedToast);
  };

  /** 平台版本存為文案範本(通用內容 = 目前草稿全文,平台版本 = 生成結果)。 */
  const saveDraftVariantsAsTemplate = (title: string, category: string) => {
    if (!draftVariants) return;
    const tpl: Template = {
      id: newId('sv'),
      category: category || '日常分享',
      title,
      text: draftText,
      platformVariants: { ...draftVariants },
    };
    setCopyTemplates((list) => [tpl, ...list]);
    setDraftVariants(null);
    showToast(DRAFT_VARIANTS_COPY.variantsSavedToast);
  };

  /** hashtag 建議(第四期 F7,BYOK;無 key 依 D5 顯示按鈕但點擊僅提示)。 */
  const requestHashtags = async () => {
    if (!draftText.trim()) {
      showToast(DRAFT_VARIANTS_COPY.variantsEmptyDraftToast);
      return;
    }
    if (aiBusy) return;
    if (!geminiKey) {
      showToast(DRAFT_VARIANTS_COPY.hashtagsNeedKeyToast);
      return;
    }
    setAiBusy(true);
    const result = await suggestHashtagsFor({ apiKey: geminiKey, text: draftText });
    setAiBusy(false);
    if (result.ok) {
      setHashtagSuggestions(result.hashtags);
      showToast(DRAFT_VARIANTS_COPY.hashtagsDoneToast);
    } else {
      showToast(GEMINI_ERROR_COPY[result.code] ?? GEMINI_ERROR_COPY.unknown);
    }
  };

  const addHashtagsToDraft = (tags: string[]) => {
    const joined = tags.join(' ');
    if (!joined) return;
    setDraftText((t) => (t ? t + (t.endsWith('\n') ? '' : '\n\n') : '') + joined);
    showToast(DRAFT_VARIANTS_COPY.hashtagAppendedToast);
  };

  const togglePlatform = (key: PlatformKey) => {
    setDraftPlatforms((p) => ({ ...p, [key]: !p[key] }));
  };

  /** 目前草稿勾選的平台鍵值(範本插入時決定要帶入哪些平台變體)。 */
  const selectedDraftPlatformKeys = (): PlatformKey[] =>
    PLATFORM_LIST.filter((p) => draftPlatforms[p.key]).map((p) => p.key);

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
    setDraftText(
      (t) =>
        (t ? t + '\n\n' : '') +
        buildTemplateInsertText(tpl, selectedDraftPlatformKeys(), values ?? {}),
    );
    markTemplateApplied(tpl.id);
    showToast('已插入文庫內容');
  };

  /** 套用社群媒體歷史貼文到草稿(附加到尾端),若尚無草稿目標則視為空白草稿開始。 */
  const pickSocialPost = (post: SocialPost) => {
    setSelectedMailId((id) => id ?? 'blank');
    setDraftText((t) => (t ? t + '\n\n' : '') + post.content);
    setActiveTab('draft');
    showToast('已套用社群媒體歷史貼文');
  };

  /** 引用 Drive 文檔到編輯緩衝(附加到尾端;DRIVE-PLAN D3),若尚無草稿目標則視為空白草稿開始。 */
  const insertDriveText = (text: string) => {
    setSelectedMailId((id) => id ?? 'blank');
    setDraftText((t) => (t ? t + '\n\n' : '') + text);
    setActiveTab('draft');
    showToast(DRIVE_COPY.referenceToast);
  };

  const applyTemplateToDraft = (tpl: Template, values?: Record<string, string>) => {
    setSelectedMailId((id) => id ?? 'blank');
    setDraftText(
      (t) =>
        (t ? t + '\n\n' : '') +
        buildTemplateInsertText(tpl, selectedDraftPlatformKeys(), values ?? {}),
    );
    setActiveTab('draft');
    markTemplateApplied(tpl.id);
    showToast('已套用範本到草稿');
  };

  /** 複製範本:choice 指定平台變體或 'generic' 通用版(第二期)。 */
  const copyTemplate = async (
    tpl: Template,
    values?: Record<string, string>,
    choice: PlatformKey | 'generic' = 'generic',
  ) => {
    try {
      await navigator.clipboard.writeText(templateCopyText(tpl, choice, values ?? {}));
      markTemplateApplied(tpl.id);
      showToast('已複製到剪貼簿');
    } catch {
      showToast('複製失敗,請手動選取複製');
    }
  };

  /** 「+ 新增內容」:依文管庫當前分頁寫入對應資料集,分類取該分頁當前選取分類。 */
  const addTemplate = (
    title: string,
    text: string,
    platformVariants?: Partial<Record<PlatformKey, string>>,
  ) => {
    const variants = cleanVariants(platformVariants);
    if (libraryMainTab === 'copy') {
      const tpl: Template = {
        id: newId('nc'),
        category: copyCategory === '全部' ? '其他' : copyCategory,
        title,
        text,
        ...(variants ? { platformVariants: variants } : {}),
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
      ...(variants ? { platformVariants: variants } : {}),
    };
    setTemplates((list) => [tpl, ...list]);
    showToast('已新增至訊息管理');
  };

  /** 編輯範本:依 id 找到所屬資料集(訊息/文案)更新標題與內容;分類維持原值。 */
  const updateTemplate = (
    id: string,
    patch: { title: string; text: string; platformVariants?: Partial<Record<PlatformKey, string>> },
  ) => {
    const inTemplates = templates.some((t) => t.id === id);
    const inCopy = copyTemplates.some((t) => t.id === id);
    if (!inTemplates && !inCopy) return;
    const map = (list: Template[]) =>
      list.map((t) => {
        if (t.id !== id) return t;
        const next = { ...t, ...patch };
        // 僅在呼叫端明確傳入變體欄位時處理(空物件 = 清除全部變體;未傳 = 維持原值)
        if ('platformVariants' in patch) next.platformVariants = cleanVariants(patch.platformVariants);
        return next;
      });
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
  /**
   * 文案/訊息體的「儲存文體」(2026-09-11 B4):存入對應範本集(文案管理/訊息管理),
   * activeTemplateId 追蹤同緩衝的原地更新;分類預設沿 saveDriveDocAsTemplate(D7)慣例。
   */
  const saveEditorTemplate = (kind: 'copy' | 'message') => {
    const isCopy = kind === 'copy';
    const list = isCopy ? copyTemplates : templates;
    const existing = activeTemplateId ? list.find((t) => t.id === activeTemplateId) : undefined;
    if (existing) {
      const map = (l: Template[]) =>
        l.map((t) => (t.id === existing.id ? { ...t, text: draftText } : t));
      if (isCopy) setCopyTemplates(map);
      else setTemplates(map);
    } else {
      const tpl: Template = {
        id: newId(isCopy ? 'ec' : 'em'),
        category: DRAFT_SAVE_COPY.defaultCategory[kind],
        title: draftText.trim().slice(0, 12),
        text: draftText,
      };
      if (isCopy) setCopyTemplates((l) => [tpl, ...l]);
      else setTemplates((l) => [tpl, ...l]);
      setActiveTemplateId(tpl.id);
    }
    showToast(DRAFT_SAVE_COPY.savedToast[kind]);
  };

  /**
   * 「儲存文體」(原「儲存草稿」,IA Phase 2 D8;2026-09-11 B4 依文檔類型歸檔)——
   * 草稿體存入文庫 · 草稿管理(activeDraftId 有對應文檔則原地更新,否則建立新文檔);
   * 文案/訊息體存入對應範本集(文案管理/訊息管理),不再是「草稿管理 + kind 標籤」。
   */
  const saveDraft = () => {
    if (!draftText.trim()) {
      showToast(DRAFT_SAVE_COPY.needTextToast);
      return;
    }
    if (draftKind !== 'draft') {
      saveEditorTemplate(draftKind);
      return;
    }
    const now = new Date().toISOString();
    const existing = activeDraftId ? drafts.find((d) => d.id === activeDraftId) : undefined;
    if (existing) {
      setDrafts((ds) =>
        ds.map((d) =>
          d === existing
            ? { ...d, kind: 'draft', text: draftText, platforms: draftPlatforms, sourceId: selectedMailId, updatedAt: now }
            : d,
        ),
      );
    } else {
      const doc: DraftDoc = {
        id: newId('doc-'),
        kind: 'draft',
        title: draftText.trim().slice(0, 12),
        text: draftText,
        platforms: draftPlatforms,
        sourceId: selectedMailId,
        updatedAt: now,
      };
      setDrafts((ds) => [doc, ...ds]);
      setActiveDraftId(doc.id);
    }
    showToast(DRAFT_SAVE_COPY.savedToast.draft);
  };

  /** 開啟草稿文檔至編輯器:載入緩衝並追蹤 activeDraftId(後續儲存原地更新同一筆);範本追蹤解除。 */
  const openDraftDoc = (id: string) => {
    const doc = drafts.find((d) => d.id === id);
    if (!doc) return;
    setActiveDraftId(doc.id);
    setActiveTemplateId(null);
    setSelectedMailId(doc.sourceId);
    setDraftKind(doc.kind);
    setDraftText(doc.text);
    setDraftPlatforms({ ...DEFAULT_DRAFT_PLATFORMS, ...doc.platforms });
    setActiveTab('draft');
    showToast(DRAFT_LIBRARY_COPY.openedToast);
  };

  /** 刪除草稿文檔(編輯緩衝若正對應該文檔則解除追蹤,緩衝內容不動)。 */
  const deleteDraftDoc = (id: string) => {
    setDrafts((ds) => ds.filter((d) => d.id !== id));
    if (activeDraftId === id) setActiveDraftId(null);
    showToast(DRAFT_LIBRARY_COPY.deletedToast);
  };

  /** Drive 風格樣本(DRIVE-PLAN D6):標記/取消(上限 3 篇控制 prompt 長度)。 */
  const toggleDriveStyleSample = (doc: { id: string; name: string; mimeType: string }) => {
    setDriveStyleSamples((list) => {
      if (list.some((s) => s.id === doc.id)) {
        showToast(DRIVE_COPY.styleUnmarkedToast);
        return list.filter((s) => s.id !== doc.id);
      }
      if (list.length >= 3) {
        showToast(DRIVE_COPY.styleFullToast(3));
        return list;
      }
      showToast(DRIVE_COPY.styleMarkedToast);
      return [...list, doc];
    });
  };

  /**
   * 取得樣本文字:已連線走 Drive API 即時匯出(內容不落地);
   * 未連線時示範文檔用內建文案(D6:示範模式流程可完整體驗)。
   */
  const getDriveStyleSampleTexts = async (): Promise<string[]> => {
    if (!driveStyleSamples.length) return [];
    if (drive.status !== 'connected') {
      const demo = driveStyleSamples
        .map((s) => DEMO_DRIVE_DOC_TEXT[s.id])
        .filter((t): t is string => !!t);
      if (demo.length) return demo;
      showToast(DRIVE_COPY.styleNotConnected);
      return [];
    }
    const texts: string[] = [];
    let failed = 0;
    for (const s of driveStyleSamples) {
      try {
        texts.push(await drive.previewText(s));
      } catch {
        failed += 1;
      }
    }
    if (failed) showToast(DRIVE_COPY.stylePartialFail(failed));
    return texts;
  };

  /** Drive 文檔存為範本(D7):草稿→drafts;文案/訊息→對應範本集(分類預設,入庫後可改)。 */
  const saveDriveDocAsTemplate = (kind: DocKind, title: string, text: string) => {
    const t = title.trim() || text.slice(0, 12);
    if (kind === 'draft') {
      const doc: DraftDoc = {
        id: newId('doc-'),
        kind: 'draft',
        title: t,
        text,
        platforms: { fb: false, ig: false, threads: false, line: false, yt: false },
        sourceId: null,
        updatedAt: new Date().toISOString(),
      };
      setDrafts((ds) => [doc, ...ds]);
    } else {
      const tpl: Template = {
        id: newId('dt-'),
        category: kind === 'copy' ? '日常分享' : '粉絲互動',
        title: t,
        text,
      };
      if (kind === 'copy') setCopyTemplates((l) => [tpl, ...l]);
      else setTemplates((l) => [tpl, ...l]);
    }
    showToast(DRIVE_COPY.savedAsTemplateToast(DOC_KIND_LABELS[kind]));
  };

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
        docKind: draftKind,
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
    docKind: DocKind = 'copy',
  ) => {
    const item: ScheduleItem = {
      id: newId('ms'),
      date,
      time,
      platform,
      title,
      content,
      status: 'scheduled',
      docKind,
    };
    setScheduleItems((list) => [...list, item]);
    setSelectedDay(date);
    showToast(SCHEDULE_COPY.addedToast);
  };

  /** 編輯排程:更新標題/內容/日期/時間/平台/文檔類別;狀態維持原值。 */
  const updateScheduleItem = (
    id: string,
    patch: Partial<Pick<ScheduleItem, 'title' | 'content' | 'date' | 'time' | 'platform' | 'docKind'>>,
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

  /** Threads 立即代發(階段三前端串接):成功即寫入發文歷史。 */
  const publishDraftToThreadsNow = async () => {
    if (!draftText.trim()) {
      showToast(BACKEND_COPY.needTextToast);
      return;
    }
    const result = await threadsProxy.publish(draftText);
    if (!result) return; // 連點被鎖定忽略
    if (result.ok) {
      appendPublishedHistory('threads', draftText.split('\n')[0], draftText);
      showToast(BACKEND_COPY.publishedToast);
    } else {
      showToast(BACKEND_ERROR_COPY[result.code] ?? BACKEND_ERROR_COPY.unknown);
    }
  };

  /** Threads 排程代發:同步後端雲端佇列(cron 到點自動發佈)並建立本地排程。 */
  const scheduleDraftToThreads = async (publishAtLocal: string) => {
    if (!draftText.trim()) {
      showToast(BACKEND_COPY.needTextToast);
      return;
    }
    const dt = new Date(publishAtLocal);
    if (!publishAtLocal || Number.isNaN(dt.getTime()) || dt.getTime() <= Date.now()) {
      showToast(BACKEND_COPY.pastTimeToast);
      return;
    }
    const result = await threadsProxy.schedule(draftText, dt.getTime());
    if (!result) return; // 連點被鎖定忽略
    if (result.ok) {
      addManualSchedule(
        draftText.split('\n')[0],
        publishAtLocal.slice(0, 10),
        publishAtLocal.slice(11, 16),
        'threads',
        draftText,
        draftKind,
      );
      showToast(BACKEND_COPY.scheduledToast);
    } else {
      showToast(BACKEND_ERROR_COPY[result.code] ?? BACKEND_ERROR_COPY.unknown);
    }
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
    threadsProxy,
    drive,
    emails,
    templates,
    copyTemplates,
    socialHistory,
    socialHistoryIsDemo,
    publishedHistory,
    scheduleItems,
    selectedMailId,
    draftText,
    setDraftText,
    draftPlatforms,
    draftKind,
    setDraftKind,
    aiRole,
    aiLanguage,
    selectAiRole,
    selectAiLanguage,
    drafts,
    activeDraftId,
    openDraftDoc,
    deleteDraftDoc,
    driveStyleSamples,
    driveStyleEnabled,
    setDriveStyleEnabled,
    toggleDriveStyleSample,
    saveDriveDocAsTemplate,
    inboxSearch,
    setInboxSearch,
    inboxFilter,
    setInboxFilter,
    inboxLabelId,
    setInboxLabelId,
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
    generateDraftVariants,
    draftVariants,
    setDraftVariant,
    appendDraftVariantsToDraft,
    clearDraftVariants: () => setDraftVariants(null),
    saveDraftVariantsAsTemplate,
    requestHashtags,
    hashtagSuggestions,
    addHashtagsToDraft,
    clearHashtagSuggestions: () => setHashtagSuggestions([]),
    geminiKey,
    setGeminiKey,
    aiBusy,
    togglePlatform,
    insertTemplateIntoDraft,
    pickSocialPost,
    insertDriveText,
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
    publishDraftToThreadsNow,
    scheduleDraftToThreads,
    copyScheduleText,
    openSchedulePublish,
    deleteScheduleItem,
    tomorrowISO,
  };
}
