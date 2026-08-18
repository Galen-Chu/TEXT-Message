/**
 * 規則式分類器(非 AI):依寄件網域與關鍵字評分,判斷 EmailTag 與
 * 「AI 建議可發文」。關鍵字表匯出為常數便於調校與測試;
 * 未來接 LLM 時以此介面替換(同 TONE_REWRITES 的定位)。
 */
import type { EmailTag } from '../../types';

export interface ClassifyInput {
  senderName: string;
  senderLocal: string;
  senderDomain: string;
  subject: string;
  snippet: string;
}

export interface ClassifyResult {
  tag: EmailTag;
  suitable: boolean;
}

/** 常見免費信箱網域(用於「個人 vs 品牌」判斷)。 */
export const FREE_MAIL_DOMAINS: readonly string[] = [
  'gmail.com',
  'googlemail.com',
  'yahoo.com',
  'yahoo.com.tw',
  'outlook.com',
  'hotmail.com',
  'live.com',
  'icloud.com',
  'me.com',
  'protonmail.com',
  'proton.me',
];

/** 系統/自動通知常用的 local part。 */
export const NOREPLY_LOCALS: readonly string[] = [
  'noreply',
  'no-reply',
  'donotreply',
  'notifications',
  'notification',
  'calendar-notification',
  'mailer',
  'postmaster',
];

/** 商務合作窗口常用的 local part。 */
const COLLAB_LOCALS: readonly string[] = [
  'pr',
  'press',
  'marketing',
  'partnerships',
  'biz',
  'business',
  'collab',
  'cooperation',
];

export const TAG_KEYWORDS: Record<EmailTag, readonly string[]> = {
  合作邀約: ['合作', '業配', '邀約', '代言', '試用', '開箱', '報價', '介紹費', '廠商', 'collab', 'sponsorship', 'partnership'],
  讀者來信: ['請教', '想問', '想請問', '諮詢', '請問', '謝謝你', '謝謝您'],
  電子報: ['電子報', '週報', '本周精選', '本週精選', 'newsletter', 'digest', '取消訂閱', 'unsubscribe', 'vol.', 'issue'],
  活動通知: ['提醒', '通知', '已報名', '已排程', '活動', '直播', '分享會', '講座', 'webinar', 'event'],
};

/** 趨勢/靈感訊號(電子報是否「建議可發文」)。 */
export const SUITABLE_KEYWORDS: readonly string[] = [
  '趨勢',
  '正夯',
  '觀察',
  '排行',
  '精選',
  '推薦',
  '季節',
  '節日',
  '話題',
  'trend',
  'insight',
];

const CALENDAR_DOMAINS: readonly string[] = ['calendar.google.com', 'eventbrite.com', 'meetup.com'];

function countHits(text: string, words: readonly string[]): number {
  let hits = 0;
  for (const w of words) {
    if (text.includes(w.toLowerCase())) hits += 1;
  }
  return hits;
}

export function classifyEmail(input: ClassifyInput): ClassifyResult {
  const subject = input.subject.toLowerCase();
  const snippet = input.snippet.toLowerCase();
  // 寄件者名稱也納入比對(如「××電子報」「××通知」是很強的訊號)
  const text = `${input.senderName.toLowerCase()}\n${subject}\n${snippet}`;

  const isFree = FREE_MAIL_DOMAINS.includes(input.senderDomain);
  const local = input.senderLocal;
  const isNoreply =
    NOREPLY_LOCALS.includes(local) ||
    input.senderName.toLowerCase().includes('noreply') ||
    input.senderName.includes('通知');
  const isCollabLocal = COLLAB_LOCALS.includes(local);
  const isReply =
    subject.startsWith('re:') ||
    subject.startsWith('fw:') ||
    subject.startsWith('回覆');

  const scores: Record<EmailTag, number> = {
    合作邀約: countHits(text, TAG_KEYWORDS['合作邀約']),
    讀者來信: countHits(text, TAG_KEYWORDS['讀者來信']),
    電子報: countHits(text, TAG_KEYWORDS['電子報']),
    活動通知: countHits(text, TAG_KEYWORDS['活動通知']),
  };
  // 「第 N 期」型式的期數編號
  if (/第\s*\d+\s*期/.test(text)) scores['電子報'] += 1;

  // 網域/結構規則加分
  if (!isFree && (scores['合作邀約'] > 0 || isCollabLocal)) scores['合作邀約'] += 2;
  if (isFree && isReply) scores['讀者來信'] += 2;
  if (snippet.includes('取消訂閱') || snippet.includes('unsubscribe')) scores['電子報'] += 2;
  if (isNoreply || CALENDAR_DOMAINS.includes(input.senderDomain)) scores['活動通知'] += 2;

  let tag: EmailTag = (Object.keys(scores) as EmailTag[]).reduce((best, cur) =>
    scores[cur] > scores[best] ? cur : best,
  );
  if (Object.values(scores).every((s) => s === 0)) {
    tag = isNoreply ? '活動通知' : '電子報';
  }

  const hasTrend = countHits(text, SUITABLE_KEYWORDS) > 0;
  // 活動/系統通知一律不建議可發文;電子報需含趨勢訊號才建議
  const suitable =
    tag === '合作邀約' || tag === '讀者來信' || (tag === '電子報' && hasTrend);

  return { tag, suitable };
}
