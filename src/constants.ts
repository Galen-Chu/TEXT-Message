import type { EmailTag, PlatformKey, PlatformMeta } from './types';
import type { GmailErrorCode } from './services/gmail/errors';

/** Gmail 連線錯誤的使用者文案(依 errors.ts 的 code 對應)。 */
export const GMAIL_ERROR_COPY: Record<GmailErrorCode, string> = {
  disabled: '此版本未設定 Gmail 連線',
  gis_load_failed: 'Google 登入服務載入失敗,請確認網路後重試',
  popup_blocked: '無法開啟 Google 登入視窗,請允許彈出視窗後重試',
  access_denied: '已取消授權,未連接 Gmail',
  cancelled: '已取消連接',
  network: '網路連線異常,請稍後再試',
  unauthorized: 'Gmail 授權已過期,請重新連接',
  quota: '暫時達到 Gmail 用量上限,請稍後再試',
  server: 'Gmail 服務暫時無法使用,請稍後再試',
  parse: '郵件資料解析失敗',
  unknown: '發生未預期的錯誤,請重試',
};

export const PLATFORM_META: Record<PlatformKey, PlatformMeta> = {
  fb: { key: 'fb', label: 'Facebook', color: '#1877F2', badge: 'f', limit: 63206 },
  ig: { key: 'ig', label: 'Instagram', color: '#C13584', badge: 'IG', limit: 2200 },
  threads: { key: 'threads', label: 'Threads', color: '#101010', badge: '@', limit: 500 },
  line: { key: 'line', label: 'LINE', color: '#06C755', badge: 'L', limit: 1000 },
};

export const PLATFORM_LIST: PlatformMeta[] = Object.values(PLATFORM_META);

export const INBOX_FILTERS: Array<'全部' | EmailTag> = [
  '全部',
  '電子報',
  '合作邀約',
  '讀者來信',
  '活動通知',
];

// 文管庫「訊息管理」分類
export const LIBRARY_CATEGORIES = [
  '全部',
  '節慶祝賀',
  '業配/產品促銷',
  '粉絲互動',
  '常見問答',
  '感謝訊息',
];

// 文管庫「文案管理」分類
export const COPY_CATEGORIES = ['全部', '日常分享', '新品/業配', '活動宣傳', '品牌故事'];

export type LibraryMainTab = 'message' | 'copy';

export const TONE_OPTIONS = ['專業', '親切', '活潑', '簡短'] as const;
export type Tone = (typeof TONE_OPTIONS)[number];

// 純前端規則示範(非真實 AI),生產環境應接後端 AI 改寫 API
export const TONE_REWRITES: Record<Tone, (t: string) => string> = {
  專業: (t) => t,
  親切: (t) => (t ? t + '\n\n謝謝你一直以來的陪伴 🌿' : t),
  活潑: (t) => (t ? t.replace(/。/g, '!') + ' ✨' : t),
  簡短: (t) => (t ? t.split('\n')[0] : t),
};

export const WEEKDAY_LABELS = ['週一', '週二', '週三', '週四', '週五', '週六', '週日'];
