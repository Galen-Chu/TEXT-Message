import { useState } from 'react';
import {
  DRAFT_AI_COPY,
  GEMINI_KEY_MODAL,
  GEMINI_MODE_LABEL,
  PLATFORM_LIST,
  PLATFORM_META,
  TONE_OPTIONS,
  YOUTUBE_COPY,
  YOUTUBE_ERROR_COPY,
} from '../constants';
import type { AppStore } from '../hooks/useAppStore';
import { YOUTUBE_ENABLED } from '../services/youtube/config';
import { fileSizeMb, resolvePublishPlan } from '../services/youtube/video';
import { charCount, dateLabel } from '../utils/date';
import { extractVariables } from '../utils/variables';
import type { Template } from '../types';
import Modal from './Modal';
import GeminiKeyModal from './GeminiKeyModal';
import VariableFillModal from './VariableFillModal';

export default function Draft({ store }: { store: AppStore }) {
  const [showTemplatePicker, setShowTemplatePicker] = useState(false);
  const [showSocialPicker, setShowSocialPicker] = useState(false);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [showKeyModal, setShowKeyModal] = useState(false);
  const [scheduleDate, setScheduleDate] = useState(store.tomorrowISO);
  const [scheduleTime, setScheduleTime] = useState('09:00');
  const [customInstruction, setCustomInstruction] = useState('');
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [publishMode, setPublishMode] = useState<'now' | 'schedule'>('now');
  const [publishAtLocal, setPublishAtLocal] = useState(`${store.tomorrowISO}T09:00`);
  const [fillInsert, setFillInsert] = useState<Template | null>(null);

  const yt = store.youtube;

  const handleYoutubeUpload = async () => {
    if (!videoFile) {
      store.showToast(YOUTUBE_COPY.noFileToast);
      return;
    }
    if (!store.draftText.trim()) {
      store.showToast(YOUTUBE_COPY.noTextToast);
      return;
    }
    let plan;
    try {
      plan = resolvePublishPlan(publishMode, publishAtLocal);
    } catch {
      store.showToast(YOUTUBE_COPY.pastTimeToast);
      return;
    }
    const title = store.draftText.split('\n')[0];
    try {
      await yt.upload({
        file: videoFile,
        title,
        description: store.draftText,
        privacyStatus: plan.privacyStatus,
        publishAt: plan.mode === 'schedule' ? plan.publishAt : undefined,
      });
      if (plan.mode === 'now') {
        store.appendPublishedHistory('yt', title, store.draftText);
        store.showToast(YOUTUBE_COPY.uploadedToast);
      } else {
        store.addManualSchedule(title, plan.date, plan.time, 'yt', store.draftText);
        store.showToast(YOUTUBE_COPY.scheduledToast);
      }
    } catch {
      // 錯誤已由 useYoutube 記錄(yt.error),於卡片內顯示,此處不再 toast
    }
  };

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
            從 Gmail 挑一封信、社群媒體歷史貼文轉成草稿,或直接空白開始撰寫
          </div>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
            <button className="btn btn-outline" onClick={() => store.setActiveTab('inbox')}>
              前往郵件匣挑選
            </button>
            <button className="btn btn-outline" onClick={() => setShowSocialPicker(true)}>
              從社群媒體挑選
            </button>
            <button className="btn btn-primary" onClick={store.startBlankDraft}>
              空白草稿開始撰寫
            </button>
          </div>
        </div>
      )}

      {hasDraftTarget && (
        <div className="draft-layout" style={{ display: 'flex', gap: 20, alignItems: 'flex-start' }}>
          {!sourceMail && store.selectedMailId !== 'blank' && (
            <div className="card draft-source" style={{ padding: 18, fontSize: 12.5, color: 'var(--text-weak)' }}>
              來源郵件已不在清單中(可能已中斷連線或重新整理)
            </div>
          )}
          {sourceMail && (
            <div className="card draft-source" style={{ padding: 18 }}>
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
                  {store.aiBusy
                    ? GEMINI_MODE_LABEL.busy
                    : store.geminiKey
                      ? GEMINI_MODE_LABEL.on
                      : GEMINI_MODE_LABEL.off}
                </div>
                <div style={{ display: 'flex', gap: 14 }}>
                  <button
                    onClick={() => setShowKeyModal(true)}
                    style={{ fontSize: 12, fontWeight: 700, color: 'var(--brand)' }}
                  >
                    ⚙️ AI 設定
                  </button>
                  <button
                    onClick={() => setShowTemplatePicker(true)}
                    style={{ fontSize: 12, fontWeight: 700, color: 'var(--brand)' }}
                  >
                    📋 從文管庫插入
                  </button>
                  <button
                    onClick={() => setShowSocialPicker(true)}
                    style={{ fontSize: 12, fontWeight: 700, color: 'var(--brand)' }}
                  >
                    📣 從社群媒體挑選
                  </button>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {TONE_OPTIONS.map((tone) => (
                  <button
                    key={tone}
                    onClick={() => void store.applyTone(tone)}
                    disabled={store.aiBusy}
                    style={{
                      padding: '7px 14px',
                      borderRadius: 9,
                      fontSize: 12.5,
                      fontWeight: 600,
                      background: 'var(--bg)',
                      color: 'var(--brand)',
                      border: '1px solid var(--pill-purple-bg-2)',
                      opacity: store.aiBusy ? 0.5 : 1,
                      cursor: store.aiBusy ? 'wait' : 'pointer',
                    }}
                  >
                    {tone}
                  </button>
                ))}
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                <input
                  className="text-input"
                  value={customInstruction}
                  onChange={(e) => setCustomInstruction(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') void store.applyCustomInstruction(customInstruction);
                  }}
                  placeholder={DRAFT_AI_COPY.customInstructionPlaceholder}
                  aria-label={DRAFT_AI_COPY.customInstructionLabel}
                  style={{ flex: 1, borderRadius: 9, padding: '8px 12px', fontSize: 12.5 }}
                />
                <button
                  onClick={() => void store.applyCustomInstruction(customInstruction)}
                  disabled={store.aiBusy}
                  style={{
                    padding: '8px 16px',
                    borderRadius: 9,
                    fontSize: 12.5,
                    fontWeight: 700,
                    background: 'var(--pill-purple-bg)',
                    color: 'var(--brand)',
                    opacity: store.aiBusy ? 0.5 : 1,
                    cursor: store.aiBusy ? 'wait' : 'pointer',
                  }}
                >
                  {DRAFT_AI_COPY.customInstructionApply}
                </button>
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
                        background: active ? 'var(--pill-purple-bg)' : 'var(--card)',
                        color: active ? 'var(--brand)' : 'var(--text-faint)',
                        border: `1px solid ${active ? 'var(--brand)' : 'var(--pill-purple-bg-2)'}`,
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
                    <div style={{ fontSize: 13, color: 'var(--text-sub)', lineHeight: 1.7, whiteSpace: 'pre-line' }}>
                      {store.draftText || '(尚未輸入內容)'}
                    </div>
                  </div>
                );
              })}
            </div>

            {store.draftPlatforms.yt && YOUTUBE_ENABLED && (
              <div className="card" style={{ padding: 18 }}>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: 4,
                  }}
                >
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-weak)' }}>
                    {YOUTUBE_COPY.cardTitle}
                  </div>
                  {yt.status === 'connected' && (
                    <button
                      onClick={yt.disconnect}
                      style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--text-faint)' }}
                    >
                      {YOUTUBE_COPY.disconnect}
                    </button>
                  )}
                </div>
                <div style={{ fontSize: 11.5, color: 'var(--text-faint)', marginBottom: 12 }}>
                  {YOUTUBE_COPY.cardDesc}
                </div>

                {yt.status !== 'connected' ? (
                  <div>
                    <button
                      className="btn btn-outline"
                      onClick={() => void yt.connect()}
                      disabled={yt.status === 'connecting'}
                    >
                      {yt.status === 'connecting' ? YOUTUBE_COPY.connecting : YOUTUBE_COPY.connect}
                    </button>
                    {yt.status === 'error' && yt.error && (
                      <div style={{ fontSize: 11.5, color: 'var(--error)', marginTop: 8 }}>
                        {YOUTUBE_ERROR_COPY[yt.error.code] ?? YOUTUBE_ERROR_COPY.unknown}
                      </div>
                    )}
                  </div>
                ) : (
                  <div>
                    <div style={{ fontSize: 11, color: 'var(--text-faint)', marginBottom: 10 }}>
                      {YOUTUBE_COPY.connectedHint}
                    </div>
                    <input
                      id="yt-video-file"
                      type="file"
                      accept="video/*"
                      hidden
                      onChange={(e) => setVideoFile(e.target.files?.[0] ?? null)}
                    />
                    <label
                      htmlFor="yt-video-file"
                      className="btn btn-outline"
                      style={{ display: 'inline-block', cursor: 'pointer', marginBottom: 12 }}
                    >
                      {videoFile
                        ? `🎬 ${videoFile.name}(${fileSizeMb(videoFile.size)} MB)`
                        : `📎 ${YOUTUBE_COPY.pickFile}`}
                    </label>
                    <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                      {(
                        [
                          ['now', YOUTUBE_COPY.publishNowLabel],
                          ['schedule', YOUTUBE_COPY.publishScheduleLabel],
                        ] as const
                      ).map(([mode, label]) => {
                        const active = publishMode === mode;
                        return (
                          <button
                            key={mode}
                            onClick={() => setPublishMode(mode)}
                            style={{
                              padding: '7px 14px',
                              borderRadius: 9,
                              fontSize: 12.5,
                              fontWeight: 600,
                              background: active ? 'var(--pill-purple-bg)' : 'var(--card)',
                              color: active ? 'var(--brand)' : 'var(--text-faint)',
                              border: `1px solid ${active ? 'var(--brand)' : 'var(--pill-purple-bg-2)'}`,
                            }}
                          >
                            {label}
                          </button>
                        );
                      })}
                    </div>
                    {publishMode === 'schedule' && (
                      <input
                        className="text-input"
                        type="datetime-local"
                        value={publishAtLocal}
                        onChange={(e) => setPublishAtLocal(e.target.value)}
                        aria-label={YOUTUBE_COPY.publishAtLabel}
                        style={{ marginBottom: 12 }}
                      />
                    )}
                    <button
                      className="btn btn-accent"
                      onClick={() => void handleYoutubeUpload()}
                      disabled={!videoFile || yt.uploadState === 'uploading'}
                      style={{ width: '100%' }}
                    >
                      {yt.uploadState === 'uploading'
                        ? YOUTUBE_COPY.uploading(Math.round(yt.uploadProgress * 100))
                        : YOUTUBE_COPY.upload}
                    </button>
                    {yt.uploadState === 'uploading' && (
                      <div
                        style={{
                          height: 6,
                          borderRadius: 3,
                          background: 'var(--bg)',
                          marginTop: 10,
                          overflow: 'hidden',
                        }}
                      >
                        <div
                          style={{
                            width: `${Math.round(yt.uploadProgress * 100)}%`,
                            height: '100%',
                            background: 'var(--brand)',
                            transition: 'width 0.2s ease',
                          }}
                        />
                      </div>
                    )}
                    {yt.error && (
                      <div style={{ fontSize: 11.5, color: 'var(--error)', marginTop: 8 }}>
                        {YOUTUBE_ERROR_COPY[yt.error.code] ?? YOUTUBE_ERROR_COPY.unknown}
                      </div>
                    )}
                    <div style={{ fontSize: 11, color: 'var(--text-faint)', marginTop: 10 }}>
                      {YOUTUBE_COPY.auditCaveat}
                    </div>
                  </div>
                )}
              </div>
            )}

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button
                onClick={store.discardDraft}
                style={{ padding: '11px 12px', fontSize: 12.5, fontWeight: 700, color: 'var(--error)' }}
              >
                捨棄草稿
              </button>
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

      {showKeyModal && (
        <GeminiKeyModal
          label={GEMINI_KEY_MODAL.title}
          hasKey={!!store.geminiKey}
          onSave={(key) => {
            store.setGeminiKey(key);
            store.showToast(GEMINI_KEY_MODAL.savedToast);
          }}
          onClear={() => {
            store.setGeminiKey('');
            store.showToast(GEMINI_KEY_MODAL.clearedToast);
          }}
          onClose={() => setShowKeyModal(false)}
        />
      )}

      {fillInsert && (
        <VariableFillModal
          template={fillInsert}
          mode="apply"
          onClose={() => setFillInsert(null)}
          onApply={(values) => {
            store.insertTemplateIntoDraft(fillInsert, values);
            setFillInsert(null);
          }}
        />
      )}

      {showTemplatePicker && (
        <Modal
          onClose={() => setShowTemplatePicker(false)}
          width={480}
          label="插入文管庫內容"
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
            <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-main)' }}>插入文管庫內容</div>
            <button
              onClick={() => setShowTemplatePicker(false)}
              aria-label="關閉"
              style={{ fontSize: 18, color: 'var(--text-faint)' }}
            >
              ✕
            </button>
          </div>
          <div style={{ overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[...store.templates, ...store.copyTemplates].map((tpl) => (
              <button
                key={tpl.id}
                onClick={() => {
                  if (extractVariables(tpl.text).length > 0) {
                    setFillInsert(tpl);
                  } else {
                    store.insertTemplateIntoDraft(tpl);
                  }
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

      {showSocialPicker && (
        <Modal
          onClose={() => setShowSocialPicker(false)}
          width={480}
          label="從社群媒體挑選"
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
            <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-main)' }}>從社群媒體挑選</div>
            <button
              onClick={() => setShowSocialPicker(false)}
              aria-label="關閉"
              style={{ fontSize: 18, color: 'var(--text-faint)' }}
            >
              ✕
            </button>
          </div>
          <div style={{ overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 10 }}>
            {store.socialHistory.map((post) => (
              <button
                key={post.id}
                onClick={() => {
                  store.pickSocialPost(post);
                  setShowSocialPicker(false);
                }}
                style={{
                  textAlign: 'left',
                  padding: '12px 14px',
                  border: '1px solid var(--border-2)',
                  borderRadius: 10,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text-main)' }}>
                    {post.title}
                  </div>
                  <span
                    style={{
                      width: 18,
                      height: 18,
                      borderRadius: 5,
                      background: PLATFORM_META[post.platform].color,
                      color: '#fff',
                      fontSize: 9,
                      fontWeight: 700,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    {PLATFORM_META[post.platform].badge}
                  </span>
                </div>
                <div
                  style={{ fontSize: 11.5, color: 'var(--text-weak)', marginTop: 4, whiteSpace: 'pre-line' }}
                >
                  {post.content}
                </div>
                <div style={{ fontSize: 10.5, color: 'var(--text-faint)', marginTop: 4 }}>
                  {dateLabel(post.date)}
                </div>
              </button>
            ))}
          </div>
        </Modal>
      )}

      {showScheduleModal && (
        <Modal onClose={() => setShowScheduleModal(false)} width={420} label="加入排程">
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
