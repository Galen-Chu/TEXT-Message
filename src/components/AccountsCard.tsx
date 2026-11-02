/**
 * 平台帳號卡(自媒體頁,2026-11-02 UIUX 批)。
 *
 * 連接操作原本只存在編發器的發佈卡裡;這張卡把「連接/重新連接/檢查連線」集中到
 * 自媒體頁(帳號管理的主場),編發器則保留原本的 inline 連接鈕——寫稿途中臨時要連接
 * 是合理需求。兩處讀的是 useAppStore 裡同一組狀態機 hook(threadsProxy /
 * facebookProxy / linkedinProxy / youtube),所以不會有狀態不同步的問題。
 *
 * 這張卡只做連接,不做發佈:發佈一律留在編發器(UIUX.md §五 狀態與操作分離的延伸——
 * 同一個動作只有一個操作點)。
 */
import {
  ACCOUNTS_COPY,
  BACKEND_COPY,
  BACKEND_FB_COPY,
  BACKEND_LINKEDIN_COPY,
  YOUTUBE_COPY,
} from '../constants';
import type { AppStore } from '../hooks/useAppStore';
import type { PlatformKey } from '../types';
import { YOUTUBE_ENABLED } from '../services/youtube/config';
import PlatformBadge from './PlatformBadge';

type RowState = 'connected' | 'disconnected' | 'unknown' | 'error' | 'semiauto';

interface AccountRow {
  platform: PlatformKey;
  label: string;
  state: RowState;
  /** 已連線時的誠實說明;未連線時的授權提示。 */
  hint: string;
  connectLabel: string;
  onConnect?: () => void;
  onRefresh?: () => void;
  disconnectLabel?: string;
  onDisconnect?: () => void;
}

const STATUS_COPY: Record<RowState, string> = {
  connected: ACCOUNTS_COPY.statusConnected,
  disconnected: ACCOUNTS_COPY.statusDisconnected,
  unknown: ACCOUNTS_COPY.statusUnknown,
  error: ACCOUNTS_COPY.statusError,
  semiauto: ACCOUNTS_COPY.statusSemiAuto,
};

/** 後端代發三平台的狀態對應(enabled=false 代表沒設後端→半自動)。 */
function proxyState(enabled: boolean, status: string): RowState {
  if (!enabled) return 'semiauto';
  if (status === 'connected') return 'connected';
  if (status === 'error') return 'error';
  if (status === 'unknown') return 'unknown';
  return 'disconnected';
}

export default function AccountsCard({ store }: { store: AppStore }) {
  const rows: AccountRow[] = [];

  const proxies = [
    {
      platform: 'threads' as PlatformKey,
      label: 'Threads',
      proxy: store.threadsProxy,
      copy: BACKEND_COPY,
      connectedHint: BACKEND_COPY.connectedHint,
    },
    {
      platform: 'fb' as PlatformKey,
      label: 'Facebook',
      proxy: store.facebookProxy,
      copy: BACKEND_FB_COPY,
      connectedHint: BACKEND_FB_COPY.connectedHint(store.facebookProxy.pageName),
    },
    {
      platform: 'linkedin' as PlatformKey,
      label: 'LinkedIn',
      proxy: store.linkedinProxy,
      copy: BACKEND_LINKEDIN_COPY,
      connectedHint: BACKEND_LINKEDIN_COPY.connectedHint(store.linkedinProxy.memberName),
    },
  ];

  for (const p of proxies) {
    const state = proxyState(p.proxy.enabled, p.proxy.status);
    rows.push({
      platform: p.platform,
      label: p.label,
      state,
      hint:
        state === 'semiauto'
          ? ACCOUNTS_COPY.semiAutoNote
          : state === 'connected'
            ? p.connectedHint
            : p.copy.connectHint,
      connectLabel: state === 'connected' ? ACCOUNTS_COPY.reconnect : p.copy.connect,
      onConnect: state === 'semiauto' ? undefined : p.proxy.connect,
      onRefresh: state === 'semiauto' ? undefined : () => void p.proxy.refresh(),
    });
  }

  // YouTube 未設定 Client ID 的建置不出現任何上傳/連接入口(紅線),故整列不顯示
  if (YOUTUBE_ENABLED) {
    const yt = store.youtube;
    rows.push({
      platform: 'yt',
      label: 'YouTube',
      state: yt.status === 'connected' ? 'connected' : yt.status === 'error' ? 'error' : 'disconnected',
      hint: yt.status === 'connected' ? YOUTUBE_COPY.connectedHint : YOUTUBE_COPY.cardDesc,
      connectLabel: yt.status === 'connecting' ? YOUTUBE_COPY.connecting : YOUTUBE_COPY.connect,
      onConnect: () => void yt.connect(),
      disconnectLabel: yt.status === 'connected' ? YOUTUBE_COPY.disconnect : undefined,
      onDisconnect: yt.status === 'connected' ? yt.disconnect : undefined,
    });
  }

  return (
    <div className="card" style={{ padding: 18, marginBottom: 20 }}>
      <div className="t-sec-title" style={{ marginBottom: 4 }}>
        {ACCOUNTS_COPY.cardTitle}
      </div>
      <div className="t-meta" style={{ marginBottom: 12 }}>
        {ACCOUNTS_COPY.cardDesc}
      </div>

      {rows.map((row) => (
        <div
          key={row.platform}
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: 12,
            padding: '12px 0',
            borderTop: '1px solid var(--border-2)',
          }}
        >
          <PlatformBadge platform={row.platform} size={30} radius={8} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span className="t-item-title">{row.label}</span>
              <span
                className={row.state === 'connected' ? 'pill pill-brand' : 'pill'}
                style={
                  row.state === 'connected'
                    ? undefined
                    : {
                        background: 'var(--surface-soft)',
                        color: row.state === 'error' ? 'var(--error)' : 'var(--text-faint)',
                      }
                }
              >
                {STATUS_COPY[row.state]}
              </span>
            </div>
            <div className="t-meta" style={{ marginTop: 4 }}>
              {row.hint}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, flexShrink: 0, alignItems: 'center' }}>
            {row.onConnect && (
              <button className="btn btn-outline btn-sm" onClick={row.onConnect}>
                {row.connectLabel}
              </button>
            )}
            {row.onDisconnect && row.disconnectLabel && (
              <button className="btn btn-ghost btn-sm" onClick={row.onDisconnect}>
                {row.disconnectLabel}
              </button>
            )}
            {row.onRefresh && (
              <button className="t-meta" onClick={row.onRefresh}>
                {BACKEND_COPY.refreshStatus}
              </button>
            )}
          </div>
        </div>
      ))}

      <div className="t-note" style={{ marginTop: 12 }}>
        {ACCOUNTS_COPY.notes.map((n) => (
          <div key={n}>· {n}</div>
        ))}
      </div>
    </div>
  );
}
