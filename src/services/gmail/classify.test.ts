import { describe, expect, it } from 'vitest';
import { classifyEmail, type ClassifyInput } from './classify';

function input(overrides: Partial<ClassifyInput>): ClassifyInput {
  return {
    senderName: '',
    senderLocal: '',
    senderDomain: '',
    subject: '',
    snippet: '',
    ...overrides,
  };
}

describe('classifyEmail', () => {
  it('品牌網域 + 業配主旨 → 合作邀約,且 suitable', () => {
    const r = classifyEmail(
      input({ senderName: '光影香氛 Studio', senderLocal: 'marketing', senderDomain: 'studio.example', subject: '業配邀約:新品香氛蠟燭試用', snippet: '想邀請你試用並分享真實使用心得' }),
    );
    expect(r.tag).toBe('合作邀約');
    expect(r.suitable).toBe(true);
  });

  it('非免費信箱網域 + 內文含 試用/開箱 → 合作邀約', () => {
    const r = classifyEmail(
      input({ senderDomain: 'brand.example', subject: '新產品上市', snippet: '歡迎申請試用,並且開箱分享' }),
    );
    expect(r.tag).toBe('合作邀約');
  });

  it('gmail.com + Re: + 提問 → 讀者來信,且 suitable', () => {
    const r = classifyEmail(
      input({ senderLocal: 'wenwen', senderDomain: 'gmail.com', subject: 'Re: 上次分享的行程好詳細!', snippet: '想請問你推薦的民宿還有營業嗎?' }),
    );
    expect(r.tag).toBe('讀者來信');
    expect(r.suitable).toBe(true);
  });

  it('snippet 含 取消訂閱 → 電子報', () => {
    const r = classifyEmail(
      input({ senderDomain: 'news.example', subject: '本週精選', snippet: '……全文請見網站。取消訂閱' }),
    );
    expect(r.tag).toBe('電子報');
  });

  it('主旨「第 52 期」→ 電子報', () => {
    const r = classifyEmail(input({ senderDomain: 'weekly.example', subject: '第 52 期:慢活週報', snippet: '祝閱讀愉快' }));
    expect(r.tag).toBe('電子報');
  });

  it('noreply + 提醒 → 活動通知,且不 suitable', () => {
    const r = classifyEmail(
      input({ senderLocal: 'noreply', senderDomain: 'calendar.google.com', subject: '提醒:下週三「創作者線上分享會」', snippet: '你已報名參加' }),
    );
    expect(r.tag).toBe('活動通知');
    expect(r.suitable).toBe(false);
  });

  it('calendar.google.com 寄件 → 活動通知', () => {
    const r = classifyEmail(input({ senderDomain: 'calendar.google.com', subject: '已排程:會議', snippet: '時間異動通知' }));
    expect(r.tag).toBe('活動通知');
  });

  it('優先序:noreply 寄件者 + 業配關鍵字 → 關鍵字分數勝出為 合作邀約', () => {
    const r = classifyEmail(
      input({ senderLocal: 'noreply', senderDomain: 'brand.example', subject: '合作提案', snippet: '業配內容說明' }),
    );
    expect(r.tag).toBe('合作邀約');
  });

  it('電子報含趨勢詞 → suitable true;純電子報 → suitable false', () => {
    const withTrend = classifyEmail(input({ senderDomain: 'news.example', subject: '本週旅遊趨勢精選', snippet: '取消訂閱請點此' }));
    expect(withTrend.tag).toBe('電子報');
    expect(withTrend.suitable).toBe(true);

    const plain = classifyEmail(input({ senderDomain: 'news.example', subject: '電子報', snippet: '取消訂閱請點此' }));
    expect(plain.tag).toBe('電子報');
    expect(plain.suitable).toBe(false);
  });

  it('空輸入 → fallback 電子報(非 noreply)、不 suitable', () => {
    const r = classifyEmail(input({}));
    expect(r.tag).toBe('電子報');
    expect(r.suitable).toBe(false);
  });

  it('大小寫不敏感:COLLAB / Newsletter', () => {
    const r = classifyEmail(input({ senderDomain: 'shop.example', subject: 'COLLAB opportunity', snippet: 'Newsletter partnership' }));
    expect(r.tag).toBe('合作邀約');
  });

  it('免費信箱網域邊界:gmail.com 是免費、品牌網域不是', () => {
    const free = classifyEmail(input({ senderLocal: 'pr', senderDomain: 'gmail.com', subject: '合作邀約', snippet: '' }));
    // 免費網域不吃品牌加分,但仍有關鍵字分
    expect(free.tag).toBe('合作邀約');
  });
});
