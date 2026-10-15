/**
 * 夢境靈感日誌解析(PIPELINE-PLAN §3.2,D5:工具端指定格式)——純函式。
 * 慣例:一個 Doc 累積所有條目;「整行只有一個日期」= 新條目的開始。
 * exportDocText 回純文字(Docs 樣式會消失),故只能靠行內容判斷,不靠 # / 粗體。
 */

/** 單一日期的容錯解析:`2026-10-14`、`2026/10/14`、`2026/10/4`、`2026年10月14日` → `YYYY-MM-DD`;不是日期回 null。 */
export function parseDateLine(line: string): string | null {
  const s = line.trim();
  if (!s) return null;
  let m = /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/.exec(s);
  if (m) return normalize(m[1], m[2], m[3]);
  m = /^(\d{4})年(\d{1,2})月(\d{1,2})日?$/.exec(s);
  if (m) return normalize(m[1], m[2], m[3]);
  return null;
}

function normalize(y: string, mo: string, d: string): string | null {
  const month = Number(mo);
  const day = Number(d);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return `${y}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/** 「日期行 + 選用標題」拆解:`2026-10-13 海` → {date:'2026-10-13', title:'海'};非條目行回 null。 */
export function parseEntryHeader(line: string): { date: string; title: string } | null {
  const s = line.trim();
  if (!s) return null;
  let m = /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})(?:\s+(.*))?$/.exec(s);
  if (!m) m = /^(\d{4})年(\d{1,2})月(\d{1,2})日?(?:\s+(.*))?$/.exec(s);
  if (!m) return null;
  const date = normalize(m[1], m[2], m[3]);
  if (!date) return null;
  return { date, title: (m[4] ?? '').trim() };
}

export interface JournalEntry {
  date: string; // YYYY-MM-DD
  title?: string;
  body: string;
}

/**
 * 解析整份日誌純文字:日期行分段、空內文丟棄、同日合併(append),一律依日期**新→舊**排序。
 * 整份無日期行 → 空陣列(呼叫端誠實提示格式,不猜、不把全文當一篇)。
 */
export function parseJournal(text: string): JournalEntry[] {
  const byDate = new Map<string, JournalEntry>();
  let current: JournalEntry | null = null;
  const bodyLines: string[] = [];
  for (const line of text.split(/\r?\n/)) {
    const header = parseEntryHeader(line);
    if (header) {
      if (current) {
        current.body = bodyLines.join('\n').trim();
        appendEntry(byDate, current);
      }
      current = { date: header.date, title: header.title || undefined, body: '' };
      bodyLines.length = 0;
      continue;
    }
    if (current) bodyLines.push(line);
  }
  if (current) {
    current.body = bodyLines.join('\n').trim();
    appendEntry(byDate, current);
  }
  // 空內文丟棄(只寫日期還沒寫內容的那天);新→舊排序
  return [...byDate.values()].filter((e) => e.body).sort((a, b) => (a.date > b.date ? -1 : 1));
}

/** 同日多個日期行 → 合併(append,不丟資料);標題取第一個有標題者。 */
function appendEntry(map: Map<string, JournalEntry>, entry: JournalEntry): void {
  const prev = map.get(entry.date);
  if (!prev) {
    map.set(entry.date, entry);
    return;
  }
  prev.body = prev.body ? `${prev.body}\n\n${entry.body}` : entry.body;
  if (!prev.title && entry.title) prev.title = entry.title;
}

/**
 * 選料(D6:沒寫就用較舊、還沒用過的):
 * 新→舊掃,跳過 usedDates 已含、跳過晚於 today(未來=筆誤);取滿 count 筆為止。
 * 取不滿就只回取得的筆數;全部用過 → 空陣列(補糧停止,不生成憑空內容)。
 */
export function pickJournalEntries(
  entries: JournalEntry[],
  opts: { today: string; usedDates: string[]; count: number },
): JournalEntry[] {
  const used = new Set(opts.usedDates);
  const picked: JournalEntry[] = [];
  for (const e of entries) {
    if (picked.length >= opts.count) break;
    if (e.date > opts.today) continue; // 未來日期視為筆誤
    if (used.has(e.date)) continue;
    picked.push(e);
  }
  return picked;
}
