// WCAG 2.1 對比度稽核:最終提案(執行後可刪)
const lin = (c) => {
  const s = c / 255;
  return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
};
const L = (hex) => {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16);
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
};
const ratio = (fg, bg) => {
  const a = L(fg), b = L(bg);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
};

const cases = [
  // 淺色模式
  ['L placeholder=text-sub / card', '#5b5773', '#ffffff', 4.5],
  ['L text-weak 新 / card', '#66627e', '#ffffff', 4.5],
  ['L text-weak 新 / surface-soft', '#66627e', '#f8f7fd', 4.5],
  ['L text-faint 新 / card', '#736e92', '#ffffff', 4.5],
  ['L brand 新(文字)/ card', '#5849d2', '#ffffff', 4.5],
  ['L brand 新(文字)/ surface-soft', '#5849d2', '#f8f7fd', 4.5],
  ['L brand 新(文字)/ pill-purple-bg', '#5849d2', '#f1edff', 4.5],
  ['L 白字 / brand-fill(btn-primary)', '#ffffff', '#6c5ce7', 4.5],
  ['L accent 新(文字)/ card', '#b03d1d', '#ffffff', 4.5],
  ['L accent 新(文字)/ pill-orange-bg', '#b03d1d', '#fff1ec', 4.5],
  ['L 深棕字 / accent-fill(btn-accent)', '#38130a', '#ff7a59', 4.5],
  ['L error 新 / card', '#d62f1c', '#ffffff', 4.5],
  // 深色模式
  ['D placeholder=text-sub / card', '#c6c3dd', '#22223a', 4.5],
  ['D text-faint 新 / card', '#8d89ae', '#22223a', 4.5],
  ['D brand 新(文字)/ card', '#a79aff', '#22223a', 4.5],
  ['D brand 新(文字)/ pill-purple-bg', '#a79aff', '#2f2a4e', 4.5],
  ['D 白字 / brand-fill(btn-primary)', '#ffffff', '#6c5ce7', 4.5],
  ['D accent 新(文字)/ card', '#ff9d7d', '#22223a', 4.5],
  ['D accent 新(文字)/ pill-orange-bg', '#ff9d7d', '#45312a', 4.5],
  ['D 深棕字 / accent-fill(btn-accent)', '#38130a', '#ff7a59', 4.5],
  ['D error / card', '#ff6b5e', '#22223a', 4.5],
];

let fail = 0;
for (const [name, fg, bg, min] of cases) {
  const r = ratio(fg, bg);
  if (r < min) fail++;
  console.log(`${r >= min ? '✓' : '✗'} ${r.toFixed(2).padStart(6)}  (需 ${min})  ${name}`);
}
console.log(fail === 0 ? '\n全數過關' : `\n${fail} 項未過關`);
