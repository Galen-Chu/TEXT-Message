import { describe, expect, it } from 'vitest';
import { gmailComposeUrl } from './compose';

describe('gmailComposeUrl', () => {
  it('組出 Gmail 網頁版撰寫 URL(view=cm、全螢幕、收件人與主旨)', () => {
    const url = gmailComposeUrl('a@example.com', 'Hello');
    expect(url.startsWith('https://mail.google.com/mail/?')).toBe(true);
    expect(url).toContain('view=cm');
    expect(url).toContain('fs=1');
    expect(url).toContain('to=a%40example.com');
    expect(url).toContain('su=Hello');
    expect(url).not.toContain('body=');
  });

  it('有內文時附加 body 參數', () => {
    const url = gmailComposeUrl('a@example.com', 'S', 'B');
    expect(url).toContain('body=B');
  });

  it('中文與特殊字元正確編碼(不產生裸 CJK)', () => {
    const url = gmailComposeUrl('someone@gmail.com', '測試電子報:本週精選', '第一行\n第二行');
    expect(url).not.toMatch(/[一-鿿]/);
    expect(decodeURIComponent(url)).toContain('測試電子報:本週精選');
  });
});
