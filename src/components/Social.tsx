import { useState } from 'react';
import { COPY_CATEGORIES, LIBRARY_COPY, PLATFORM_LIST, PLATFORM_META } from '../constants';
import type { AppStore } from '../hooks/useAppStore';
import type { SocialPost } from '../types';
import { dateLabel } from '../utils/date';
import Modal from './Modal';
import PlatformBadge from './PlatformBadge';
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
      <div style={{ fontSize: 20, fontWeight: 900, color: 'var(--text-main)', marginBottom: 4 }}>
        社群媒體
      </div>
      <div style={{ fontSize: 13, color: 'var(--text-weak)', marginBottom: 20 }}>
        各社群平台發文歷史記錄
        {store.socialHistoryIsDemo && (
          <span style={{ fontSize: 11, color: 'var(--text-faint)', marginLeft: 6 }}>
            (示範資料;於排程頁「標記已發佈」後即為真實記錄)
          </span>
        )}
      </div>

      <TrendsPanel posts={store.publishedHistory} />

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
                background: active ? 'var(--brand)' : 'var(--card)',
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
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginTop: 6,
                }}
              >
                <div style={{ fontSize: 10.5, fontWeight: 700, color: '#06C755' }}>✓ 已發佈</div>
                <button
                  onClick={() => openSaveModal(post)}
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
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
          <div
            style={{ padding: '32px 0', textAlign: 'center', fontSize: 12.5, color: 'var(--text-faint)' }}
          >
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
          <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-main)', marginBottom: 16 }}>
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
            style={{
              fontSize: 12.5,
              color: 'var(--text-weak)',
              lineHeight: 1.6,
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
              存入文管庫
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
