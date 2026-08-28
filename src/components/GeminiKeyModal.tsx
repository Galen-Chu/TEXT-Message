import { useState } from 'react';
import { GEMINI_KEY_MODAL } from '../constants';
import Modal from './Modal';

/** BYOG key 設定:輸入/清除 Gemini API key(僅存使用者瀏覽器)。 */
export default function GeminiKeyModal({
  hasKey,
  onSave,
  onClear,
  onClose,
}: {
  hasKey: boolean;
  onSave: (key: string) => void;
  onClear: () => void;
  onClose: () => void;
}) {
  const [value, setValue] = useState('');

  return (
    <Modal onClose={onClose} width={460}>
      <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-main)', marginBottom: 10 }}>
        {GEMINI_KEY_MODAL.title}
      </div>
      <div style={{ fontSize: 12.5, color: 'var(--text-sub)', lineHeight: 1.7, marginBottom: 8 }}>
        {GEMINI_KEY_MODAL.desc}
      </div>
      {hasKey && (
        <div
          style={{
            fontSize: 12,
            color: 'var(--brand)',
            fontWeight: 700,
            background: 'var(--pill-purple-bg)',
            borderRadius: 8,
            padding: '6px 10px',
            marginBottom: 10,
          }}
        >
          目前已設定 key(輸入新值可覆蓋)
        </div>
      )}
      <input
        className="text-input"
        type="password"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={GEMINI_KEY_MODAL.placeholder}
        style={{ width: '100%', borderRadius: 10, padding: '10px 14px', marginBottom: 8 }}
        autoFocus
      />
      <div style={{ fontSize: 11.5, color: 'var(--text-faint)', lineHeight: 1.7, marginBottom: 12 }}>
        {GEMINI_KEY_MODAL.privacy}
      </div>
      <div style={{ fontSize: 12, marginBottom: 16 }}>
        {GEMINI_KEY_MODAL.getKeyTip}{' '}
        <a href={GEMINI_KEY_MODAL.getKeyUrl} target="_blank" rel="noreferrer" style={{ color: 'var(--brand)', fontWeight: 600 }}>
          {GEMINI_KEY_MODAL.getKeyUrl.replace('https://', '')}
        </a>
      </div>
      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
        {hasKey && (
          <button
            className="btn btn-ghost"
            onClick={() => {
              onClear();
              onClose();
            }}
          >
            {GEMINI_KEY_MODAL.clear}
          </button>
        )}
        <button className="btn btn-outline" onClick={onClose}>
          取消
        </button>
        <button
          className="btn btn-primary"
          disabled={!value.trim()}
          onClick={() => {
            onSave(value.trim());
            onClose();
          }}
        >
          {GEMINI_KEY_MODAL.save}
        </button>
      </div>
    </Modal>
  );
}
