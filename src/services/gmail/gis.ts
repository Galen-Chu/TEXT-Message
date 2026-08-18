/**
 * Google Identity Services(token model)載入與授權。
 * - script 採動態注入(未連線/示範模式建置完全不觸碰 Google 網路)
 * - access token 只回傳給呼叫端(useGmail 存 useRef),任何地方都不落地
 */
import { GMAIL_CLIENT_ID, GMAIL_SCOPE } from './config';
import { GmailError } from './errors';

export interface GisTokenResponse {
  access_token: string;
  expires_in: number;
  scope?: string;
  token_type?: string;
}

export type GisPrompt = '' | 'consent' | 'select_account';

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
  revokeToken(token: string): void;
}

declare global {
  interface Window {
    google?: { accounts?: { oauth2?: GoogleOauth2 } };
  }
}

const GIS_SRC = 'https://accounts.google.com/gsi/client';
const GIS_LOAD_TIMEOUT_MS = 10000;

let scriptPromise: Promise<void> | null = null;

/** 惰性載入 GIS script(冪等;逾時/失敗重試時可重新載入)。 */
export function loadGisScript(): Promise<void> {
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise<void>((resolve, reject) => {
    if (typeof window === 'undefined' || !window.document) {
      scriptPromise = null;
      reject(new GmailError('gis_load_failed', 'no window'));
      return;
    }
    if (window.google?.accounts?.oauth2) {
      resolve();
      return;
    }
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${GIS_SRC}"]`);
    const script = existing ?? document.createElement('script');
    const timer = window.setTimeout(() => {
      scriptPromise = null;
      reject(new GmailError('gis_load_failed', 'timeout'));
    }, GIS_LOAD_TIMEOUT_MS);
    script.addEventListener('load', () => {
      window.clearTimeout(timer);
      resolve();
    });
    script.addEventListener('error', () => {
      window.clearTimeout(timer);
      scriptPromise = null;
      reject(new GmailError('gis_load_failed', 'script error'));
    });
    if (!existing) {
      script.src = GIS_SRC;
      script.async = true;
      script.defer = true;
      document.head.appendChild(script);
    }
  });
  return scriptPromise;
}

let tokenClient: TokenClient | null = null;
let pending: { resolve: (t: GisTokenResponse) => void; reject: (e: GmailError) => void } | null = null;

function mapGisError(err: { type: string; message?: string }): GmailError {
  switch (err.type) {
    case 'popup_failed_to_start':
      return new GmailError('popup_blocked', err.message);
    case 'popup_closed':
      return new GmailError('cancelled', err.message);
    case 'access_denied':
      return new GmailError('access_denied', err.message);
    case 'network_changed':
    case 'browser_not_supported':
      return new GmailError('gis_load_failed', err.message);
    default:
      return new GmailError('unknown', err.type);
  }
}

/**
 * 取得 access token。必須在使用者手勵有效期內呼叫
 * (GIS script 已由 useGmail 預熱,點擊後能同步開窗)。
 * prompt:'' = 靜默續約;'select_account' = 讓多帳號使用者選帳號。
 */
export function acquireToken(prompt: GisPrompt): Promise<GisTokenResponse> {
  return loadGisScript().then(
    () =>
      new Promise<GisTokenResponse>((resolve, reject) => {
        const oauth2 = window.google?.accounts?.oauth2;
        if (!oauth2) {
          reject(new GmailError('gis_load_failed'));
          return;
        }
        if (!tokenClient) {
          tokenClient = oauth2.initTokenClient({
            client_id: GMAIL_CLIENT_ID,
            scope: GMAIL_SCOPE,
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
          pending.reject(new GmailError('cancelled'));
          pending = null;
        }
        pending = { resolve, reject };
        tokenClient.requestAccessToken(prompt ? { prompt } : undefined);
      }),
  );
}

/** 撤銷 token(中斷連線時,最佳努力)。 */
export function revokeToken(token: string): void {
  try {
    window.google?.accounts?.oauth2?.revokeToken(token);
  } catch {
    // 撤銷失敗不影響本機登出
  }
}
