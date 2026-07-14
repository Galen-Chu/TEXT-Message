import { INBOX_FILTERS } from '../constants';
import type { AppStore } from '../hooks/useAppStore';

export default function Inbox({ store }: { store: AppStore }) {
  const filtered = store.emails.filter((e) => {
    const matchFilter = store.inboxFilter === '全部' || e.tag === store.inboxFilter;
    const q = store.inboxSearch.trim();
    const matchSearch = !q || e.sender.includes(q) || e.subject.includes(q);
    return matchFilter && matchSearch;
  });

  return (
    <div>
      <div style={{ fontSize: 20, fontWeight: 900, color: 'var(--text-main)', marginBottom: 4 }}>
        Gmail 郵件匣
      </div>
      <div style={{ fontSize: 13, color: 'var(--text-weak)', marginBottom: 20 }}>
        已串接帳號:xiaori.life@gmail.com · AI 自動標示適合轉發文的內容
      </div>

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
              style={{
                padding: '8px 14px',
                borderRadius: 9,
                fontSize: 12.5,
                fontWeight: 600,
                background: active ? 'var(--brand)' : '#fff',
                color: active ? '#fff' : 'var(--text-sub)',
                border: `1px solid ${active ? 'var(--brand)' : 'var(--border-3)'}`,
              }}
            >
              {f}
            </button>
          );
        })}
      </div>

      <div className="card" style={{ overflow: 'hidden' }}>
        {filtered.map((mail) => (
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
              style={{
                width: 38,
                height: 38,
                borderRadius: '50%',
                background: 'var(--pill-purple-bg-2)',
                color: 'var(--brand)',
                fontWeight: 700,
                fontSize: 14,
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
                <div style={{ fontSize: 13, color: 'var(--text-main)', fontWeight: 600 }}>
                  {mail.sender}
                </div>
                <div style={{ fontSize: 11.5, color: 'var(--text-faint)', whiteSpace: 'nowrap' }}>
                  {mail.date}
                </div>
              </div>
              <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text-main)', marginTop: 2 }}>
                {mail.subject}
              </div>
              <div
                style={{
                  fontSize: 12.5,
                  color: 'var(--text-weak)',
                  marginTop: 3,
                  lineHeight: 1.5,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {mail.snippet}
              </div>
              <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                <div className="pill pill-purple">{mail.tag}</div>
                {mail.suitable && <div className="pill pill-orange">✨ AI 建議可發文</div>}
              </div>
            </div>
            <button
              onClick={() => store.convertToDraft(mail)}
              style={{
                flexShrink: 0,
                padding: '8px 14px',
                borderRadius: 9,
                background: 'var(--brand)',
                color: '#fff',
                fontSize: 12.5,
                fontWeight: 700,
                alignSelf: 'center',
              }}
            >
              轉為草稿
            </button>
          </div>
        ))}
        {filtered.length === 0 && (
          <div
            style={{ padding: '32px 0', textAlign: 'center', fontSize: 12.5, color: 'var(--text-faint)' }}
          >
            沒有符合條件的郵件
          </div>
        )}
      </div>
    </div>
  );
}
