import { useMemo, useState } from 'react';
import { LIBRARY_COPY } from '../constants';
import type { Template } from '../types';
import { applyVariables, extractVariables } from '../utils/variables';
import Modal from './Modal';

/**
 * 範本變數填值 modal(文管庫深化第一期):含 {{變數}} 的範本在
 * 「套用到草稿/複製」前先填值;留空的變數保留原樣。
 */
export default function VariableFillModal({
  template,
  mode,
  onClose,
  onApply,
}: {
  template: Template;
  /** apply = 文管庫/Draft 的套用流程;copy = 文管庫的複製流程 */
  mode: 'apply' | 'copy';
  onClose: () => void;
  /** values 為填寫結果(可能部分留空);呼叫端負責後續套用/複製 */
  onApply: (values: Record<string, string>) => void;
}) {
  const variables = useMemo(() => extractVariables(template.text), [template]);
  const [values, setValues] = useState<Record<string, string>>({});
  const preview = applyVariables(template.text, values);

  return (
    <Modal onClose={onClose} width={460} label={LIBRARY_COPY.fillTitle}>
      <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-main)', marginBottom: 6 }}>
        {LIBRARY_COPY.fillTitle}
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
          {mode === 'copy' ? LIBRARY_COPY.fillCopy : LIBRARY_COPY.fillApply}
        </button>
      </div>
    </Modal>
  );
}
