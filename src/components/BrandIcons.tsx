/**
 * 品牌圖像(來源=個人品牌設計系統 Uniconsign,galen-chu/uniconsign)。
 * BrandMark=品牌符號字母版「T」(綠底+青圓+白字母+黃點,SVG 造型逐字複製自
 * icons/brand/logo-t.svg,僅補 React 屬性與唯一 clipPath id);
 * IconBook=符號系統法學類「書」,fill 改 currentColor 跟隨文字色。
 */
import { useId, type ReactNode } from 'react';

export function BrandMark({ size = 36, title }: { size?: number; title?: string }) {
  const clipId = `brand-t-${useId()}`;
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 32 32"
      width={size}
      height={size}
      fill="none"
      role={title ? 'img' : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
    >
      <defs>
        <clipPath id={clipId}>
          <rect width="32" height="32" rx="8" />
        </clipPath>
      </defs>
      <g clipPath={`url(#${clipId})`}>
        <rect width="32" height="32" fill="#167839" />
        <circle cx="22" cy="10" r="10" fill="#009CAD" />
        <path d="M9 9h12m-6 0v14" stroke="#FFFFFF" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="25" cy="25" r="2.5" fill="#E7D24E" />
      </g>
    </svg>
  );
}

export function IconBook({ size = 18 }: { size?: number }): ReactNode {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      aria-hidden="true"
      style={{ display: 'inline-block', verticalAlign: '-0.18em' }}
    >
      <path
        fill="currentColor"
        d="M11.4 7.3L11.08 7.07L10.74 6.86L10.4 6.67L10 6.47L9.59 6.3L9.12 6.13L8.6 5.98L8.02 5.84L7.34 5.72L6.5 5.61L5.35 5.53L4 5.5A1 1 0 0 1 4 3.5L4 3.5L5.44 3.53L6.7 3.62L7.64 3.74L8.43 3.88L9.11 4.05L9.74 4.23L10.31 4.43L10.82 4.65L11.33 4.89L11.76 5.14L12.19 5.41L12.6 5.7A1 1 0 0 1 11.4 7.3ZM5 4.5L5 17.5A1 1 0 0 1 3 17.5L3 17.5L3 4.5A1 1 0 0 1 5 4.5ZM4 16.5L5.65 16.54L6.8 16.63L7.75 16.76L8.54 16.91L9.22 17.07L9.85 17.27L10.42 17.48L10.93 17.7L11.42 17.95L11.86 18.2L12.28 18.47L12.6 18.7A1 1 0 0 1 11.4 20.3L11.4 20.3L11.15 20.12L10.82 19.9L10.47 19.71L10.08 19.51L9.67 19.33L9.21 19.16L8.69 19L8.11 18.86L7.43 18.73L6.59 18.62L5.55 18.54L4 18.5A1 1 0 0 1 4 16.5ZM11.4 18.7L11.81 18.41L12.24 18.14L12.67 17.89L13.18 17.65L13.69 17.43L14.26 17.23L14.89 17.05L15.57 16.88L16.36 16.74L17.3 16.62L18.55 16.53L20 16.5A1 1 0 0 1 20 18.5L20 18.5L18.65 18.53L17.5 18.61L16.66 18.72L15.98 18.84L15.4 18.98L14.88 19.13L14.41 19.3L14 19.47L13.6 19.67L13.26 19.86L12.92 20.07L12.6 20.3A1 1 0 0 1 11.4 18.7ZM19 17.5L19 4.5A1 1 0 0 1 21 4.5L21 4.5L21 17.5A1 1 0 0 1 19 17.5ZM20 5.5L18.45 5.54L17.41 5.62L16.57 5.73L15.89 5.86L15.31 6L14.79 6.16L14.33 6.33L13.92 6.51L13.53 6.71L13.18 6.9L12.85 7.12L12.6 7.3A1 1 0 0 1 11.4 5.7L11.4 5.7L11.72 5.47L12.14 5.2L12.58 4.95L13.07 4.7L13.58 4.48L14.15 4.27L14.78 4.07L15.46 3.91L16.25 3.76L17.2 3.63L18.35 3.54L20 3.5A1 1 0 0 1 20 5.5Z"
      />
      <path fill="currentColor" d="M13 6.5L13 19.5A1 1 0 0 1 11 19.5L11 19.5L11 6.5A1 1 0 0 1 13 6.5Z" />
    </svg>
  );
}
