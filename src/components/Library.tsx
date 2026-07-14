import { useState } from 'react';
import { COPY_CATEGORIES, LIBRARY_CATEGORIES, type LibraryMainTab } from '../constants';
import type { AppStore } from '../hooks/useAppStore';
import type { Template } from '../types';
import Modal from './Modal';

const MAIN_TABS: Array<{ key: LibraryMainTab; label: string }> = [
  { key: 'message', label: '訊息管理' },
  { key: 'copy', label: '文案管理' },
];

function filterTemplates(list: Template[], category: string, search: string): Template[] {
  return list.filter((t) => {
    const matchCat = category === '全部' || t.category === category;
    const q = search.trim();
    const matchSearch = !q || t.title.includes(q) || t.text.includes(q);
    return matchCat && matchSearch;
  });
}

export default function Library({ store }: { store: AppStore }) {
  const [showNewModal, setShowNewModal] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newText, setNewText] = useState('');

  const isMessageTab = store.libraryMainTab === 'message';
  const categories = isMessageTab ? LIBRARY_CATEGORIES : COPY_CATEGORIES;
  const category = isMessageTab ? store.libraryCategory : store.copyCategory;
  const setCategory = isMessageTab ? store.setLibraryCategory : store.setCopyCategory;
  const search = isMessageTab ? store.librarySearch : store.copySearch;
  const setSearch = isMessageTab ? store.setLibrarySearch : store.setCopySearch;
  const filtered = filterTemplates(
    isMessageTab ? store.templates : store.copyTemplates,
    category,
    search,
  );

  const openNewModal = () => {
    setNewTitle('');
    setNewText('');
    setShowNewModal(true);
  };

  const saveNewTemplate = () => {
    if (!newTitle.trim()) {
      store.showToast('請輸入標題');
      return;
    }
    store.addTemplate(newTitle, newText);
    setShowNewModal(false);
  };

  return (
    <div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-end',
          marginBottom: 16,
        }}
      >
        <div>
          <div style={{ fontSize: 20, fontWeight: 900, color: 'var(--text-main)', marginBottom: 4 }}>
            文管庫
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-weak)' }}>
            可套用草稿的常用內容,依用途分為訊息管理與文案管理
          </div>
        </div>
        <button className="btn btn-primary" onClick={openNewModal}>
          + 新增內容
        </button>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        {MAIN_TABS.map((tab) => {
          const active = store.libraryMainTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => store.setLibraryMainTab(tab.key)}
              style={{
                padding: '9px 18px',
                borderRadius: 10,
                fontSize: 13,
                fontWeight: 700,
                background: active ? 'var(--brand)' : '#fff',
                color: active ? '#fff' : 'var(--text-sub)',
                border: `1px solid ${active ? 'var(--brand)' : 'var(--border-3)'}`,
              }}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start' }}>
        <div style={{ width: 180, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
          {categories.map((cat) => {
            const active = category === cat;
            return (
              <button
                key={cat}
                onClick={() => setCategory(cat)}
                style={{
                  textAlign: 'left',
                  padding: '10px 12px',
                  borderRadius: 9,
                  fontSize: 13,
                  fontWeight: active ? 700 : 500,
                  color: active ? 'var(--brand)' : 'var(--text-sub)',
                  background: active ? 'var(--pill-purple-bg)' : 'transparent',
                }}
              >
                {cat}
              </button>
            );
          })}
        </div>

        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 11.5, color: 'var(--text-weak)', marginBottom: 10 }}>
            {isMessageTab
              ? '訊息管理:可直接套用到草稿的通用文字片段(問候、感謝、常見問答等)'
              : '文案管理:針對社群發文設計的完整貼文草稿範本'}
          </div>
          <input
            className="text-input"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={isMessageTab ? '搜尋內容標題或文字…' : '搜尋文案標題或內容…'}
            style={{ maxWidth: 360, borderRadius: 10, padding: '10px 14px', marginBottom: 16 }}
          />

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            {filtered.map((tpl) => (
              <div key={tpl.id} className="card" style={{ borderRadius: 14, padding: 16 }}>
                <div className="pill pill-purple" style={{ display: 'inline-block', marginBottom: 8 }}>
                  {tpl.category}
                </div>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-main)', marginBottom: 6 }}>
                  {tpl.title}
                </div>
                <div
                  style={{
                    fontSize: 12.5,
                    color: 'var(--text-weak)',
                    lineHeight: 1.6,
                    marginBottom: 12,
                    whiteSpace: 'pre-line',
                  }}
                >
                  {tpl.text}
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    onClick={() => store.applyTemplateToDraft(tpl)}
                    style={{
                      flex: 1,
                      textAlign: 'center',
                      padding: 8,
                      borderRadius: 8,
                      background: 'var(--brand)',
                      color: '#fff',
                      fontSize: 12,
                      fontWeight: 700,
                    }}
                  >
                    套用到草稿
                  </button>
                  <button
                    onClick={() => store.copyTemplate(tpl)}
                    style={{
                      padding: '8px 12px',
                      borderRadius: 8,
                      background: 'var(--bg)',
                      color: 'var(--brand)',
                      fontSize: 12,
                      fontWeight: 700,
                    }}
                  >
                    複製
                  </button>
                </div>
              </div>
            ))}
          </div>
          {filtered.length === 0 && (
            <div
              style={{ padding: '32px 0', textAlign: 'center', fontSize: 12.5, color: 'var(--text-faint)' }}
            >
              沒有符合條件的內容
            </div>
          )}
        </div>
      </div>

      {showNewModal && (
        <Modal onClose={() => setShowNewModal(false)} width={440}>
          <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-main)', marginBottom: 16 }}>
            新增內容
          </div>
          <div className="field-label">標題</div>
          <input
            className="text-input"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="例如:感謝訂閱電子報"
            style={{ marginBottom: 14 }}
          />
          <div className="field-label">內容</div>
          <textarea
            className="text-input"
            value={newText}
            onChange={(e) => setNewText(e.target.value)}
            placeholder="輸入範本內容…"
            style={{ minHeight: 100, lineHeight: 1.6, marginBottom: 16, resize: 'vertical' }}
          />
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <button className="btn btn-ghost" style={{ borderRadius: 9 }} onClick={() => setShowNewModal(false)}>
              取消
            </button>
            <button className="btn btn-primary" style={{ borderRadius: 9 }} onClick={saveNewTemplate}>
              儲存範本
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
