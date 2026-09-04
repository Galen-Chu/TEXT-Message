import { describe, expect, it } from 'vitest';
import {
  cancelThreadsQueueItem,
  checkThreadsStatus,
  listThreadsQueue,
  publishThreadsNow,
  scheduleThreadsPost,
  threadsAuthStartUrl,
  type Fetcher,
} from './client';

const BASE = 'https://worker.example';
const INSTALL = 'ins-abc123def456';

function okFetcher(data: unknown): Fetcher {
  return async () => new Response(JSON.stringify(data), { status: 200 });
}

describe('threadsAuthStartUrl', () => {
  it('組出 install 參數編碼的授權起始 URL', () => {
    expect(threadsAuthStartUrl(BASE, INSTALL)).toBe(
      `${BASE}/auth/threads/start?install=${encodeURIComponent(INSTALL)}`,
    );
  });
});

describe('requestJson(經各 API 驗證)', () => {
  it('status:成功解析 connected;404 not_connected 對應錯誤碼', async () => {
    expect(
      await checkThreadsStatus({ base: BASE, installId: INSTALL, fetcher: okFetcher({ connected: true }) }),
    ).toEqual({ ok: true, data: { connected: true } });

    const notConnected: Fetcher = async () =>
      new Response(JSON.stringify({ error: 'not_connected' }), { status: 404 });
    const r = await checkThreadsStatus({ base: BASE, installId: INSTALL, fetcher: notConnected });
    expect(r).toEqual({ ok: false, code: 'not_connected' });
  });

  it('publish:POST 帶正確 body;5xx → unknown;網路錯誤 → network', async () => {
    let captured = { url: '', body: '' };
    const fetcher: Fetcher = async (url, init) => {
      captured = { url: String(url), body: String(init?.body ?? '') };
      return new Response(JSON.stringify({ id: 'post-1' }), { status: 200 });
    };
    const r = await publishThreadsNow({ base: BASE, installId: INSTALL, text: '貼文', fetcher });
    expect(r).toEqual({ ok: true, data: { id: 'post-1' } });
    expect(captured.url).toBe(`${BASE}/api/threads/publish`);
    expect(JSON.parse(captured.body)).toEqual({ installId: INSTALL, text: '貼文' });

    const serverErr: Fetcher = async () => new Response('boom', { status: 502 });
    expect(
      await publishThreadsNow({ base: BASE, installId: INSTALL, text: 'x', fetcher: serverErr }),
    ).toEqual({ ok: false, code: 'unknown' });

    const netErr: Fetcher = async () => {
      throw new TypeError('offline');
    };
    expect(
      await publishThreadsNow({ base: BASE, installId: INSTALL, text: 'x', fetcher: netErr }),
    ).toEqual({ ok: false, code: 'network' });
  });

  it('schedule:publishAt(ms)正確傳遞', async () => {
    let body = '';
    const fetcher: Fetcher = async (_url, init) => {
      body = String(init?.body ?? '');
      return new Response(JSON.stringify({ itemId: 'q1' }), { status: 201 });
    };
    const r = await scheduleThreadsPost({
      base: BASE,
      installId: INSTALL,
      text: '預約',
      publishAt: 1893456000000,
      fetcher,
    });
    expect(r).toEqual({ ok: true, data: { itemId: 'q1' } });
    expect(JSON.parse(body)).toEqual({ installId: INSTALL, text: '預約', publishAt: 1893456000000 });
  });

  it('queue:清單解析與取消', async () => {
    const items = [
      { id: 'q1', text: 'a', publishAt: 1, status: 'pending', attempts: 0 },
    ];
    expect(
      await listThreadsQueue({ base: BASE, installId: INSTALL, fetcher: okFetcher({ items }) }),
    ).toEqual({ ok: true, data: { items } });
    expect(
      await cancelThreadsQueueItem({ base: BASE, installId: INSTALL, itemId: 'q1', fetcher: okFetcher({ ok: true }) }),
    ).toEqual({ ok: true, data: { ok: true } });
  });

  it('非 JSON 錯誤回應不爆,對應 unknown', async () => {
    const bad: Fetcher = async () => new Response('<html>', { status: 500 });
    expect(
      await listThreadsQueue({ base: BASE, installId: INSTALL, fetcher: bad }),
    ).toEqual({ ok: false, code: 'unknown' });
  });
});
