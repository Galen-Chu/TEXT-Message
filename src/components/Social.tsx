import { useState } from 'react';
import {
  COPY_CATEGORIES,
  LIBRARY_COPY,
  PLATFORM_LIST,
  PLATFORM_META,
  SOCIAL_NOTIFY_COPY,
} from '../constants';
import type { AppStore } from '../hooks/useAppStore';
import type { SocialPost } from '../types';
import { gmailFilterSearchUrl } from '../services/gmail/filterLink';
import { dateLabel } from '../utils/date';
import AccountsCard from './AccountsCard';
import Modal from './Modal';
import PlatformBadge from './PlatformBadge';
import ThreadsInteractionsCard from './ThreadsInteractionsCard';
import TrendsPanel from './TrendsPanel';

const SOCIAL_FILTERS = ['全部', ...PLATFORM_LIST.map((p) => p.label)];
const SAVE_CATEGORIES = COPY_CATEGORIES.filter((c) => c !== '全部');

export default function Social({ store }: { store: AppStore }) {
  const [saveFrom, setSaveFrom] = useState<SocialPost | null>(null);
  const [saveTitle, setSaveTitle] = useState('');
  const [saveCategory, setSaveCategory] = useState(SAVE_CATEGORIES[0]);

  const filtered = store.socialHistory.filter(
    (post) => store.socialFilter === '全部' || PLATFORM_META[post.platform].label === store.socialFilter,
  );

  const openSaveModal = (post: SocialPost) => {
    setSaveTitle(post.title);
    setSaveCategory(SAVE_CATEGORIES[0]);
    setSaveFrom(post);
  };

  const saveTemplate = () => {
    if (!saveFrom) return;
    if (!saveTitle.trim()) {
      store.showToast(LIBRARY_COPY.titleRequiredToast);
      return;
    }
    store.saveSocialPostAsTemplate(saveFrom, saveTitle.trim(), saveCategory);
    setSaveFrom(null);
  };

  return (
    <div>
      <div className="t-page-title" style={{ marginBottom: 4 }}>
        自媒體 Social
      </div>
      <div className="t-page-desc" style={{ marginBottom: 20 }}>
        連接平台帳號、各平台發文歷史,與 Threads 留言唯讀代讀
        {store.socialHistoryIsDemo && (
          <span className="t-meta" style={{ marginLeft: 6 }}>
            (示範資料;於排程頁「標記已發佈」後即為真實記錄)
          </span>
        )}
      </div>

      {/* 2026-11-02 UIUX 批:連接操作放在本頁最前——它是本頁的「進入操作」,
          不該只存在編發器裡(否則自媒體頁要先繞進編發器才能串起來) */}
      <AccountsCard store={store} />

      <TrendsPanel posts={store.publishedHistory} />

      {/* IA Phase 5 D6 一期:平台互動通知信(唯讀分類,emails 不落地;回覆一律回平台 App) */}
      <div className="card" style={{ padding: 18, marginBottom: 20 }}>
        <div className="t-sec-title" style={{ marginBottom: 4 }}>
          {SOCIAL_NOTIFY_COPY.cardTitle}
          {store.gmail.status !== 'connected' && (
            <span className="t-meta" style={{ marginLeft: 6 }}>
              {SOCIAL_NOTIFY_COPY.demoNote}
            </span>
          )}
        </div>
        <div className="t-meta" style={{ marginBottom: 12 }}>
          {SOCIAL_NOTIFY_COPY.desc}
        </div>
        {store.emails
          .filter((m) => m.tag === '互動通知')
          .slice(0, 5)
          .map((m) => (
            <div
              key={m.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '10px 0',
                borderBottom: '1px solid var(--border-2)',
              }}
            >
              <div
                className="t-sub"
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: '50%',
                  background: 'var(--pill-brand-bg)',
                  color: 'var(--brand)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 'var(--weight-bold)',
                  flexShrink: 0,
                }}
              >
                {m.initial}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="t-item-title">{m.sender}</div>
                <div
                  className="t-sub"
                  style={{
                    marginTop: 2,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {m.subject}
                </div>
              </div>
              <div className="t-meta t-num" style={{ whiteSpace: 'nowrap' }}>
                {m.date}
              </div>
              {m.senderEmail && (
                <a
                  href={gmailFilterSearchUrl(m.senderEmail)}
                  target="_blank"
                  rel="noreferrer"
                  className="t-meta"
                  style={{ fontWeight: 'var(--weight-bold)', color: 'var(--brand)', whiteSpace: 'nowrap' }}
                >
                  {SOCIAL_NOTIFY_COPY.openMail}
                </a>
              )}
            </div>
          ))}
        {store.emails.filter((m) => m.tag === '互動通知').length === 0 && (
          <div className="t-sub" style={{ padding: '14px 0', textAlign: 'center' }}>
            {SOCIAL_NOTIFY_COPY.empty}
          </div>
        )}
      </div>

      {/* NOTIFY 二期(2026-10-14):Threads 留言唯讀代讀。放在通知信卡之後——
          通知信覆蓋所有平台(含未串接者),這張只有 Threads 但是直接讀平台、較即時 */}
      <ThreadsInteractionsCard store={store} />

      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        {SOCIAL_FILTERS.map((f) => {
          const active = store.socialFilter === f;
          return (
            <button
              key={f}
              onClick={() => store.setSocialFilter(f)}
              className="t-sub"
              style={{
                padding: '8px 14px',
                borderRadius: 9,
                fontWeight: 'var(--weight-semibold)',
                background: active ? 'var(--brand-fill)' : 'var(--card)',
                color: active ? 'var(--on-brand-fill)' : 'var(--text-sub)',
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
                <div className="t-item-title" style={{ fontWeight: 'var(--weight-bold)' }}>
                  {post.title}
                </div>
                <div className="t-meta t-num" style={{ whiteSpace: 'nowrap' }}>
                  {dateLabel(post.date)} · {post.time}
                </div>
              </div>
              <div
                className="t-sub"
                style={{
                  marginTop: 4,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {post.content}
              </div>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginTop: 6,
                }}
              >
                <div className="t-micro" style={{ color: '#06C755' }}>
                  ✓ 已發佈
                </div>
                <button
                  className="t-meta"
                  onClick={() => openSaveModal(post)}
                  style={{
                    fontWeight: 'var(--weight-semibold)',
                    color: 'var(--brand)',
                    padding: '4px 8px',
                    borderRadius: 7,
                  }}
                >
                  {LIBRARY_COPY.saveAsTemplate}
                </button>
              </div>
            </div>
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="t-sub" style={{ padding: '32px 0', textAlign: 'center' }}>
            此平台還沒有發文記錄
          </div>
        )}
      </div>

      {saveFrom && (
        <Modal
          onClose={() => setSaveFrom(null)}
          width={420}
          label={LIBRARY_COPY.saveAsTemplateTitle}
        >
          <div className="t-card-title" style={{ marginBottom: 16 }}>
            {LIBRARY_COPY.saveAsTemplateTitle}
          </div>
          <div className="field-label">標題</div>
          <input
            className="text-input"
            value={saveTitle}
            onChange={(e) => setSaveTitle(e.target.value)}
            style={{ marginBottom: 14 }}
          />
          <div className="field-label">{LIBRARY_COPY.saveAsTemplateCategory}</div>
          <select
            className="text-input"
            value={saveCategory}
            onChange={(e) => setSaveCategory(e.target.value)}
            style={{ marginBottom: 14 }}
          >
            {SAVE_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <div className="field-label">{LIBRARY_COPY.saveAsTemplateContentLabel}</div>
          <div
            className="t-sub"
            style={{
              whiteSpace: 'pre-line',
              maxHeight: 140,
              overflowY: 'auto',
              border: '1px solid var(--border-2)',
              borderRadius: 10,
              padding: 12,
              marginBottom: 16,
            }}
          >
            {saveFrom.content}
          </div>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <button
              className="btn btn-ghost"
              style={{ borderRadius: 9 }}
              onClick={() => setSaveFrom(null)}
            >
              取消
            </button>
            <button className="btn btn-primary" style={{ borderRadius: 9 }} onClick={saveTemplate}>
              存入文庫
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
