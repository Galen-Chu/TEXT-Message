import { useEffect, useRef, type CSSProperties, type ReactNode } from 'react';

const FOCUSABLE_SELECTOR =
  'button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])';

function queryFocusable(root: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
}

/**
 * 共用 modal 外框:點擊遮罩、Esc 皆可關閉;開啟時聚焦第一個可 focus 元素、
 * 關閉時焦點還原給開啟者;Tab 在框內循環(focus trap)。label 供讀屏使用。
 */
export default function Modal({
  onClose,
  width,
  children,
  style,
  label,
}: {
  onClose: () => void;
  width: number;
  children: ReactNode;
  style?: CSSProperties;
  label?: string;
}) {
  const cardRef = useRef<HTMLDivElement>(null);
  // onClose 在父層多為 inline 函式(每次 render 新 identity),用 ref 讓效果只跑一次
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const prevFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    prevFocusRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const card = cardRef.current;
    if (card) {
      (queryFocusable(card)[0] ?? card).focus();
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCloseRef.current();
        return;
      }
      if (e.key !== 'Tab' || !card) return;
      const items = queryFocusable(card);
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      prevFocusRef.current?.focus();
    };
  }, []);

  return (
    <div
      className="modal-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={cardRef}
        className="modal-card"
        role="dialog"
        aria-modal="true"
        aria-label={label}
        tabIndex={-1}
        style={{ width, ...style }}
      >
        {children}
      </div>
    </div>
  );
}
