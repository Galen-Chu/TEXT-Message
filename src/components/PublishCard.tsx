import { useState } from 'react';
import {
  BACKEND_COPY,
  BACKEND_ERROR_COPY,
  BACKEND_FB_COPY,
  BACKEND_FB_ERROR_COPY,
  PLATFORM_LIST,
  PUBLISH_CARD_COPY,
  SCHEDULE_COPY,
  YOUTUBE_COPY,
  YOUTUBE_ERROR_COPY,
} from '../constants';
import type { AppStore } from '../hooks/useAppStore';
import { YOUTUBE_ENABLED } from '../services/youtube/config';
import { fileSizeMb, resolvePublishPlan } from '../services/youtube/video';
import { charCount } from '../utils/date';
import { buildPublishTarget } from '../utils/publish';
import type { PlatformKey } from '../types';

/**
 * 頁簽解析(D14):上次頁簽仍在已選清單中則保持,否則退回第一個;無已選平台回 null。
 * 純函式,配 PublishCard.test.ts。
 */
export function resolveActiveTab(
  selected: PlatformKey[],
  prev: PlatformKey | null,
): PlatformKey | null {
  if (!selected.length) return null;
  return prev !== null && selected.includes(prev) ? prev : selected[0];
}

/** 各平台排程時間欄的預設值(沿用重構前各卡的慣例時間)。 */
const DEFAULT_SCHEDULE_AT: Record<PlatformKey, string> = {
  yt: 'T09:00',
  threads: 'T10:00',
  line: 'T10:00',
  ig: 'T10:00',
  fb: 'T10:30',
};

/**
 * 發佈卡(D14,2026-10-03):單一卡片 + 已勾選平台的頁簽,取代原本
 * 「選擇發布平台卡內預覽堆疊 + Threads/FB/YouTube 三張獨立卡」。
 * 顯示層重構:store/worker/API 全不動;半自動平台(IG/LINE,以及未設後端的
 * Threads/FB)提供「複製內容並開啟平台」深連結(沿用 utils/publish)。
 */
