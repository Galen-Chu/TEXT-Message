/**
 * 品牌圖像(來源=個人品牌設計系統 Uniconsign,galen-chu/uniconsign)。
 * BrandMark=品牌符號字母版「T」(綠底+青圓+白字母+黃點,SVG 造型逐字複製自
 * icons/brand/logo-t.svg,僅補 React 屬性與唯一 clipPath id)。
 * 導覽符號=Uniconsign 符號系統(fill 改 currentColor 跟隨文字色,造型逐字複製):
 * 儀表板(science/dashboard)=文管 Dashboard、信封(science/envelope)=郵件匣、
 * 分享節點(science/social-media)=自媒體、雲(dao/cloud)=雲端列、
 * 打字機(science/typewriter)=編發器、帳本(science/ledger)=定排程、
 * 書(science/book,原 law/book 遷入)=文庫。
 * 日誌本(science/diary)=寫日記。
 * (產生方式:scripts 外臨時產生器,幾何逐字取自 git 追蹤的 icons/ 原始 SVG。)
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

/** 符號系統共用骨架:24×24、currentColor、裝飾性(aria-hidden)、與文字基線對齊。 */
function NavIcon({ size = 18, children }: { size?: number; children: ReactNode }): ReactNode {
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
      {children}
    </svg>
  );
}

