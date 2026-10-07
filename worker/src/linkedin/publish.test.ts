import { describe, expect, it } from 'vitest';
import { LINKEDIN_API_BASE, LINKEDIN_TEXT_LIMIT, LINKEDIN_VERSION } from '../config';
import { buildLinkedInPostBody, publishLinkedInText, validateLinkedInText } from './publish';
import type { Fetcher } from '../threads/oauth';

describe('validateLinkedInText', () => {
  it('空白 → 不通過;超過 3000 字 → 不通過', () => {
    expect(validateLinkedInText('  ').ok).toBe(false);
    expect(validateLinkedInText('x'.repeat(LINKEDIN_TEXT_LIMIT + 1)).ok).toBe(false);
    expect(validateLinkedInText('hello').ok).toBe(true);
  });
});

describe('buildLinkedInPostBody(官方文字貼文 schema)', () => {
  it('author=urn:li:person:{id};commentary/visibility/distribution/lifecycleState 齊全', () => {
    const b = buildLinkedInPostBody('abc123', '你好,LinkedIn');
    expect(b.author).toBe('urn:li:person:abc123');
    expect(b.commentary).toBe('你好,LinkedIn');
    expect(b.visibility).toBe('PUBLIC');
    expect(b.distribution).toEqual({
      feedDistribution: 'MAIN_FEED',
      targetEntities: [],
      thirdPartyDistributionChannels: [],
    });
    expect(b.lifecycleState).toBe('PUBLISHED');
    expect(b.isReshareDisabledByAuthor).toBe(false);
  });
});

describe('publishLinkedInText(POST /rest/posts)', () => {
  it('完整請求形狀:三個必帶標頭(X-Restli/LinkedIn-Version/Content-Type)+Bearer;貼文 id 取自 x-restli-id 標頭', async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    const fetcher: Fetcher = async (url, init) => {
      calls.push({ url: String(url), init });
      return new Response('', {
        status: 201,
        headers: { 'x-restli-id': 'urn:li:share:6844785523593134080' },
      });
    };
    const r = await publishLinkedInText({ memberId: 'abc123', text: '第一則測試', accessToken: 'li-at' }, fetcher);
    expect(r).toEqual({ id: 'urn:li:share:6844785523593134080' });
    expect(calls[0].url).toBe(`${LINKEDIN_API_BASE}/rest/posts`);
    const headers = calls[0].init?.headers as Record<string, string>;
    expect(calls[0].init?.method).toBe('POST');
    expect(headers.Authorization).toBe('Bearer li-at');
    expect(headers['X-Restli-Protocol-Version']).toBe('2.0.0');
    expect(headers['LinkedIn-Version']).toBe(LINKEDIN_VERSION);
    expect(headers['Content-Type']).toBe('application/json');
    const body = JSON.parse(String(calls[0].init?.body)) as { commentary: string; author: string };
    expect(body.commentary).toBe('第一則測試');
    expect(body.author).toBe('urn:li:person:abc123');
  });

  it('缺 x-restli-id 標頭 → 丟錯;API 錯誤 → 丟錯附摘錄;空白文字先行驗證', async () => {
    const noId: Fetcher = async () => new Response('', { status: 201 });
    await expect(
      publishLinkedInText({ memberId: 'm', text: 't', accessToken: 'a' }, noId),
    ).rejects.toThrow('missing x-restli-id');

    const err: Fetcher = async () => new Response('{"message":"Access denied"}', { status: 403 });
    await expect(
      publishLinkedInText({ memberId: 'm', text: 't', accessToken: 'a' }, err),
    ).rejects.toThrow('posts failed');

    const noop: Fetcher = async () => {
      throw new Error('should not be called');
    };
    await expect(
      publishLinkedInText({ memberId: 'm', text: ' ', accessToken: 'a' }, noop),
    ).rejects.toThrow('empty');
  });
});
