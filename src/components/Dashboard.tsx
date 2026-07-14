import type { AppStore } from '../hooks/useAppStore';
import { dateLabel, fullDateLabel, greeting } from '../utils/date';
import PlatformBadge from './PlatformBadge';

export default function Dashboard({ store }: { store: AppStore }) {
  const upcoming = [...store.scheduleItems]
    .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time))
    .slice(0, 3);

  const inspiration = store.emails.filter((e) => e.suitable).slice(0, 2);

  const thisWeekCount = store.scheduleItems.filter((i) => store.weekDates.includes(i.date)).length;

  const statCards = [
    { label: '本週已排程', value: thisWeekCount, color: 'var(--brand)' },
    { label: '草稿數量', value: store.selectedMailId ? 1 : 0, color: 'var(--accent)' },
    { label: '本月已發佈', value: 12, color: 'var(--text-main)' },
    {
      label: '待處理合作邀約',
      value: store.emails.filter((e) => e.tag === '合作邀約').length,
      color: '#06C755',
    },
  ];

  return (
    <div>
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'space-between',
          marginBottom: 24,
        }}
      >
        <div>
          <div style={{ fontSize: 22, fontWeight: 900, color: 'var(--text-main)' }}>
            {greeting()},小日 👋
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-weak)', marginTop: 4 }}>
            {fullDateLabel()} · 這是你本週的發文進度
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn-outline" onClick={() => store.setActiveTab('inbox')}>
            從 Gmail 建立草稿
          </button>
          <button className="btn btn-primary" onClick={() => store.setActiveTab('library')}>
            瀏覽罐頭訊息庫
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 16, marginBottom: 24 }}>
        {statCards.map((stat) => (
          <div key={stat.label} className="card" style={{ flex: 1, padding: 20 }}>
            <div style={{ fontSize: 26, fontWeight: 900, color: stat.color }}>{stat.value}</div>
            <div style={{ fontSize: 12.5, color: 'var(--text-weak)', marginTop: 6, fontWeight: 500 }}>
              {stat.label}
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start' }}>
        <div className="card" style={{ flex: 1, padding: 22 }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 14,
            }}
          >
            <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-main)' }}>近期排程</div>
            <button
              onClick={() => store.setActiveTab('schedule')}
              style={{ fontSize: 12.5, color: 'var(--brand)', fontWeight: 600 }}
            >
              查看全部 →
            </button>
          </div>
          {upcoming.map((item) => (
            <div
              key={item.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '12px 0',
                borderBottom: '1px solid var(--border-2)',
              }}
            >
              <PlatformBadge platform={item.platform} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontSize: 13.5,
                    fontWeight: 600,
                    color: 'var(--text-main)',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {item.title}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-weak)', marginTop: 2 }}>
                  {dateLabel(item.date)} · {item.time}
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="card" style={{ flex: 1, padding: 22 }}>
          <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-main)', marginBottom: 14 }}>
            來自 Gmail 的靈感
          </div>
          {inspiration.map((mail) => (
            <div
              key={mail.id}
              style={{
                padding: 14,
                border: '1px solid var(--border-2)',
                borderRadius: 12,
                marginBottom: 10,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-main)' }}>
                  {mail.subject}
                </div>
                <div className="pill pill-purple">{mail.tag}</div>
              </div>
              <div
                style={{
                  fontSize: 12,
                  color: 'var(--text-weak)',
                  margin: '6px 0 10px 0',
                  lineHeight: 1.5,
                }}
              >
                {mail.snippet}
              </div>
              <button
                onClick={() => store.convertToDraft(mail)}
                style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent)' }}
              >
                轉為草稿 →
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
