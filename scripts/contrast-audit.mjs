/**
 * WCAG 2.1 對比度稽核(回歸閘門,2026-10-09 改寫)。
 *
 * 2026-09-09 全站配色修正時這支腳本是「一次性提案驗算」,色值硬寫在檔案裡;
 * 那代表改了 index.css 的 token 它照樣全綠,等於假閘門。現在改為**從
 * src/index.css 實際解析 token**,並在未達標時以 exit code 1 失敗,CI 才擋得住。
 *
 * 用法:node scripts/contrast-audit.mjs
 * 例外:PlatformBadge 的平台識別色(FB 藍/LINE 綠等)不列入——平台識別優先於對比度。
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const CSS_PATH = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'index.css');
const AA_NORMAL = 4.5;

// ---- CSS token 解析 -------------------------------------------------------

/** 取 `selector {` 之後到第一個 `}` 之間的宣告文字。 */
function blockAfter(css, marker) {
  const start = css.indexOf(marker);
  if (start === -1) throw new Error(`index.css 找不到 ${marker}`);
  const open = css.indexOf('{', start);
  const close = css.indexOf('}', open);
  if (open === -1 || close === -1) throw new Error(`index.css 的 ${marker} 區塊不完整`);
  return css.slice(open + 1, close);
}

/** 從宣告文字抽出 `--name: #rrggbb`(忽略非 hex 的 token,如 shadow/color-scheme)。 */
function parseTokens(block) {
  const out = {};
  for (const m of block.matchAll(/--([\w-]+)\s*:\s*(#[0-9a-fA-F]{3,8})\s*;/g)) {
    out[m[1]] = m[2];
  }
  return out;
}

const css = readFileSync(CSS_PATH, 'utf8');
const light = parseTokens(blockAfter(css, ':root'));
const darkBlock = blockAfter(css, '@media (prefers-color-scheme: dark)').includes('--')
  ? blockAfter(css, '@media (prefers-color-scheme: dark)')
  : blockAfter(css.slice(css.indexOf('@media (prefers-color-scheme: dark)')), ':root');
const dark = { ...light, ...parseTokens(darkBlock) };

// ---- 對比度計算 ----------------------------------------------------------

const lin = (c) => {
  const s = c / 255;
  return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
};
const L = (hex) => {
  let h = hex.replace('#', '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
};
const ratio = (fg, bg) => {
  const a = L(fg), b = L(bg);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
};

/** `#...` 當字面色值,其餘視為 token 名稱並依模式查表。 */
function resolve(spec, tokens, mode) {
  if (spec.startsWith('#')) return spec;
  const v = tokens[spec];
  if (!v) throw new Error(`${mode} 模式找不到 token --${spec}(index.css 是否已改名?)`);
  return v;
}

// ---- 稽核案例(前景, 背景, 說明)-----------------------------------------
// 兩模式共用同一份清單;token 由各模式的表解析,字面色值寫在 CSS 規則裡(如按鈕文字)。

const CASES = [
  ['text-sub', 'card', '次要文字(含 placeholder)/ 卡片'],
  ['text-sub', 'surface-soft', '次要文字 / 淺層面'],
  ['text-weak', 'card', '弱化文字 / 卡片'],
  ['text-weak', 'surface-soft', '弱化文字 / 淺層面'],
  ['text-faint', 'card', '最弱文字 / 卡片'],
  ['text-main', 'card', '主文字 / 卡片'],
  ['text-main', 'bg', '主文字 / 底色'],
  ['brand', 'card', '品牌色文字 / 卡片'],
  ['brand', 'surface-soft', '品牌色文字 / 淺層面'],
  ['brand', 'pill-purple-bg', '品牌色文字 / 紫膠囊'],
  ['brand', 'pill-purple-bg-2', '品牌色文字 / 紫膠囊 2'],
  ['accent', 'card', '強調色文字 / 卡片'],
  ['accent', 'pill-orange-bg', '強調色文字 / 橘膠囊'],
  ['error', 'card', '錯誤色 / 卡片'],
  ['#ffffff', 'brand-fill', '白字 / brand-fill(btn-primary)'],
  ['#38130a', 'accent-fill', '深棕字 / accent-fill(btn-accent)'],
];

let fail = 0;
for (const [mode, tokens] of [['淺色', light], ['深色', dark]]) {
  console.log(`\n── ${mode}模式 ──`);
  for (const [fgSpec, bgSpec, name] of CASES) {
    const fg = resolve(fgSpec, tokens, mode);
    const bg = resolve(bgSpec, tokens, mode);
    const r = ratio(fg, bg);
    const pass = r >= AA_NORMAL;
    if (!pass) fail++;
    console.log(
      `${pass ? '✓' : '✗'} ${r.toFixed(2).padStart(6)} (需 ${AA_NORMAL})  ${name}  ${fg} on ${bg}`,
    );
  }
}

if (fail === 0) {
  console.log('\n全數過關 ✅');
} else {
  console.error(`\n${fail} 項未達 WCAG AA(4.5:1)——請調整 src/index.css 的 token`);
  process.exit(1);
}
