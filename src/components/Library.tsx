import { useState } from 'react';
import {
  COPY_CATEGORIES,
  LIBRARY_CATEGORIES,
  LIBRARY_COPY,
  PLATFORM_LIST,
  PLATFORM_META,
  type LibraryMainTab,
} from '../constants';
import type { AppStore } from '../hooks/useAppStore';
import type { PlatformKey, Template } from '../types';
import { shortDateLabel } from '../utils/date';
import { buildTemplateInsertText, templateCopyText } from '../utils/variants';
import { extractVariables } from '../utils/variables';
import Modal from './Modal';
import VariableFillModal from './VariableFillModal';

const MAIN_TABS: Array<{ key: LibraryMainTab; label: string }> = [
  { key: 'message', label: '訊息管理' },
  { key: 'copy', label: '文案管理' },
];

type SortBy = 'default' | 'used' | 'recent';

const SORT_OPTIONS: Array<{ key: SortBy; label: string }> = [
  { key: 'default', label: LIBRARY_COPY.sortDefault },
  { key: 'used', label: LIBRARY_COPY.sortMostUsed },
  { key: 'recent', label: LIBRARY_COPY.sortRecent },
];

function filterTemplates(list: Template[], category: string, search: string): Template[] {
  return list.filter((t) => {
    const matchCat = category === '全部' || t.category === category;
    const q = search.trim();
    const matchSearch = !q || t.title.includes(q) || t.text.includes(q);
    return matchCat && matchSearch;
  });
}

/** 排序:最常用(次數降序)/最近使用(時間降序);default = 原始順序(新加入在前)。 */
function sortTemplates(list: Template[], sortBy: SortBy): Template[] {
  if (sortBy === 'default') return list;
  return [...list].sort((a, b) =>
    sortBy === 'used'
      ? (b.appliedCount ?? 0) - (a.appliedCount ?? 0)
      : (b.lastAppliedAt ?? '').localeCompare(a.lastAppliedAt ?? ''),
  );
}

/** 範本實際擁有的(非空白)平台變體鍵值。 */
function variantKeys(tpl: Template): PlatformKey[] {
  return PLATFORM_LIST.map((p) => p.key).filter((k) => (tpl.platformVariants?.[k] ?? '').trim());
}

