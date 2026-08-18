/** Gmail REST API 回應的最小 DTO(手寫,不引入 API client 套件)。 */

export interface GmailProfile {
  emailAddress: string;
  messagesTotal?: number;
}

export interface GmailMessageListResponse {
  messages?: Array<{ id: string; threadId: string }>;
  nextPageToken?: string;
  resultSizeEstimate?: number;
}

export interface GmailHeader {
  name: string;
  value: string;
}

export interface GmailMimePart {
  partId?: string;
  mimeType?: string;
  filename?: string;
  headers?: GmailHeader[];
  body?: { size?: number; data?: string };
  parts?: GmailMimePart[];
}

export interface GmailMessage {
  id: string;
  threadId: string;
  labelIds?: string[];
  snippet?: string;
  /** epoch 毫秒字串(Google 已標準化,優先於自行解析 Date header)。 */
  internalDate?: string;
  payload?: GmailMimePart;
}
