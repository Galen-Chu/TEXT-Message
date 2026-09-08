/** 建置期環境設定(雲端列 Drive 模組);與 gmail/youtube 同一唯讀 env 哲學(DRIVE-PLAN D2)。 */

/**
 * OAuth 用戶端 ID:預設沿用 Gmail 的用戶端(自架者只需一個 Cloud 專案,
 * 且需在 OAuth 同意畫面加入 Drive 的唯讀範圍);需要獨立用戶端時可另設 VITE_DRIVE_CLIENT_ID。
 */
export const DRIVE_CLIENT_ID: string = (
  import.meta.env.VITE_DRIVE_CLIENT_ID ?? import.meta.env.VITE_GMAIL_CLIENT_ID ?? ''
).trim();

/** 未設定 Client ID 時為 false:雲端列不出現連接按鈕,顯示示範文檔(純示範模式建置,D5)。 */
export const DRIVE_ENABLED: boolean = DRIVE_CLIENT_ID.length > 0;

/** 最小權限:僅唯讀(同 Gmail 紅線哲学——不申請任何寫入範圍)。 */
export const DRIVE_READONLY_SCOPE = 'https://www.googleapis.com/auth/drive.readonly';
