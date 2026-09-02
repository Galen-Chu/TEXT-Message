import { describe, expect, it } from 'vitest';
import { buildPublishTarget } from './publish';

describe('buildPublishTarget', () => {
  it('Threads 用 intent 網址預填文字', () => {
    expect(buildPublishTarget('threads', '你好 世界')).toEqual({
      url: `https://www.threads.net/intent/post?text=${encodeURIComponent('你好 世界')}`,
      canPrefill: true,
    });
  });

  it('特殊字元(換行/emoji)正確編碼,不產生未編碼空白', () => {
    const { url } = buildPublishTarget('threads', '第一行\n第二行 ✨');
    expect(url).not.toContain('\n');
    expect(url).toContain(encodeURIComponent('第一行\n第二行 ✨'));
  });

  it('FB/IG/LINE 無法預填文字,僅開啟平台頁', () => {
    expect(buildPublishTarget('fb', '內容')).toEqual({
      url: 'https://www.facebook.com/',
      canPrefill: false,
    });
    expect(buildPublishTarget('ig', '內容')).toEqual({
      url: 'https://www.instagram.com/',
      canPrefill: false,
    });
    expect(buildPublishTarget('line', '內容')).toEqual({
      url: 'https://line.me/',
      canPrefill: false,
    });
  });
});
