/**
 * 文庫雲端備份的內容組裝與套用(方案 A,2026-10-05)。
 * 備份範圍(D4)= `text-message:v2` 的全部使用者內容;**emails 與 Gemini key 永不備份**
 * (前者不落地、後者屬 BYOK 憑證——紅線見 CLAUDE.md)。
 * D2(2026-10-24):日記(獨立鍵 `text-message:diary:v1`)隨文庫一併備份——`diary` 為
 * **選用欄位**,舊備份無此欄仍視為有效(還原時不動本機日記,見 useAppStore)。
 */
import type { DiaryEntry, DraftDoc, DocKind, PlatformKey, ScheduleItem, SocialPost, Template } from '../../types';
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
  return typeof v.driveStyleEnabled === 'boolean';
}
