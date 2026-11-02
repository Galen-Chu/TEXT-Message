import { useState } from 'react';
import { NOTES_COPY, NOTES_PAGE_SIZE, NOTE_BODY_MAX, NOTE_KIND_OPTIONS } from '../constants';
import type { AppStore } from '../hooks/useAppStore';
import {
  collectTags,
  filterNotesByKind,
  parseTagsInput,
  searchNotes,
  sortNotes,
} from '../services/notes/storage';
import type { Note, NoteKind } from '../types';
import { shortDateTimeLabel } from '../utils/date';
import Modal from './Modal';

/**
 * 貼便條 Post(POST-PLAN,2026-11-01):小筆記/好文章/靈感的落點——
 * 新增/編輯/刪除 + 類型與標籤篩選 + 搜尋 + 套用到編發器。
 * 鏡像寫日記的頁面結構;刪除同樣走確認 Modal(便條多半是外部來源,刪了找不回)。
 * 篩選與搜尋都是頁面本地狀態(不落地)。
 */
export default function Post({ store }: { store: AppStore }) {
  const [kind, setKind] = useState<NoteKind>('note');
  const [title, setTitle] = useState('');
  const [url, setUrl] = useState('');
  const [body, setBody] = useState('');
  const [tagsInput, setTagsInput] = useState('');
  const [search, setSearch] = useState('');
  const [kindFilter, setKindFilter] = useState<NoteKind | null>(null);
  const [tagFilter, setTagFilter] = useState<string | null>(null);
  const [shown, setShown] = useState(NOTES_PAGE_SIZE);
  const [editing, setEditing] = useState<Note | null>(null);
  const [editKind, setEditKind] = useState<NoteKind>('note');
  const [editTitle, setEditTitle] = useState('');
  const [editUrl, setEditUrl] = useState('');
  const [editBody, setEditBody] = useState('');
  const [editTags, setEditTags] = useState('');
  const [deleting, setDeleting] = useState<Note | null>(null);

  const allTags = collectTags(store.notes);
  const matched = searchNotes(
    filterNotesByKind(sortNotes(store.notes), kindFilter),
    search,
  ).filter((n) => !tagFilter || n.tags.includes(tagFilter));
  const visible = matched.slice(0, shown);
  const more = matched.length - visible.length;
  const filtering = !!search.trim() || !!kindFilter || !!tagFilter;

  /** 任一篩選條件變動都縮回第一頁,否則會停在空白的後段。 */
  const resetPage = () => setShown(NOTES_PAGE_SIZE);

  const kindLabel = (k: NoteKind) =>
    NOTE_KIND_OPTIONS.find((o) => o.key === k)?.label ?? k;

  /** 類型 chips(撰寫卡與編輯 Modal 共用;沿日記心情 chips 樣式)。 */
  const kindChips = (value: NoteKind, onPick: (k: NoteKind) => void) => (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
      {NOTE_KIND_OPTIONS.map((o) => {
        const active = value === o.key;
        return (
          <button
            key={o.key}
            onClick={() => onPick(o.key)}
            title={o.hint}
            className="t-meta"
            style={{
              padding: '5px 12px',
              borderRadius: 8,
              fontWeight: 'var(--weight-semibold)',
              background: active ? 'var(--pill-brand-bg)' : 'var(--card)',
              color: active ? 'var(--brand)' : 'var(--text-faint)',
              border: `1px solid ${active ? 'var(--brand)' : 'var(--border-3)'}`,
            }}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );

  const submit = () => {
    if (!body.trim()) {
      store.showToast(NOTES_COPY.emptyBodyToast);
      return;
    }
    store.addNote({
      kind,
      title: title.trim(),
      body,
      url: url.trim() || undefined,
      tags: parseTagsInput(tagsInput),
    });
    setTitle('');
    setUrl('');
    setBody('');
    setTagsInput('');
  };

  /** 複製內容(沿雲端列預覽的剪貼簿慣例:失敗時誠實提示手動複製)。 */
  const copyNoteBody = (n: Note) => {
    void navigator.clipboard.writeText(n.body).then(
      () => store.showToast(NOTES_COPY.copiedToast),
      () => store.showToast('複製失敗,請手動選取複製'),
    );
  };

  const openEdit = (n: Note) => {
    setEditing(n);
    setEditKind(n.kind);
    setEditTitle(n.title);
    setEditUrl(n.url ?? '');
    setEditBody(n.body);
    setEditTags(n.tags.join(' '));
  };

  const saveEdit = () => {
    if (!editing) return;
    if (!editBody.trim()) {
      store.showToast(NOTES_COPY.emptyBodyToast);
      return;
    }
    store.updateNote(editing.id, {
      kind: editKind,
      title: editTitle.trim(),
      body: editBody,
      url: editUrl.trim() || undefined,
      tags: parseTagsInput(editTags),
    });
    setEditing(null);
  };

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <div className="t-page-title" style={{ marginBottom: 4 }}>
          {NOTES_COPY.pageTitle}
        </div>
        <div className="t-page-desc">{NOTES_COPY.pageDesc}</div>
      </div>

      <div className="card" style={{ padding: 16, marginBottom: 20 }}>
        <div className="t-sec-title" style={{ marginBottom: 12 }}>
          {NOTES_COPY.composeTitle}
        </div>
        <div style={{ marginBottom: 10 }}>
          <div className="field-label">{NOTES_COPY.kindLabel}</div>
          {kindChips(kind, setKind)}
        </div>
        <div style={{ display: 'flex', gap: 10, marginBottom: 10, flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 180 }}>
            <div className="field-label">{NOTES_COPY.titleLabel}</div>
            <input className="text-input" value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div style={{ flex: 1, minWidth: 180 }}>
            <div className="field-label">{NOTES_COPY.urlLabel}</div>
            <input
              className="text-input"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder={NOTES_COPY.urlPlaceholder}
            />
          </div>
        </div>
        <div className="field-label">{NOTES_COPY.bodyLabel}</div>
        <textarea
          className="text-input"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder={NOTES_COPY.bodyPlaceholder}
          maxLength={NOTE_BODY_MAX}
          style={{ minHeight: 100, lineHeight: 'var(--leading-normal)', resize: 'vertical' }}
        />
        <div style={{ marginTop: 10 }}>
          <div className="field-label">{NOTES_COPY.tagsLabel}</div>
          <input
            className="text-input"
            value={tagsInput}
            onChange={(e) => setTagsInput(e.target.value)}
            placeholder={NOTES_COPY.tagsPlaceholder}
          />
        </div>
        <div
          style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 }}
        >
          <div className="t-meta t-num" style={{ color: 'var(--text-weak)' }}>
            {NOTES_COPY.bodyCountLabel(body.trim().length)}
          </div>
          <button className="btn btn-primary" onClick={submit}>
            {NOTES_COPY.saveButton}
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 10 }}>
        <input
          className="text-input"
          style={{ flex: 1 }}
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            resetPage();
          }}
          placeholder={NOTES_COPY.searchPlaceholder}
        />
        <span className="t-sub t-num" style={{ whiteSpace: 'nowrap' }}>
          {NOTES_COPY.countLabel(matched.length)}
        </span>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
        {[null, ...NOTE_KIND_OPTIONS.map((o) => o.key)].map((k) => {
          const active = kindFilter === k;
          return (
            <button
              key={k ?? 'all'}
              onClick={() => {
                setKindFilter(k);
                resetPage();
              }}
              className={active ? 'pill pill-brand' : 'pill'}
              style={{
                // 篩選 chip 借用 .pill 的配色,但字級要跟其他頁的篩選 chip 一致
                // (.pill 是標籤尺寸且排在 .t-* 之後會贏)——故走 token 的 inline escape hatch
                fontSize: 'var(--text-meta)',
                fontWeight: 'var(--weight-semibold)',
                border: `1px solid ${active ? 'var(--brand)' : 'var(--border-3)'}`,
                color: active ? undefined : 'var(--text-faint)',
              }}
            >
              {k === null ? NOTES_COPY.filterAll : kindLabel(k)}
            </button>
          );
        })}
        {allTags.slice(0, 12).map(({ tag, count }) => {
          const active = tagFilter === tag;
          return (
            <button
              key={tag}
              onClick={() => {
                setTagFilter(active ? null : tag);
                resetPage();
              }}
              className={active ? 'pill pill-accent' : 'pill'}
              style={{
                fontSize: 'var(--text-meta)',
                fontWeight: 'var(--weight-semibold)',
                border: `1px solid ${active ? 'var(--accent)' : 'var(--border-3)'}`,
                color: active ? undefined : 'var(--text-faint)',
              }}
            >
              #{tag} {count}
            </button>
          );
        })}
      </div>

      {matched.length === 0 ? (
        <div className="card" style={{ padding: 28, textAlign: 'center' }}>
          <div className="t-card-title" style={{ marginBottom: 6 }}>
            {filtering ? NOTES_COPY.emptyFiltered : NOTES_COPY.emptyTitle}
          </div>
          <div className="t-sub">
            {filtering ? NOTES_COPY.emptyFilteredDesc : NOTES_COPY.emptyDesc}
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {visible.map((n) => (
            <div className="card" key={n.id} style={{ padding: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
                <span className="pill pill-brand">{kindLabel(n.kind)}</span>
                {n.tags.map((t) => (
                  <span className="pill pill-accent" key={t}>
                    #{t}
                  </span>
                ))}
                <span className="t-meta t-num" style={{ marginLeft: 'auto' }}>
                  {shortDateTimeLabel(n.updatedAt)}
                </span>
              </div>
              {n.title && (
                <div
                  className="t-item-title"
                  style={{
                    fontWeight: 'var(--weight-bold)',
                    marginBottom: 4,
                    overflowWrap: 'anywhere',
                  }}
                >
                  {n.title}
                </div>
              )}
              <div
                className="t-body"
                style={{
                  color: 'var(--text-sub)',
                  whiteSpace: 'pre-wrap',
                  overflowWrap: 'anywhere',
                }}
              >
                {n.body}
              </div>
              {n.url && (
                <a
                  href={n.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="t-sub"
                  style={{
                    display: 'inline-block',
                    marginTop: 8,
                    fontWeight: 'var(--weight-semibold)',
                    color: 'var(--brand)',
                    overflowWrap: 'anywhere',
                  }}
                >
                  {NOTES_COPY.openLink}
                </a>
              )}
              <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
                <button
                  className="btn btn-outline"
                  style={{ borderRadius: 8 }}
                  onClick={() => store.applyNoteToDraft(n)}
                >
                  {NOTES_COPY.applyButton}
                </button>
                <button
                  className="btn btn-ghost"
                  style={{ borderRadius: 8 }}
                  onClick={() => copyNoteBody(n)}
                >
                  {NOTES_COPY.copyButton}
                </button>
                <button
                  className="btn btn-outline"
                  style={{ borderRadius: 8 }}
                  onClick={() => openEdit(n)}
                >
                  {NOTES_COPY.editButton}
                </button>
                <button
                  className="btn btn-ghost"
                  style={{ borderRadius: 8, color: 'var(--error)' }}
                  onClick={() => setDeleting(n)}
                >
                  {NOTES_COPY.deleteButton}
                </button>
              </div>
            </div>
          ))}
          {more > 0 && (
            <button
              className="btn btn-outline"
              style={{ alignSelf: 'center', borderRadius: 8 }}
              onClick={() => setShown((s) => s + NOTES_PAGE_SIZE)}
            >
              {NOTES_COPY.loadMoreButton(more)}
            </button>
          )}
        </div>
      )}

      {editing && (
        <Modal onClose={() => setEditing(null)} width={520} label={NOTES_COPY.editButton}>
          <div className="t-card-title" style={{ marginBottom: 16 }}>
            {NOTES_COPY.editButton}
          </div>
          <div style={{ marginBottom: 14 }}>
            <div className="field-label">{NOTES_COPY.kindLabel}</div>
            {kindChips(editKind, setEditKind)}
          </div>
          <div className="field-label">{NOTES_COPY.titleLabel}</div>
          <input
            className="text-input"
            value={editTitle}
            onChange={(e) => setEditTitle(e.target.value)}
            style={{ marginBottom: 14 }}
          />
          <div className="field-label">{NOTES_COPY.urlLabel}</div>
          <input
            className="text-input"
            value={editUrl}
            onChange={(e) => setEditUrl(e.target.value)}
            placeholder={NOTES_COPY.urlPlaceholder}
            style={{ marginBottom: 14 }}
          />
          <div className="field-label">{NOTES_COPY.bodyLabel}</div>
          <textarea
            className="text-input"
            value={editBody}
            onChange={(e) => setEditBody(e.target.value)}
            maxLength={NOTE_BODY_MAX}
            style={{
              minHeight: 120,
              lineHeight: 'var(--leading-normal)',
              resize: 'vertical',
              marginBottom: 14,
            }}
          />
          <div className="field-label">{NOTES_COPY.tagsLabel}</div>
          <input
            className="text-input"
            value={editTags}
            onChange={(e) => setEditTags(e.target.value)}
            placeholder={NOTES_COPY.tagsPlaceholder}
          />
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 16 }}>
            <button className="btn btn-ghost" onClick={() => setEditing(null)}>
              {NOTES_COPY.cancelButton}
            </button>
            <button className="btn btn-primary" onClick={saveEdit}>
              {NOTES_COPY.saveChangesButton}
            </button>
          </div>
        </Modal>
      )}

      {deleting && (
        <Modal onClose={() => setDeleting(null)} width={380} label={NOTES_COPY.deleteModalTitle}>
          <div className="t-card-title" style={{ marginBottom: 8 }}>
            {NOTES_COPY.deleteModalTitle}
          </div>
          <div
            className="t-body"
            style={{
              color: 'var(--text-weak)',
              marginBottom: 16,
              lineHeight: 'var(--leading-normal)',
            }}
          >
            {NOTES_COPY.deleteModalDesc}
          </div>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <button className="btn btn-ghost" onClick={() => setDeleting(null)}>
              {NOTES_COPY.cancelButton}
            </button>
            <button
              className="btn btn-primary"
              style={{ background: 'var(--error)' }}
              onClick={() => {
                store.deleteNote(deleting.id);
                setDeleting(null);
              }}
            >
              {NOTES_COPY.deleteConfirmButton}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