/** 科學「書」——文庫 Library。 */
export function IconBook({ size = 18 }: { size?: number }): ReactNode {
  return (
    <NavIcon size={size}>
      <path d="M11.4 7.3L11.08 7.07L10.74 6.86L10.4 6.67L10 6.47L9.59 6.3L9.12 6.13L8.6 5.98L8.02 5.84L7.34 5.72L6.5 5.61L5.35 5.53L4 5.5A1 1 0 0 1 4 3.5L4 3.5L5.44 3.53L6.7 3.62L7.64 3.74L8.43 3.88L9.11 4.05L9.74 4.23L10.31 4.43L10.82 4.65L11.33 4.89L11.76 5.14L12.19 5.41L12.6 5.7A1 1 0 0 1 11.4 7.3ZM5 4.5L5 17.5A1 1 0 0 1 3 17.5L3 17.5L3 4.5A1 1 0 0 1 5 4.5ZM4 16.5L5.65 16.54L6.8 16.63L7.75 16.76L8.54 16.91L9.22 17.07L9.85 17.27L10.42 17.48L10.93 17.7L11.42 17.95L11.86 18.2L12.28 18.47L12.6 18.7A1 1 0 0 1 11.4 20.3L11.4 20.3L11.15 20.12L10.82 19.9L10.47 19.71L10.08 19.51L9.67 19.33L9.21 19.16L8.69 19L8.11 18.86L7.43 18.73L6.59 18.62L5.55 18.54L4 18.5A1 1 0 0 1 4 16.5ZM11.4 18.7L11.81 18.41L12.24 18.14L12.67 17.89L13.18 17.65L13.69 17.43L14.26 17.23L14.89 17.05L15.57 16.88L16.36 16.74L17.3 16.62L18.55 16.53L20 16.5A1 1 0 0 1 20 18.5L20 18.5L18.65 18.53L17.5 18.61L16.66 18.72L15.98 18.84L15.4 18.98L14.88 19.13L14.41 19.3L14 19.47L13.6 19.67L13.26 19.86L12.92 20.07L12.6 20.3A1 1 0 0 1 11.4 18.7ZM19 17.5L19 4.5A1 1 0 0 1 21 4.5L21 4.5L21 17.5A1 1 0 0 1 19 17.5ZM20 5.5L18.45 5.54L17.41 5.62L16.57 5.73L15.89 5.86L15.31 6L14.79 6.16L14.33 6.33L13.92 6.51L13.53 6.71L13.18 6.9L12.85 7.12L12.6 7.3A1 1 0 0 1 11.4 5.7L11.4 5.7L11.72 5.47L12.14 5.2L12.58 4.95L13.07 4.7L13.58 4.48L14.15 4.27L14.78 4.07L15.46 3.91L16.25 3.76L17.2 3.63L18.35 3.54L20 3.5A1 1 0 0 1 20 5.5Z" fill="currentColor"/>
      <path d="M13 6.5L13 19.5A1 1 0 0 1 11 19.5L11 19.5L11 6.5A1 1 0 0 1 13 6.5Z" fill="currentColor"/>
    </NavIcon>
  );
}
/** 道家「雲」——雲端列 Drive。 */
export function IconCloud({ size = 18 }: { size?: number }): ReactNode {
  return (
    <NavIcon size={size}>
      <path d="M7.09 12.5L6.94 12.5L6.8 12.51L6.66 12.53L6.52 12.56L6.38 12.59L6.24 12.63L6.11 12.68L5.98 12.74L5.85 12.8L5.73 12.88L5.61 12.96L5.5 13.04L5.39 13.13L5.28 13.23L5.18 13.34L5.09 13.45L5.01 13.56L4.93 13.68L4.85 13.8L4.79 13.93L4.73 14.06L4.68 14.19L4.64 14.33L4.61 14.47L4.58 14.61L4.56 14.75L4.55 14.89L4.55 15.04L4.56 15.18L4.57 15.32L4.59 15.46L4.62 15.6L4.66 15.74L4.71 15.87L4.76 16.01L4.82 16.13L4.89 16.26L4.96 16.38L5.05 16.5L5.14 16.61L5.23 16.72L5.33 16.82L5.44 16.91L5.55 17L5.67 17.09L5.79 17.16L5.91 17.23L6.04 17.29L6.18 17.34L6.31 17.39L6.45 17.43L6.59 17.46L6.73 17.48L6.87 17.49L7 17.5L17 17.5L17.13 17.49L17.27 17.48L17.41 17.46L17.55 17.43L17.69 17.39L17.82 17.34L17.96 17.29L18.09 17.23L18.21 17.16L18.33 17.09L18.45 17L18.56 16.91L18.67 16.82L18.77 16.72L18.86 16.61L18.95 16.5L19.04 16.38L19.11 16.26L19.18 16.13L19.24 16.01L19.29 15.87L19.34 15.74L19.38 15.6L19.41 15.46L19.43 15.32L19.44 15.18L19.45 15.04L19.45 14.89L19.44 14.75L19.42 14.61L19.39 14.47L19.36 14.33L19.32 14.19L19.27 14.06L19.21 13.93L19.15 13.8L19.07 13.68L18.99 13.56L18.91 13.45L18.82 13.34L18.72 13.23L18.61 13.13L18.5 13.04L18.39 12.96L18.27 12.88L18.15 12.8L18.02 12.74L17.89 12.68L17.76 12.63L17.62 12.59L17.48 12.56L17.34 12.53L17.2 12.51L17.06 12.5L16.91 12.5A1 1 0 0 1 16.89 10.5L16.89 10.5L17.14 10.5L17.4 10.52L17.65 10.55L17.91 10.6L18.16 10.66L18.4 10.74L18.64 10.83L18.88 10.93L19.11 11.05L19.33 11.18L19.54 11.32L19.75 11.48L19.95 11.64L20.13 11.82L20.31 12L20.47 12.2L20.63 12.41L20.77 12.62L20.9 12.84L21.02 13.07L21.12 13.31L21.21 13.55L21.29 13.79L21.35 14.04L21.4 14.3L21.43 14.55L21.45 14.81L21.45 15.06L21.44 15.32L21.41 15.58L21.37 15.83L21.32 16.08L21.25 16.33L21.17 16.57L21.07 16.81L20.96 17.04L20.84 17.27L20.7 17.49L20.55 17.7L20.39 17.9L20.22 18.09L20.04 18.27L19.85 18.44L19.65 18.6L19.44 18.75L19.22 18.89L18.99 19.01L18.76 19.12L18.52 19.22L18.28 19.3L18.03 19.37L17.78 19.42L17.53 19.46L17.27 19.49L17 19.5L7 19.5L6.73 19.49L6.47 19.46L6.22 19.42L5.97 19.37L5.72 19.3L5.48 19.22L5.24 19.12L5.01 19.01L4.78 18.89L4.56 18.75L4.35 18.6L4.15 18.44L3.96 18.27L3.78 18.09L3.61 17.9L3.45 17.7L3.3 17.49L3.16 17.27L3.04 17.04L2.93 16.81L2.83 16.57L2.75 16.33L2.68 16.08L2.63 15.83L2.59 15.58L2.56 15.32L2.55 15.06L2.55 14.81L2.57 14.55L2.6 14.3L2.65 14.04L2.71 13.79L2.79 13.55L2.88 13.31L2.98 13.07L3.1 12.84L3.23 12.62L3.37 12.41L3.53 12.2L3.69 12L3.87 11.82L4.05 11.64L4.25 11.48L4.46 11.32L4.67 11.18L4.89 11.05L5.12 10.93L5.36 10.83L5.6 10.74L5.84 10.66L6.09 10.6L6.35 10.55L6.6 10.52L6.86 10.5L7.11 10.5A1 1 0 0 1 7.09 12.5ZM15.92 11.31L15.96 11.06L15.99 10.83L16 10.59L16 10.35L15.98 10.11L15.95 9.87L15.9 9.64L15.85 9.41L15.77 9.18L15.69 8.95L15.59 8.74L15.48 8.52L15.35 8.32L15.21 8.12L15.07 7.94L14.91 7.76L14.74 7.59L14.56 7.43L14.37 7.28L14.17 7.15L13.97 7.02L13.75 6.91L13.54 6.81L13.31 6.73L13.08 6.65L12.85 6.6L12.62 6.55L12.38 6.52L12.14 6.51L11.9 6.51L11.66 6.52L11.42 6.55L11.19 6.59L10.95 6.64L10.73 6.71L10.5 6.8L10.28 6.89L10.07 7L9.86 7.12L9.66 7.26L9.47 7.4L9.29 7.56L9.12 7.73L8.96 7.9L8.81 8.09L8.67 8.29L8.54 8.49L8.43 8.7L8.33 8.92L8.24 9.14L8.17 9.37L8.1 9.6L8.06 9.83L8.02 10.07L8 10.31L8 10.55L8.01 10.79L8.03 11.03L8.07 11.26L8.08 11.31A1 1 0 0 1 6.12 11.69L6.12 11.69L6.11 11.64L6.05 11.29L6.01 10.93L6 10.57L6.01 10.21L6.04 9.85L6.09 9.5L6.16 9.14L6.25 8.8L6.36 8.46L6.49 8.12L6.65 7.8L6.82 7.48L7.01 7.18L7.22 6.88L7.44 6.6L7.68 6.34L7.94 6.09L8.21 5.85L8.5 5.63L8.79 5.43L9.1 5.25L9.42 5.09L9.75 4.94L10.09 4.82L10.43 4.71L10.78 4.63L11.14 4.57L11.49 4.53L11.85 4.51L12.21 4.51L12.57 4.53L12.92 4.58L13.28 4.64L13.63 4.73L13.97 4.84L14.3 4.96L14.63 5.11L14.95 5.28L15.26 5.47L15.55 5.67L15.84 5.89L16.1 6.13L16.36 6.38L16.6 6.65L16.82 6.93L17.03 7.23L17.21 7.53L17.38 7.85L17.53 8.18L17.66 8.51L17.77 8.85L17.86 9.2L17.92 9.56L17.97 9.91L18 10.27L18 10.63L17.98 10.99L17.94 11.35L17.88 11.69A1 1 0 0 1 15.92 11.31Z" fill="currentColor"/>
    </NavIcon>
  );
}/** 科學「儀表板」——文管 Dashboard(每日總覽)。 */
export function IconDashboard({ size = 18 }: { size?: number }): ReactNode {
  return (
    <NavIcon size={size}>
      <path d="M5.64 18.36A9 9 0 1 1 18.36 18.36A1 1 0 0 1 16.95 16.95A7 7 0 1 0 7.05 16.95A1 1 0 0 0 5.64 18.36Z" fill="currentColor"/>
      <rect x="11" y="3.4" width="2" height="2.6" rx="1" fill="currentColor"/>
      <rect x="11.7" y="5.79" width="2" height="9.99" rx="1" transform="rotate(30 12.7 10.79)" fill="currentColor"/>
      <circle cx="12" cy="12" r="1.6" fill="currentColor"/>
    </NavIcon>
  );
}
/** 科學「信封」——郵件匣 Gmail(收信)。 */
export function IconEnvelope({ size = 18 }: { size?: number }): ReactNode {
  return (
    <NavIcon size={size}>
      <path d="M5 6H19Q21 6 21 8V16Q21 18 19 18H5Q3 18 3 16V8Q3 6 5 6Z M5 8V16H19V8Z" fill="currentColor"/>
      <rect x="7" y="4.1" width="2" height="12.31" rx="1" transform="rotate(-50.91 8 10.25)" fill="currentColor"/>
      <rect x="15" y="4.1" width="2" height="12.31" rx="1" transform="rotate(50.91 16 10.25)" fill="currentColor"/>
    </NavIcon>
  );
}
/** 科學「分享節點」——自媒體 Social(對外發佈)。 */
export function IconSocialMedia({ size = 18 }: { size?: number }): ReactNode {
  return (
    <NavIcon size={size}>
      <circle cx="6" cy="12" r="2.2" fill="currentColor"/>
      <circle cx="18" cy="5.5" r="2.2" fill="currentColor"/>
      <circle cx="18" cy="18.5" r="2.2" fill="currentColor"/>
      <rect x="11" y="2.67" width="2" height="12.16" rx="1" transform="rotate(-115.05 12 8.75)" fill="currentColor"/>
      <rect x="11" y="9.17" width="2" height="12.16" rx="1" transform="rotate(-64.95 12 15.25)" fill="currentColor"/>
    </NavIcon>
  );
}
/** 科學「打字機」——編發器 Text。 */
export function IconTypewriter({ size = 18 }: { size?: number }): ReactNode {
  return (
    <NavIcon size={size}>
      <path d="M9.5 2.5H14.5Q16.5 2.5 16.5 4.5V7.5Q16.5 9.5 14.5 9.5H9.5Q7.5 9.5 7.5 7.5V4.5Q7.5 2.5 9.5 2.5Z M9.5 4.5V7.5H14.5V4.5Z" fill="currentColor"/>
      <rect x="9.3" y="5.3" width="5.4" height="1.4" rx="0.7" fill="currentColor"/>
      <path d="M5 10H19Q21 10 21 12V15Q21 17 19 17H5Q3 17 3 15V12Q3 10 5 10Z M5 12V15H19V12Z" fill="currentColor"/>
      <circle cx="7.5" cy="13.5" r="0.9" fill="currentColor"/>
      <circle cx="12" cy="13.5" r="0.9" fill="currentColor"/>
      <circle cx="16.5" cy="13.5" r="0.9" fill="currentColor"/>
    </NavIcon>
  );
}
/** 科學「帳本」——定排程 Task(逐筆排定的紀錄)。 */
export function IconLedger({ size = 18 }: { size?: number }): ReactNode {
  return (
    <NavIcon size={size}>
      <path d="M6 4H18Q20 4 20 6V18Q20 20 18 20H6Q4 20 4 18V6Q4 4 6 4Z M6 6V18H18V6Z" fill="currentColor"/>
      <rect x="7.5" y="8" width="9" height="2" rx="1" fill="currentColor"/>
      <rect x="10.5" y="8" width="2" height="8" rx="1" fill="currentColor"/>
    </NavIcon>
  );
}
/** 科學「日誌本」——寫日記 Diary。 */
export function IconDiary({ size = 18 }: { size?: number }): ReactNode {
  return (
    <NavIcon size={size}>
      <path d="M6 4H18Q20 4 20 6V18Q20 20 18 20H6Q4 20 4 18V6Q4 4 6 4Z M6 6V18H18V6Z" fill="currentColor"/>
      <rect x="14" y="2.5" width="2.5" height="6" rx="1.25" fill="currentColor"/>
      <rect x="8" y="9" width="8" height="1.8" rx="0.9" fill="currentColor"/>
      <rect x="8" y="13" width="8" height="1.8" rx="0.9" fill="currentColor"/>
    </NavIcon>
  );
}
