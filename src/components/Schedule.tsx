import { useState } from 'react';
import { PLATFORM_LIST, WEEKDAY_LABELS } from '../constants';
import type { AppStore } from '../hooks/useAppStore';
import type { PlatformKey, ScheduleStatus } from '../types';
import { dateLabel } from '../utils/date';
import Modal from './Modal';
import PlatformBadge from './PlatformBadge';

function statusLabel(status: ScheduleStatus): string {
  return status === 'draft' ? '草稿排程' : '已確認排程';
}

export default function Schedule({ store }: { store: AppStore }) {
  const [showNewModal, setShowNewModal] = useState(false);
  const [manualTitle, setManualTitle] = useState('');
  const [manualDate, setManualDate] = useState(store.tomorrowISO);
  const [manualTime, setManualTime] = useState('09:00');
  const [manualPlatform, setManualPlatform] = useState<PlatformKey>('fb');

  const selectedDayItems = store.scheduleItems
    .filter((i) => i.date === store.selectedDay)
    .sort((a, b) => a.time.localeCompare(b.time));

  const allSorted = [...store.scheduleItems].sort((a, b) =>
    (a.date + a.time).localeCompare(b.date + b.time),
  );

  const saveManualSchedule = () => {
    if (!manualTitle.trim()) {
      store.showToast('請輸入貼文標題');
      return;
    }
    store.addManualSchedule(manualTitle, manualDate, manualTime, manualPlatform);
    setShowNewModal(false);
  };

  return (
    <div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-end',
          marginBottom: 20,
        }}
      >
        <div>
          <div style={{ fontSize: 20, fontWeight: 900, color: 'var(--text-main)', marginBottom: 4 }}>
            排程管理
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-weak)' }}>跨平台發佈排程一覽</div>
        </div>
        <button
          className="btn btn-primary"
          onClick={() => {
            setManualTitle('');
            setShowNewModal(true);
          }}
        >
          + 新增排程
        </button>
      </div>

      <div
        style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 8, marginBottom: 20 }}
      >
        {store.weekDates.map((date, i) => {
          const active = store.selectedDay === date;
          const hasItems = store.scheduleItems.some((it) => it.date === date);
          return (
            <button
              key={date}
              onClick={() => store.setSelectedDay(date)}
              style={{
                textAlign: 'center',
                padding: '10px 4px',
                borderRadius: 12,
                background: active ? 'var(--brand)' : 'var(--card)',
                color: active ? '#fff' : 'var(--text-sub)',
                boxShadow: '0 2px 8px rgba(108,92,231,0.06)',
              }}
            >
              <div style={{ fontSize: 11, opacity: 0.75 }}>{WEEKDAY_LABELS[i]}</div>
              <div style={{ fontSize: 17, fontWeight: 800, margin: '4px 0' }}>
                {new Date(date + 'T00:00:00').getDate()}
              </div>
              {hasItems && (
                <div
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: '50%',
                    background: 'currentColor',
                    margin: '0 auto',
                  }}
                />
              )}
            </button>
          );
        })}
      </div>

      <div className="card" style={{ padding: 18, marginBottom: 20 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-main)', marginBottom: 12 }}>
          {dateLabel(store.selectedDay)} 排程內容
        </div>
        {selectedDayItems.length === 0 && (
          <div style={{ fontSize: 12.5, color: 'var(--text-faint)', padding: '16px 0', textAlign: 'center' }}>
            這天還沒有排程,點右上角新增一則吧
          </div>
        )}
        {selectedDayItems.map((item) => (
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
              <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text-main)' }}>{item.title}</div>
              <div style={{ fontSize: 12, color: 'var(--text-weak)', marginTop: 2 }}>
                {item.time} · {statusLabel(item.status)}
              </div>
            </div>
            <button
              onClick={() => store.deleteScheduleItem(item.id)}
              style={{ fontSize: 12, color: 'var(--text-faint)', fontWeight: 600, padding: '6px 10px' }}
            >
              刪除
            </button>
          </div>
        ))}
      </div>

      <div className="card" style={{ padding: 18 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-main)', marginBottom: 12 }}>
          所有排程(依日期)
        </div>
        {allSorted.map((item) => (
          <div
            key={item.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: '10px 0',
              borderBottom: '1px solid var(--border-2)',
            }}
          >
            <PlatformBadge platform={item.platform} size={28} radius={8} fontSize={10.5} />
            <div style={{ fontSize: 12.5, color: 'var(--text-weak)', width: 120, flexShrink: 0 }}>
              {dateLabel(item.date)} {item.time}
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-main)', fontWeight: 600, flex: 1 }}>
              {item.title}
            </div>
            <div style={{ fontSize: 11, color: 'var(--brand)', fontWeight: 700 }}>
              {statusLabel(item.status)}
            </div>
          </div>
        ))}
      </div>

      {showNewModal && (
        <Modal onClose={() => setShowNewModal(false)} width={440} label="手動新增排程">
          <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-main)', marginBottom: 16 }}>
            手動新增排程
          </div>
          <div className="field-label">貼文標題</div>
          <input
            className="text-input"
            value={manualTitle}
            onChange={(e) => setManualTitle(e.target.value)}
            placeholder="例如:週末生活分享"
            style={{ marginBottom: 14 }}
          />
          <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
            <div style={{ flex: 1 }}>
              <div className="field-label">日期</div>
              <input
                className="text-input"
                type="date"
                value={manualDate}
                onChange={(e) => setManualDate(e.target.value)}
              />
            </div>
            <div style={{ flex: 1 }}>
              <div className="field-label">時間</div>
              <input
                className="text-input"
                type="time"
                value={manualTime}
                onChange={(e) => setManualTime(e.target.value)}
              />
            </div>
          </div>
          <div className="field-label">平台</div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 18 }}>
            {PLATFORM_LIST.map((p) => {
              const active = manualPlatform === p.key;
              return (
                <button
                  key={p.key}
                  onClick={() => setManualPlatform(p.key)}
                  style={{
                    padding: '8px 14px',
                    borderRadius: 9,
                    fontSize: 12.5,
                    fontWeight: 600,
                    background: active ? p.color : 'var(--card)',
                    color: active ? '#fff' : 'var(--text-sub)',
                    border: `1px solid ${active ? p.color : 'var(--pill-purple-bg-2)'}`,
                  }}
                >
                  {p.label}
                </button>
              );
            })}
          </div>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <button className="btn btn-ghost" style={{ borderRadius: 9 }} onClick={() => setShowNewModal(false)}>
              取消
            </button>
            <button className="btn btn-primary" style={{ borderRadius: 9 }} onClick={saveManualSchedule}>
              新增
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
