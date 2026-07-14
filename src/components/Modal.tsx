import type { CSSProperties, ReactNode } from 'react';

/** 共用 modal 外框:點擊遮罩或取消按鈕皆可關閉。 */
export default function Modal({
  onClose,
  width,
  children,
  style,
}: {
  onClose: () => void;
  width: number;
  children: ReactNode;
  style?: CSSProperties;
}) {
  return (
    <div
      className="modal-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal-card" style={{ width, ...style }}>
        {children}
      </div>
    </div>
  );
}
