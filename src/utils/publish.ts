import type { PlatformKey } from '../types';

export interface PublishTarget {
  url: string;
  /** true = 網址已帶入貼文文字(Threads/X intent);false = 僅開啟平台頁,需手動貼上 */
  canPrefill: boolean;
}

/**
 * 發佈輔助(半自動模式):Threads 提供 web intent 可預填文字;
 * FB 分享器僅接受網址、IG 無網頁 intent、LINE 個人動態無 API、YouTube 影片走
 * 草稿頁上傳(此處開啟 Studio)——皆僅開啟平台頁,內容先複製到剪貼簿由使用者貼上。
 */
export function buildPublishTarget(platform: PlatformKey, text: string): PublishTarget {
  const encoded = encodeURIComponent(text);
  switch (platform) {
    case 'threads':
      return { url: `https://www.threads.net/intent/post?text=${encoded}`, canPrefill: true };
    case 'fb':
      return { url: 'https://www.facebook.com/', canPrefill: false };
    case 'ig':
      return { url: 'https://www.instagram.com/', canPrefill: false };
    case 'line':
      return { url: 'https://line.me/', canPrefill: false };
    case 'yt':
      return { url: 'https://studio.youtube.com/', canPrefill: false };
  }
}
