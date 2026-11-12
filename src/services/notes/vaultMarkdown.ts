/**
 * 便條匯出到 Obsidian vault 的 markdown 組裝(POST-PLAN P3,2026-11-12)。
 * 全部純函式、無 DOM——檔案系統那一段共用日記的 `vaultFs.ts`。
 *
 * 落點拍板(2026-11-03,2026-11-12 複查確認):**Obsidian_Journal**(private repo)
 * 的 `notes/` 資料夾——Obsidian_Library 是 MIT 公開授權 repo(其慣例「只有可公開的
 * 個人資訊才能進來」),便條是私密收集桶,不可進。
 *
 * 設計沿日記 D7 的紀律:**一張一檔**(便條的語意單位是單張,不是日期)、標記區塊
 * `<!-- text-message:note -->` 承載**所有可變內容**(內文/網址/類型/標籤都在區塊內,
 * frontmatter 只放出生時就固定的 created/source——避免「frontmatter 在區塊外、改了
 * 卻不同步」的漂移)。**標題例外**:檔名與 H1 都取自標題,而標題改了=新檔名→寫新檔、
 * 舊檔凍結留在原地(同日記「app 刪除不同步刪 vault」的凍結語意)。
 */
import { NOTE_KIND_OPTIONS } from '../../constants';
import type { Note } from '../../types';
import { spliceMarkedBlock } from '../diary/vaultMarkdown';
import { toISODate } from '../../utils/date';

/** vault 內的落點(相對 vault 根目錄),逐層 getDirectoryHandle。 */
export const VAULT_NOTES_PATH = ['notes'] as const;

/** 區塊標記:app 只擁有這兩行之間的內容(同日記的標記區塊紀律)。 */
export const NOTE_BLOCK_START = '<!-- text-message:note -->';
export const NOTE_BLOCK_END = '<!-- /text-message:note -->';

/** 便條戳記:`noteId → 上次匯出時的 updatedAt`。 */
export type NoteExportStamps = Record<string, number>;

const KIND_LABEL: Record<Note['kind'], string> = Object.fromEntries(
  NOTE_KIND_OPTIONS.map((o) => [o.key, o.label]),
) as Record<Note['kind'], string>;

/** 標題 → 檔名安全的一段:去檔案系統與 markdown anchor 的特殊字元、空白轉連字號、截 24 字。 */
export function noteSlug(title: string): string {
  return title
    .replace(/[\s/\\:*?"<>|#^[\]]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 24)
    .replace(/-+$/g, '');
}

/**
 * 檔名:`YYYY-MM-DD-<標題 slug 或 note>-<id 尾 6 碼>.md`。
 * 日期取 createdAt(便條的出生日,穩定不變);id 尾碼保證唯一(同日同標題也不撞)。
 * 標題改字 → slug 變 → 新檔名 → 寫新檔(舊檔凍結),與戳記邏輯一致。
 */
export function noteFileName(note: Note): string {
  const date = toISODate(new Date(note.createdAt));
  return `${date}-${noteSlug(note.title) || 'note'}-${note.id.slice(-6)}.md`;
}

/** 便條的版本=updatedAt(增量判定用)。 */
export function noteVersion(note: Note): number {
  return note.updatedAt;
}

/** 區塊內容(含首尾標記):類型+標籤一行 → 內文 → 網址一行。標籤用行內 `#tag`(可被 Obsidian 搜尋)。 */
export function buildNoteBlock(note: Note): string {
  const meta = [KIND_LABEL[note.kind], ...note.tags.map((t) => `#${t}`)].join(' · ');
  const lines = [NOTE_BLOCK_START, '', meta, '', note.body.trim()];
  if (note.url) lines.push('', `🔗 ${note.url}`);
  lines.push('', NOTE_BLOCK_END);
  return lines.join('\n');
}

/** 新建檔案:frontmatter(出生時固定)+ H1 標題(有標題才有)+ 區塊。 */
export function buildNoteMarkdown(note: Note): string {
  const head = [
    '---',
    `created: ${toISODate(new Date(note.createdAt))}`,
    'source: text-message-post',
    '---',
    '',
  ];
  if (note.title.trim()) head.push(`# ${note.title.trim()}`, '');
  return [...head, buildNoteBlock(note), ''].join('\n');
}

/** 併進既有檔(共用日記的 splice 演算法,標記換便條的)。 */
export function spliceNoteBlock(existing: string, block: string): string {
  return spliceMarkedBlock(existing, block, NOTE_BLOCK_START, NOTE_BLOCK_END);
}

/** 需要寫入的便條(新→舊):範圍內、且戳記不等於當前版本。 */
export function notesNeedingExport(
  notes: Note[],
  stamps: NoteExportStamps,
  range: { from?: string; to?: string } = {},
): Note[] {
  return notes
    .filter((n) => {
      const d = toISODate(new Date(n.createdAt));
      if (range.from && d < range.from) return false;
      if (range.to && d > range.to) return false;
      return stamps[n.id] !== n.updatedAt;
    })
    .sort((a, b) => b.createdAt - a.createdAt);
}

/** 不支援目錄寫入的瀏覽器(Firefox/Safari)用的彙整下載檔(同日記退路)。 */
export function buildNotesCombinedMarkdown(notes: Note[]): string {
  const parts = notes.map(
    (n) => `# ${toISODate(new Date(n.createdAt))} ${n.title.trim() || KIND_LABEL[n.kind]}\n\n${buildNoteBlock(n)}`,
  );
  return `${parts.join('\n\n')}\n`;
}
