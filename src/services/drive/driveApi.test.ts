import { describe, expect, it } from 'vitest';
import { DOCS_MIME, buildListQuery, exportDocText, listDriveDocs, type Fetcher } from './driveApi';

describe('buildListQuery', () => {
  it('僅 Docs 與純文字檔、排除垃圾筒;關鍵字進 name contains(引號轉義)', () => {
    const base = buildListQuery('');
    expect(base).toBe(
      "trashed = false and (mimeType = 'application/vnd.google-apps.document' or mimeType = 'text/plain')",
    );

    const q = buildListQuery("旅途's 記事");
    expect(q).toBe(
      "trashed = false and (mimeType = 'application/vnd.google-apps.document' or mimeType = 'text/plain')" +
        " and name contains '旅途\\'s 記事'",
    );
  });
});

describe('listDriveDocs', () => {
  it('組出正確 URL 與 headers,解析檔案清單與分頁 token', async () => {
    let captured = { url: '', auth: '' };
    const fetcher: Fetcher = async (url, init) => {
      const u = new URL(String(url));
      captured = {
        url: u.origin + u.pathname,
        auth: ((init?.headers ?? {}) as Record<string, string>)['Authorization'] ?? '',
      };
      expect(u.searchParams.get('orderBy')).toBe('modifiedTime desc');
      if (u.searchParams.get('pageToken') === 'p2') {
        expect(u.searchParams.get('q')).toBe(
          "trashed = false and (mimeType = 'application/vnd.google-apps.document' or mimeType = 'text/plain')",
        );
        return new Response(JSON.stringify({ files: [{ id: 'f2', name: 'B', mimeType: 'text/plain' }] }));
      }
      expect(u.searchParams.get('q')).toBe(
        "trashed = false and (mimeType = 'application/vnd.google-apps.document' or mimeType = 'text/plain') and name contains '遊記'",
      );
      return new Response(
        JSON.stringify({
          nextPageToken: 'p2',
          files: [
            { id: 'f1', name: 'A', mimeType: DOCS_MIME, modifiedTime: '2026-09-01T00:00:00Z' },
          ],
        }),
      );
    };

    const r1 = await listDriveDocs({ token: 'tok', query: '遊記' }, fetcher);
    expect(captured.url).toBe('https://www.googleapis.com/drive/v3/files');
    expect(captured.auth).toBe('Bearer tok');
    expect(r1.docs).toHaveLength(1);
    expect(r1.docs[0]).toEqual({
      id: 'f1',
      name: 'A',
      mimeType: DOCS_MIME,
      modifiedTime: '2026-09-01T00:00:00Z',
    });
    expect(r1.nextPageToken).toBe('p2');

    const r2 = await listDriveDocs({ token: 'tok', pageToken: 'p2' }, fetcher);
    expect(r2.docs[0].name).toBe('B');
    expect(r2.nextPageToken).toBeUndefined();
  });

  it('非 2xx 轉為 DriveError(帶對應 code)', async () => {
    const fetcher: Fetcher = async () => new Response('nope', { status: 401 });
    await expect(listDriveDocs({ token: 'bad' }, fetcher)).rejects.toMatchObject({
      name: 'DriveError',
      code: 'unauthorized',
    });
  });
});

describe('exportDocText', () => {
  it('Docs 走 export 端點;text/plain 走 alt=media', async () => {
    const urls: string[] = [];
    const fetcher: Fetcher = async (url) => {
      urls.push(String(url));
      return new Response('文章內容');
    };
    const a = await exportDocText({ token: 't', doc: { id: 'd1', mimeType: DOCS_MIME } }, fetcher);
    expect(a).toBe('文章內容');
    expect(urls[0]).toContain('/files/d1/export?mimeType=text%2Fplain');

    await exportDocText({ token: 't', doc: { id: 'd2', mimeType: 'text/plain' } }, fetcher);
    expect(urls[1]).toContain('/files/d2?alt=media');
  });
});
