import { useMemo, useState } from 'react';
import { LIBRARY_COPY } from '../constants';
import { applyVariables, extractVariables } from '../utils/variables';
import Modal from './Modal';

/**
 * 範本變數填值 modal(文管庫深化第一期;第二期起吃原始文字,
 * 通用版與各平台變體皆可複用):含 {{變數}} 的內容在套用/複製前先填值;
 * 留空的變數保留原樣。
 */
export default function VariableFillModal({
  text,
  title = LIBRARY_COPY.fillTitle,
  confirmLabel,
  onClose,
  onApply,
}: {
  text: string;
  title?: string;
  /** 確認按鈕文字;未提供時依 kind 給預設 */
  confirmLabel?: string;
  onClose: () => void;
  /** values 為填寫結果(可能部分留空);呼叫端負責後續套用/複製 */
  onApply: (values: Record<string, string>) => void;
}) {
  const variables = useMemo(() => extractVariables(text), [text]);
  const [values, setValues] = useState<Record<string, string>>({});
  const preview = applyVariables(text, values);

  return (
    <Modal onClose={onClose} width={460} label={title}>
      <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-main)', marginBottom: 6 }}>
        {title}
      </div>
      <div style={{ fontSize: 12, color: 'var(--text-weak)', marginBottom: 14 }}>
        {LIBRARY_COPY.fillDesc(variables.length)}
      </div>
      {variables.map((name) => (
        <div key={name} style={{ marginBottom: 12 }}>
          <div className="field-label">{'{{' + name + '}}'}</div>
          <input
            className="text-input"
            value={values[name] ?? ''}
            onChange={(e) => setValues((v) => ({ ...v, [name]: e.target.value }))}
            placeholder={LIBRARY_COPY.fillPlaceholder(name)}
            aria-label={name}
          />
        </div>
      ))}
      <div className="field-label">{LIBRARY_COPY.fillPreview}</div>
      <div
        style={{
          fontSize: 12.5,
          color: 'var(--text-sub)',
          lineHeight: 1.6,
          whiteSpace: 'pre-line',
          maxHeight: 180,
          overflowY: 'auto',
          border: '1px solid var(--border-2)',
          borderRadius: 10,
          padding: 12,
          marginBottom: 16,
        }}
      >
        {preview}
      </div>
      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
        <button className="btn btn-ghost" style={{ borderRadius: 9 }} onClick={onClose}>
          取消
        </button>
        <button
          className="btn btn-outline"
          style={{ borderRadius: 9 }}
          onClick={() => onApply({})}
        >
          {LIBRARY_COPY.fillSkip}
        </button>
        <button
          className="btn btn-primary"
          style={{ borderRadius: 9 }}
          onClick={() => onApply(values)}
        >
          {confirmLabel ?? LIBRARY_COPY.fillApply}
        </button>
      </div>
    </Modal>
  );
}
