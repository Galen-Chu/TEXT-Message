import { useState } from 'react';
import { GEMINI_KEY_MODAL } from '../constants';
import Modal from './Modal';

/** BYOG key 設定:輸入/清除 Gemini API key(僅存使用者瀏覽器)。 */
export default function GeminiKeyModal({
  hasKey,
  onSave,
  onClear,
  onClose,
  label,
}: {
  hasKey: boolean;
  onSave: (key: string) => void;
  onClear: () => void;
  onClose: () => void;
  label?: string;
}) {
  const [value, setValue] = useState('');

  return (
    <Modal onClose={onClose} width={460} label={label}>
      <div className="t-card-title" style={{ marginBottom: 10 }}>
        {GEMINI_KEY_MODAL.title}
      </div>
      <div
        className="t-sub"
        style={{
          color: 'var(--text-sub)',
          lineHeight: 'var(--leading-normal)',
          marginBottom: 8,
        }}
      >
        {GEMINI_KEY_MODAL.desc}
      </div>
      {hasKey && (
        <div
          className="t-sub"
          style={{
            color: 'var(--brand)',
            fontWeight: 'var(--weight-bold)',
            background: 'var(--pill-brand-bg)',
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
      <div className="t-note" style={{ marginBottom: 8 }}>
        {GEMINI_KEY_MODAL.privacy}
      </div>
      {/*
        L3 家族共用的誠實標示(IA-D8):媒管庫唯讀同一把 key。共用的是配額,
        不是「金鑰外流」——文案必須讓使用者在這裡就看到,而不是到別處才發現。
      */}
      <div
        className="t-note"
        style={{
          color: 'var(--text-sub)',
          marginBottom: 12,
          padding: '10px 12px',
          borderRadius: 10,
          background: 'var(--surface-soft)',
        }}
      >
        {GEMINI_KEY_MODAL.familyShareNote}
      </div>
      <div className="t-sub" style={{ marginBottom: 16 }}>
        {GEMINI_KEY_MODAL.getKeyTip}{' '}
        <a
          href={GEMINI_KEY_MODAL.getKeyUrl}
          target="_blank"
          rel="noreferrer"
          style={{ color: 'var(--brand)', fontWeight: 'var(--weight-semibold)' }}
        >
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
