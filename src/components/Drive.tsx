/**
 * 雲端列 Drive(docs/DRIVE-PLAN 一期):連接 Google Drive(唯讀)→ 搜尋文檔 →
 * 純文字預覽 → 引用到編發器。未連線(或未設定 Client ID 的建置)顯示示範文檔,
 * 互動流程與真實模式一致(同 Gmail 的示範模式哲學)。
 */
import { useState } from 'react';
import { DRIVE_COPY, DRIVE_ERROR_COPY } from '../constants';
import { initialDriveDocs } from '../data/mockData';
import type { AppStore } from '../hooks/useAppStore';
import type { DriveDocSummary } from '../services/drive/driveApi';
import { shortDateLabel } from '../utils/date';
import Modal from './Modal';

/** 示範文檔的預覽文字(僅示範模式使用;真實模式一律由 Drive API 匯出)。 */
const DEMO_DOC_TEXT: Record<string, string> = {
  'demo-d1':
    '蘭嶼慢旅記\n\n第一天抵達時風很大,機車沿著環島公路往東,海的颜色從灰藍一路轉成透明的青。\n\n我沒有排太多行程,只在朗島的涼亭坐了一個下午,看潮水慢慢漲上來。慢下來之後,感官都變靈敏了——這大概就是我想寫給讀者的東西。',
  'demo-d2':
    '寫作風格筆記\n\n我的開場通常從一個具體的畫面或感官細節開始,不先講結論。\n\n例:與其寫「這趟旅行很放鬆」,我會寫「把鞋脫在民宿門口,赤腳踩上磨石子地板的那一瞬間,肩膀先鬆了」。',
  'demo-d3':
    '讀者問答整理(2026 Q3)\n\nQ:長住沖繩的網路怎麼處理?\nA:我用 eSIM 短約+民宿 Wi-Fi 雙保險,山區訊號���時提前離線地圖。',
};

export default function Drive({ store }: { store: AppStore }) {
  const drive = store.drive;
  const [query, setQuery] = useState('');
  const [preview, setPreview] = useState<{ doc: DriveDocSummary; text: string } | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState('');

  const connected = drive.status === 'connected';
  const useDemo = !connected;
  const docs = connected ? drive.docs : initialDriveDocs();

  const openPreview = async (doc: DriveDocSummary) => {
    setPreviewError('');
    setPreview({ doc, text: '' });
    if (useDemo) {
      setPreview({ doc, text: DEMO_DOC_TEXT[doc.id] ?? '(示範文檔無預覽內容)' });
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
      <div style={{ fontSize: 20, fontWeight: 900, color: 'var(--text-main)', marginBottom: 4 }}>
        {DRIVE_COPY.title}
      </div>
      <div style={{ fontSize: 13, color: 'var(--text-weak)', marginBottom: 20 }}>
        {DRIVE_COPY.subtitle}
        {useDemo && (
          <span style={{ fontSize: 11, color: 'var(--text-faint)', marginLeft: 6 }}>
            {DRIVE_COPY.demoNote}
          </span>
        )}
      </div>

      <div className="card" style={{ padding: 16, marginBottom: 16 }}>
        {drive.status === 'error' && drive.error && (
          <div style={{ fontSize: 12.5, color: 'var(--error)', marginBottom: 12 }}>
            {DRIVE_ERROR_COPY[drive.error.code] ?? DRIVE_ERROR_COPY.unknown}
          </div>
        )}
        {!drive.enabled ? (
          <div style={{ fontSize: 12.5, color: 'var(--text-faint)' }}>
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
            <div style={{ fontSize: 12.5, color: 'var(--text-sub)' }}>{DRIVE_COPY.connectedHint}</div>
            <button
              onClick={drive.disconnect}
              style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-faint)' }}
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
            <span style={{ fontSize: 18 }}>{doc.mimeType === 'text/plain' ? '📄' : '📝'}</span>
            <span style={{ flex: 1, minWidth: 0, fontSize: 13.5, fontWeight: 600, color: 'var(--text-main)' }}>
              {doc.name}
            </span>
            <span style={{ fontSize: 11.5, color: 'var(--text-faint)', whiteSpace: 'nowrap' }}>
              {doc.modifiedTime ? shortDateLabel(new Date(doc.modifiedTime)) : ''}
            </span>
          </button>
        ))}
        {docs.length === 0 && (
          <div
            style={{ padding: '24px 0', textAlign: 'center', fontSize: 12.5, color: 'var(--text-faint)' }}
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
          <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-main)', marginBottom: 12 }}>
            {preview.doc.name}
          </div>
          {previewLoading && (
            <div style={{ fontSize: 12.5, color: 'var(--text-faint)', marginBottom: 10 }}>
              {DRIVE_COPY.loading}
            </div>
          )}
          {previewError && (
            <div style={{ fontSize: 12.5, color: 'var(--error)', marginBottom: 10 }}>
              {previewError}
            </div>
          )}
          {!previewLoading && !previewError && (
            <div
              className="text-input"
              style={{
                whiteSpace: 'pre-line',
                fontSize: 13,
                lineHeight: 1.7,
                color: 'var(--text-sub)',
                maxHeight: 320,
                overflowY: 'auto',
                marginBottom: 14,
              }}
            >
              {preview.text}
            </div>
          )}
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <button className="btn btn-outline" style={{ borderRadius: 9 }} onClick={copyPreviewText}>
              {DRIVE_COPY.copyButton}
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
