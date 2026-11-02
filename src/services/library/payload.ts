/**
 * 文庫雲端備份的內容組裝與套用(方案 A,2026-10-05;UI 現名「Cloudflare worker 備份」)。
 * 備份範圍(D4)= `text-message:v2` 的全部使用者內容;**emails 與 Gemini key 永不備份**
 * (前者不落地、後者屬 BYOK 憑證——紅線見 CLAUDE.md)。
 * D2(2026-10-24):日記(獨立鍵 `text-message:diary:v1`)隨文庫一併備份——`diary` 為
 * **選用欄位**,舊備份無此欄仍視為有效(還原時不動本機日記,見 useAppStore)。
 * POST-PLAN D2(2026-11-01):便條(獨立鍵 `text-message:notes:v1`)同規,`notes` 亦為選用欄位。
 */
import type { AutoPipeline, DiaryEntry, DraftDoc, DocKind, Note, PlatformKey, ScheduleItem, SocialPost, Template } from '../../types';
import { PLATFORM_META } from '../../constants';
import type { RewriteLanguage, Role } from '../../constants';

export const LIBRARY_SCHEMA_VERSION = 1;

export interface LibraryPayload {
  schema: typeof LIBRARY_SCHEMA_VERSION;
  savedAt: number;
  templates: Template[];
  copyTemplates: Template[];
  scheduleItems: ScheduleItem[];
  publishedHistory: SocialPost[];
  drafts: DraftDoc[];
  activeDraftId: string | null;
  activeTemplateId: string | null;
  draftText: string;
  draftPlatforms: Record<PlatformKey, boolean>;
  draftSourceId: string | null;
  draftKind: DocKind;
  aiRole: Role | null;
  aiLanguage: RewriteLanguage;
  driveStyleSamples: Array<{ id: string; name: string; mimeType: string }>;
  driveStyleEnabled: boolean;
  diary?: DiaryEntry[]; // D2(2026-10-24):選用——schema 維持 v1,舊備份無此欄照樣通過驗證
  notes?: Note[]; // POST-PLAN D2(2026-11-01):便條同規,選用欄位
  pipelineSettings?: PipelineSettings; // 2026-11-02:管線「設定+素材游標」隨備份(機器本地狀態刻意排除,見 PipelineSettings)
}

/**
 * 管線設定的備份投影(2026-11-02 拍板折衷):只含「設定+素材游標」,
 * **刻意排除 enabled/queuedThrough/lastFilledAt**——雲端佇列以 installId 分帳
 * (每個瀏覽器安裝一份),enabled 跨機還原會雙機各自補糧=同日重複發文;queuedThrough
 * 帶到佇列為空的新機會誤判「已排到那天」而漏發。這三欄屬機器本地狀態,不隨備份漫遊;
 * usedJournalDates/usedTemplateIds 則跨機共用(素材去重本來就該全域一份)。
 */
export interface PipelineSettings {
  platform: PlatformKey;
  time: string; // 'HH:mm',本機時區
  daysOfWeek: number[];
  source: AutoPipeline['source'];
  horizonDays: number;
  journalFileId: string;
  journalFileName: string;
  usedJournalDates: string[];
  sourceCategory?: string;
  usedTemplateIds: string[];
}

/** AutoPipeline → 備份投影(排除機器本地三欄)。 */
export function pipelineSettingsOf(ap: AutoPipeline): PipelineSettings {
  return {
    platform: ap.platform,
    time: ap.time,
    daysOfWeek: ap.daysOfWeek,
    source: ap.source,
    horizonDays: ap.horizonDays,
    journalFileId: ap.journalFileId,
    journalFileName: ap.journalFileName,
    usedJournalDates: ap.usedJournalDates,
    sourceCategory: ap.sourceCategory,
    usedTemplateIds: ap.usedTemplateIds,
  };
}

const PIPELINE_SOURCES: readonly AutoPipeline['source'][] = ['journal-ai', 'templates', 'manual'];

/**
 * 還原端的嚴格驗證(payload 層只鬆驗 isObj,壞形狀由這裡全有或全無地擋下:
 * 不完整就整份不套用,本機管線設定不動——避免半套設定覆蓋)。
 */
export function isPipelineSettings(v: unknown): v is PipelineSettings {
  if (!isObj(v)) return false;
  const platformOk = typeof v.platform === 'string' && v.platform in PLATFORM_META;
  if (!platformOk) return false;
  if (typeof v.time !== 'string' || !/^\d{2}:\d{2}$/.test(v.time)) return false;
  if (!Array.isArray(v.daysOfWeek) || !v.daysOfWeek.every((n) => typeof n === 'number')) return false;
  if (typeof v.source !== 'string' || !PIPELINE_SOURCES.includes(v.source as AutoPipeline['source'])) return false;
  if (typeof v.horizonDays !== 'number' || !Number.isFinite(v.horizonDays)) return false;
  if (typeof v.journalFileId !== 'string' || typeof v.journalFileName !== 'string') return false;
  if (!Array.isArray(v.usedJournalDates) || !v.usedJournalDates.every((d) => typeof d === 'string')) return false;
  if (!Array.isArray(v.usedTemplateIds) || !v.usedTemplateIds.every((d) => typeof d === 'string')) return false;
  if (v.sourceCategory !== undefined && typeof v.sourceCategory !== 'string') return false;
  return true;
}

/** 純函式:把持久化欄位組成備份 payload(呼叫端傳入當前值)。 */
export function buildLibraryPayload(data: Omit<LibraryPayload, 'schema' | 'savedAt'>): LibraryPayload {
  return { schema: LIBRARY_SCHEMA_VERSION, savedAt: Date.now(), ...data };
}

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object';

/** 還原前的形狀驗證:必備陣列/欄位齊才放行,避免半套資料覆蓋本機。 */
export function isValidLibraryPayload(v: unknown): v is LibraryPayload {
  if (!isObj(v)) return false;
  if (v.schema !== LIBRARY_SCHEMA_VERSION) return false;
  if (typeof v.savedAt !== 'number') return false;
  for (const k of [
    'templates',
    'copyTemplates',
    'scheduleItems',
    'publishedHistory',
    'drafts',
    'driveStyleSamples',
  ] as const) {
    if (!Array.isArray(v[k])) return false;
  }
  if (typeof v.draftText !== 'string') return false;
  if (!isObj(v.draftPlatforms)) return false;
  if (typeof v.draftKind !== 'string') return false;
  if (typeof v.aiLanguage !== 'string') return false;
  if (v.aiRole !== null && typeof v.aiRole !== 'string') return false;
  if (v.activeDraftId !== null && typeof v.activeDraftId !== 'string') return false;
  if (v.activeTemplateId !== null && typeof v.activeTemplateId !== 'string') return false;
  if (v.draftSourceId !== null && typeof v.draftSourceId !== 'string') return false;
  if (v.diary !== undefined && !Array.isArray(v.diary)) return false; // 單筆內容好壞由還原端逐筆過濾
  if (v.notes !== undefined && !Array.isArray(v.notes)) return false; // 同上(POST-PLAN D2)
  if (v.pipelineSettings !== undefined && !isObj(v.pipelineSettings)) return false; // 鬆驗;嚴格形狀由還原端 isPipelineSettings 決定是否套用
  return typeof v.driveStyleEnabled === 'boolean';
}
