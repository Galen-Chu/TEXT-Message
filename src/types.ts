export type Tab = 'dashboard' | 'inbox' | 'draft' | 'library' | 'schedule';

export type PlatformKey = 'fb' | 'ig' | 'threads' | 'line';

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
}

export type ScheduleStatus = 'scheduled' | 'draft';

export interface ScheduleItem {
  id: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:mm
  platform: PlatformKey;
  title: string;
  status: ScheduleStatus;
}

export interface PlatformMeta {
  key: PlatformKey;
  label: string;
  color: string;
  badge: string;
  limit: number;
}