export default function PublishCard({ store }: { store: AppStore }) {
  const selected = PLATFORM_LIST.filter((p) => store.draftPlatforms[p.key]).map((p) => p.key);
  const [tab, setTab] = useState<PlatformKey | null>(null);
  const active = resolveActiveTab(selected, tab);
  const activeMeta = active ? PLATFORM_LIST.find((p) => p.key === active) : null;

  // 各平台各自記住的排程時間(D14-2)
  const [scheduleAt, setScheduleAt] = useState<Record<PlatformKey, string>>(
    () =>
      Object.fromEntries(
        PLATFORM_LIST.map((p) => [p.key, `${store.tomorrowISO}${DEFAULT_SCHEDULE_AT[p.key]}`]),
      ) as Record<PlatformKey, string>,
  );
  const setSchedule = (key: PlatformKey, value: string) =>
    setScheduleAt((m) => ({ ...m, [key]: value }));

  // YouTube 上傳狀態(自 Draft.tsx 移入)
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [publishMode, setPublishMode] = useState<'now' | 'schedule'>('now');
  const [publishAtLocal, setPublishAtLocal] = useState(`${store.tomorrowISO}T09:00`);
  const yt = store.youtube;

  const draftLength = charCount(store.draftText);

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
      // 錯誤已由 useYoutube 記錄(yt.error),於卡內顯示,此處不再 toast
    }
  };

  /** 半自動:複製內容並開啟平台(沿用排程頁 openSchedulePublish 的流程與文案)。 */
  const copyAndOpen = async (platform: PlatformKey) => {
    const text = store.draftText.trim();
    if (!text) {
      store.showToast(PUBLISH_CARD_COPY.emptyTextToast);
      return;
    }
    const target = buildPublishTarget(platform, text);
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      store.showToast(SCHEDULE_COPY.copyFailToast);
      window.open(target.url, '_blank', 'noopener');
      return;
    }
    window.open(target.url, '_blank', 'noopener');
    store.showToast(
      target.canPrefill ? SCHEDULE_COPY.openPrefillToast(activeMeta?.label ?? '') : SCHEDULE_COPY.openPasteToast(activeMeta?.label ?? ''),
    );
  };

  // ---- 各平台頁簽內容 ----

  const renderPreview = (limit: number) => {
    const over = draftLength > limit;
    return (
      <div style={{ border: '1px solid var(--border-2)', borderRadius: 12, padding: 14, marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-main)' }}>
            {activeMeta?.label} 預覽
          </span>
          <span
            style={{
              fontSize: 11,
              color: over ? 'var(--error)' : 'var(--text-faint)',
              marginLeft: 'auto',
            }}
          >
            {draftLength} / {limit} 字
          </span>
        </div>
        <div style={{ fontSize: 13, color: 'var(--text-sub)', lineHeight: 1.7, whiteSpace: 'pre-line' }}>
          {store.draftText || '(尚未輸入內容)'}
        </div>
      </div>
    );
  };

  const renderSemiAuto = (platform: PlatformKey) => (
    <div>
      <div style={{ fontSize: 11.5, color: 'var(--text-faint)', marginBottom: 12 }}>
        {PUBLISH_CARD_COPY.semiAutoHint}
      </div>
      <button className="btn btn-accent" style={{ width: '100%' }} onClick={() => void copyAndOpen(platform)}>
        {platform === 'threads' ? '📋 複製內容並開啟 Threads(已預填)' : '📋 複製內容並開啟平台'}
      </button>
    </div>
  );

  const renderThreads = () =>
    store.threadsProxy.enabled ? (
      <div>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 8,
          }}
        >
          <div style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--text-weak)' }}>
            {store.threadsProxy.status === 'connected'
              ? BACKEND_COPY.connectedHint
              : BACKEND_COPY.cardDesc}
          </div>
          <button
            onClick={() => void store.threadsProxy.refresh()}
            style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--text-faint)' }}
          >
            {BACKEND_COPY.refreshStatus}
          </button>
        </div>

        {store.threadsProxy.status !== 'connected' ? (
          <div>
            <div style={{ display: 'flex', gap: 10, marginBottom: 8 }}>
              <button className="btn btn-outline" onClick={store.threadsProxy.connect}>
                {BACKEND_COPY.connect}
              </button>
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-faint)', lineHeight: 1.6 }}>
              {store.threadsProxy.authReturn === 'connected' && BACKEND_COPY.connectedBackToast}
              {store.threadsProxy.authReturn === 'error' && BACKEND_COPY.connectErrorToast}
              {store.threadsProxy.authReturn === null && BACKEND_COPY.connectHint}
            </div>
            {store.threadsProxy.status === 'unknown' && (
              <div style={{ fontSize: 11, color: 'var(--text-faint)', marginTop: 6 }}>
                {BACKEND_COPY.checking}
              </div>
            )}
          </div>
        ) : (
          <div>
            <button
              className="btn btn-accent"
              onClick={() => void store.publishDraftToThreadsNow()}
              disabled={store.threadsProxy.busy}
              style={{
                width: '100%',
                marginBottom: 12,
                opacity: store.threadsProxy.busy ? 0.5 : 1,
                cursor: store.threadsProxy.busy ? 'not-allowed' : 'pointer',
              }}
            >
              {store.threadsProxy.busy ? BACKEND_COPY.publishingLabel : BACKEND_COPY.publishNow}
            </button>
            <div className="field-label">{BACKEND_COPY.scheduleLabel}</div>
            <input
              className="text-input"
              type="datetime-local"
              value={scheduleAt.threads}
              onChange={(e) => setSchedule('threads', e.target.value)}
              aria-label={BACKEND_COPY.scheduleAtLabel}
              style={{ marginBottom: 10 }}
            />
            <button
              className="btn btn-outline"
              onClick={() => void store.scheduleDraftToThreads(scheduleAt.threads)}
              disabled={store.threadsProxy.busy}
              style={{
                width: '100%',
                opacity: store.threadsProxy.busy ? 0.5 : 1,
                cursor: store.threadsProxy.busy ? 'not-allowed' : 'pointer',
              }}
            >
              {store.threadsProxy.busy ? BACKEND_COPY.schedulingLabel : BACKEND_COPY.schedulePublish}
            </button>
          </div>
        )}
        {store.threadsProxy.status === 'error' && (
          <div style={{ fontSize: 11.5, color: 'var(--error)', marginTop: 8 }}>
            {BACKEND_ERROR_COPY.unknown}
          </div>
        )}
      </div>
    ) : (
      renderSemiAuto('threads')
    );

  const renderFacebook = () =>
    store.facebookProxy.enabled ? (
      <div>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 8,
          }}
        >
          <div style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--text-weak)' }}>
            {store.facebookProxy.status === 'connected'
              ? BACKEND_FB_COPY.connectedHint(store.facebookProxy.pageName)
              : BACKEND_FB_COPY.cardDesc}
          </div>
          <button
            onClick={() => void store.facebookProxy.refresh()}
            style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--text-faint)' }}
          >
            {BACKEND_FB_COPY.refreshStatus}
          </button>
        </div>

        {store.facebookProxy.status !== 'connected' ? (
          <div>
            <div style={{ display: 'flex', gap: 10, marginBottom: 8 }}>
              <button className="btn btn-outline" onClick={store.facebookProxy.connect}>
                {BACKEND_FB_COPY.connect}
              </button>
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-faint)', lineHeight: 1.6 }}>
              {store.facebookProxy.authReturn === 'connected' && BACKEND_FB_COPY.connectedBackToast}
              {store.facebookProxy.authReturn === 'error' && BACKEND_FB_COPY.connectErrorToast}
              {store.facebookProxy.authReturn === null && BACKEND_FB_COPY.connectHint}
            </div>
            {store.facebookProxy.status === 'unknown' && (
              <div style={{ fontSize: 11, color: 'var(--text-faint)', marginTop: 6 }}>
                {BACKEND_COPY.checking}
              </div>
            )}
          </div>
        ) : (
          <div>
            <button
              className="btn btn-accent"
              onClick={() => void store.publishDraftToFacebookNow()}
              disabled={store.facebookProxy.busy}
              style={{
                width: '100%',
                marginBottom: 12,
                opacity: store.facebookProxy.busy ? 0.5 : 1,
                cursor: store.facebookProxy.busy ? 'not-allowed' : 'pointer',
              }}
            >
              {store.facebookProxy.busy ? BACKEND_FB_COPY.publishingLabel : BACKEND_FB_COPY.publishNow}
            </button>
            <div className="field-label">{BACKEND_FB_COPY.scheduleLabel}</div>
            <input
              className="text-input"
              type="datetime-local"
              value={scheduleAt.fb}
              onChange={(e) => setSchedule('fb', e.target.value)}
              aria-label={BACKEND_FB_COPY.scheduleAtLabel}
              style={{ marginBottom: 10 }}
            />
            <button
              className="btn btn-outline"
              onClick={() => void store.scheduleDraftToFacebook(scheduleAt.fb)}
              disabled={store.facebookProxy.busy}
              style={{
                width: '100%',
                opacity: store.facebookProxy.busy ? 0.5 : 1,
                cursor: store.facebookProxy.busy ? 'not-allowed' : 'pointer',
              }}
            >
              {store.facebookProxy.busy ? BACKEND_FB_COPY.schedulingLabel : BACKEND_FB_COPY.schedulePublish}
            </button>
          </div>
        )}
        {store.facebookProxy.status === 'error' && (
          <div style={{ fontSize: 11.5, color: 'var(--error)', marginTop: 8 }}>
            {BACKEND_FB_ERROR_COPY.unknown ?? BACKEND_ERROR_COPY.unknown}
          </div>
        )}
      </div>
    ) : (
      renderSemiAuto('fb')
    );

  const renderYoutube = () =>
    YOUTUBE_ENABLED ? (
      <div>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 8,
          }}
        >
          <div style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--text-weak)' }}>
            {YOUTUBE_COPY.cardDesc}
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
                const on = publishMode === mode;
                return (
                  <button
                    key={mode}
                    onClick={() => setPublishMode(mode)}
                    style={{
                      padding: '7px 14px',
                      borderRadius: 9,
                      fontSize: 12.5,
                      fontWeight: 600,
                      background: on ? 'var(--pill-purple-bg)' : 'var(--card)',
                      color: on ? 'var(--brand)' : 'var(--text-faint)',
                      border: `1px solid ${on ? 'var(--brand)' : 'var(--pill-purple-bg-2)'}`,
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
                    background: 'var(--brand-fill)',
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
    ) : (
      <div style={{ fontSize: 11.5, color: 'var(--text-faint)' }}>
        {PUBLISH_CARD_COPY.youtubeDisabledHint}
      </div>
    );

  const renderContent = (key: PlatformKey) => {
    const meta = PLATFORM_LIST.find((p) => p.key === key);
    if (!meta) return null;
    return (
      <div>
        {renderPreview(meta.limit)}
        {key === 'threads' && renderThreads()}
        {key === 'fb' && renderFacebook()}
        {key === 'yt' && renderYoutube()}
        {(key === 'ig' || key === 'line') && renderSemiAuto(key)}
      </div>
    );
  };

  return (
    <div className="card" style={{ padding: 18 }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-weak)', marginBottom: 12 }}>
        {PUBLISH_CARD_COPY.cardTitle}
      </div>
      {selected.length === 0 ? (
        <div style={{ padding: '16px 0', textAlign: 'center', fontSize: 12.5, color: 'var(--text-faint)' }}>
          {PUBLISH_CARD_COPY.noPlatformHint}
        </div>
      ) : (
        <>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
            {PLATFORM_LIST.filter((p) => store.draftPlatforms[p.key]).map((p) => {
              const on = p.key === active;
              return (
                <button
                  key={p.key}
                  onClick={() => setTab(p.key)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 7,
                    padding: '7px 13px',
                    borderRadius: 9,
                    fontSize: 12.5,
                    fontWeight: 600,
                    background: on ? 'var(--pill-purple-bg)' : 'var(--card)',
                    color: on ? 'var(--brand)' : 'var(--text-faint)',
                    border: `1px solid ${on ? 'var(--brand)' : 'var(--pill-purple-bg-2)'}`,
                  }}
                >
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
                  <span>{p.label}</span>
                </button>
              );
            })}
          </div>
          {active && renderContent(active)}
        </>
      )}
    </div>
  );
}
