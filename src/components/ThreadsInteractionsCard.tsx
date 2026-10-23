import { THREADS_INTERACTIONS_COPY as COPY } from '../constants';
import type { AppStore } from '../hooks/useAppStore';
import { shortDateTimeLabel } from '../utils/date';

/**
 * Threads 留言(互動唯讀代讀,2026-10-14)。
 * - 僅在後端已設定時出現(未設 `VITE_API_BASE` = 完整半自動模式,不顯示)
 * - 按下才讀:worker 以代管 token 打 Threads 唯讀 API,回應直接轉傳、不落地儲存
 * - 回覆一律導回 Threads(我們刻意不要 `threads_manage_replies`,不代回覆)
 */
export default function ThreadsInteractionsCard({ store }: { store: AppStore }) {
  const p = store.threadsProxy;
  if (!p.enabled) return null;

  const connected = p.status === 'connected';
  const scopeIssue = p.interactionsError === 'scope_required';

  return (
    <div className="card" style={{ padding: 18, marginBottom: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-main)' }}>
          {COPY.cardTitle}
        </div>
        {p.unseenCount > 0 && (
          <span
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: 'var(--brand)',
              background: 'var(--pill-brand-bg)',
              borderRadius: 999,
              padding: '2px 8px',
            }}
          >
            {COPY.unseenLabel(p.unseenCount)}
          </span>
        )}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          {p.unseenCount > 0 && (
            <button className="btn btn-ghost" onClick={p.markInteractionsSeen}>
              {COPY.markSeen}
            </button>
          )}
          {connected && (
            <button
              className="btn btn-outline"
              disabled={p.interactionsLoading}
              onClick={() => void p.loadInteractions()}
            >
              {p.interactionsLoading ? COPY.refreshing : COPY.refresh}
            </button>
          )}
        </div>
      </div>

      <div style={{ fontSize: 11.5, color: 'var(--text-faint)', marginBottom: 12 }}>
        {COPY.desc}
        {p.interactionsLoaded && !scopeIssue && p.interactionsScanned > 0 && (
          <> · {COPY.scannedNote(p.interactionsScanned)}</>
        )}
      </div>

      {!connected ? (
        <div style={{ padding: '14px 0', textAlign: 'center', fontSize: 12.5, color: 'var(--text-faint)' }}>
          {COPY.notConnected}
        </div>
      ) : scopeIssue ? (
        // 權限不足是可行動的狀態,不混進通用錯誤:直接給出「重新連接」這個解法
        <div style={{ padding: '12px 0', textAlign: 'center' }}>
          <div style={{ fontSize: 12.5, color: 'var(--text-sub)', lineHeight: 1.7, marginBottom: 10 }}>
            {COPY.scopeRequired}
          </div>
          <button className="btn btn-primary" onClick={p.connect}>
            {COPY.reconnect}
          </button>
        </div>
      ) : (
        <>
          {p.interactions.map((it) => (
            <div
              key={it.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '10px 0',
                borderBottom: '1px solid var(--border-2)',
              }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-main)' }}>
                  {it.username ? `@${it.username}` : COPY.anonymous}
                  {it.postSnippet && (
                    <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-faint)', marginLeft: 6 }}>
                      ↩ {it.postSnippet}
                    </span>
                  )}
                </div>
                <div
                  style={{
                    fontSize: 12,
                    color: 'var(--text-weak)',
                    marginTop: 2,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {it.text || COPY.noText}
                </div>
              </div>
              {it.timestamp > 0 && (
                <div style={{ fontSize: 11.5, color: 'var(--text-faint)', whiteSpace: 'nowrap' }}>
                  {shortDateTimeLabel(it.timestamp)}
                </div>
              )}
              {it.permalink && (
                <a
                  href={it.permalink}
                  target="_blank"
                  rel="noreferrer"
                  style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--brand)', whiteSpace: 'nowrap' }}
                >
                  {COPY.openReply}
                </a>
              )}
            </div>
          ))}
          {p.interactions.length === 0 && (
            <div
              style={{ padding: '14px 0', textAlign: 'center', fontSize: 12.5, color: 'var(--text-faint)' }}
            >
              {/* 「還沒讀過」與「讀過但沒有留言」要分開,否則使用者無法判斷是不是功能壞了 */}
              {p.interactionsError ? COPY.readFailed : p.interactionsLoaded ? COPY.empty : COPY.notLoaded}
            </div>
          )}
        </>
      )}
    </div>
  );
}
