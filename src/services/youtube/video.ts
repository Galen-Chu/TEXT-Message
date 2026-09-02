/**
 * 影片中繼資料組裝與發佈計畫解析(純邏輯,node 環境可測)。
 * YouTube 的標題/說明限制以 UTF-8 位元組計(中文 3 bytes/字),不是字數。
 */
import { YoutubeError } from './errors';

export const YT_TITLE_MAX_BYTES = 100;
export const YT_DESCRIPTION_MAX_BYTES = 5000;

/** 以 UTF-8 位元組為單位截斷,完整保留 code point(不切壞中文字/emoji)。 */
export function clampUtf8(text: string, maxBytes: number): string {
  const encoder = new TextEncoder();
  let out = '';
  let used = 0;
  for (const ch of text) {
    const size = encoder.encode(ch).length;
    if (used + size > maxBytes) break;
    out += ch;
    used += size;
  }
  return out;
}

export type PrivacyStatus = 'public' | 'private' | 'unlisted';

/** videos.insert 的 snippet+status 中繼資料(送進 resumable session 起始請求)。 */
export interface VideoMetadata {
  snippet: { title: string; description: string; categoryId: string };
  status: {
    privacyStatus: PrivacyStatus;
    selfDeclaredMadeForKids: false;
    /** 僅 privacyStatus 為 private 時有效:到點後 YouTube 自動轉公開。 */
    publishAt?: string;
  };
}

export function buildVideoMetadata(input: {
  title: string;
  description: string;
  privacyStatus: PrivacyStatus;
  publishAt?: string;
}): VideoMetadata {
  const metadata: VideoMetadata = {
    snippet: {
      title: clampUtf8(input.title.trim() || '未命名影片', YT_TITLE_MAX_BYTES),
      description: clampUtf8(input.description, YT_DESCRIPTION_MAX_BYTES),
      categoryId: '22', // People & Blogs
    },
    status: { privacyStatus: input.privacyStatus, selfDeclaredMadeForKids: false },
  };
  if (input.publishAt && input.privacyStatus === 'private') {
    metadata.status.publishAt = input.publishAt;
  }
  return metadata;
}

export type PublishPlan =
  | { mode: 'now'; privacyStatus: 'public' }
  | { mode: 'schedule'; privacyStatus: 'private'; publishAt: string; date: string; time: string };

/**
 * 解析發佈計畫:'now' 立即公開;'schedule' 以 private+publishAt 預約
 * (YouTube 原生排程——零後端,到點由 YouTube 自動公開)。
 * publishAtLocal 為 datetime-local 值(YYYY-MM-DDTHH:mm);時間已過則拒絕。
 */
export function resolvePublishPlan(
  mode: 'now' | 'schedule',
  publishAtLocal: string,
  now: Date = new Date(),
): PublishPlan {
  if (mode === 'now') return { mode: 'now', privacyStatus: 'public' };
  const dt = new Date(publishAtLocal);
  if (!publishAtLocal || Number.isNaN(dt.getTime()) || dt.getTime() <= now.getTime()) {
    throw new YoutubeError('invalid_request', `past or empty publishAt: ${publishAtLocal}`);
  }
  return {
    mode: 'schedule',
    privacyStatus: 'private',
    publishAt: dt.toISOString(),
    date: publishAtLocal.slice(0, 10),
    time: publishAtLocal.slice(11, 16),
  };
}

/** 供 UI 顯示:影片檔案大小(MB,一位小數)。 */
export function fileSizeMb(bytes: number): string {
  return (bytes / 1024 / 1024).toFixed(1);
}
