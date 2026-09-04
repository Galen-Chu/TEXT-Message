import { useEffect, useState } from 'react';
import {
  BACKEND_COPY,
  PLATFORM_LIST,
  SCHEDULE_COPY,
  SCHEDULE_STATUS_META,
  WEEKDAY_LABELS,
} from '../constants';
import type { AppStore } from '../hooks/useAppStore';
import type { PlatformKey, ScheduleItem } from '../types';
import { dateLabel } from '../utils/date';
import { effectiveStatus, overdueItems } from '../utils/schedule';
import Modal from './Modal';
import PlatformBadge from './PlatformBadge';

/** Threads 雲端佇列項目狀態顯示(與本地排程狀態分開定義:語意不同——雲端由 cron 執行)。 */
const QUEUE_STATUS_META: Record<string, { label: string; color: string }> = {
  pending: { label: '待發佈', color: 'var(--brand)' },
  done: { label: '✓ 已發佈', color: '#06C755' },
  failed: { label: '✗ 失敗', color: '#E74C3C' },
  cancelled: { label: '已取消', color: 'var(--text-faint)' },
};

/** 排程列動作按鈕(發佈輔助為純前端半自動:複製 + 平台深連結)。 */
function actionButtonStyle(color: string) {
  return { fontSize: 11.5, fontWeight: 700, color, padding: '4px 8px', borderRadius: 7 };
}

