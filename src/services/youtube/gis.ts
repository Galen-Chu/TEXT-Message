/**
 * YouTube 授權(GIS token model):GIS script 與 gmail 模組共用同一份載入器
 * (冪等),但以 YouTube 的 client_id + upload scope 建立獨立 token client。
 * access token 只回傳給呼叫端(useYoutube 存 useRef),任何地方都不落地。
 */
import { loadGisScript, type GisTokenResponse, type GisPrompt } from '../gmail/gis';
import { revokeToken as gisRevokeToken } from '../gmail/gis';
import { YOUTUBE_CLIENT_ID, YOUTUBE_UPLOAD_SCOPE } from './config';
import { YoutubeError } from './errors';

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
let pending: { resolve: (t: GisTokenResponse) => void; reject: (e: YoutubeError) => void } | null =
  null;

function mapGisError(err: { type: string; message?: string }): YoutubeError {
  switch (err.type) {
    case 'popup_failed_to_start':
      return new YoutubeError('popup_blocked', err.message);
    case 'popup_closed':
      return new YoutubeError('cancelled', err.message);
    case 'access_denied':
      return new YoutubeError('access_denied', err.message);
    case 'network_changed':
    case 'browser_not_supported':
      return new YoutubeError('gis_load_failed', err.message);
    default:
      return new YoutubeError('unknown', err.type);
  }
}

/** 取得 YouTube access token(必須在使用者手勢有效期內呼叫)。 */
export function acquireYoutubeToken(prompt: GisPrompt): Promise<GisTokenResponse> {
  return loadGisScript().then(
    () =>
      new Promise<GisTokenResponse>((resolve, reject) => {
        const api = oauth2();
        if (!api) {
          reject(new YoutubeError('gis_load_failed'));
          return;
        }
        if (!tokenClient) {
          tokenClient = api.initTokenClient({
            client_id: YOUTUBE_CLIENT_ID,
            scope: YOUTUBE_UPLOAD_SCOPE,
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
          pending.reject(new YoutubeError('cancelled'));
          pending = null;
        }
        pending = { resolve, reject };
        tokenClient.requestAccessToken(prompt ? { prompt } : undefined);
      }),
  );
}

/** 撤銷 token(中斷連線時,最佳努力;與 gmail 共用 GIS 的 revoke)。 */
export function revokeYoutubeToken(token: string): void {
  gisRevokeToken(token);
}
