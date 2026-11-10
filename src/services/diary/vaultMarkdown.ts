/**
 * 日記匯出到 Obsidian vault 的 markdown 組裝(DIARY-PLAN D6/D7,2026-11-01)。
 * 全部純函式、無 DOM——檔案系統那一段在 `vaultFs.ts`。
 *
 * 落點拍板(2026-11-01):**併入 vault 既有的 life 條目**`daily/life/YYYY-MM-DD.md`
 * ——與 `templates/life-daily.md` 同型別同檔名,因此自動被 vault 的 `scripts/review.py`
 * 與 `weekly_digest.py` 的 life 統計吃到(獨立資料夾就不會)。
 *
 * 寫入方式拍板:**標記區塊 splice**——只建立/更新自己的
 * `<!-- text-message:diary -->` 區塊,檔案其餘部分原封不動。這是 vault 自己
 * `CLAUDE.md` 的第一條紀律(「只 append,不改寫」;腳本只更新自己帶標記的區段,
 * 手寫內容視為唯讀)——D7 原案的「整檔覆蓋、以 app 為準」與之直接衝突,已否決。
 *
 * 慣例來源=`~/Github-Projects/Obsidian_Journal`(vault 本身的 `CLAUDE.md` 與
 * `templates/life-daily.md`;週回顧反向連結格式比對 `scripts/journal.py` 的 `_iso_week`)。
 */
import { DIARY_SECTIONS } from '../../constants';
import type { DiaryEntry } from '../../types';

/** vault 內的落點(相對 vault 根目錄),逐層 getDirectoryHandle。 */
export const VAULT_LIFE_PATH = ['daily', 'life'] as const;

/**
 * 區塊標記:app 只擁有這兩行之間的內容。
 * 沿用 vault digest 腳本的 HTML 註解標記慣例(`<!-- digest:session:UUID -->`),
 * Obsidian 閱讀模式不顯示註解,所以標記對使用者是隱形的。
 */
export const BLOCK_START = '<!-- text-message:diary -->';
export const BLOCK_END = '<!-- /text-message:diary -->';

/** vault 每日筆記檔名慣例:`YYYY-MM-DD.md`,不加描述文字(排序與程式化查詢靠它)。 */
export function vaultNoteName(date: string): string {
  return `${date}.md`;
}

/**
 * ISO-8601 週標籤 `YYYY-Www`,對齊 vault `journal.py` 的 `_iso_week`
 * (= moment.js `GGGG-[W]WW`)。**週編號年份不等於日曆年份**:1/1 可能屬上一年的
 * 第 52/53 週(例:2027-01-01 是 2026-W53),所以不能用 `getFullYear()`。
 */
export function isoWeekLabel(date: string): string {
  const [y, m, d] = date.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  const dow = dt.getUTCDay() || 7; // 週一=1 … 週日=7
  dt.setUTCDate(dt.getUTCDate() + 4 - dow); // 移到該 ISO 週的星期四(決定週年份)
  const isoYear = dt.getUTCFullYear();
  const jan1 = Date.UTC(isoYear, 0, 1);
  const week = Math.ceil(((dt.getTime() - jan1) / 86400000 + 1) / 7);
  return `${isoYear}-W${String(week).padStart(2, '0')}`;
}

