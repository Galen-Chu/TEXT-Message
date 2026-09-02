/** YouTube 模組統一錯誤型別;UI 依 code 對應 zh-TW 文案(見 constants.ts YOUTUBE_ERROR_COPY)。 */

export type YoutubeErrorCode =
  | 'disabled'
  | 'gis_load_failed'
  | 'popup_blocked'
  | 'access_denied'
  | 'cancelled'
  | 'network'
  | 'unauthorized'
  | 'quota'
  | 'forbidden'
  | 'invalid_request'
  | 'server'
  | 'parse'
  | 'unknown';

export class YoutubeError extends Error {
  readonly code: YoutubeErrorCode;

  constructor(code: YoutubeErrorCode, message?: string) {
    super(message ?? code);
    this.name = 'YoutubeError';
    this.code = code;
  }
}

export function toYoutubeError(err: unknown): YoutubeError {
  if (err instanceof YoutubeError) return err;
  if (err instanceof TypeError) return new YoutubeError('network', String(err));
  if (err instanceof Error) return new YoutubeError('unknown', err.message);
  return new YoutubeError('unknown', String(err));
}

/** 依 HTTP 狀態碼與回應 body 分類錯誤(uploadApi 使用)。 */
export function fromHttpStatus(status: number, bodyText: string): YoutubeError {
  const brief = bodyText.slice(0, 200);
  if (status === 400) return new YoutubeError('invalid_request', brief);
  if (status === 401) return new YoutubeError('unauthorized', brief);
  if (status === 403) {
    if (/quotaExceeded|rateLimitExceeded|uploadLimitExceeded|quota/i.test(bodyText)) {
      return new YoutubeError('quota', brief);
    }
    // 未啟用 API、權限不足等
    return new YoutubeError('forbidden', brief);
  }
  if (status === 429) return new YoutubeError('quota', brief);
  if (status >= 500) return new YoutubeError('server', `HTTP ${status}`);
  return new YoutubeError('parse', `HTTP ${status} ${brief}`);
}
