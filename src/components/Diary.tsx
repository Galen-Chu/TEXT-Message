import { useState } from 'react';
import {
  DIARY_BODY_MAX,
  DIARY_BODY_MIN,
  DIARY_COPY,
  DIARY_EXPORT_COPY,
  DIARY_EXPORT_RANGES,
  DIARY_MOODS,
  DIARY_PAGE_SIZE,
  DIARY_SECTIONS,
  DIARY_SECTION_MAX,
} from '../constants';
import type { AppStore } from '../hooks/useAppStore';
import { diaryTotalLength, searchDiaryEntries, sortDiaryEntries } from '../services/diary/storage';
import { isVaultExportSupported } from '../services/diary/vaultFs';
import { datesNeedingExport, rangeBounds } from '../services/diary/vaultMarkdown';
import type { DiaryEntry, DiarySectionKey } from '../types';
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
  // 沉澱小節(D9,2026-11-10):對映 vault 模板四小節的選填一行欄;字數計入 100–500 統計
  const [sections, setSections] = useState<Partial<Record<DiarySectionKey, string>>>({});
  const [editSections, setEditSections] = useState<Partial<Record<DiarySectionKey, string>>>({});
  const [deleting, setDeleting] = useState<DiaryEntry | null>(null);
  // 日記 P2 路徑 B:條目卡生成貼文(genBusyId=生成中的條目;genModal=可編輯結果)
  const [genBusyId, setGenBusyId] = useState<string | null>(null);
  const [genModal, setGenModal] = useState<{ entry: DiaryEntry; text: string } | null>(null);
  const [shown, setShown] = useState(DIARY_PAGE_SIZE);
  /** 匯出範圍是頁面本地狀態(每次進頁面重設為「全部」——增量寫入讓它幾乎沒代價)。 */
  const [range, setRange] = useState<'all' | 'year' | 'month'>('all');

  const entries = searchDiaryEntries(sortDiaryEntries(store.diaryEntries), search);
  // 分頁(2026-11-01 補缺口):累積數百篇後整頁全文渲染會過長;換關鍵字時縮回第一頁。
  const visible = entries.slice(0, shown);
  const more = entries.length - visible.length;

  // 匯出:支援度決定顯示流程還是下載退路;待寫天數=增量判定的結果(戳記比對)。
  const supported = isVaultExportSupported();
  const pending = datesNeedingExport(
    store.diaryEntries,
    store.diaryExport.stamps,
    rangeBounds(range, toISODate(new Date())),
  ).length;

  /** 心情 chips(撰寫卡與編輯 Modal 共用;點已選的再取消)。樣式沿 Inbox 標籤 chips 慣例。 */
  const moodChips = (value: string, onPick: (m: string) => void) => (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
      {DIARY_MOODS.map((m) => {
        const active = value === m;
        return (
          <button
            key={m}
            onClick={() => onPick(active ? '' : m)}
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
            {m}
          </button>
        );
      })}
    </div>
  );

  /** 沉澱小節欄(D9):撰寫卡與編輯 Modal 共用;選填一行欄,窄螢幕自動單欄。 */
  const sectionFields = (
    value: Partial<Record<DiarySectionKey, string>>,
    onChange: (next: Partial<Record<DiarySectionKey, string>>) => void,
  ) => (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10 }}>
      {DIARY_SECTIONS.map((s) => (
        <div key={s.key}>
          <div className="field-label">{s.label}</div>
          <input
            className="text-input"
            value={value[s.key] ?? ''}
            maxLength={DIARY_SECTION_MAX}
            aria-label={s.label}
            onChange={(e) => onChange({ ...value, [s.key]: e.target.value })}
          />
        </div>
      ))}
    </div>
  );

  /** 正規化:trim、空值不落地;全空=整組不存(undefined)。 */
  const filledSections = (s: Partial<Record<DiarySectionKey, string>>) => {
    const out: Partial<Record<DiarySectionKey, string>> = {};
    for (const { key } of DIARY_SECTIONS) {
      const v = (s[key] ?? '').trim();
      if (v) out[key] = v;
    }
    return Object.keys(out).length > 0 ? out : undefined;
  };

  /** 即時字數(D9:主文+小節合計):100–500 之外轉紅提示,在門檻內轉弱色。 */
  const totalCount = (text: string, secs: Partial<Record<DiarySectionKey, string>>) => {
    const n = diaryTotalLength({ body: text, sections: secs });
    return (
      <div
        className="t-meta t-num"
        style={{
          color: n >= DIARY_BODY_MIN && n <= DIARY_BODY_MAX ? 'var(--text-weak)' : 'var(--error)',
          whiteSpace: 'nowrap',
        }}
      >
        {DIARY_COPY.bodyCountLabel(n)}
      </div>
    );
  };

  const submit = () => {
    const secs = filledSections(sections);
    if (!body.trim().length) {
      store.showToast(DIARY_COPY.emptyBodyToast);
      return;
    }
    const n = diaryTotalLength({ body, sections: secs });
    if (n < DIARY_BODY_MIN || n > DIARY_BODY_MAX) {
      store.showToast(DIARY_COPY.bodyLengthToast(n));
      return;
    }
    store.addDiaryEntry({
      date: date || toISODate(new Date()),
      title: title.trim(),
      body,
      mood: mood || undefined,
      sections: secs,
    });
    setDate(toISODate(new Date()));
    setTitle('');
    setBody('');
    setMood('');
    setSections({});
  };

  const openEdit = (e: DiaryEntry) => {
    setEditing(e);
    setEditDate(e.date);
    setEditTitle(e.title);
    setEditBody(e.body);
    setEditMood(e.mood ?? '');
    setEditSections(e.sections ?? {});
  };

  const saveEdit = () => {
    if (!editing) return;
    const secs = filledSections(editSections);
    if (!editBody.trim().length) {
      store.showToast(DIARY_COPY.emptyBodyToast);
      return;
    }
    const n = diaryTotalLength({ body: editBody, sections: secs });
    if (n < DIARY_BODY_MIN || n > DIARY_BODY_MAX) {
      store.showToast(DIARY_COPY.bodyLengthToast(n));
      return;
    }
    store.updateDiaryEntry(editing.id, {
      date: editDate || editing.date,
      title: editTitle.trim(),
      body: editBody,
      mood: editMood || undefined,
      sections: secs,
    });
    setEditing(null);
  };

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <div className="t-page-title" style={{ marginBottom: 4 }}>
          {DIARY_COPY.pageTitle}
        </div>
        <div className="t-page-desc">{DIARY_COPY.pageDesc}</div>
      </div>

      <div className="card" style={{ padding: 16, marginBottom: 20 }}>
        <div className="t-sec-title" style={{ marginBottom: 12 }}>
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
          style={{ minHeight: 120, lineHeight: 'var(--leading-normal)', resize: 'vertical' }}
        />
        <div style={{ margin: '14px 0 0' }}>
          <div className="field-label">{DIARY_COPY.sectionsLabel}</div>
          <div className="t-note" style={{ marginBottom: 8 }}>
            {DIARY_COPY.sectionsHint}
          </div>
          {sectionFields(sections, setSections)}
        </div>
        <div
          style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 }}
        >
          {totalCount(body, sections)}
          <button className="btn btn-primary" onClick={submit}>
            {DIARY_COPY.saveButton}
          </button>
        </div>
      </div>

      {store.diaryEntries.length > 0 && (
        <div className="card" style={{ padding: 16, marginBottom: 20 }}>
          <div className="t-sec-title">{DIARY_EXPORT_COPY.cardTitle}</div>
          <div className="t-meta" style={{ marginBottom: 14 }}>
            {DIARY_EXPORT_COPY.cardDesc}
          </div>

          {!supported ? (
            <>
              <div className="t-item-title">{DIARY_EXPORT_COPY.unsupportedTitle}</div>
              <div className="t-meta" style={{ margin: '4px 0 12px' }}>
                {DIARY_EXPORT_COPY.unsupportedDesc}
              </div>
              <button className="btn btn-outline" onClick={() => store.exportDiaryToVault(range)}>
                {DIARY_EXPORT_COPY.downloadButton}
              </button>
            </>
          ) : (
            <>
              {/* 步驟①:資料夾。狀態(已選哪個/還沒選)與它自己的按鈕同一列——
                  舊版把這顆鈕排在匯出鈕之後、狀態又落在下方,讀的順序與做的順序不一致。 */}
              <div
                style={{
                  display: 'flex',
                  gap: 12,
                  alignItems: 'flex-start',
                  justifyContent: 'space-between',
                  paddingBottom: 12,
                  borderBottom: '1px solid var(--border-2)',
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="t-item-title">{DIARY_EXPORT_COPY.stepFolderLabel}</div>
                  <div className="t-meta" style={{ marginTop: 2 }}>
                    {store.vaultFolder
                      ? DIARY_EXPORT_COPY.folderLabel(store.vaultFolder)
                      : DIARY_EXPORT_COPY.needPickHint}
                  </div>
                </div>
                <button
                  className="btn btn-outline btn-sm"
                  style={{ flexShrink: 0 }}
                  onClick={store.pickDiaryVault}
                >
                  {store.vaultFolder
                    ? DIARY_EXPORT_COPY.repickButton
                    : DIARY_EXPORT_COPY.pickButton}
                </button>
              </div>

              {/* 步驟②:選範圍 → 看這個範圍的即時狀態 → 按匯出。動作在步驟末尾,不必往上回。 */}
              <div style={{ paddingTop: 12 }}>
                <div className="t-item-title">{DIARY_EXPORT_COPY.stepExportLabel}</div>
                <div style={{ display: 'flex', gap: 8, margin: '8px 0' }}>
                  {DIARY_EXPORT_RANGES.map((r) => {
                    const active = range === r.value;
                    return (
                      <button
                        key={r.value}
                        onClick={() => setRange(r.value)}
                        className="t-meta"
                        style={{
                          padding: '5px 14px',
                          borderRadius: 8,
                          fontWeight: 'var(--weight-semibold)',
                          background: active ? 'var(--pill-brand-bg)' : 'var(--card)',
                          color: active ? 'var(--brand)' : 'var(--text-faint)',
                          border: `1px solid ${active ? 'var(--brand)' : 'var(--border-3)'}`,
                        }}
                      >
                        {r.label}
                      </button>
                    );
                  })}
                </div>
                <div className="t-meta" style={{ marginBottom: 10 }}>
                  {DIARY_EXPORT_COPY.pendingLabel(pending)} ·{' '}
                  {store.diaryExport.lastExportAt
                    ? DIARY_EXPORT_COPY.lastExportLabel(
                        shortDateTimeLabel(store.diaryExport.lastExportAt),
                      )
                    : DIARY_EXPORT_COPY.neverExported}
                </div>
                <button
                  className="btn btn-primary"
                  disabled={store.diaryExporting}
                  onClick={() => store.exportDiaryToVault(range)}
                >
                  {store.diaryExporting
                    ? DIARY_EXPORT_COPY.exportingButton
                    : DIARY_EXPORT_COPY.exportButton}
                </button>
              </div>

              {/* 誠實標示是靜態的(不隨操作變動),固定收在卡底,不再夾在按鈕之間 */}
              <div
                className="t-note"
                style={{ marginTop: 14, paddingTop: 10, borderTop: '1px solid var(--border-2)' }}
              >
                {DIARY_EXPORT_COPY.notes.map((n) => (
                  <div key={n}>· {n}</div>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 12 }}>
        <input
          className="text-input"
          style={{ flex: 1 }}
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setShown(DIARY_PAGE_SIZE);
          }}
          placeholder={DIARY_COPY.searchPlaceholder}
        />
        <span className="t-sub t-num" style={{ whiteSpace: 'nowrap' }}>
          {DIARY_COPY.countLabel(entries.length)}
        </span>
      </div>

      {entries.length === 0 ? (
        <div className="card" style={{ padding: 28, textAlign: 'center' }}>
          <div className="t-card-title" style={{ marginBottom: 6 }}>
            {search.trim() ? '找不到符合的日記' : DIARY_COPY.emptyTitle}
          </div>
          <div className="t-sub">
            {search.trim() ? '換個關鍵字試試' : DIARY_COPY.emptyDesc}
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {visible.map((e) => (
            <div className="card" key={e.id} style={{ padding: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <span className="pill pill-brand">{e.date}</span>
                {e.mood && <span className="pill pill-accent">{e.mood}</span>}
                <span className="t-meta t-num" style={{ marginLeft: 'auto' }}>
                  {shortDateTimeLabel(e.updatedAt)}
                </span>
              </div>
              {e.title && (
                <div
                  className="t-item-title"
                  style={{
                    fontWeight: 'var(--weight-bold)',
                    marginBottom: 4,
                    overflowWrap: 'anywhere',
                  }}
                >
                  {e.title}
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
                {e.body}
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                <button
                  className="btn btn-outline"
                  style={{ borderRadius: 8 }}
                  disabled={genBusyId !== null}
                  onClick={async () => {
                    setGenBusyId(e.id);
                    const r = await store.generateDiaryPostFromEntry(e);
                    setGenBusyId(null);
                    if (r.ok) setGenModal({ entry: e, text: r.text });
                  }}
                >
                  {genBusyId === e.id ? DIARY_COPY.generatingLabel : DIARY_COPY.genButton}
                </button>
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
          {more > 0 && (
            <button
              className="btn btn-outline"
              style={{ alignSelf: 'center', borderRadius: 8 }}
              onClick={() => setShown((n) => n + DIARY_PAGE_SIZE)}
            >
              {DIARY_COPY.loadMoreButton(more)}
            </button>
          )}
        </div>
      )}

      {genModal && (
        <Modal onClose={() => setGenModal(null)} width={520} label={DIARY_COPY.genModalTitle}>
          <div className="t-card-title" style={{ marginBottom: 6 }}>
            {DIARY_COPY.genModalTitle}
          </div>
          <div className="t-sub" style={{ marginBottom: 12 }}>
            {DIARY_COPY.genFromLabel(genModal.entry.date, genModal.entry.mood)}
          </div>
          <textarea
            className="text-input"
            value={genModal.text}
            onChange={(ev) => setGenModal({ ...genModal, text: ev.target.value })}
            style={{
              minHeight: 160,
              lineHeight: 'var(--leading-normal)',
              resize: 'vertical',
              marginBottom: 8,
            }}
          />
          <div className="t-note" style={{ marginBottom: 14 }}>
            {DIARY_COPY.genHonesty}
          </div>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <button
              className="btn btn-ghost"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(genModal.text);
                  store.showToast(DIARY_COPY.genCopiedToast);
                } catch {
                  // 剪貼簿不可用(權限/環境)靜默略過——編輯器內仍可手動複製
                }
              }}
            >
              {DIARY_COPY.genCopyButton}
            </button>
            <button className="btn btn-ghost" onClick={() => setGenModal(null)}>
              {DIARY_COPY.cancelButton}
            </button>
            <button
              className="btn btn-primary"
              onClick={() => {
                store.insertDiaryPostText(genModal.text);
                setGenModal(null);
              }}
            >
              {DIARY_COPY.genToDraftButton}
            </button>
          </div>
        </Modal>
      )}

      {editing && (
        <Modal onClose={() => setEditing(null)} width={520} label={DIARY_COPY.editButton}>
          <div className="t-card-title" style={{ marginBottom: 16 }}>
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
            style={{ minHeight: 120, lineHeight: 'var(--leading-normal)', resize: 'vertical' }}
          />
          <div style={{ margin: '14px 0 0' }}>
            <div className="field-label">{DIARY_COPY.sectionsLabel}</div>
            <div style={{ marginTop: 8 }}>{sectionFields(editSections, setEditSections)}</div>
          </div>
          <div
            style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 }}
          >
            {totalCount(editBody, editSections)}
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
          <div className="t-card-title" style={{ marginBottom: 8 }}>
            {DIARY_COPY.deleteModalTitle}
          </div>
          <div className="t-body" style={{ color: 'var(--text-weak)', marginBottom: 16 }}>
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
