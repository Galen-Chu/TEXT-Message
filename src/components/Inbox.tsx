import {
  CONNECT_UNVERIFIED_HINT,
  GMAIL_ERROR_COPY,
  INBOX_EMPTY_CONNECTED,
  INBOX_FILTERS,
  INBOX_GMAIL_COPY,
} from '../constants';
import { gmailComposeUrl } from '../services/gmail/compose';
import { gmailFilterSearchUrl } from '../services/gmail/filterLink';
import type { AppStore } from '../hooks/useAppStore';

export default function Inbox({ store }: { store: AppStore }) {
  const g = store.gmail;
  // Gmail 標籤篩選僅在已連線時生效(示範郵件無 labelIds,避免中斷連線後清單全空)
  const activeLabelId = g.status === 'connected' ? store.inboxLabelId : null;
  const filtered = store.emails.filter((e) => {
    const matchFilter = store.inboxFilter === '全部' || e.tag === store.inboxFilter;
    const matchLabel = !activeLabelId || (e.labelIds ?? []).includes(activeLabelId);
    const q = store.inboxSearch.trim();
    const matchSearch = !q || e.sender.includes(q) || e.subject.includes(q);
    return matchFilter && matchLabel && matchSearch;
  });

  return (
    <div>
      <div className="t-page-title" style={{ marginBottom: 4 }}>
        郵件匣 Gmail
      </div>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          marginBottom: 20,
        }}
      >
        <div className="t-page-desc">
          {g.status === 'disabled' && '示範模式:此建置未設定 Gmail 連線,以下為示範資料'}
          {g.status === 'disconnected' && '示範模式:顯示示範郵件,可連接真實 Gmail 帳號'}
          {g.status === 'connecting' && '連接中…'}
          {g.status === 'connected' &&
            INBOX_GMAIL_COPY.connectedSubtitle.replace('{email}', g.accountEmail ?? '')}
          {g.status === 'error' && 'Gmail 連線發生問題'}
        </div>
        <div style={{ display: 'flex', gap: 10, flexShrink: 0 }}>
          {(g.status === 'disconnected' || g.status === 'connecting') && (
            <button
              className="btn btn-primary"
              onClick={g.connect}
              disabled={g.status === 'connecting'}
            >
              {g.status === 'connecting' ? '連接中…' : '連接 Gmail 帳號'}
            </button>
          )}
          {g.status === 'connected' && (
            <>
              <button className="btn btn-outline" onClick={g.refresh} disabled={g.loadingEmails}>
                {g.loadingEmails ? '載入中…' : '重新整理'}
              </button>
              <button className="btn btn-ghost" onClick={g.disconnect}>
                中斷連線
              </button>
            </>
          )}
          {g.status === 'error' && (
            <button className="btn btn-primary" onClick={g.retry}>
              {g.error?.code === 'unauthorized' ? '重新連接' : '重試'}
            </button>
          )}
        </div>
      </div>

      {g.status === 'disconnected' && (
        <div className="t-note" style={{ marginBottom: 12 }}>
          {CONNECT_UNVERIFIED_HINT}
        </div>
      )}

      {g.status === 'error' && g.error && (
        <div
          className="card t-body"
          style={{
            padding: '14px 18px',
            marginBottom: 16,
            color: 'var(--error)',
            background: 'var(--pill-accent-bg)',
          }}
        >
          {GMAIL_ERROR_COPY[g.error.code]}
        </div>
      )}

      <div style={{ display: 'flex', gap: 10, marginBottom: 16, alignItems: 'center' }}>
        <input
          className="text-input"
          value={store.inboxSearch}
          onChange={(e) => store.setInboxSearch(e.target.value)}
          placeholder="搜尋寄件者或主旨…"
          style={{ flex: 1, maxWidth: 320, borderRadius: 10, padding: '10px 14px' }}
        />
        {INBOX_FILTERS.map((f) => {
          const active = store.inboxFilter === f;
          return (
            <button
              key={f}
              onClick={() => store.setInboxFilter(f)}
              className="t-sub"
              style={{
                padding: '8px 14px',
                borderRadius: 9,
                fontWeight: 'var(--weight-semibold)',
                background: active ? 'var(--brand-fill)' : 'var(--card)',
                color: active ? 'var(--on-brand-fill)' : 'var(--text-sub)',
                border: `1px solid ${active ? 'var(--brand)' : 'var(--border-3)'}`,
              }}
            >
              {f}
            </button>
          );
        })}
      </div>

      {g.status === 'connected' && g.labels.length > 0 && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 16, alignItems: 'center', flexWrap: 'wrap' }}>
          <span className="t-meta" style={{ marginRight: 2 }}>
            {INBOX_GMAIL_COPY.labelRowTitle}
          </span>
          <button
            onClick={() => store.setInboxLabelId(null)}
            className="t-meta"
            style={{
              padding: '5px 12px',
              borderRadius: 8,
              fontWeight: 'var(--weight-semibold)',
              background: !store.inboxLabelId ? 'var(--pill-brand-bg)' : 'var(--card)',
              color: !store.inboxLabelId ? 'var(--brand)' : 'var(--text-faint)',
              border: `1px solid ${!store.inboxLabelId ? 'var(--brand)' : 'var(--border-3)'}`,
            }}
          >
            全部
          </button>
          {g.labels.map((label) => {
            const active = store.inboxLabelId === label.id;
            return (
              <button
                key={label.id}
                onClick={() => store.setInboxLabelId(active ? null : label.id)}
                className="t-meta"
                style={{
                  padding: '5px 12px',
                  borderRadius: 8,
                  fontWeight: 'var(--weight-semibold)',
                  background: active ? 'var(--pill-brand-bg)' : 'var(--card)',
                  color: active ? 'var(--brand)' : 'var(--text-faint)',
                  border: `1px solid ${active ? 'var(--brand)' : 'var(--border-3)'}`,
                }}
              >
                {label.name}
              </button>
            );
          })}
        </div>
      )}

      <div className="card" style={{ overflow: 'hidden' }}>
        {g.loadingEmails && (
          <div className="t-page-desc" style={{ padding: '40px 0', textAlign: 'center' }}>
            郵件載入中…
          </div>
        )}
        {!g.loadingEmails && filtered.map((mail) => (
          <div
            key={mail.id}
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 14,
              padding: '18px 20px',
              borderBottom: '1px solid var(--border-2)',
            }}
          >
            <div
              className="t-body"
              style={{
                width: 38,
                height: 38,
                borderRadius: '50%',
                background: 'var(--pill-brand-bg-2)',
                color: 'var(--brand)',
                fontWeight: 'var(--weight-bold)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              {mail.initial}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                <div className="t-item-title">{mail.sender}</div>
                <div className="t-meta t-num" style={{ whiteSpace: 'nowrap' }}>
                  {mail.date}
                </div>
              </div>
              <div
                className="t-item-title"
                style={{ fontWeight: 'var(--weight-bold)', marginTop: 2 }}
              >
                {mail.subject}
              </div>
              <div
                className="t-sub"
                style={{
                  marginTop: 3,
                  lineHeight: 'var(--leading-snug)',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {mail.snippet}
              </div>
              <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                <div className="pill pill-brand">{mail.tag}</div>
                {mail.suitable && <div className="pill pill-accent">✨ AI 建議可發文</div>}
              </div>
            </div>
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 6,
                flexShrink: 0,
                alignSelf: 'center',
              }}
            >
              <button
                onClick={() => store.convertToDraft(mail)}
                className="t-sub"
                style={{
                  padding: '8px 14px',
                  borderRadius: 9,
                  background: 'var(--brand-fill)',
                  color: 'var(--on-brand-fill)',
                  fontWeight: 'var(--weight-bold)',
                }}
              >
                轉為草稿
              </button>
              {g.status === 'connected' && (
                <button
                  onClick={() => {
                    window.open(
                      gmailFilterSearchUrl(mail.senderEmail ?? mail.sender),
                      '_blank',
                      'noopener',
                    );
                    store.showToast(INBOX_GMAIL_COPY.autoFileToast);
                  }}
                  title={INBOX_GMAIL_COPY.autoFileTitle}
                  className="t-meta"
                  style={{
                    padding: '6px 10px',
                    borderRadius: 9,
                    background: 'var(--bg)',
                    color: 'var(--text-sub)',
                    fontWeight: 'var(--weight-semibold)',
                  }}
                >
                  {INBOX_GMAIL_COPY.autoFileButton}
                </button>
              )}
            </div>
          </div>
        ))}
        {!g.loadingEmails && g.status === 'connected' && g.canLoadMore && (
          <div style={{ padding: '12px 0', textAlign: 'center' }}>
            <button className="btn btn-ghost" onClick={() => void g.loadMore()} disabled={g.loadingMore}>
              {g.loadingMore ? '載入中…' : '載入更多'}
            </button>
          </div>
        )}
        {!g.loadingEmails && filtered.length === 0 && g.status === 'connected' && store.emails.length === 0 && (
          <div style={{ padding: '36px 24px', textAlign: 'center' }}>
            <div className="t-card-title" style={{ marginBottom: 6 }}>
              {INBOX_EMPTY_CONNECTED.title}
            </div>
            <div
              className="t-sub"
              style={{ lineHeight: 'var(--leading-normal)', marginBottom: 16 }}
            >
              {INBOX_EMPTY_CONNECTED.desc}
            </div>
            <a
              href={gmailComposeUrl(g.accountEmail ?? '', INBOX_EMPTY_CONNECTED.subject, INBOX_EMPTY_CONNECTED.body)}
              target="_blank"
              rel="noreferrer"
              className="btn btn-primary"
              style={{ textDecoration: 'none', display: 'inline-block', padding: '10px 18px' }}
            >
              {INBOX_EMPTY_CONNECTED.action}
            </a>
            <div className="t-note" style={{ marginTop: 14 }}>
              {INBOX_EMPTY_CONNECTED.after}
            </div>
          </div>
        )}
        {!g.loadingEmails && filtered.length === 0 && !(g.status === 'connected' && store.emails.length === 0) && (
          <div
            className="t-sub"
            style={{ padding: '32px 0', textAlign: 'center', color: 'var(--text-faint)' }}
          >
            沒有符合條件的郵件
          </div>
        )}
      </div>
    </div>
  );
}
