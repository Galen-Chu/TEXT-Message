import { PLATFORM_LIST, PLATFORM_META } from '../constants';
import type { AppStore } from '../hooks/useAppStore';
import { dateLabel } from '../utils/date';
import PlatformBadge from './PlatformBadge';

const SOCIAL_FILTERS = ['全部', ...PLATFORM_LIST.map((p) => p.label)];

export default function Social({ store }: { store: AppStore }) {
  const filtered = store.socialHistory.filter(
    (post) => store.socialFilter === '全部' || PLATFORM_META[post.platform].label === store.socialFilter,
  );

  return (
    <div>
      <div style={{ fontSize: 20, fontWeight: 900, color: 'var(--text-main)', marginBottom: 4 }}>
        社群媒體
      </div>
      <div style={{ fontSize: 13, color: 'var(--text-weak)', marginBottom: 20 }}>
        各社群平台發文歷史記錄
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        {SOCIAL_FILTERS.map((f) => {
          const active = store.socialFilter === f;
          return (
            <button
              key={f}
              onClick={() => store.setSocialFilter(f)}
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
        {filtered.map((post) => (
          <div
            key={post.id}
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 14,
              padding: '16px 20px',
              borderBottom: '1px solid var(--border-2)',
            }}
          >
            <PlatformBadge platform={post.platform} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text-main)' }}>
                  {post.title}
                </div>
                <div style={{ fontSize: 11.5, color: 'var(--text-faint)', whiteSpace: 'nowrap' }}>
                  {dateLabel(post.date)} · {post.time}
                </div>
              </div>
              <div
                style={{
                  fontSize: 12.5,
                  color: 'var(--text-weak)',
                  marginTop: 4,
                  lineHeight: 1.5,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {post.content}
              </div>
              <div style={{ fontSize: 10.5, fontWeight: 700, color: '#06C755', marginTop: 6 }}>
                ✓ 已發佈
              </div>
            </div>
          </div>
        ))}
        {filtered.length === 0 && (
          <div
            style={{ padding: '32px 0', textAlign: 'center', fontSize: 12.5, color: 'var(--text-faint)' }}
          >
            此平台還沒有發文記錄
          </div>
        )}
      </div>
    </div>
  );
}
