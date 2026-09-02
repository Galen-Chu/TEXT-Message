/**
 * Threads 文字貼文發佈(兩步 container 流程;可注入 fetcher 測試):
 * 1. POST /{user_id}/threads(media_type=TEXT + text)→ container id
 * 2. POST /{user_id}/threads_publish(creation_id)→ 正式發佈
 */
import { THREADS_API_BASE, THREADS_TEXT_LIMIT } from '../config';
import type { Fetcher } from './oauth';

export interface PublishOutcome {
  /** Threads 貼文 id。 */
  id: string;
}

export function validateThreadsText(text: string): { ok: true } | { ok: false; reason: string } {
  const trimmed = text.trim();
  if (!trimmed) return { ok: false, reason: 'text is empty' };
  if (Array.from(trimmed).length > THREADS_TEXT_LIMIT) {
    return { ok: false, reason: `text exceeds ${THREADS_TEXT_LIMIT} characters` };
  }
  return { ok: true };
}

async function postForm(
  url: string,
  params: Record<string, string>,
  accessToken: string,
  fetcher: Fetcher,
): Promise<Record<string, unknown>> {
  const resp = await fetcher(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Bearer ${accessToken}`,
    },
    body: new URLSearchParams(params).toString(),
  });
  const text = await resp.text();
  let data: Record<string, unknown>;
  try {
    data = JSON.parse(text) as Record<string, unknown>;
  } catch {
    throw new Error(`threads api non-json response: ${text.slice(0, 200)}`);
  }
  if (!resp.ok) {
    throw new Error(`threads api ${url.split('/').pop()} failed: ${JSON.stringify(data).slice(0, 200)}`);
  }
  return data;
}

/** 建立文字 container,回傳 creation_id。 */
export async function createTextContainer(opts: {
  userId: string;
  text: string;
  accessToken: string;
}, fetcher: Fetcher = fetch): Promise<string> {
  const data = await postForm(
    `${THREADS_API_BASE}/${encodeURIComponent(opts.userId)}/threads`,
    { media_type: 'TEXT', text: opts.text },
    opts.accessToken,
    fetcher,
  );
  if (typeof data.id !== 'string') throw new Error('threads container: missing id');
  return data.id;
}

/** 以 creation_id 正式發佈,回傳貼文 id。 */
export async function publishContainer(opts: {
  userId: string;
  creationId: string;
  accessToken: string;
}, fetcher: Fetcher = fetch): Promise<string> {
  const data = await postForm(
    `${THREADS_API_BASE}/${encodeURIComponent(opts.userId)}/threads_publish`,
    { creation_id: opts.creationId },
    opts.accessToken,
    fetcher,
  );
  if (typeof data.id !== 'string') throw new Error('threads publish: missing id');
  return data.id;
}

/** 完整流程:驗證 → container → publish。 */
export async function publishThreadsText(opts: {
  userId: string;
  text: string;
  accessToken: string;
}, fetcher: Fetcher = fetch): Promise<PublishOutcome> {
  const check = validateThreadsText(opts.text);
  if (!check.ok) throw new Error(check.reason);
  const creationId = await createTextContainer(opts, fetcher);
  const id = await publishContainer({ ...opts, creationId }, fetcher);
  return { id };
}
