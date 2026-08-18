/** 建置期環境設定;全專案唯一讀取 import.meta.env 的地方。 */

export const GMAIL_CLIENT_ID: string = (import.meta.env.VITE_GMAIL_CLIENT_ID ?? '').trim();

/** 未設定 Client ID 時為 false:畫面不出現任何 Gmail 連線元素(純示範模式建置)。 */
export const GMAIL_ENABLED: boolean = GMAIL_CLIENT_ID.length > 0;

export const GMAIL_SCOPE = 'https://www.googleapis.com/auth/gmail.readonly';

/** 收件匣清單查詢:近 7 天收件匣郵件。 */
export const GMAIL_LIST_QUERY = 'in:inbox newer_than:7d';

export const GMAIL_MAX_RESULTS = 20;

/** 並行抓取單封郵件的併發上限。 */
export const GMAIL_FETCH_CONCURRENCY = 6;

/** 內文截斷上限(大型電子報防護)。 */
export const GMAIL_FULL_BODY_MAX_CHARS = 10000;
