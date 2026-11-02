import { useEffect, useState } from 'react';
import {
  BACKEND_COPY,
  DOC_KIND_LABELS,
  DRAFT_KIND_META,
  PLATFORM_LIST,
  SCHEDULE_COPY,
  PIPELINE_COPY,
  SCHEDULE_KIND_FILTERS,
  SCHEDULE_STATUS_META,
  WEEKDAY_LABELS,
} from '../constants';
import type { AppStore } from '../hooks/useAppStore';
import type { DocKind, PlatformKey, ScheduleItem } from '../types';
import { dateLabel } from '../utils/date';
import { effectiveStatus, overdueItems, scheduleKindOf } from '../utils/schedule';
import Modal from './Modal';
import PlatformBadge from './PlatformBadge';

/** 雲端佇列項目狀態顯示(Threads/FB 共用佇列;與本地排程狀態分開定義——雲端由 cron 執行)。 */
const QUEUE_STATUS_META: Record<string, { label: string; color: string }> = {
  pending: { label: '待發佈', color: 'var(--brand)' },
  done: { label: '✓ 已發佈', color: '#06C755' },
  failed: { label: '✗ 失敗', color: '#E74C3C' },
  cancelled: { label: '已取消', color: 'var(--text-faint)' },
};

/** 排程列動作按鈕(發佈輔助為純前端半自動:複製 + 平台深連結)。 */
function actionButtonStyle(color: string) {
  return {
    fontSize: 'var(--text-meta)',
    fontWeight: 'var(--weight-bold)',
    color,
    padding: '4px 8px',
    borderRadius: 7,
  };
}

