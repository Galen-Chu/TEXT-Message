import { useState } from 'react';
import { LIBRARY_CATEGORIES } from '../constants';
import type { AppStore } from '../hooks/useAppStore';
import Modal from './Modal';

export default function Library({ store }: { store: AppStore }) {
  const [showNewModal, setShowNewModal] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newText, setNewText] = useState('');

  const filtered = store.templates.filter((t) => {
    const matchCat = store.libraryCategory === '全部' || t.category === store.libraryCategory;
    const q = store.librarySearch.trim();
    const matchSearch = !q || t.title.includes(q) || t.text.includes(q);
    return matchCat && matchSearch;
  });

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
          marginBottom: 20,
        }}
      >
        <div>
          <div style={{ fontSize: 20, fontWeight: 900, color: 'var(--text-main)', marginBottom: 4 }}>
            罐頭訊息庫
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-weak)' }}>常用文案範本,一鍵套用到草稿</div>
        </div>
        <button className="btn btn-primary" onClick={openNewModal}>
          + 新增範本
        </button>
      </div>

      <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start' }}>
        <div style={{ width: 180, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
          {LIBRARY_CATEGORIES.map((cat) => {
            const active = store.libraryCategory === cat;
            return (
              <button
                key={cat}
                onClick={() => store.setLibraryCategory(cat)}
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
          <input
            className="text-input"
            value={store.librarySearch}
            onChange={(e) => store.setLibrarySearch(e.target.value)}
            placeholder="搜尋範本標題或內容…"
            style={{ maxWidth: 360, borderRadius: 10, padding: '10px 14px', marginBottom: 16 }}
          />

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            {filtered.map((tpl) => (
              <div
                key={tpl.id}
                className="card"
                style={{ borderRadius: 14, padding: 16 }}
              >
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
              沒有符合條件的範本
            </div>
          )}
        </div>
      </div>

      {showNewModal && (
        <Modal onClose={() => setShowNewModal(false)} width={440}>
          <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-main)', marginBottom: 16 }}>
            新增罐頭訊息
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
