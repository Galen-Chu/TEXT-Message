import { describe, expect, it } from 'vitest';
import { mapGmailMessage } from './mapToEmail';
import type { GmailMessage, GmailMimePart } from './types';

function b64url(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = '';
  bytes.forEach((b) => (binary += String.fromCharCode(b)));
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function message(overrides: {
  payload: GmailMimePart;
  internalDate?: string;
  snippet?: string;
  id?: string;
  labelIds?: string[];
}): GmailMessage {
  return {
    id: overrides.id ?? 'm1',
    threadId: 't1',
    internalDate: overrides.internalDate ?? String(Date.now()),
    snippet: overrides.snippet,
    labelIds: overrides.labelIds,
    payload: overrides.payload,
  };
}

describe('mapGmailMessage', () => {
  it('完整 fixture:全欄位正確', () => {
    const encodedSubject = `=?UTF-8?B?${b64url('本週旅遊趨勢:小島慢活正夯')}?=`;
    const msg = message({
      snippet: '今年夏天,越來越多人選擇離島慢活 取代打卡行程',
      labelIds: ['INBOX', 'Label_123'],
      payload: {
        mimeType: 'multipart/alternative',
        headers: [
          { name: 'From', value: `=?UTF-8?B?${b64url('換日線電子報')}?= <news@crossing.example>` },
          { name: 'Subject', value: encodedSubject },
        ],
        parts: [{ mimeType: 'text/plain', body: { data: b64url('嗨,小日:\n本週電子報想分享離島慢活趨勢。\n取消訂閱請點此') } }],
      },
    });
    const email = mapGmailMessage(msg);
    expect(email.id).toBe('m1');
    expect(email.sender).toBe('換日線電子報');
    expect(email.initial).toBe('換');
    expect(email.subject).toBe('本週旅遊趨勢:小島慢活正夯');
    expect(email.snippet).toContain('離島慢活');
    expect(email.fullBody).toContain('取消訂閱');
    expect(email.labelIds).toEqual(['INBOX', 'Label_123']);
    expect(email.senderEmail).toBe('news@crossing.example');
    // encoded-word 解碼後才分類:趨勢關鍵字 → 電子報 + suitable
    expect(email.tag).toBe('電子報');
    expect(email.suitable).toBe(true);
  });

  it('internalDate 跨年 → YYYY/M/D;今年 → M/D', () => {
    const payload: GmailMimePart = {
      mimeType: 'text/plain',
      headers: [{ name: 'From', value: 'a@b.example' }],
      body: { data: b64url('x') },
    };
    const thisYear = new Date();
    const e1 = mapGmailMessage(message({ payload, internalDate: String(thisYear.getTime()) }));
    expect(e1.date).toBe(`${thisYear.getMonth() + 1}/${thisYear.getDate()}`);

    const lastYear = new Date(thisYear.getFullYear() - 1, 6, 13);
    const e2 = mapGmailMessage(message({ payload, internalDate: String(lastYear.getTime()) }));
    expect(e2.date).toBe(`${lastYear.getFullYear()}/7/13`);
  });

  it('缺 internalDate → 退回 Date header', () => {
    const payload: GmailMimePart = {
      mimeType: 'text/plain',
      headers: [
        { name: 'From', value: 'a@b.example' },
        { name: 'Date', value: 'Mon, 13 Jul 2026 08:00:00 +0800' },
      ],
      body: { data: b64url('x') },
    };
    const email = mapGmailMessage({ id: 'm2', threadId: 't', payload });
    expect(email.date).toBe('7/13');
  });

  it('缺 Subject → (無主旨)', () => {
    const payload: GmailMimePart = {
      mimeType: 'text/plain',
      headers: [{ name: 'From', value: 'a@b.example' }],
      body: { data: b64url('內文') },
    };
    expect(mapGmailMessage(message({ payload })).subject).toBe('(無主旨)');
  });

  it('From 無顯示名稱 → local part 為寄件者、initial 大寫', () => {
    const payload: GmailMimePart = {
      mimeType: 'text/plain',
      headers: [{ name: 'From', value: 'wenwen@gmail.com' }],
      body: { data: b64url('想請問民宿') },
    };
    const email = mapGmailMessage(message({ payload }));
    expect(email.sender).toBe('wenwen');
    expect(email.initial).toBe('W');
  });

  it('內文超過截斷上限 → 截斷加省略號', () => {
    const long = '很長'.repeat(6000); // 12000 字
    const payload: GmailMimePart = {
      mimeType: 'text/plain',
      headers: [{ name: 'From', value: 'a@b.example' }],
      body: { data: b64url(long) },
    };
    const email = mapGmailMessage(message({ payload }));
    expect(email.fullBody.length).toBeLessThanOrEqual(10001); // 10000 + 省略號
    expect(email.fullBody.endsWith('…')).toBe(true);
  });

  it('缺 snippet → 由內文前 90 字補', () => {
    const payload: GmailMimePart = {
      mimeType: 'text/plain',
      headers: [{ name: 'From', value: 'a@b.example' }],
      body: { data: b64url('這是內文的開頭部分,用來驗證 snippet 遞補邏輯') },
    };
    const email = mapGmailMessage(message({ payload, snippet: undefined }));
    expect(email.snippet).toBe('這是內文的開頭部分,用來驗證 snippet 遞補邏輯');
  });
});
