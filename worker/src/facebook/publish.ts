/**
 * FB 粉專文字貼文發佈(單步 POST /{page-id}/feed;可注入 fetcher 測試)。
 * 與 Threads 的兩步 container 流程不同,FB 文字貼文一步完成:message 參數 + page token。
 * 文件(2026-09-30 查證):https://developers.facebook.com/docs/graph-api/reference/page/feed/
 */
import { FACEBOOK_API_BASE, FACEBOOK_TEXT_LIMIT } from '../config';
import type { Fetcher } from '../threads/oauth';

export interface PublishOutcome {
  /** FB 貼文 id(格式 `<pageId>_<postId>`)。 */
  id: string;
}

export function validateFacebookText(text: string): { ok: true } | { ok: false; reason: string } {
  const trimmed = text.trim();
  if (!trimmed) return { ok: false, reason: 'text is empty' };
  if (Array.from(trimmed).length > FACEBOOK_TEXT_LIMIT) {
    return { ok: false, reason: `text exceeds ${FACEBOOK_TEXT_LIMIT} characters` };
  }
  return { ok: true };
}

/**
 * 參數以 URL 查詢字串送出(與 threads/publish.ts 同款):Meta 對表單 body 的
 * 非 ASCII 有 Latin-1 解碼失真問題,URL 查詢字串依規範以 UTF-8 百分號編碼(§6.1 #6)。
 */
export async function publishFacebookText(opts: {
  pageId: string;
  text: string;
  accessToken: string;
}, fetcher: Fetcher = fetch): Promise<PublishOutcome> {
  const check = validateFacebookText(opts.text);
  if (!check.ok) throw new Error(check.reason);
  const params = new URLSearchParams({ message: opts.text });
  const resp = await fetcher(
    `${FACEBOOK_API_BASE}/${encodeURIComponent(opts.pageId)}/feed?${params.toString()}`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${opts.accessToken}` },
    },
  );
  const text = await resp.text();
  let data: Record<string, unknown>;
  try {
    data = JSON.parse(text) as Record<string, unknown>;
  } catch {
    throw new Error(`facebook api non-json response: ${text.slice(0, 200)}`);
  }
  if (!resp.ok) {
    throw new Error(`facebook feed failed: ${JSON.stringify(data).slice(0, 200)}`);
  }
  // 貼文 id 為 `<pageId>_<postId>`:依紀律從原始文字抽取(JSON number 會失真)
  const id = /"id"\s*:\s*"?(\d+_\d+)"?/.exec(text)?.[1] ?? '';
  if (!id) throw new Error('facebook feed: missing id');
  return { id };
}
