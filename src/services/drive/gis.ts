/**
 * 雲端列 Drive 授權(GIS token model):GIS script 與 gmail 模組共用同一份載入器(冪等),
 * 以 Drive 的 client_id + drive.readonly scope 建立獨立 token client。
 * access token 只回傳給呼叫端(useDrive 存 useRef),任何地方都不落地。
 */
import { loadGisScript, revokeToken, type GisPrompt, type GisTokenResponse } from '../gmail/gis';
import { DRIVE_CLIENT_ID, DRIVE_READONLY_SCOPE } from './config';
import { DriveError } from './errors';

interface TokenError {
  type: string;
  message?: string;
}

interface TokenClient {
  requestAccessToken(overrides?: { prompt?: string }): void;
}

interface GoogleOauth2 {
  initTokenClient(config: {
    client_id: string;
    scope: string;
    callback?: (resp: GisTokenResponse & { error?: string }) => void;
    error_callback?: (err: TokenError) => void;
  }): TokenClient;
}

function oauth2(): GoogleOauth2 | undefined {
  return (globalThis as { google?: { accounts?: { oauth2?: GoogleOauth2 } } }).google?.accounts
    ?.oauth2;
}

let tokenClient: TokenClient | null = null;
let pending: { resolve: (t: GisTokenResponse) => void; reject: (e: DriveError) => void } | null =
  null;

function mapGisError(err: { type: string; message?: string }): DriveError {
  switch (err.type) {
    case 'popup_failed_to_start':
      return new DriveError('popup_blocked', err.message);
    case 'popup_closed':
      return new DriveError('cancelled', err.message);
    case 'access_denied':
      return new DriveError('access_denied', err.message);
    case 'network_changed':
    case 'browser_not_supported':
      return new DriveError('gis_load_failed', err.message);
    default:
      return new DriveError('unknown', err.type);
  }
}

/** 取得 Drive access token(必須在使用者手勢有效期內呼叫)。 */
export function acquireDriveToken(prompt: GisPrompt): Promise<GisTokenResponse> {
  return loadGisScript().then(
    () =>
      new Promise<GisTokenResponse>((resolve, reject) => {
        const api = oauth2();
        if (!api) {
          reject(new DriveError('gis_load_failed'));
          return;
        }
        if (!tokenClient) {
          tokenClient = api.initTokenClient({
            client_id: DRIVE_CLIENT_ID,
            scope: DRIVE_READONLY_SCOPE,
            callback: (resp) => {
              if (!pending) return;
              const p = pending;
              pending = null;
              if (resp.error) {
                p.reject(mapGisError({ type: resp.error }));
                return;
              }
              p.resolve(resp);
            },
            error_callback: (err) => {
              if (!pending) return;
              const p = pending;
              pending = null;
              p.reject(mapGisError(err));
            },
          });
        }
        if (pending) {
          pending.reject(new DriveError('cancelled'));
          pending = null;
        }
        pending = { resolve, reject };
        tokenClient.requestAccessToken(prompt ? { prompt } : undefined);
      }),
  );
}

/** 撤銷 token(中斷連線時,最佳努力;與 gmail 共用 GIS 的 revoke)。 */
export function revokeDriveToken(token: string): void {
  revokeToken(token);
}