export default function Schedule({ store }: { store: AppStore }) {
  // 逾期狀態依「現在」推導:每分鐘更新一次,頁面開著也會即時反映
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(timer);
  }, []);

  // Threads 雲端佇列:後端啟用時進入本頁自動載入
  const proxy = store.threadsProxy;
  useEffect(() => {
    if (proxy.enabled) void proxy.loadQueue();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [proxy.enabled]);

  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [manualTitle, setManualTitle] = useState('');
  const [manualContent, setManualContent] = useState('');
  const [manualDate, setManualDate] = useState(store.tomorrowISO);
  const [manualTime, setManualTime] = useState('09:00');
  const [manualPlatform, setManualPlatform] = useState<PlatformKey>('fb');

  const selectedDayItems = store.scheduleItems
    .filter((i) => i.date === store.selectedDay)
    .sort((a, b) => a.time.localeCompare(b.time));

  const allSorted = [...store.scheduleItems].sort((a, b) =>
    (a.date + a.time).localeCompare(b.date + b.time),
  );

  const overdue = overdueItems(store.scheduleItems, now);

  const openNewModal = () => {
    setEditingId(null);
    setManualTitle('');
    setManualContent('');
    setManualDate(store.tomorrowISO);
    setManualTime('09:00');
    setManualPlatform('fb');
    setShowModal(true);
  };

  const openEditModal = (item: ScheduleItem) => {
    setEditingId(item.id);
    setManualTitle(item.title);
    setManualContent(item.content ?? '');
    setManualDate(item.date);
    setManualTime(item.time);
    setManualPlatform(item.platform);
    setShowModal(true);
  };

  const saveModal = () => {
    if (!manualTitle.trim()) {
      store.showToast(SCHEDULE_COPY.emptyTitleToast);
      return;
    }
    if (editingId) {
      store.updateScheduleItem(editingId, {
        title: manualTitle,
        content: manualContent,
        date: manualDate,
        time: manualTime,
        platform: manualPlatform,
      });
    } else {
      store.addManualSchedule(manualTitle, manualDate, manualTime, manualPlatform, manualContent);
    }
    setShowModal(false);
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
            定排程 Task
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-weak)' }}>跨平台發佈排程一覽</div>
        </div>
        <button className="btn btn-primary" onClick={openNewModal}>
          + 新增排程
        </button>
      </div>

      {overdue.length > 0 && (
        <div
          className="card"
          style={{
            padding: '12px 18px',
            marginBottom: 16,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 12,
            border: '1px solid rgba(231,76,60,0.35)',
            background: 'rgba(231,76,60,0.06)',
          }}
        >
          <div style={{ fontSize: 13, fontWeight: 700, color: '#E74C3C' }}>
            {SCHEDULE_COPY.overdueBanner(overdue.length)}
          </div>
          <button
            style={{ fontSize: 12, fontWeight: 700, color: '#E74C3C', whiteSpace: 'nowrap' }}
            onClick={() => store.setSelectedDay(overdue[0].date)}
          >
            {SCHEDULE_COPY.overdueBannerAction} →
          </button>
        </div>
      )}

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
        {selectedDayItems.map((item) => {
          const status = effectiveStatus(item, now);
          const meta = SCHEDULE_STATUS_META[status];
          return (
            <div
              key={item.id}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 12,
                padding: '12px 0',
                borderBottom: '1px solid var(--border-2)',
              }}
            >
              <PlatformBadge platform={item.platform} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text-main)' }}>
                  {item.title}
                </div>
                <div style={{ fontSize: 12, color: meta.color, marginTop: 2, fontWeight: 600 }}>
                  {item.time} · {meta.label}
                </div>
                {status !== 'published' && (
                  <div
                    style={{
                      display: 'flex',
                      gap: 2,
                      marginTop: 6,
                      marginLeft: -8,
                      flexWrap: 'wrap',
                    }}
                  >
                    <button
                      style={actionButtonStyle('var(--brand)')}
                      onClick={() => store.copyScheduleText(item)}
                    >
                      {SCHEDULE_COPY.copyAction}
                    </button>
                    <button
                      style={actionButtonStyle('var(--accent)')}
                      onClick={() => store.openSchedulePublish(item)}
                    >
                      {SCHEDULE_COPY.openAction}
                    </button>
                    <button
                      style={actionButtonStyle('#06C755')}
                      onClick={() => store.markSchedulePublished(item.id)}
                    >
                      {SCHEDULE_COPY.publishAction}
                    </button>
                    <button
                      style={actionButtonStyle('var(--text-sub)')}
                      onClick={() => openEditModal(item)}
                    >
                      {SCHEDULE_COPY.editAction}
                    </button>
                  </div>
                )}
              </div>
              <button
                onClick={() => store.deleteScheduleItem(item.id)}
                style={{
                  fontSize: 12,
                  color: 'var(--text-faint)',
                  fontWeight: 600,
                  padding: '6px 10px',
                }}
              >
                刪除
              </button>
            </div>
          );
        })}
      </div>

      <div className="card" style={{ padding: 18 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-main)', marginBottom: 12 }}>
          所有排程(依日期)
        </div>
        {allSorted.map((item) => {
          const meta = SCHEDULE_STATUS_META[effectiveStatus(item, now)];
          return (
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
              <div style={{ fontSize: 11, fontWeight: 700, color: meta.color }}>{meta.label}</div>
            </div>
          );
        })}
      </div>

      {proxy.enabled && (
        <div className="card" style={{ padding: 18, marginTop: 20 }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 12,
            }}
          >
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-main)' }}>
              {BACKEND_COPY.queueTitle}
            </div>
            <button
              onClick={() => void proxy.loadQueue()}
              disabled={proxy.queueLoading}
              style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--brand)' }}
            >
              {proxy.queueLoading ? '載入中…' : BACKEND_COPY.queueRefresh}
            </button>
          </div>
          {proxy.queue.length === 0 && (
            <div
              style={{ padding: '16px 0', textAlign: 'center', fontSize: 12.5, color: 'var(--text-faint)' }}
            >
              {proxy.queueLoading ? '載入中…' : BACKEND_COPY.queueEmpty}
            </div>
          )}
          {proxy.queue.map((item) => {
            const meta = QUEUE_STATUS_META[item.status] ?? QUEUE_STATUS_META.pending;
            const dt = new Date(item.publishAt);
            const timeLabel = `${dt.getMonth() + 1}/${dt.getDate()} ${String(dt.getHours()).padStart(2, '0')}:${String(dt.getMinutes()).padStart(2, '0')}`;
            return (
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
                <div style={{ fontSize: 12.5, color: 'var(--text-weak)', width: 110, flexShrink: 0 }}>
                  {timeLabel}
                </div>
                <div
                  style={{ fontSize: 12.5, color: 'var(--text-sub)', flex: 1, minWidth: 0 }}
                  title={item.lastError ?? item.text}
                >
                  <span
                    style={{
                      display: 'block',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {item.text.split('\n')[0]}
                  </span>
                </div>
                <div style={{ fontSize: 11, fontWeight: 700, color: meta.color }}>{meta.label}</div>
                {item.status === 'pending' && (
                  <button
                    onClick={() => void proxy.cancel(item.id)}
                    style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--text-faint)', padding: '4px 8px' }}
                  >
                    {BACKEND_COPY.queueCancel}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {showModal && (
        <Modal
          onClose={() => setShowModal(false)}
          width={440}
          label={editingId ? SCHEDULE_COPY.editModalTitle : SCHEDULE_COPY.newModalTitle}
        >
          <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-main)', marginBottom: 16 }}>
            {editingId ? SCHEDULE_COPY.editModalTitle : SCHEDULE_COPY.newModalTitle}
          </div>
          <div className="field-label">貼文標題</div>
          <input
            className="text-input"
            value={manualTitle}
            onChange={(e) => setManualTitle(e.target.value)}
            placeholder="例如:週末生活分享"
            style={{ marginBottom: 14 }}
          />
          <div className="field-label">{SCHEDULE_COPY.contentLabel}</div>
          <textarea
            className="text-input"
            value={manualContent}
            onChange={(e) => setManualContent(e.target.value)}
            placeholder={SCHEDULE_COPY.contentPlaceholder}
            rows={4}
            style={{ marginBottom: 14, resize: 'vertical' }}
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
          <div style={{ display: 'flex', gap: 8, marginBottom: 18, flexWrap: 'wrap' }}>
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
            <button className="btn btn-ghost" style={{ borderRadius: 9 }} onClick={() => setShowModal(false)}>
              取消
            </button>
            <button className="btn btn-primary" style={{ borderRadius: 9 }} onClick={saveModal}>
              {editingId ? '儲存變更' : '新增'}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
