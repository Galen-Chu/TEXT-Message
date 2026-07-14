import { useState } from 'react';
import { PLATFORM_LIST, TONE_OPTIONS } from '../constants';
import type { AppStore } from '../hooks/useAppStore';
import { charCount } from '../utils/date';
import Modal from './Modal';

export default function Draft({ store }: { store: AppStore }) {
  const [showTemplatePicker, setShowTemplatePicker] = useState(false);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [scheduleDate, setScheduleDate] = useState(store.tomorrowISO);
  const [scheduleTime, setScheduleTime] = useState('09:00');

  const hasDraftTarget = !!store.selectedMailId;
  const sourceMail =
    store.selectedMailId && store.selectedMailId !== 'blank'
      ? store.emails.find((e) => e.id === store.selectedMailId)
      : null;

  const draftLength = charCount(store.draftText);
  const selectedPlatforms = PLATFORM_LIST.filter((p) => store.draftPlatforms[p.key]);
  const selectedPlatformLabelsText =
    selectedPlatforms.map((p) => p.label).join('、') || '尚未選擇平台';

  return (
    <div>
      <div style={{ fontSize: 20, fontWeight: 900, color: 'var(--text-main)', marginBottom: 4 }}>
        草稿撰寫
      </div>
      <div style={{ fontSize: 13, color: 'var(--text-weak)', marginBottom: 20 }}>
        將郵件內容轉換成適合各平台的貼文草稿
      </div>

      {!hasDraftTarget && (
        <div className="card" style={{ padding: 48, textAlign: 'center' }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>📝</div>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-main)', marginBottom: 6 }}>
            還沒有選擇內容來源
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-weak)', marginBottom: 20 }}>
            從 Gmail 挑一封信轉成草稿,或直接空白開始撰寫
          </div>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
            <button className="btn btn-outline" onClick={() => store.setActiveTab('inbox')}>
              前往收件匣挑選
            </button>
            <button className="btn btn-primary" onClick={store.startBlankDraft}>
              空白草稿開始撰寫
            </button>
          </div>
        </div>
      )}

      {hasDraftTarget && (
        <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start' }}>
          {sourceMail && (
            <div className="card" style={{ width: 280, flexShrink: 0, padding: 18 }}>
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: 'var(--text-weak)',
                  marginBottom: 10,
                  letterSpacing: 0.5,
                }}
              >
                原始郵件參考
              </div>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-main)' }}>
                {sourceMail.subject}
              </div>
              <div style={{ fontSize: 11.5, color: 'var(--text-faint)', margin: '4px 0 10px 0' }}>
                {sourceMail.sender} · {sourceMail.date}
              </div>
              <div
                style={{
                  fontSize: 12.5,
                  color: 'var(--text-sub)',
                  lineHeight: 1.7,
                  maxHeight: 340,
                  overflowY: 'auto',
                  whiteSpace: 'pre-line',
                }}
              >
                {sourceMail.fullBody}
              </div>
            </div>
          )}

          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className="card" style={{ padding: 18 }}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: 10,
                }}
              >
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-weak)' }}>
                  AI 語氣輔助改寫(輔助功能,可略過)
                </div>
                <button
                  onClick={() => setShowTemplatePicker(true)}
                  style={{ fontSize: 12, fontWeight: 700, color: 'var(--brand)' }}
                >
                  📋 從罐頭訊息庫插入
                </button>
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {TONE_OPTIONS.map((tone) => (
                  <button
                    key={tone}
                    onClick={() => store.applyTone(tone)}
                    style={{
                      padding: '7px 14px',
                      borderRadius: 9,
                      fontSize: 12.5,
                      fontWeight: 600,
                      background: 'var(--bg)',
                      color: 'var(--brand)',
                      border: '1px solid var(--pill-purple-bg-2)',
                    }}
                  >
                    {tone}
                  </button>
                ))}
              </div>
            </div>

            <div className="card" style={{ padding: 18 }}>
              <textarea
                value={store.draftText}
                onChange={(e) => store.setDraftText(e.target.value)}
                placeholder="開始撰寫你的貼文內容…"
                style={{
                  width: '100%',
                  minHeight: 160,
                  border: '1px solid var(--border-3)',
                  borderRadius: 12,
                  padding: 14,
                  fontSize: 14,
                  fontFamily: 'inherit',
                  lineHeight: 1.7,
                  color: 'var(--text-main)',
                  resize: 'vertical',
                }}
              />
              <div style={{ textAlign: 'right', fontSize: 11.5, color: 'var(--text-faint)', marginTop: 6 }}>
                {draftLength} 字
              </div>
            </div>

            <div className="card" style={{ padding: 18 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-weak)', marginBottom: 12 }}>
                選擇發布平台
              </div>
              <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
                {PLATFORM_LIST.map((p) => {
                  const active = store.draftPlatforms[p.key];
                  return (
                    <button
                      key={p.key}
                      onClick={() => store.togglePlatform(p.key)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 7,
                        padding: '8px 14px',
                        borderRadius: 9,
                        fontSize: 12.5,
                        fontWeight: 600,
                        background: active ? 'var(--pill-purple-bg)' : '#fff',
                        color: active ? 'var(--brand)' : 'var(--text-faint)',
                        border: `1px solid ${active ? '#D9D0FA' : 'var(--pill-purple-bg-2)'}`,
                      }}
                    >
                      <span
                        style={{
                          width: 20,
                          height: 20,
                          borderRadius: 6,
                          background: p.color,
                          color: '#fff',
                          fontSize: 10,
                          fontWeight: 700,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        {p.badge}
                      </span>
                      <span>{p.label}</span>
                    </button>
                  );
                })}
              </div>

              {selectedPlatforms.map((p) => {
                const over = draftLength > p.limit;
                return (
                  <div
                    key={p.key}
                    style={{
                      border: '1px solid var(--border-2)',
                      borderRadius: 12,
                      padding: 14,
                      marginBottom: 10,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                      <span
                        style={{
                          width: 18,
                          height: 18,
                          borderRadius: 5,
                          background: p.color,
                          color: '#fff',
                          fontSize: 9,
                          fontWeight: 700,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        {p.badge}
                      </span>
                      <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-main)' }}>
                        {p.label} 預覽
                      </span>
                      <span
                        style={{
                          fontSize: 11,
                          color: over ? 'var(--error)' : 'var(--text-faint)',
                          marginLeft: 'auto',
                        }}
                      >
                        {draftLength} / {p.limit} 字
                      </span>
                    </div>
                    <div style={{ fontSize: 13, color: '#3A3750', lineHeight: 1.7, whiteSpace: 'pre-line' }}>
                      {store.draftText || '(尚未輸入內容)'}
                    </div>
                  </div>
                );
              })}
            </div>

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button className="btn btn-outline" style={{ padding: '11px 20px' }} onClick={store.saveDraft}>
                儲存草稿
              </button>
              <button
                className="btn btn-accent"
                style={{ padding: '11px 22px' }}
                onClick={() => setShowScheduleModal(true)}
              >
                加入排程 →
              </button>
            </div>
          </div>
        </div>
      )}

      {showTemplatePicker && (
        <Modal
          onClose={() => setShowTemplatePicker(false)}
          width={480}
          style={{ maxHeight: '70vh', display: 'flex', flexDirection: 'column' }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 16,
            }}
          >
            <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-main)' }}>插入罐頭訊息</div>
            <button
              onClick={() => setShowTemplatePicker(false)}
              style={{ fontSize: 18, color: 'var(--text-faint)' }}
            >
              ✕
            </button>
          </div>
          <div style={{ overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 10 }}>
            {store.templates.map((tpl) => (
              <button
                key={tpl.id}
                onClick={() => {
                  store.insertTemplateIntoDraft(tpl);
                  setShowTemplatePicker(false);
                }}
                style={{
                  textAlign: 'left',
                  padding: '12px 14px',
                  border: '1px solid var(--border-2)',
                  borderRadius: 10,
                }}
              >
                <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text-main)' }}>{tpl.title}</div>
                <div
                  style={{ fontSize: 11.5, color: 'var(--text-weak)', marginTop: 4, whiteSpace: 'pre-line' }}
                >
                  {tpl.text}
                </div>
              </button>
            ))}
          </div>
        </Modal>
      )}

      {showScheduleModal && (
        <Modal onClose={() => setShowScheduleModal(false)} width={420}>
          <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-main)', marginBottom: 16 }}>
            加入排程
          </div>
          <div className="field-label">日期</div>
          <input
            className="text-input"
            type="date"
            value={scheduleDate}
            onChange={(e) => setScheduleDate(e.target.value)}
            style={{ marginBottom: 14 }}
          />
          <div className="field-label">時間</div>
          <input
            className="text-input"
            type="time"
            value={scheduleTime}
            onChange={(e) => setScheduleTime(e.target.value)}
            style={{ marginBottom: 16 }}
          />
          <div style={{ fontSize: 11.5, color: 'var(--text-faint)', marginBottom: 16 }}>
            將發布至:{selectedPlatformLabelsText}
          </div>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <button
              className="btn btn-ghost"
              style={{ borderRadius: 9 }}
              onClick={() => setShowScheduleModal(false)}
            >
              取消
            </button>
            <button
              className="btn btn-accent"
              style={{ borderRadius: 9 }}
              onClick={() => {
                store.confirmSchedule(scheduleDate, scheduleTime);
                setShowScheduleModal(false);
              }}
            >
              確認排程
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
