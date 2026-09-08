/**
 * Drive v3 REST(唯讀):文檔搜尋與純文字匯出。URL/query 組裝為純函式、
 * fetch 可注入(node 環境可測,同 gmailApi 慣例);token 由呼叫端傳入(僅記憶體)。
 */
import { fromHttpStatus } from './errors';

export const DRIVE_API_BASE = 'https://www.googleapis.com/drive/v3';

/** Google Docs 的 mimeType。 */
export const DOCS_MIME = 'application/vnd.google-apps.document';

export interface DriveDocSummary {
  id: string;
  name: string;
  mimeType: string;
  /** ISO(修改時間);舊檔可能缺。 */
  modifiedTime?: string;
}

export type Fetcher = (url: string, init?: RequestInit) => Promise<Response>;

/**
 * 搜尋清單查詢(DRIVE-PLAN D3):名稱包含關鍵字、僅 Docs 與純文字檔、排除垃圾筒。
 * query 為空 = 列出全部(依修改時間新→舊)。
 */
export function buildListQuery(query: string): string {
  const parts = [
    'trashed = false',
    `(${DOCS_MIME.replace(/[/]/g, '\\/')} = mimeType or mimeType = 'text/plain')`,
  ];
  const q = query.trim();
  if (q) parts.push(`name contains '${q.replace(/'/g, "\\'")}'`);
  return parts.join(' and ');
}

function authHeaders(token: string): Record<string, string> {
  return { Authorization: `Bearer ${token}` };
}

async function readError(resp: Response): Promise<never> {
  throw fromHttpStatus(resp.status, await resp.text());
}

/** 搜尋文檔清單(每頁 50 筆,新→舊)。 */
export async function listDriveDocs(
  opts: { token: string; query?: string; pageToken?: string },
  fetcher: Fetcher = fetch,
): Promise<{ docs: DriveDocSummary[]; nextPageToken?: string }> {
  const params = new URLSearchParams({
    q: buildListQuery(opts.query ?? ''),
    fields: 'nextPageToken, files(id, name, mimeType, modifiedTime)',
    orderBy: 'modifiedTime desc',
    pageSize: '50',
  });
  if (opts.pageToken) params.set('pageToken', opts.pageToken);
  const resp = await fetcher(`${DRIVE_API_BASE}/files?${params.toString()}`, {
    headers: authHeaders(opts.token),
  });
  if (!resp.ok) await readError(resp);
  const data = (await resp.json()) as {
    files?: Array<{ id: string; name: string; mimeType: string; modifiedTime?: string }>;
    nextPageToken?: string;
  };
  return {
    docs: (data.files ?? []).map((f) => ({
      id: f.id,
      name: f.name,
      mimeType: f.mimeType,
      modifiedTime: f.modifiedTime,
    })),
    nextPageToken: data.nextPageToken,
  };
}

/**
 * 匯出文檔純文字:Google Docs 走 export 端點,text/plain 檔直接 alt=media(D3)。
 */
export async function exportDocText(
  opts: { token: string; doc: Pick<DriveDocSummary, 'id' | 'mimeType'> },
  fetcher: Fetcher = fetch,
): Promise<string> {
  const url =
    opts.doc.mimeType === DOCS_MIME
      ? `${DRIVE_API_BASE}/files/${encodeURIComponent(opts.doc.id)}/export?mimeType=${encodeURIComponent('text/plain')}`
      : `${DRIVE_API_BASE}/files/${encodeURIComponent(opts.doc.id)}?alt=media`;
  const resp = await fetcher(url, { headers: authHeaders(opts.token) });
  if (!resp.ok) await readError(resp);
  return resp.text();
}
