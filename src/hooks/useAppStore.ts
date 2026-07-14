import { useCallback, useRef, useState } from 'react';
import { PLATFORM_LIST, TONE_REWRITES, type Tone } from '../constants';
import { initialEmails, initialSchedule, initialTemplates } from '../data/mockData';
import type { Email, EmailTag, PlatformKey, ScheduleItem, Tab, Template } from '../types';
import { getWeekDates, toISODate } from '../utils/date';

export type AppStore = ReturnType<typeof useAppStore>;

function tomorrowISO(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return toISODate(d);
}

export function useAppStore() {
  const weekDates = getWeekDates();

  const [activeTab, setActiveTab] = useState<Tab>('dashboard');
  const [emails] = useState<Email[]>(initialEmails);
  const [templates, setTemplates] = useState<Template[]>(initialTemplates);
  const [scheduleItems, setScheduleItems] = useState<ScheduleItem[]>(initialSchedule);

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
  const [librarySearch, setLibrarySearch] = useState('');
  const [libraryCategory, setLibraryCategory] = useState('全部');
  const [selectedDay, setSelectedDay] = useState(toISODate(new Date()));

  const [toastMessage, setToastMessage] = useState('');
  const toastTimer = useRef<ReturnType<typeof setTimeout>>();

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToastMessage(''), 2200);
  }, []);

  const convertToDraft = (mail: Email) => {
    setSelectedMailId(mail.id);
    setDraftText(mail.snippet + '\n\n(草稿已由 AI 從郵件內容摘要產生,歡迎編輯調整)');
    setActiveTab('draft');
    showToast('已將郵件轉換為草稿 ✨');
  };

  const startBlankDraft = () => {
    setSelectedMailId('blank');
    setDraftText('');
  };

  const applyTone = (tone: Tone) => {
    setDraftText((t) => TONE_REWRITES[tone](t));
    showToast(`AI 已套用「${tone}」語氣`);
  };

  const togglePlatform = (key: PlatformKey) => {
    setDraftPlatforms((p) => ({ ...p, [key]: !p[key] }));
  };

  const insertTemplateIntoDraft = (tpl: Template) => {
    setDraftText((t) => (t ? t + '\n\n' : '') + tpl.text);
    showToast('已插入罐頭訊息');
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

  const addTemplate = (title: string, text: string) => {
    const tpl: Template = {
      id: 'nt' + Date.now(),
      category: libraryCategory === '全部' ? '其他' : libraryCategory,
      title,
      text,
    };
    setTemplates((list) => [tpl, ...list]);
    showToast('已新增罐頭訊息');
  };

  const saveDraft = () => showToast('草稿已儲存');

  /** 「加入排程」:依已選平台各建立一筆排程,並跳轉排程頁。 */
  const confirmSchedule = (date: string, time: string) => {
    const platforms = PLATFORM_LIST.filter((p) => draftPlatforms[p.key]).map((p) => p.key);
    const title = (draftText || '未命名草稿').split('\n')[0].slice(0, 24);
    const newItems: ScheduleItem[] = (platforms.length ? platforms : ['fb' as const]).map(
      (p, i) => ({
        id: 'ns' + Date.now() + i,
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
      id: 'ms' + Date.now(),
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
    emails,
    templates,
    scheduleItems,
    selectedMailId,
    draftText,
    setDraftText,
    draftPlatforms,
    inboxSearch,
    setInboxSearch,
    inboxFilter,
    setInboxFilter,
    librarySearch,
    setLibrarySearch,
    libraryCategory,
    setLibraryCategory,
    selectedDay,
    setSelectedDay,
    toastMessage,
    showToast,
    convertToDraft,
    startBlankDraft,
    applyTone,
    togglePlatform,
    insertTemplateIntoDraft,
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
