export type Tab = 'dashboard' | 'inbox' | 'social' | 'schedule' | 'draft' | 'library';

export type PlatformKey = 'fb' | 'ig' | 'threads' | 'line' | 'yt';

export type EmailTag = '電子報' | '合作邀約' | '讀者來信' | '活動通知';

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
