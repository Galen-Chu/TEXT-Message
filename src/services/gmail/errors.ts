/** Gmail 模組統一錯誤型別;UI 依 code 對應 zh-TW 文案(見 constants.ts GMAIL_ERROR_COPY)。 */

export type GmailErrorCode =
  | 'disabled'
  | 'gis_load_failed'
  | 'popup_blocked'
  | 'access_denied'
  | 'cancelled'
  | 'network'
  | 'unauthorized'
  | 'quota'
  | 'server'
  | 'parse'
  | 'unknown';

export class GmailError extends Error {
  readonly code: GmailErrorCode;

  constructor(code: GmailErrorCode, message?: string) {
    super(message ?? code);
    this.name = 'GmailError';
    this.code = code;
  }
}

export function toGmailError(err: unknown): GmailError {
  if (err instanceof GmailError) return err;
  if (err instanceof TypeError) return new GmailError('network', String(err));
  if (err instanceof Error) return new GmailError('unknown', err.message);
  return new GmailError('unknown', String(err));
}

/** 依 HTTP 狀態碼與回應 body 分類錯誤(gmailApi 使用)。 */
export function fromHttpStatus(status: number, bodyText: string): GmailError {
  const brief = bodyText.slice(0, 200);
  if (status === 401) return new GmailError('unauthorized', brief);
  if (status === 403) {
    if (/rateLimitExceeded|userRateLimitExceeded|quota/i.test(bodyText)) {
      return new GmailError('quota', brief);
    }
    return new GmailError('unauthorized', brief);
  }
  if (status === 429) return new GmailError('quota', brief);
  if (status >= 500) return new GmailError('server', `HTTP ${status}`);
  return new GmailError('parse', `HTTP ${status} ${brief}`);
}
