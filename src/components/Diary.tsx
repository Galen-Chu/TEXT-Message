import { useState } from 'react';
import { DIARY_BODY_MAX, DIARY_BODY_MIN, DIARY_COPY, DIARY_MOODS } from '../constants';
import type { AppStore } from '../hooks/useAppStore';
import { searchDiaryEntries, sortDiaryEntries } from '../services/diary/storage';
import type { DiaryEntry } from '../types';
import { shortDateTimeLabel, toISODate } from '../utils/date';
import Modal from './Modal';

/**
 * 寫日記(DIARY-PLAN P1,2026-10-24):私密的第一方內容——撰寫/編輯/刪除+列表新→舊+搜尋。
 * 刪除走確認 Modal(日記是不可再生的長文內容,與文庫範本直接刪的慣例刻意不同)。
 * 搜尋是頁面本地狀態(不進 store 不落地——寫日記頁每次進入都從今天開始)。
 * 同日追加(維護者指示):心情(選填 8 選項)+內容長度 100–500 字(下限門檻、maxLength、
 * 即時字數)——長度屬 UI 層驗證,storage 只驗結構。
 */
export default function Diary({ store }: { store: AppStore }) {
  const [date, setDate] = useState(toISODate(new Date()));
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [mood, setMood] = useState('');
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<DiaryEntry | null>(null);
  const [editDate, setEditDate] = useState('');
  const [editTitle, setEditTitle] = useState('');
  const [editBody, setEditBody] = useState('');
  const [editMood, setEditMood] = useState('');
  const [deleting, setDeleting] = useState<DiaryEntry | null>(null);

  const entries = searchDiaryEntries(sortDiaryEntries(store.diaryEntries), search);

  /** 心情 chips(撰寫卡與編輯 Modal 共用;點已選的再取消)。樣式沿 Inbox 標籤 chips 慣例。 */
  const moodChips = (value: string, onPick: (m: string) => void) => (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
      {DIARY_MOODS.map((m) => {
        const active = value === m;
        return (
          <button
            key={m}
            onClick={() => onPick(active ? '' : m)}
            style={{
              padding: '5px 12px',
              borderRadius: 8,
              fontSize: 11.5,
              fontWeight: 600,
              background: active ? 'var(--pill-brand-bg)' : 'var(--card)',
              color: active ? 'var(--brand)' : 'var(--text-faint)',
              border: `1px solid ${active ? 'var(--brand)' : 'var(--border-3)'}`,
            }}
          >
            {m}
          </button>
        );
      })}
    </div>
  );

  /** 即時字數:100–500 之外轉紅提示,在門檻內轉弱色。 */
  const bodyCount = (text: string) => {
    const n = text.trim().length;
    return (
      <div
        style={{
          fontSize: 11.5,
          color: n >= DIARY_BODY_MIN && n <= DIARY_BODY_MAX ? 'var(--text-weak)' : 'var(--error)',
          whiteSpace: 'nowrap',
        }}
      >
        {DIARY_COPY.bodyCountLabel(n)}
      </div>
    );
  };

  const submit = () => {
    const n = body.trim().length;
    if (!n) {
      store.showToast(DIARY_COPY.emptyBodyToast);
      return;
    }
    if (n < DIARY_BODY_MIN || n > DIARY_BODY_MAX) {
      store.showToast(DIARY_COPY.bodyLengthToast(n));
      return;
    }
    store.addDiaryEntry({
      date: date || toISODate(new Date()),
      title: title.trim(),
      body,
      mood: mood || undefined,
    });
    setDate(toISODate(new Date()));
    setTitle('');
    setBody('');
    setMood('');
  };

  const openEdit = (e: DiaryEntry) => {
    setEditing(e);
    setEditDate(e.date);
    setEditTitle(e.title);
    setEditBody(e.body);
    setEditMood(e.mood ?? '');
  };

  const saveEdit = () => {
    if (!editing) return;
    const n = editBody.trim().length;
    if (!n) {
      store.showToast(DIARY_COPY.emptyBodyToast);
      return;
    }
    if (n < DIARY_BODY_MIN || n > DIARY_BODY_MAX) {
      store.showToast(DIARY_COPY.bodyLengthToast(n));
      return;
    }
    store.updateDiaryEntry(editing.id, {
      date: editDate || editing.date,
      title: editTitle.trim(),
      body: editBody,
      mood: editMood || undefined,
    });
    setEditing(null);
  };

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 20, fontWeight: 900, color: 'var(--text-main)', marginBottom: 4 }}>
          {DIARY_COPY.pageTitle}
        </div>
        <div style={{ fontSize: 13, color: 'var(--text-weak)' }}>{DIARY_COPY.pageDesc}</div>
      </div>

      <div className="card" style={{ padding: 16, marginBottom: 20 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-main)', marginBottom: 12 }}>
          {DIARY_COPY.composeTitle}
        </div>
        <div style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
          <div style={{ flexShrink: 0 }}>
            <div className="field-label">{DIARY_COPY.dateLabel}</div>
            <input
              type="date"
              className="text-input"
              style={{ width: 160 }}
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="field-label">{DIARY_COPY.titleLabel}</div>
            <input
              className="text-input"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>
        </div>
        <div style={{ marginBottom: 10 }}>
          <div className="field-label">{DIARY_COPY.moodLabel}</div>
          {moodChips(mood, setMood)}
        </div>
        <div className="field-label">{DIARY_COPY.bodyLabel}</div>
        <textarea
          className="text-input"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder={DIARY_COPY.bodyPlaceholder}
          maxLength={DIARY_BODY_MAX}
          style={{ minHeight: 120, lineHeight: 1.6, resize: 'vertical' }}
        />
        <div
          style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 }}
        >
          {bodyCount(body)}
          <button className="btn btn-primary" onClick={submit}>
            {DIARY_COPY.saveButton}
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 12 }}>
        <input
          className="text-input"
          style={{ flex: 1 }}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={DIARY_COPY.searchPlaceholder}
        />
        <span style={{ fontSize: 12, color: 'var(--text-weak)', whiteSpace: 'nowrap' }}>
          {DIARY_COPY.countLabel(entries.length)}
        </span>
      </div>

      {entries.length === 0 ? (
        <div className="card" style={{ padding: 28, textAlign: 'center' }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-main)', marginBottom: 6 }}>
            {search.trim() ? '找不到符合的日記' : DIARY_COPY.emptyTitle}
          </div>
          <div style={{ fontSize: 12.5, color: 'var(--text-weak)' }}>
            {search.trim() ? '換個關鍵字試試' : DIARY_COPY.emptyDesc}
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {entries.map((e) => (
            <div className="card" key={e.id} style={{ padding: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <span className="pill pill-brand">{e.date}</span>
                {e.mood && <span className="pill pill-accent">{e.mood}</span>}
                <span style={{ fontSize: 11.5, color: 'var(--text-weak)', marginLeft: 'auto' }}>
                  {shortDateTimeLabel(e.updatedAt)}
                </span>
              </div>
              {e.title && (
                <div
                  style={{
                    fontSize: 14,
                    fontWeight: 700,
                    color: 'var(--text-main)',
                    marginBottom: 4,
                    overflowWrap: 'anywhere',
                  }}
                >
                  {e.title}
                </div>
              )}
              <div
                style={{
                  fontSize: 13,
                  color: 'var(--text-sub)',
                  whiteSpace: 'pre-wrap',
                  overflowWrap: 'anywhere',
                }}
              >
                {e.body}
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                <button
                  className="btn btn-outline"
                  style={{ borderRadius: 8 }}
                  onClick={() => openEdit(e)}
                >
                  {DIARY_COPY.editButton}
                </button>
                <button
                  className="btn btn-ghost"
                  style={{ borderRadius: 8, color: 'var(--error)' }}
                  onClick={() => setDeleting(e)}
                >
                  {DIARY_COPY.deleteButton}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {editing && (
        <Modal onClose={() => setEditing(null)} width={520} label={DIARY_COPY.editButton}>
          <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-main)', marginBottom: 16 }}>
            {DIARY_COPY.editButton}
          </div>
          <div className="field-label">{DIARY_COPY.dateLabel}</div>
          <input
            type="date"
            className="text-input"
            style={{ width: 160, marginBottom: 14 }}
            value={editDate}
            onChange={(e) => setEditDate(e.target.value)}
          />
          <div className="field-label">{DIARY_COPY.titleLabel}</div>
          <input
            className="text-input"
            value={editTitle}
            onChange={(e) => setEditTitle(e.target.value)}
            style={{ marginBottom: 14 }}
          />
          <div style={{ marginBottom: 14 }}>
            <div className="field-label">{DIARY_COPY.moodLabel}</div>
            {moodChips(editMood, setEditMood)}
          </div>
          <div className="field-label">{DIARY_COPY.bodyLabel}</div>
          <textarea
            className="text-input"
            value={editBody}
            onChange={(e) => setEditBody(e.target.value)}
            placeholder={DIARY_COPY.bodyPlaceholder}
            maxLength={DIARY_BODY_MAX}
            style={{ minHeight: 120, lineHeight: 1.6, resize: 'vertical' }}
          />
          <div
            style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 }}
          >
            {bodyCount(editBody)}
            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn btn-ghost" onClick={() => setEditing(null)}>
                {DIARY_COPY.cancelButton}
              </button>
              <button className="btn btn-primary" onClick={saveEdit}>
                {DIARY_COPY.saveChangesButton}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {deleting && (
        <Modal onClose={() => setDeleting(null)} width={380} label={DIARY_COPY.deleteModalTitle}>
          <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-main)', marginBottom: 8 }}>
            {DIARY_COPY.deleteModalTitle}
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-weak)', marginBottom: 16, lineHeight: 1.6 }}>
            {DIARY_COPY.deleteModalDesc}
          </div>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <button className="btn btn-ghost" onClick={() => setDeleting(null)}>
              {DIARY_COPY.cancelButton}
            </button>
            <button
              className="btn btn-primary"
              style={{ background: 'var(--error)' }}
              onClick={() => {
                store.deleteDiaryEntry(deleting.id);
                setDeleting(null);
              }}
            >
              {DIARY_COPY.deleteConfirmButton}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
