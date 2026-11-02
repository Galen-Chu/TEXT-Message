/**
 * 雲端列 Drive(docs/DRIVE-PLAN 一期):連接 Google Drive(唯讀)→ 搜尋文檔 →
 * 純文字預覽 → 引用到編發器。未連線(或未設定 Client ID 的建置)顯示示範文檔,
 * 互動流程與真實模式一致(同 Gmail 的示範模式哲學)。
 */
import { useState } from 'react';
import { DOC_KIND_LABELS, DRAFT_KIND_META, DRIVE_COPY, DRIVE_ERROR_COPY } from '../constants';
import { DEMO_DRIVE_DOC_TEXT, initialDriveDocs } from '../data/mockData';
import type { AppStore } from '../hooks/useAppStore';
import type { DriveDocSummary } from '../services/drive/driveApi';
import { shortDateLabel } from '../utils/date';
import Modal from './Modal';


export default function Drive({ store }: { store: AppStore }) {
  const drive = store.drive;
  const [query, setQuery] = useState('');
  const [preview, setPreview] = useState<{ doc: DriveDocSummary; text: string } | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState('');
  const [saveOpen, setSaveOpen] = useState(false);

  const connected = drive.status === 'connected';
  const useDemo = !connected;
  const docs = connected ? drive.docs : initialDriveDocs();
  const isSample = (id: string) => store.driveStyleSamples.some((s) => s.id === id);

  const openPreview = async (doc: DriveDocSummary) => {
    setPreviewError('');
    setSaveOpen(false);
    setPreview({ doc, text: '' });
    if (useDemo) {
      setPreview({ doc, text: DEMO_DRIVE_DOC_TEXT[doc.id] ?? '(示範文檔無預覽內容)' });
      return;
    }
    setPreviewLoading(true);
    try {
      const text = await drive.previewText(doc);
      setPreview({ doc, text });
    } catch {
      setPreviewError(drive.error ? DRIVE_ERROR_COPY[drive.error.code] : DRIVE_ERROR_COPY.unknown);
    } finally {
      setPreviewLoading(false);
    }
  };

  const copyPreviewText = () => {
    if (!preview) return;
    void navigator.clipboard.writeText(preview.text).then(
      () => store.showToast(DRIVE_COPY.copiedToast),
      () => store.showToast('複製失敗,請手動選取複製'),
    );
  };

  return (
    <div>
      <div className="t-page-title" style={{ marginBottom: 4 }}>
        {DRIVE_COPY.title}
      </div>
      <div className="t-page-desc" style={{ marginBottom: 20 }}>
        {DRIVE_COPY.subtitle}
        {useDemo && (
          <span className="t-meta" style={{ marginLeft: 6 }}>
            {DRIVE_COPY.demoNote}
          </span>
        )}
      </div>

      <div className="card" style={{ padding: 16, marginBottom: 16 }}>
        {drive.status === 'error' && drive.error && (
          <div className="t-sub" style={{ color: 'var(--error)', marginBottom: 12 }}>
            {DRIVE_ERROR_COPY[drive.error.code] ?? DRIVE_ERROR_COPY.unknown}
          </div>
        )}
        {!drive.enabled ? (
          <div className="t-sub" style={{ color: 'var(--text-faint)' }}>
            {DRIVE_ERROR_COPY.disabled}
          </div>
        ) : !connected ? (
          <button
            className="btn btn-primary"
            onClick={() => void drive.connect()}
            disabled={drive.status === 'connecting'}
          >
            {drive.status === 'connecting' ? DRIVE_COPY.connecting : DRIVE_COPY.connect}
          </button>
        ) : (
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: 10,
              flexWrap: 'wrap',
            }}
          >
            <div className="t-sub" style={{ color: 'var(--text-sub)' }}>
              {DRIVE_COPY.connectedHint}
            </div>
            <button
              className="t-sub"
              style={{ fontWeight: 'var(--weight-semibold)', color: 'var(--text-faint)' }}
              onClick={drive.disconnect}
            >
              {DRIVE_COPY.disconnect}
            </button>
          </div>
        )}
      </div>

      <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
        <input
          className="text-input"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && connected) void drive.search(query);
          }}
          placeholder={DRIVE_COPY.searchPlaceholder}
          disabled={!connected}
          style={{ flex: 1, maxWidth: 420, borderRadius: 10, padding: '10px 14px' }}
        />
        <button
          className="btn btn-primary"
          onClick={() => void drive.search(query)}
          disabled={!connected || drive.searchLoading}
        >
          {drive.searchLoading ? DRIVE_COPY.loading : DRIVE_COPY.searchButton}
        </button>
        {connected && (
          <button className="btn btn-outline" onClick={() => void drive.search('')}>
            {DRIVE_COPY.listAll}
          </button>
        )}
      </div>

      <div className="card" style={{ overflow: 'hidden' }}>
        {docs.map((doc) => (
          <button
            key={doc.id}
            onClick={() => void openPreview(doc)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              width: '100%',
              textAlign: 'left',
              padding: '14px 20px',
              borderBottom: '1px solid var(--border-2)',
              background: 'transparent',
            }}
          >
            <span className="t-emoji">{doc.mimeType === 'text/plain' ? '📄' : '📝'}</span>
            <span className="t-item-title" style={{ flex: 1, minWidth: 0 }}>
              {isSample(doc.id) && <span style={{ color: 'var(--accent)' }}>★ </span>}
              {doc.name}
            </span>
            <span className="t-meta t-num" style={{ whiteSpace: 'nowrap' }}>
              {doc.modifiedTime ? shortDateLabel(new Date(doc.modifiedTime)) : ''}
            </span>
          </button>
        ))}
        {docs.length === 0 && (
          <div
            className="t-sub"
            style={{ padding: '24px 0', textAlign: 'center', color: 'var(--text-faint)' }}
          >
            {connected ? DRIVE_COPY.empty : ''}
          </div>
        )}
      </div>

      {preview && (
        <Modal
          onClose={() => setPreview(null)}
          width={560}
          label={DRIVE_COPY.previewTitle}
        >
          <div className="t-card-title" style={{ marginBottom: 12 }}>
            {preview.doc.name}
          </div>
          {previewLoading && (
            <div className="t-sub" style={{ color: 'var(--text-faint)', marginBottom: 10 }}>
              {DRIVE_COPY.loading}
            </div>
          )}
          {previewError && (
            <div className="t-sub" style={{ color: 'var(--error)', marginBottom: 10 }}>
              {previewError}
            </div>
          )}
          {!previewLoading && !previewError && (
            <div
              className="text-input"
              style={{
                whiteSpace: 'pre-line',
                lineHeight: 'var(--leading-normal)',
                color: 'var(--text-sub)',
                maxHeight: 320,
                overflowY: 'auto',
                marginBottom: 14,
              }}
            >
              {preview.text}
            </div>
          )}
          {saveOpen && !previewLoading && !previewError && (
            <div
              style={{
                display: 'flex',
                gap: 8,
                alignItems: 'center',
                flexWrap: 'wrap',
                marginBottom: 12,
              }}
            >
              <span className="t-meta">{DRIVE_COPY.saveAsTemplateTitle}:</span>
              {DRAFT_KIND_META.map((k) => (
                <button
                  key={k.key}
                  className="btn btn-outline"
                  style={{ padding: '7px 14px', borderRadius: 9 }}
                  onClick={() => {
                    store.saveDriveDocAsTemplate(k.key, preview.doc.name, preview.text);
                    setSaveOpen(false);
                    setPreview(null);
                  }}
                >
                  {DOC_KIND_LABELS[k.key]}
                </button>
              ))}
            </div>
          )}
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
            <button className="btn btn-outline" style={{ borderRadius: 9 }} onClick={copyPreviewText}>
              {DRIVE_COPY.copyButton}
            </button>
            <button
              className="btn btn-outline"
              style={{ borderRadius: 9 }}
              disabled={previewLoading || !!previewError}
              onClick={() => store.toggleDriveStyleSample(preview.doc)}
            >
              {isSample(preview.doc.id) ? DRIVE_COPY.styleUnmark : DRIVE_COPY.styleMark}
            </button>
            <button
              className="btn btn-outline"
              style={{ borderRadius: 9 }}
              disabled={previewLoading || !!previewError}
              onClick={() => setSaveOpen((v) => !v)}
            >
              {DRIVE_COPY.saveAsTemplate}
            </button>
            <button
              className="btn btn-primary"
              style={{ borderRadius: 9 }}
              disabled={previewLoading || !!previewError}
              onClick={() => {
                store.insertDriveText(preview.text);
                setPreview(null);
              }}
            >
              {DRIVE_COPY.referenceButton}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
