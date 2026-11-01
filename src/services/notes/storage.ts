import type { Note, NoteKind } from '../../types';

/**
 * 便條本機儲存(POST-PLAN D1,2026-11-01):獨立鍵 `text-message:notes:v1`——
 * 鏡像日記的作法(`services/diary/storage.ts`):不進 `text-message:v2`(避免高頻貼便條
 * 觸發主區塊整包重新序列化)、不進 `family:*`(契約只放排程摘要與交接佇列)、
 * 絕不進 worker/KV(零後端)。D2:內容隨文庫雲端備份(方案 A 加密 blob 的選用欄位)。
 * 讀寫失敗(隱私模式等)由呼叫端靜默退回記憶體模式,同主 store 慣例。
 */
export const NOTES_KEY = 'text-message:notes:v1';

/** 可注入儲存介面(測試以 memStorage 注入,不依賴真 localStorage)。 */
export interface NotesStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

const KINDS: NoteKind[] = ['note', 'article', 'idea'];

export function isNoteKind(v: unknown): v is NoteKind {
  return typeof v === 'string' && (KINDS as string[]).includes(v);
}

export function isNote(v: unknown): v is Note {
  if (!v || typeof v !== 'object') return false;
  const n = v as Partial<Note>;
  return (
    typeof n.id === 'string' &&
    isNoteKind(n.kind) &&
    typeof n.title === 'string' &&
    typeof n.body === 'string' &&
    (n.url === undefined || typeof n.url === 'string') &&
    Array.isArray(n.tags) &&
    n.tags.every((t) => typeof t === 'string') &&
    typeof n.createdAt === 'number' &&
    Number.isFinite(n.createdAt) &&
    typeof n.updatedAt === 'number' &&
    Number.isFinite(n.updatedAt)
  );
}

/** 解析 `{version:1, notes}`:版本不符/形狀壞 → [];單筆壞只丟那筆(防禦式,同日記)。 */
export function parseNotes(raw: string | null): Note[] {
  if (!raw) return [];
  try {
    const data = JSON.parse(raw) as { version?: unknown; notes?: unknown };
    if (!data || typeof data !== 'object' || data.version !== 1 || !Array.isArray(data.notes)) {
      return [];
    }
    return data.notes.filter(isNote);
  } catch {
    return [];
  }
}

export function loadNotes(storage: Pick<NotesStorage, 'getItem'>): Note[] {
  try {
    return parseNotes(storage.getItem(NOTES_KEY));
  } catch {
    return [];
  }
}

export type SaveNotesResult = { ok: true } | { ok: false; quota: boolean };

export function saveNotes(
  notes: Note[],
  storage: Pick<NotesStorage, 'setItem'>,
): SaveNotesResult {
  try {
    storage.setItem(NOTES_KEY, JSON.stringify({ version: 1, notes }));
    return { ok: true };
  } catch (err) {
    const name = err instanceof DOMException ? err.name : '';
    return {
      ok: false,
      quota: name === 'QuotaExceededError' || name === 'NS_ERROR_DOM_QUOTA_REACHED',
    };
  }
}

/** 排序:更新時間新→舊(便條會反覆回來補充,以最後整理的時間為序最合用)。不原地變動。 */
export function sortNotes(notes: Note[]): Note[] {
  return [...notes].sort((a, b) => b.updatedAt - a.updatedAt);
}

/** 類型篩選:null=全部。 */
export function filterNotesByKind(notes: Note[], kind: NoteKind | null): Note[] {
  return kind ? notes.filter((n) => n.kind === kind) : notes;
}

/** 搜尋:標題+內容+連結+標籤不分大小寫子字串;空白查詢=全部。 */
export function searchNotes(notes: Note[], query: string): Note[] {
  const q = query.trim().toLowerCase();
  if (!q) return notes;
  return notes.filter((n) =>
    `${n.title} ${n.body} ${n.url ?? ''} ${n.tags.join(' ')}`.toLowerCase().includes(q),
  );
}

/** 標籤輸入解析:逗號(半角/全角/頓號)與空白皆為分隔,去空白、去重、保留輸入順序。 */
export function parseTagsInput(input: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of input.split(/[,，、\s]+/)) {
    const t = raw.trim();
    if (!t || seen.has(t)) continue;
    seen.add(t);
    out.push(t);
  }
  return out;
}

/**
 * 全部便條用過的標籤(出現次數多→少,同次數依字典序),供篩選 chips。
 */
export function collectTags(notes: Note[]): Array<{ tag: string; count: number }> {
  const counts = new Map<string, number>();
  for (const n of notes) {
    for (const t of n.tags) counts.set(t, (counts.get(t) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => (b.count !== a.count ? b.count - a.count : a.tag.localeCompare(b.tag)));
}

/**
 * 便條 → 編發器草稿的插入文字:標題(有則第一行)+內容,外部連結附在最後。
 * 刻意不帶標籤與類型——那是整理用的中繼資料,不是貼文內容。
 */
export function noteInsertText(note: Note): string {
  const parts: string[] = [];
  if (note.title.trim()) parts.push(note.title.trim());
  if (note.body.trim()) parts.push(note.body.trim());
  if (note.url?.trim()) parts.push(note.url.trim());
  return parts.join('\n\n');
}
