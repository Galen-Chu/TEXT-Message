import type { AppStore } from '../hooks/useAppStore';
import type { Tab } from '../types';

const NAV_ITEMS: Array<{ key: Tab; icon: string; label: string }> = [
  { key: 'dashboard', icon: '🏠', label: '首頁總覽' },
  { key: 'inbox', icon: '📥', label: 'Gmail 收件匣' },
  { key: 'draft', icon: '✍️', label: '草稿撰寫' },
  { key: 'library', icon: '🗂️', label: '罐頭訊息庫' },
  { key: 'schedule', icon: '📅', label: '排程管理' },
];

export default function Sidebar({ store }: { store: AppStore }) {
  return (
    <div
      style={{
        width: 232,
        flexShrink: 0,
        background: '#fff',
        borderRight: '1px solid var(--border-1)',
        display: 'flex',
        flexDirection: 'column',
        padding: '24px 16px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '0 8px 24px 8px' }}>
        <div
          style={{
            width: 36,
            height: 36,
            borderRadius: 10,
            background: 'linear-gradient(135deg,#6C5CE7,#FF7A59)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            fontWeight: 700,
            fontSize: 16,
          }}
        >
          罐
        </div>
        <div style={{ fontWeight: 700, fontSize: 16, color: 'var(--text-main)' }}>罐頭訊息小幫手</div>
      </div>

      <nav style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {NAV_ITEMS.map((item) => {
          const active = store.activeTab === item.key;
          return (
            <button
              key={item.key}
              onClick={() => store.setActiveTab(item.key)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '10px 12px',
                borderRadius: 10,
                fontSize: 13.5,
                textAlign: 'left',
                fontWeight: active ? 700 : 500,
                color: active ? 'var(--brand)' : 'var(--text-sub)',
                background: active ? 'var(--pill-purple-bg)' : 'transparent',
              }}
            >
              <span style={{ fontSize: 18 }}>{item.icon}</span>
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      <div
        style={{
          marginTop: 'auto',
          padding: '14px 12px',
          background: '#F8F7FD',
          borderRadius: 12,
          display: 'flex',
          alignItems: 'center',
          gap: 10,
        }}
      >
        <div
          style={{
            width: 34,
            height: 34,
            borderRadius: '50%',
            background: 'var(--brand)',
            color: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 700,
            fontSize: 13,
          }}
        >
          小日
        </div>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-main)' }}>小日子生活誌</div>
          <div style={{ fontSize: 11, color: 'var(--text-weak)' }}>個人自媒體帳號</div>
        </div>
      </div>
    </div>
  );
}
