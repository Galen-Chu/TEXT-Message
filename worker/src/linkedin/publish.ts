/**
 * LinkedIn 個人檔案文字貼文(單步 POST /rest/posts;可注入 fetcher 測試)。
 * 文件(2026-10-07 查證):https://learn.microsoft.com/en-us/linkedin/marketing/community-management/shares/posts-api
 * 必帶標頭:X-Restli-Protocol-Version: 2.0.0、LinkedIn-Version: YYYYMM;
 * 貼文 id 在回應標頭 x-restli-id(非 body)。
 */
import { LINKEDIN_API_BASE, LINKEDIN_TEXT_LIMIT, LINKEDIN_VERSION } from '../config';
import type { Fetcher } from '../threads/oauth';

export interface PublishOutcome {
  /** LinkedIn 貼文 URN(如 urn:li:share:6844785523593134080)。 */
  id: string;
}

export function validateLinkedInText(text: string): { ok: true } | { ok: false; reason: string } {
  const trimmed = text.trim();
  if (!trimmed) return { ok: false, reason: 'text is empty' };
  if (Array.from(trimmed).length > LINKEDIN_TEXT_LIMIT) {
    return { ok: false, reason: `text exceeds ${LINKEDIN_TEXT_LIMIT} characters` };
  }
  return { ok: true };
}

/** 官方文字貼文 body(個人檔案:author=urn:li:person:{id})。 */
export function buildLinkedInPostBody(memberId: string, text: string): Record<string, unknown> {
  return {
    author: `urn:li:person:${memberId}`,
    commentary: text,
    visibility: 'PUBLIC',
    distribution: {
      feedDistribution: 'MAIN_FEED',
      targetEntities: [],
      thirdPartyDistributionChannels: [],
    },
    lifecycleState: 'PUBLISHED',
    isReshareDisabledByAuthor: false,
  };
}

export async function publishLinkedInText(opts: {
  memberId: string;
  text: string;
  accessToken: string;
}, fetcher: Fetcher = fetch): Promise<PublishOutcome> {
  const check = validateLinkedInText(opts.text);
  if (!check.ok) throw new Error(check.reason);
  const resp = await fetcher(`${LINKEDIN_API_BASE}/rest/posts`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${opts.accessToken}`,
      'X-Restli-Protocol-Version': '2.0.0',
      'LinkedIn-Version': LINKEDIN_VERSION,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(buildLinkedInPostBody(opts.memberId, opts.text)),
  });
  const text = await resp.text();
  if (!resp.ok) {
    throw new Error(`linkedin posts failed: ${text.slice(0, 200)}`);
  }
  const id = resp.headers.get('x-restli-id') ?? '';
  if (!id) throw new Error('linkedin posts: missing x-restli-id header');
  return { id };
}