const timeLabel = (ms: number): string => {
  const d = new Date(ms);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

/** 同一天的條目:一律時間早→晚(與 app 列表的新→舊相反——筆記裡順著讀才自然)。 */
export function entriesOfDate(entries: DiaryEntry[], date: string): DiaryEntry[] {
  return entries.filter((e) => e.date === date).sort((a, b) => a.createdAt - b.createdAt);
}

/** 匯出範圍內出現過的日期,新→舊(UI 顯示與逐日寫入都用這個順序)。 */
export function exportDates(entries: DiaryEntry[]): string[] {
  return [...new Set(entries.map((e) => e.date))].sort().reverse();
}

/**
 * 組出某一天的區塊內容(含首尾標記)。
 * 條目標題:單筆=`## {標題或「日記」}`;**同日多筆加時間前綴**`## HH:mm · …`
 * ——沿 D4 的同日合併慣例,且時間保證兩筆標題不相撞(Obsidian 的 `[[筆記#標題]]`
 * 連結靠標題唯一性)。心情寫成區塊內的一行,不去動 frontmatter:
 * splice 時那是別人的地盤(見檔頭紀律)。
 *
 * 沉澱小節(D9,2026-11-10):四個小節接在條目之後(記錄在前、沉澱在後),
 * **放在標記區塊內=整份檔案的唯一出現處**——vault `journal.py` 的 `_extract_section`
 * 是 `re.search`(第一個命中),若檔案同時存在空的範本小節與區塊內的填值小節,
 * 週摘只會讀到前面那個空的。同日多筆的小節值依時間早→晚各成一條 bullet;
 * 沒人填的小節保留範本形狀 `-`。
 */
export function buildDiaryBlock(entries: DiaryEntry[], date: string): string {
  const list = entriesOfDate(entries, date);
  const multi = list.length > 1;
  const parts = list.map((e) => {
    const name = e.title.trim() || '日記';
    const heading = multi ? `## ${timeLabel(e.createdAt)} · ${name}` : `## ${name}`;
    const mood = e.mood ? `**心情**:${e.mood}\n\n` : '';
    return `${heading}\n\n${mood}${e.body.trim()}\n`;
  });
  const sectionBlocks = DIARY_SECTIONS.map((s) => {
    const values = list
      .map((e) => (e.sections?.[s.key] ?? '').trim())
      .filter((v) => v.length > 0);
    const bullets = values.length > 0 ? values.map((v) => `- ${v}`).join('\n') : '-';
    return `## ${s.heading}\n\n${bullets}\n`;
  });
  return [BLOCK_START, '', ...parts, ...sectionBlocks, BLOCK_END].join('\n');
}

/**
 * 新建筆記:frontmatter + 標題 + 區塊 + 分隔線 + 週回顧反向連結。
 * **D9(2026-11-10)起不再帶範本的四個空小節**——小節值改由區塊承載(見
 * buildDiaryBlock 的 _extract_section 說明),頂部再放一份空的小節只會是死重量、
 * 且讓週摘讀到空值。手寫情境(journal.py 建檔)仍走範本自帶小節,兩種形狀並存;
 * `_extract_section` 對兩者都讀得到(各自的唯一出現處)。
 * frontmatter 的 `mood` **只有新建時**才填(取當天最早一筆)——既有檔案的 frontmatter
 * 一律不碰。`date` 加引號同範本;`tags: [life]` 沿用 vault 固定標籤集,
 * **不自創新標籤**(vault 標籤慣例:收斂不發散,新標籤先進清單再使用)。
 */
export function buildNewVaultNote(entries: DiaryEntry[], date: string): string {
  const list = entriesOfDate(entries, date);
  const mood = list.find((e) => e.mood)?.mood ?? '';
  return [
    '---',
    'type: life',
    `date: "${date}"`,
    'tags: [life]',
    `mood: ${mood}`,
    'energy:',
    '---',
    '',
    `# 🌱 Life · ${date}`,
    '',
    buildDiaryBlock(entries, date),
    '',
    '---',
    `*[[weekly-${isoWeekLabel(date)}]]*`,
    '',
  ].join('\n');
}

/**
 * 把區塊併進既有筆記:
 * ①已有標記 → 只換掉標記之間(含標記)的那段,其餘原封不動;
 * ②沒有標記 → 插在尾段分隔線 + 週連結**之前**(保持 vault 範本的收尾形狀);
 * ③連尾段都沒有 → 接在最後面。
 * 冪等:同樣的輸入再跑一次結果相同(①的路徑保證)。
 */
export function spliceDiaryBlock(existing: string, block: string): string {
  const s = existing.indexOf(BLOCK_START);
  const e = existing.indexOf(BLOCK_END);
  if (s !== -1 && e !== -1 && e > s) {
    return existing.slice(0, s) + block + existing.slice(e + BLOCK_END.length);
  }
  const lines = existing.replace(/\s+$/, '').split('\n');
  // frontmatter 的收尾 `---` 不是尾段分隔線:先把 frontmatter 區間跳過
  // (測試揪出來的:只有 frontmatter、沒有尾段的檔案會被插進 frontmatter 裡弄壞 properties)
  let bodyStart = 0;
  if (lines[0]?.trim() === '---') {
    const close = lines.findIndex((l, i) => i > 0 && l.trim() === '---');
    if (close !== -1) bodyStart = close + 1;
  }
  // 尾段=最後一個「只有 --- 的行」,且其後最多兩行有字(範本收尾是 `---` + `*[[weekly-…]]*`)
  // ——這道限制讓內文中間當分隔用的 `---` 不會被誤認成尾段。
  let footer = -1;
  for (let i = lines.length - 1; i > bodyStart; i -= 1) {
    if (lines[i].trim() !== '---') continue;
    const after = lines.slice(i + 1).filter((l) => l.trim()).length;
    if (after <= 2) footer = i;
    break;
  }
  if (footer > 0) {
    const head = lines.slice(0, footer).join('\n').replace(/\s+$/, '');
    const tail = lines.slice(footer).join('\n');
    return `${head}\n\n${block}\n\n${tail}\n`;
  }
  return `${lines.join('\n')}\n\n${block}\n`;
}

/**
 * 匯出戳記:`date → 該日期最後一次匯出時,當天條目的最大 updatedAt`。
 * 只重寫「上次匯出後有變更的天」(D7 增量寫入),所以按幾次都只補差異。
 */
export type ExportStamps = Record<string, number>;

/** 當天條目的最大 updatedAt(= 該日期的內容版本)。 */
export function dateVersion(entries: DiaryEntry[], date: string): number {
  return entriesOfDate(entries, date).reduce((max, e) => Math.max(max, e.updatedAt), 0);
}

/**
 * 需要寫入的日期(新→舊)。`range` 之外的不看;戳記等於當前版本=跳過。
 * **刻意不處理「app 刪掉整天」**:vault 那邊留著是對的(匯出檔的意義就是
 * 「凍結於時間點、不被後續操作覆蓋」——D6 的第①個理由),刪除不同步過去。
 */
export function datesNeedingExport(
  entries: DiaryEntry[],
  stamps: ExportStamps,
  range: { from?: string; to?: string } = {},
): string[] {
  return exportDates(entries).filter((d) => {
    if (range.from && d < range.from) return false;
    if (range.to && d > range.to) return false;
    return stamps[d] !== dateVersion(entries, d);
  });
}

/** 匯出範圍 → 日期界線(`all` 無界線;`year`/`month` 以傳入的今天為基準)。 */
export function rangeBounds(range: 'all' | 'year' | 'month', today: string): { from?: string; to?: string } {
  if (range === 'year') return { from: `${today.slice(0, 4)}-01-01`, to: `${today.slice(0, 4)}-12-31` };
  if (range === 'month') return { from: `${today.slice(0, 7)}-01`, to: `${today.slice(0, 7)}-31` };
  return {};
}

/**
 * 不支援目錄寫入的瀏覽器(Firefox/Safari)用的冷備份彙整檔:一個 markdown 含多天。
 * 刻意**不是**一天一檔的 zip——零依賴紅線下不引入 zip 套件,且 D6 已把冷備份
 * 列為與「活體副本」互補的選配形式。
 */
export function buildCombinedMarkdown(entries: DiaryEntry[], dates: string[]): string {
  const parts = dates.map((d) => `# ${d}\n\n${buildDiaryBlock(entries, d)}`);
  return `${parts.join('\n\n')}\n`;
}
