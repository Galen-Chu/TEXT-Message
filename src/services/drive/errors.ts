/** 雲端列 Drive 模組統一錯誤型別;UI 依 code 對應 zh-Hant 文案(見 constants.ts DRIVE_ERROR_COPY)。 */

export type DriveErrorCode =
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

export class DriveError extends Error {
  readonly code: DriveErrorCode;

  constructor(code: DriveErrorCode, message?: string) {
    super(message ?? code);
    this.name = 'DriveError';
    this.code = code;
  }
}

export function toDriveError(err: unknown): DriveError {
  if (err instanceof DriveError) return err;
  if (err instanceof TypeError) return new DriveError('network', String(err));
  if (err instanceof Error) return new DriveError('unknown', err.message);
  return new DriveError('unknown', String(err));
}

/** 依 HTTP 狀態碼分類錯誤(driveApi 使用)。 */
export function fromHttpStatus(status: number, bodyText: string): DriveError {
  const brief = bodyText.slice(0, 200);
  if (status === 401) return new DriveError('unauthorized', brief);
  if (status === 403) return new DriveError('quota', brief);
  if (status === 429) return new DriveError('quota', brief);
  if (status >= 500) return new DriveError('server', `HTTP ${status}`);
  return new DriveError('parse', `HTTP ${status} ${brief}`);
}