export default function Schedule({ store }: { store: AppStore }) {
  // 逾期狀態依「現在」推導:每分鐘更新一次,頁面開著也會即時反映
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(timer);
  }, []);

  // 雲端佇列(Threads/FB 共用一個佇列端點):後端啟用時進入本頁自動載入
  const proxy = store.threadsProxy;
  useEffect(() => {
    if (proxy.enabled) void proxy.loadQueue();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [proxy.enabled]);

  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [manualTitle, setManualTitle] = useState('');
  const [manualContent, setManualContent] = useState('');
  const [manualDate, setManualDate] = useState(() => store.tomorrowISO());
  const [manualTime, setManualTime] = useState('09:00');
  const [manualPlatform, setManualPlatform] = useState<PlatformKey>('fb');
  const [manualKind, setManualKind] = useState<DocKind>('copy');
  // 文檔類別篩選(IA Phase 4 D10):套用於「選定日排程」與「所有排程」;週曆與逾期不受篩選影響
  const [kindFilter, setKindFilter] = useState<'全部' | DocKind>('全部');

  const kindMatch = (i: ScheduleItem) => kindFilter === '全部' || scheduleKindOf(i) === kindFilter;

  const selectedDayItems = store.scheduleItems
    .filter((i) => i.date === store.selectedDay && kindMatch(i))
    .sort((a, b) => a.time.localeCompare(b.time));

  const allSorted = [...store.scheduleItems]
    .filter(kindMatch)
    .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));

  const overdue = overdueItems(store.scheduleItems, now);

  const openNewModal = () => {
    setEditingId(null);
    setManualTitle('');
    setManualContent('');
    setManualDate(store.tomorrowISO());
    setManualTime('09:00');
    setManualPlatform('fb');
    setManualKind('copy');
    setShowModal(true);
  };

  const openEditModal = (item: ScheduleItem) => {
    setEditingId(item.id);
    setManualTitle(item.title);
    setManualContent(item.content ?? '');
    setManualDate(item.date);
    setManualTime(item.time);
    setManualPlatform(item.platform);
    setManualKind(scheduleKindOf(item));
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
        docKind: manualKind,
      });
    } else {
      store.addManualSchedule(manualTitle, manualDate, manualTime, manualPlatform, manualContent, manualKind);
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
          <div className="t-page-title" style={{ marginBottom: 4 }}>
            定排程 Task
          </div>
          <div className="t-page-desc">跨平台發佈排程一覽,含雲端佇列與自動發文管線</div>
        </div>
        <button className="btn btn-primary" onClick={openNewModal}>
          + 新增排程
        </button>
      </div>

      <div style={{ display: 'flex', gap: 6, marginBottom: 16, alignItems: 'center' }}>
        <span className="t-meta" style={{ marginRight: 2 }}>
          類別
        </span>
        {SCHEDULE_KIND_FILTERS.map((k) => {
          const active = kindFilter === k;
          return (
            <button
              key={k}
              onClick={() => setKindFilter(k)}
              className="t-meta"
              style={{
                padding: '5px 10px',
                borderRadius: 8,
                fontWeight: 'var(--weight-semibold)',
                background: active ? 'var(--pill-brand-bg)' : 'var(--card)',
                color: active ? 'var(--brand)' : 'var(--text-faint)',
                border: `1px solid ${active ? 'var(--brand)' : 'var(--border-3)'}`,
              }}
            >
              {k === '全部' ? '全部' : DOC_KIND_LABELS[k]}
            </button>
          );
        })}
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
          <div className="t-sec-title" style={{ color: '#E74C3C' }}>
            {SCHEDULE_COPY.overdueBanner(overdue.length)}
          </div>
          <button
            className="t-sub"
            style={{ fontWeight: 'var(--weight-bold)', color: '#E74C3C', whiteSpace: 'nowrap' }}
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
                background: active ? 'var(--brand-fill)' : 'var(--card)',
                color: active ? 'var(--on-brand-fill)' : 'var(--text-sub)',
                boxShadow: '0 2px 8px rgba(108,92,231,0.06)',
              }}
            >
              {/* 週曆格的字色要跟著選取狀態走(currentColor),所以不套 .t-* 類別
                  (那會把色彩一起帶進來),改用字級 token 的 inline escape hatch */}
              <div style={{ fontSize: 'var(--text-meta)', opacity: 0.75 }}>{WEEKDAY_LABELS[i]}</div>
              <div
                className="t-num"
                style={{
                  fontSize: 'var(--text-card)',
                  fontWeight: 'var(--weight-bold)',
                  margin: '4px 0',
                }}
              >
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
        <div className="t-sec-title" style={{ marginBottom: 12 }}>
          {dateLabel(store.selectedDay)} 排程內容
        </div>
        {selectedDayItems.length === 0 && (
          <div className="t-sub" style={{ color: 'var(--text-faint)', padding: '16px 0', textAlign: 'center' }}>
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
                <div className="t-item-title">
                  {item.title}{' '}
                  <span className="pill pill-brand" style={{ marginLeft: 4 }}>
                    {DOC_KIND_LABELS[scheduleKindOf(item)]}
                  </span>
                </div>
                <div
                  className="t-sub"
                  style={{ color: meta.color, marginTop: 2, fontWeight: 'var(--weight-semibold)' }}
                >
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
                className="t-sub"
                style={{
                  color: 'var(--text-faint)',
                  fontWeight: 'var(--weight-semibold)',
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
        <div className="t-sec-title" style={{ marginBottom: 12 }}>
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
              <div className="t-sub t-num" style={{ width: 120, flexShrink: 0 }}>
                {dateLabel(item.date)} {item.time}
              </div>
              <div className="t-item-title" style={{ flex: 1 }}>
                {item.title}{' '}
                <span className="pill pill-brand" style={{ marginLeft: 4 }}>
                  {DOC_KIND_LABELS[scheduleKindOf(item)]}
                </span>
              </div>
              <div className="t-meta" style={{ fontWeight: 'var(--weight-bold)', color: meta.color }}>
                {meta.label}
              </div>
            </div>
          );
        })}
      </div>

      {store.backendEnabled && (
        <div className="card" style={{ padding: 18, marginTop: 20 }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 8,
            }}
          >
            <div className="t-sec-title">
              {PIPELINE_COPY.cardTitle}
            </div>
            <button
              onClick={() => store.updateAutoPipeline({ enabled: !store.autoPipeline.enabled })}
              className="t-sub"
              style={{
                fontWeight: 'var(--weight-bold)',
                padding: '5px 12px',
                borderRadius: 8,
                background: store.autoPipeline.enabled ? 'var(--brand-fill)' : 'var(--bg)',
                color: store.autoPipeline.enabled ? 'var(--on-brand-fill)' : 'var(--text-faint)',
              }}
            >
              {store.autoPipeline.enabled ? '✓ ' : ''}
              {PIPELINE_COPY.enable}
            </button>
          </div>
          <div className="t-note" style={{ marginBottom: 12 }}>
            {PIPELINE_COPY.desc}
          </div>

          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginBottom: 12 }}>
            <label className="t-meta" style={{ fontWeight: 'var(--weight-bold)', color: 'var(--text-weak)' }}>
              {PIPELINE_COPY.timeLabel}
            </label>
            <input
              className="text-input"
              type="time"
              value={store.autoPipeline.time}
              onChange={(e) => store.updateAutoPipeline({ time: e.target.value })}
              style={{ width: 100, padding: '6px 8px', fontSize: 'var(--text-sub)' }}
            />
            <label
              className="t-meta"
              style={{ fontWeight: 'var(--weight-bold)', color: 'var(--text-weak)', marginLeft: 8 }}
            >
              {PIPELINE_COPY.horizonLabel}
            </label>
            {[7, 14, 30].map((h) => {
              const active = store.autoPipeline.horizonDays === h;
              return (
                <button
                  key={h}
                  onClick={() => store.updateAutoPipeline({ horizonDays: h })}
                  className="t-sub"
                  style={{
                    padding: '5px 11px',
                    borderRadius: 8,
                    fontWeight: 'var(--weight-bold)',
                    background: active ? 'var(--pill-brand-bg)' : 'var(--card)',
                    color: active ? 'var(--brand)' : 'var(--text-faint)',
                    border: `1px solid ${active ? 'var(--brand)' : 'var(--pill-brand-bg-2)'}`,
                  }}
                >
                  {h}
                </button>
              );
            })}
          </div>

          {/* P2(D2 主體):內容來源切換 + 日誌 Doc 選擇 + 日期工具 + 誠實三標示 */}
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginBottom: 12 }}>
            <label className="t-meta" style={{ fontWeight: 'var(--weight-bold)', color: 'var(--text-weak)' }}>
              {PIPELINE_COPY.sourceLabel}
            </label>
            {(
              [
                ['templates', PIPELINE_COPY.sourceTemplates],
                ['journal-ai', PIPELINE_COPY.sourceJournal],
              ] as const
            ).map(([value, label]) => {
              const active = store.autoPipeline.source === value;
              return (
                <button
                  key={value}
                  onClick={() => store.updateAutoPipeline({ source: value })}
                  className="t-sub"
                  style={{
                    padding: '5px 11px',
                    borderRadius: 8,
                    fontWeight: 'var(--weight-bold)',
                    background: active ? 'var(--pill-brand-bg)' : 'var(--card)',
                    color: active ? 'var(--brand)' : 'var(--text-faint)',
                    border: `1px solid ${active ? 'var(--brand)' : 'var(--pill-brand-bg-2)'}`,
                  }}
                >
                  {label}
                </button>
              );
            })}
          </div>

          {store.autoPipeline.source === 'journal-ai' && (
            <div
              style={{
                border: '1px solid var(--border-2)',
                borderRadius: 10,
                padding: 12,
                marginBottom: 12,
                background: 'var(--surface-soft)',
              }}
            >
              <div
                className="t-meta"
                style={{ fontWeight: 'var(--weight-bold)', color: 'var(--text-weak)', marginBottom: 8 }}
              >
                {PIPELINE_COPY.journalPickerLabel}
              </div>
              {store.drive.status !== 'connected' ? (
                <div className="t-meta">{PIPELINE_COPY.journalDriveOff}</div>
              ) : (
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                  <select
                    className="text-input"
                    value={store.autoPipeline.journalFileId}
                    onChange={(e) => {
                      const doc = store.drive.docs.find((d) => d.id === e.target.value);
                      store.updateAutoPipeline({
                        journalFileId: e.target.value,
                        journalFileName: doc?.name ?? '',
                      });
                    }}
                    style={{ flex: 1, minWidth: 180, padding: '6px 8px', fontSize: 'var(--text-sub)' }}
                  >
                    <option value="">{PIPELINE_COPY.journalPickerButton}</option>
                    {store.drive.docs.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                  <span className="t-meta">
                    {store.autoPipeline.journalFileName || PIPELINE_COPY.journalNone}
                  </span>
                  <button
                    onClick={() => {
                      const today = new Date();
                      const y = today.getFullYear();
                      const m = String(today.getMonth() + 1).padStart(2, '0');
                      const d = String(today.getDate()).padStart(2, '0');
                      void navigator.clipboard.writeText(`${y}-${m}-${d}`);
                      store.showToast(PIPELINE_COPY.todayDateToast);
                    }}
                    className="t-meta"
                    style={{ fontWeight: 'var(--weight-bold)', color: 'var(--brand)' }}
                  >
                    {PIPELINE_COPY.todayDateButton}
                  </button>
                </div>
              )}
              <div className="t-note" style={{ marginTop: 10 }}>
                {PIPELINE_COPY.honesty1}
                <br />
                {PIPELINE_COPY.honesty2}
                <br />
                {PIPELINE_COPY.honesty3}
              </div>
            </div>
          )}

          {store.autoPipeline.enabled && (
            <div
              className="t-sub"
              style={{
                color: store.pipelineLowWater ? 'var(--accent)' : 'var(--text-sub)',
                fontWeight: 'var(--weight-bold)',
                marginBottom: 8,
              }}
            >
              {PIPELINE_COPY.statusQueued(store.autoPipeline.queuedThrough)}
              {' · '}
              {PIPELINE_COPY.statusRemaining(store.pipelineRemainingDays)}
            </div>
          )}
          {store.autoPipeline.enabled && store.pipelineLowWater && (
            <div className="t-meta" style={{ color: 'var(--accent)', marginBottom: 8 }}>
              {PIPELINE_COPY.lowWater}
            </div>
          )}
          {store.autoPipeline.enabled && store.threadsProxy.status !== 'connected' && (
            <div className="t-meta" style={{ color: 'var(--error)', marginBottom: 8 }}>
              {PIPELINE_COPY.notConnected}
            </div>
          )}

          <button
            className="btn btn-outline"
            style={{ borderRadius: 9 }}
            disabled={!store.autoPipeline.enabled || store.threadsProxy.status !== 'connected'}
            onClick={() => void store.topUpPipeline()}
          >
            {PIPELINE_COPY.fillNow}
          </button>
        </div>
      )}

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
            <div className="t-sec-title">
              {BACKEND_COPY.queueTitle}
            </div>
            <button
              onClick={() => void proxy.loadQueue()}
              disabled={proxy.queueLoading}
              className="t-meta"
              style={{ fontWeight: 'var(--weight-semibold)', color: 'var(--brand)' }}
            >
              {proxy.queueLoading ? '載入中…' : BACKEND_COPY.queueRefresh}
            </button>
          </div>
          {proxy.queue.length === 0 && (
            <div className="t-sub" style={{ padding: '16px 0', textAlign: 'center' }}>
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
                <div className="t-sub t-num" style={{ width: 110, flexShrink: 0 }}>
                  {timeLabel}
                </div>
                <div
                  className="t-sub"
                  style={{ color: 'var(--text-sub)', flex: 1, minWidth: 0 }}
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
                <div className="t-meta" style={{ fontWeight: 'var(--weight-bold)', flexShrink: 0 }}>
                  {item.platform === 'facebook' ? 'FB' : 'Threads'}
                </div>
                <div className="t-meta" style={{ fontWeight: 'var(--weight-bold)', color: meta.color }}>
                  {meta.label}
                </div>
                {item.status === 'pending' && (
                  <button
                    onClick={() => void proxy.cancel(item.id)}
                    className="t-meta"
                    style={{ fontWeight: 'var(--weight-semibold)', padding: '4px 8px' }}
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
          <div className="t-card-title" style={{ marginBottom: 16 }}>
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
          <div className="field-label">文檔類型</div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
            {DRAFT_KIND_META.map((k) => {
              const active = manualKind === k.key;
              return (
                <button
                  key={k.key}
                  onClick={() => setManualKind(k.key)}
                  className="t-sub"
                  style={{
                    padding: '8px 14px',
                    borderRadius: 9,
                    fontWeight: 'var(--weight-semibold)',
                    background: active ? 'var(--pill-brand-bg)' : 'var(--card)',
                    color: active ? 'var(--brand)' : 'var(--text-faint)',
                    border: `1px solid ${active ? 'var(--brand)' : 'var(--pill-brand-bg-2)'}`,
                  }}
                >
                  {k.label}
                </button>
              );
            })}
          </div>
          <div className="field-label">平台</div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 18, flexWrap: 'wrap' }}>
            {PLATFORM_LIST.map((p) => {
              const active = manualPlatform === p.key;
              return (
                <button
                  key={p.key}
                  onClick={() => setManualPlatform(p.key)}
                  className="t-sub"
                  style={{
                    padding: '8px 14px',
                    borderRadius: 9,
                    fontWeight: 'var(--weight-semibold)',
                    background: active ? p.color : 'var(--card)',
                    color: active ? '#fff' : 'var(--text-sub)',
                    border: `1px solid ${active ? p.color : 'var(--pill-brand-bg-2)'}`,
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
