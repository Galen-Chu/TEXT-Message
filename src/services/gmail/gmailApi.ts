/**
 * Gmail REST API 存取層:純 fetch + Bearer token,每個函式都吃 token
 * (無模組狀態,易於測試)。CORS 由 gmail.googleapis.com 原生支援。
 */
import { GMAIL_FETCH_CONCURRENCY, GMAIL_LIST_QUERY, GMAIL_MAX_RESULTS } from './config';
import { fromHttpStatus, GmailError, toGmailError } from './errors';
import type { GmailMessage, GmailMessageListResponse, GmailProfile } from './types';

const API = 'https://gmail.googleapis.com/gmail/v1/users/me';

function authHeaders(token: string): Record<string, string> {
  return { Authorization: `Bearer ${token}` };
}

async function fetchGmail<T>(url: string, token: string): Promise<T> {
  let resp: Response;
  try {
    resp = await fetch(url, { headers: authHeaders(token) });
  } catch (err) {
    throw err instanceof TypeError ? new GmailError('network') : toGmailError(err);
  }
  // 5xx / 429:退避 300ms 重試一次
  if (resp.status >= 500 || resp.status === 429) {
    await new Promise((r) => setTimeout(r, 300));
    try {
      resp = await fetch(url, { headers: authHeaders(token) });
    } catch {
      throw new GmailError('network');
    }
  }
  if (!resp.ok) {
    const bodyText = await resp.text().catch(() => '');
    throw fromHttpStatus(resp.status, bodyText);
  }
  try {
    return (await resp.json()) as T;
  } catch {
    throw new GmailError('parse');
  }
}

export async function fetchProfile(token: string): Promise<GmailProfile> {
  return fetchGmail<GmailProfile>(`${API}/profile`, token);
}

/** 近 7 天收件匣的郵件 id 清單頁(依 Gmail 預設 newest first;nextPageToken 供載入更多)。 */
export async function listMessageIds(
  token: string,
  pageToken?: string,
): Promise<{ ids: string[]; nextPageToken: string | null }> {
  const params = new URLSearchParams({
    maxResults: String(GMAIL_MAX_RESULTS),
    q: GMAIL_LIST_QUERY,
  });
  if (pageToken) params.set('pageToken', pageToken);
  const data = await fetchGmail<GmailMessageListResponse>(`${API}/messages?${params}`, token);
  return {
    ids: (data.messages ?? []).map((m) => m.id),
    nextPageToken: data.nextPageToken ?? null,
  };
}

/** 逐封抓取完整郵件;併發受限,單封失敗跳過(不讓整批失敗)。 */
export async function fetchMessages(token: string, ids: string[]): Promise<GmailMessage[]> {
  const results: Array<GmailMessage | null> = new Array(ids.length).fill(null);
  let cursor = 0;
  const worker = async () => {
    while (cursor < ids.length) {
      const i = cursor++;
      try {
        results[i] = await fetchGmail<GmailMessage>(`${API}/messages/${ids[i]}?format=full`, token);
      } catch {
        // 單封失敗:跳過該封
      }
    }
  };
  await Promise.all(
    Array.from({ length: Math.min(GMAIL_FETCH_CONCURRENCY, Math.max(ids.length, 1)) }, worker),
  );
  return results.filter((m): m is GmailMessage => m !== null);
}