export default function Library({ store }: { store: AppStore }) {
  const [showNewModal, setShowNewModal] = useState(false);
  const [editing, setEditing] = useState<Template | null>(null);
  const [newTitle, setNewTitle] = useState('');
  const [newText, setNewText] = useState('');
  const [sortBy, setSortBy] = useState<SortBy>('default');
  const [newVariants, setNewVariants] = useState<Partial<Record<PlatformKey, string>>>({});
  const [activeVariant, setActiveVariant] = useState<PlatformKey>('fb');
  const [applyFill, setApplyFill] = useState<{ tpl: Template; text: string } | null>(null);
  const [copyChoice, setCopyChoice] = useState<{ tpl: Template } | null>(null);
  const [copyFill, setCopyFill] = useState<{
    tpl: Template;
    choice: PlatformKey | 'generic';
    text: string;
  } | null>(null);

  const isMessageTab = store.libraryMainTab === 'message';
  const categories = isMessageTab ? LIBRARY_CATEGORIES : COPY_CATEGORIES;
  const category = isMessageTab ? store.libraryCategory : store.copyCategory;
  const setCategory = isMessageTab ? store.setLibraryCategory : store.setCopyCategory;
  const search = isMessageTab ? store.librarySearch : store.copySearch;
  const setSearch = isMessageTab ? store.setLibrarySearch : store.setCopySearch;
  const filtered = sortTemplates(
    filterTemplates(isMessageTab ? store.templates : store.copyTemplates, category, search),
    sortBy,
  );

  /** 套用:先組出「依勾選平台 + 變體」的插入文字,含變數先填值。 */
  const runApply = (tpl: Template) => {
    const selected = PLATFORM_LIST.filter((p) => store.draftPlatforms[p.key]).map((p) => p.key);
    const text = buildTemplateInsertText(tpl, selected);
    if (extractVariables(text).length > 0) {
      setApplyFill({ tpl, text });
      return;
    }
    store.applyTemplateToDraft(tpl);
  };

  /** 複製:有平台變體先選版本;含變數先填值。 */
  const startCopy = (tpl: Template) => {
    if (variantKeys(tpl).length > 0) {
      setCopyChoice({ tpl });
      return;
    }
    continueCopy(tpl, 'generic');
  };

  const continueCopy = (tpl: Template, choice: PlatformKey | 'generic') => {
    const text = templateCopyText(tpl, choice);
    if (extractVariables(text).length > 0) {
      setCopyFill({ tpl, choice, text });
      return;
    }
    void store.copyTemplate(tpl, {}, choice);
  };

  const openNewModal = () => {
    setEditing(null);
    setNewTitle('');
    setNewText('');
    setNewVariants({});
    setActiveVariant('fb');
    setShowNewModal(true);
  };

  const openEditModal = (tpl: Template) => {
    setEditing(tpl);
    setNewTitle(tpl.title);
    setNewText(tpl.text);
    setNewVariants({ ...(tpl.platformVariants ?? {}) });
    setActiveVariant(variantKeys(tpl)[0] ?? 'fb');
    setShowNewModal(true);
  };

  const saveNewTemplate = () => {
    if (!newTitle.trim()) {
      store.showToast('請輸入標題');
      return;
    }
    if (editing) {
      store.updateTemplate(editing.id, {
        title: newTitle,
        text: newText,
        platformVariants: newVariants,
      });
    } else {
      store.addTemplate(newTitle, newText, newVariants);
    }
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
                background: active ? 'var(--brand)' : 'var(--card)',
                color: active ? '#fff' : 'var(--text-sub)',
                border: `1px solid ${active ? 'var(--brand)' : 'var(--border-3)'}`,
              }}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      <div className="library-layout" style={{ display: 'flex', gap: 20, alignItems: 'flex-start' }}>
        <div className="library-cats">
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
            style={{ maxWidth: 360, borderRadius: 10, padding: '10px 14px', marginBottom: 12 }}
          />

          <div style={{ display: 'flex', gap: 6, marginBottom: 16, alignItems: 'center' }}>
            <span style={{ fontSize: 11, color: 'var(--text-faint)', marginRight: 2 }}>排序</span>
            {SORT_OPTIONS.map((opt) => {
              const active = sortBy === opt.key;
              return (
                <button
                  key={opt.key}
                  onClick={() => setSortBy(opt.key)}
                  style={{
                    padding: '5px 10px',
                    borderRadius: 8,
                    fontSize: 11.5,
                    fontWeight: 600,
                    background: active ? 'var(--pill-purple-bg)' : 'var(--card)',
                    color: active ? 'var(--brand)' : 'var(--text-faint)',
                    border: `1px solid ${active ? 'var(--brand)' : 'var(--border-3)'}`,
                  }}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            {filtered.map((tpl) => (
              <div key={tpl.id} className="card" style={{ borderRadius: 14, padding: 16 }}>
                <div style={{ display: 'flex', gap: 6, marginBottom: 8, alignItems: 'center' }}>
                  <span className="pill pill-purple">{tpl.category}</span>
                  {variantKeys(tpl).length > 0 && (
                    <span className="pill pill-purple" title={variantKeys(tpl)
                      .map((k) => PLATFORM_META[k].label)
                      .join('、')}>
                      {LIBRARY_COPY.hasVariantBadge}
                    </span>
                  )}
                </div>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-main)', marginBottom: 6 }}>
                  {tpl.title}
                </div>
                <div
                  style={{
                    fontSize: 12.5,
                    color: 'var(--text-weak)',
                    lineHeight: 1.6,
                    marginBottom: 8,
                    whiteSpace: 'pre-line',
                  }}
                >
                  {tpl.text}
                </div>
                {tpl.appliedCount ? (
                  <div style={{ fontSize: 10.5, color: 'var(--text-faint)', marginBottom: 10 }}>
                    {LIBRARY_COPY.usedCount(tpl.appliedCount)}
                    {tpl.lastAppliedAt
                      ? ' · ' +
                        LIBRARY_COPY.lastUsedAt(shortDateLabel(new Date(tpl.lastAppliedAt)))
                      : ''}
                  </div>
                ) : null}
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    onClick={() => runApply(tpl)}
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
                    onClick={() => openEditModal(tpl)}
                    style={{
                      padding: '8px 12px',
                      borderRadius: 8,
                      background: 'var(--bg)',
                      color: 'var(--brand)',
                      fontSize: 12,
                      fontWeight: 700,
                    }}
                  >
                    編輯
                  </button>
                  <button
                    onClick={() => startCopy(tpl)}
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
                  <button
                    onClick={() => store.deleteTemplate(tpl.id)}
                    style={{
                      padding: '8px 12px',
                      borderRadius: 8,
                      background: 'var(--bg)',
                      color: 'var(--error)',
                      fontSize: 12,
                      fontWeight: 700,
                    }}
                  >
                    刪除
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
        <Modal
          onClose={() => setShowNewModal(false)}
          width={440}
          label={editing ? '編輯內容' : '新增內容'}
        >
          <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-main)', marginBottom: 16 }}>
            {editing ? '編輯內容' : '新增內容'}
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
            style={{ minHeight: 100, lineHeight: 1.6, marginBottom: 14, resize: 'vertical' }}
          />

          <div className="field-label">{LIBRARY_COPY.variantSectionLabel}</div>
          <div style={{ fontSize: 11, color: 'var(--text-faint)', marginBottom: 8 }}>
            {LIBRARY_COPY.variantSectionHint}
          </div>
          <div style={{ display: 'flex', gap: 6, marginBottom: 8, flexWrap: 'wrap' }}>
            {PLATFORM_LIST.map((p) => {
              const active = activeVariant === p.key;
              const has = !!(newVariants[p.key] ?? '').trim();
              return (
                <button
                  key={p.key}
                  onClick={() => setActiveVariant(p.key)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '6px 10px',
                    borderRadius: 8,
                    fontSize: 11.5,
                    fontWeight: 600,
                    background: active ? 'var(--pill-purple-bg)' : 'var(--card)',
                    color: active ? 'var(--brand)' : 'var(--text-faint)',
                    border: `1px solid ${active ? 'var(--brand)' : 'var(--border-3)'}`,
                  }}
                >
                  <span
                    style={{
                      width: 14,
                      height: 14,
                      borderRadius: 4,
                      background: p.color,
                      color: '#fff',
                      fontSize: 8,
                      fontWeight: 700,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {p.badge}
                  </span>
                  {p.label}
                  {has && <span style={{ color: 'var(--brand)' }}>●</span>}
                </button>
              );
            })}
          </div>
          <textarea
            className="text-input"
            value={newVariants[activeVariant] ?? ''}
            onChange={(e) =>
              setNewVariants((v) => ({ ...v, [activeVariant]: e.target.value }))
            }
            placeholder={`${PLATFORM_META[activeVariant].label} 的專屬版本(留空 = 使用通用內容)…`}
            aria-label={`${PLATFORM_META[activeVariant].label} 版本`}
            style={{ minHeight: 72, lineHeight: 1.6, marginBottom: 8, resize: 'vertical' }}
          />
          {(newVariants[activeVariant] ?? '').trim() && (
            <button
              onClick={() => setNewVariants((v) => ({ ...v, [activeVariant]: '' }))}
              style={{
                fontSize: 11,
                fontWeight: 600,
                color: 'var(--error)',
                marginBottom: 16,
                padding: '2px 4px',
              }}
            >
              {LIBRARY_COPY.variantClear}
            </button>
          )}

          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <button className="btn btn-ghost" style={{ borderRadius: 9 }} onClick={() => setShowNewModal(false)}>
              取消
            </button>
            <button className="btn btn-primary" style={{ borderRadius: 9 }} onClick={saveNewTemplate}>
              {editing ? '儲存變更' : '儲存範本'}
            </button>
          </div>
        </Modal>
      )}

      {applyFill && (
        <VariableFillModal
          text={applyFill.text}
          onClose={() => setApplyFill(null)}
          onApply={(values) => {
            const { tpl } = applyFill;
            setApplyFill(null);
            store.applyTemplateToDraft(tpl, values);
          }}
        />
      )}

      {copyChoice && (
        <Modal
          onClose={() => setCopyChoice(null)}
          width={360}
          label={LIBRARY_COPY.copyVariantTitle}
        >
          <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-main)', marginBottom: 14 }}>
            {LIBRARY_COPY.copyVariantTitle}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <button
              className="btn btn-outline"
              style={{ borderRadius: 9 }}
              onClick={() => {
                const { tpl } = copyChoice;
                setCopyChoice(null);
                continueCopy(tpl, 'generic');
              }}
            >
              {LIBRARY_COPY.variantPickerGeneric}
            </button>
            {variantKeys(copyChoice.tpl).map((k) => (
              <button
                key={k}
                className="btn btn-outline"
                style={{ borderRadius: 9 }}
                onClick={() => {
                  const { tpl } = copyChoice;
                  setCopyChoice(null);
                  continueCopy(tpl, k);
                }}
              >
                {LIBRARY_COPY.variantPicker(PLATFORM_META[k].label)}
              </button>
            ))}
          </div>
        </Modal>
      )}

      {copyFill && (
        <VariableFillModal
          text={copyFill.text}
          confirmLabel={LIBRARY_COPY.fillCopy}
          onClose={() => setCopyFill(null)}
          onApply={(values) => {
            const { tpl, choice } = copyFill;
            setCopyFill(null);
            void store.copyTemplate(tpl, values, choice);
          }}
        />
      )}
    </div>
  );
}
