/**
 * 字體規格稽核(回歸閘門,2026-11-02 設計規格統一批)。
 *
 * 背景:全站字級原本散落在元件的 inline style 裡,累積出 19 種字級(8/9/10/10.5/
 * 11/11.5/12/12.5/13/13.5/14/15/16/17/18/20/22/26/36)與 5 種字重(含 800/900),
 * 其中 11~13.5 那六級肉眼幾無差別,純粹是噪音。色彩很早就 token 化並有對比度閘門
 * 守著,字體卻從來沒有——所以同一件事做兩次:先訂規格(src/index.css 的 --text-*
 * 與 .t-* 類別層、細則見 docs/UIUX.md §六),再用這支腳本擋住回頭路。
 *
 * 規則(違反即 exit 1):
 *   1. 元件不得寫 inline 字級/字重/行高字面值——字體一律走 .t-* 類別。
 *      真有動態需求時值必須是 var(--text-*) / var(--emoji-*),不得是數字。
 *   2. index.css 的 font-size/font-weight 必須引用 token,不得硬寫數值。
 *   3. 字重只有 400/500/600/700 四級(Uniconsign 原生沒有 800/900)。
 *
 * 用法:node scripts/typography-audit.mjs
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(ROOT, 'src');
const CSS_PATH = join(SRC, 'index.css');

/** 允許的 inline 值:只有引用 token 的形式過關。 */
const TOKEN_REF = /'var\(--(?:text|emoji|weight|leading)-[a-z-]+\)'/g;

/**
 * 值是否只由 token 組成。
 * 單純比對 `^'var(--x)'$` 會誤殺合法的三元式(`active ? 'var(--weight-bold)' :
 * 'var(--weight-medium)'`),所以改成「把所有 token 抽掉後不得殘留數字」——
 * 擋的是字面值,不是動態。
 */
function tokenOnly(value) {
  if (!value.includes('var(--')) return false;
  return !/\d/.test(value.replace(TOKEN_REF, ''));
}

/**
 * 唯一例外(對照 contrast-audit 的平台色例外):PlatformBadge 的徽章字級是
 * **幾何參數**——它跟著 size/radius 一起由呼叫端給定(34/9/12 一組),不是文案字級,
 * 收進 --text-* 反而會讓徽章在不同尺寸下比例跑掉。
 */
const EXEMPT = new Set(['src/components/PlatformBadge.tsx']);

function tsxFiles(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...tsxFiles(p));
    else if (name.endsWith('.tsx') && !name.endsWith('.test.tsx')) out.push(p);
  }
  return out;
}

const problems = [];
const add = (file, line, msg) => problems.push({ file: relative(ROOT, file), line, msg });

// ---- 規則 1:元件 inline 字體屬性 ------------------------------------------
for (const file of tsxFiles(SRC)) {
  if (EXEMPT.has(relative(ROOT, file).split('\\').join('/'))) continue;
  const lines = readFileSync(file, 'utf8').split('\n');
  lines.forEach((text, i) => {
    for (const m of text.matchAll(/\b(fontSize|fontWeight|lineHeight)\s*:\s*([^,}\n]+)/g)) {
      const prop = m[1];
      const value = m[2].trim();
      if (tokenOnly(value)) continue;
      add(file, i + 1, `inline ${prop}: ${value} —— 改用 .t-* 類別(或 var(--text-*))`);
    }
  });
}

// ---- 規則 2 + 3:index.css ------------------------------------------------
const css = readFileSync(CSS_PATH, 'utf8');
css.split('\n').forEach((text, i) => {
  const stripped = text.replace(/\/\*.*?\*\//g, '');
  const size = stripped.match(/font-size\s*:\s*([^;]+);/);
  if (size && !size[1].includes('var(--')) {
    add(CSS_PATH, i + 1, `index.css 硬寫 font-size: ${size[1].trim()} —— 改引用 --text-*`);
  }
  const weight = stripped.match(/font-weight\s*:\s*([^;]+);/);
  if (weight && !weight[1].includes('var(--')) {
    add(CSS_PATH, i + 1, `index.css 硬寫 font-weight: ${weight[1].trim()} —— 改引用 --weight-*`);
  }
  // 字重四級:定義行本身(--weight-*: 700)放行,其餘出現 800/900 即違規
  if (/--weight-[a-z]+\s*:/.test(stripped)) return;
  const over = stripped.match(/font-weight\s*:\s*(800|900)\b|fontWeight\s*:\s*(800|900)\b/);
  if (over) add(CSS_PATH, i + 1, `字重 ${over[1] ?? over[2]} 不在四級內(400/500/600/700)`);
});

// ---- 輸出 ----------------------------------------------------------------
if (problems.length === 0) {
  console.log('字體規格稽核:全數過關 ✅(字級與字重皆走 token/類別層)');
  process.exit(0);
}

const byFile = new Map();
for (const p of problems) {
  if (!byFile.has(p.file)) byFile.set(p.file, []);
  byFile.get(p.file).push(p);
}
for (const [file, list] of [...byFile].sort((a, b) => b[1].length - a[1].length)) {
  console.log(`\n${file}(${list.length})`);
  for (const p of list) console.log(`  L${p.line}: ${p.msg}`);
}
console.log(`\n字體規格稽核:${problems.length} 處違規 ❌(規則見 docs/UIUX.md §六)`);
process.exit(1);
