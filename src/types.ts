export type Tab = 'dashboard' | 'inbox' | 'social' | 'schedule' | 'draft' | 'library';

export type PlatformKey = 'fb' | 'ig' | 'threads' | 'line' | 'yt';

export type EmailTag = '電子報' | '合作邀約' | '讀者來信' | '互動通知' | '活動通知';

export interface Email {
  id: string;
  initial: string;
  sender: string;
  subject: string;
  snippet: string;
  fullBody: string;
  date: string;
  tag: EmailTag;
  suitable: boolean;
  /** 真實郵件的 Gmail 標籤 id(唯讀;示範資料無此欄位)——供 Gmail 標籤篩選。 */
  labelIds?: string[];
  /** 寄件者 email(唯讀;供「在 Gmail 建立篩選器」深連結)。 */
  senderEmail?: string;
}

export interface Template {
  id: string;
  category: string;
  title: string;
  text: string;
  /** 使用統計(2026-09 文管庫深化):套用/複製成功時遞增;舊資料無此欄位 = 未啟用 */
  appliedCount?: number;
  lastAppliedAt?: string; // ISO
  /** 平台變體(第二期):各平台的專屬版本,留空的平台使用通用 text;舊資料無此欄位 = 僅通用版 */
  platformVariants?: Partial<Record<PlatformKey, string>>;
}

/**
 * 三大類文檔(IA 重整 D3/D8):kind 標示內容類型——草稿(郵件向)/文案(發文向)/訊息(留言向),
 * 決定文庫歸位與後續 Gemini 分流(Phase 3)與排程類別(Phase 4)。
 */
export type DocKind = 'draft' | 'copy' | 'message';

/** 草稿管理的文檔單元(多筆可管理集合;有別於編輯器的單一作用中緩衝)。 */
export interface DraftDoc {
  id: string;
  kind: DocKind;
  /** 顯示標題;空白時 UI 以內容前綴代替。 */
  title: string;
  text: string;
  platforms: Record<PlatformKey, boolean>;
  /** 來源:郵件 id、'blank'(空白開始)或 null(未知/舊資料)。 */
  sourceId: string | null;
  updatedAt: string; // ISO
}

/**
 * 排程狀態:'published' 由使用者「標記已發佈」寫入;「逾期」不是儲存狀態,
 * 而是依目前時間即時推導(scheduled 且已過排定時間)——見 utils/schedule.ts。
 */
export type ScheduleStatus = 'scheduled' | 'draft' | 'published';

export interface ScheduleItem {
  id: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:mm
  platform: PlatformKey;
  title: string;
  /** 貼文全文(供複製/深連結預填);手動新增或舊資料可為空 */
  content?: string;
  status: ScheduleStatus;
  /** 對應三大類文檔(IA Phase 4 D10);舊資料無此欄位 = 顯示與篩選時視為 'copy' */
  docKind?: DocKind;
}

export interface SocialPost {
  id: string;
  platform: PlatformKey;
  title: string;
  content: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:mm
}

export interface PlatformMeta {
  key: PlatformKey;
  label: string;
  color: string;
  badge: string;
  limit: number;
}
