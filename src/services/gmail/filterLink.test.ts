import { describe, expect, it } from 'vitest';
import { gmailFilterSearchUrl } from './filterLink';

describe('gmailFilterSearchUrl', () => {
  it('以 from: 查詢預填 Gmail 搜尋,email 正確編碼', () => {
    expect(gmailFilterSearchUrl('news@crossing.example')).toBe(
      `https://mail.google.com/mail/u/0/#search/${encodeURIComponent('from:news@crossing.example')}`,
    );
  });

  it('特殊字元的 email 完整編碼,不留未編碼符號', () => {
    const url = gmailFilterSearchUrl('a.b+c@example.com');
    expect(url).not.toContain('+');
    expect(url).toMatch(/^https:\/\/mail\.google\.com\/mail\/u\/0\/#search\/from%3A/);
  });
});
