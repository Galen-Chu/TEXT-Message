/** 建置期環���設定(YouTube 模組);與 gmail/config.ts 同一唯讀 env 哲學。 */

/**
 * OAuth 用戶端 ID:預設沿用 Gmail 的用戶端(自架者只需一個 Cloud 專案);
 * 需要獨立用戶端時可另設 VITE_YOUTUBE_CLIENT_ID。專案需啟用 YouTube Data API v3。
 */
export const YOUTUBE_CLIENT_ID: string = (
  import.meta.env.VITE_YOUTUBE_CLIENT_ID ?? import.meta.env.VITE_GMAIL_CLIENT_ID ?? ''
).trim();

/** 未設定 Client ID 時為 false:草稿頁不出現 YouTube 上傳區(純示範模式建置)。 */
export const YOUTUBE_ENABLED: boolean = YOUTUBE_CLIENT_ID.length > 0;

/** 最小權限:僅上傳(不含讀取頻道資料的 readonly scope)。 */
export const YOUTUBE_UPLOAD_SCOPE = 'https://www.googleapis.com/auth/youtube.upload';

/** Resumable 上傳起始端點(回應 Location 標頭為上傳作��� URL)。 */
export const YOUTUBE_UPLOAD_URL =
  'https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status';
