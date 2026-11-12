import { describe, expect, it } from 'vitest';
import type { Note } from '../../types';
import {
  buildNoteBlock,
  buildNoteMarkdown,
  buildNotesCombinedMarkdown,
  NOTE_BLOCK_END,
  NOTE_BLOCK_START,
  noteFileName,
  notesNeedingExport,
  noteSlug,
  spliceNoteBlock,
} from './vaultMarkdown';

const at = (h: number) => new Date(2026, 10, 12, h, 0).getTime(); // 2026-11-12

const mk = (p: Partial<Note> & { id: string }): Note => ({
  kind: 'note',
  title: '',
  body: '便條內容',
  tags: [],
  createdAt: at(9),
  updatedAt: at(9),
  ...p,
});

describe('便條匯出:檔名', () => {
  it('標題→slug:特殊字元與空白轉連字號、截 24 字、去首尾連字號', () => {
    expect(noteSlug('好文章:AI 時代的寫作')).toBe('好文章-AI-時代的寫作');
    expect(noteSlug('a/b\\c:d*e?f"g<h>i|j#k')).toBe('a-b-c-d-e-f-g-h-i-j-k');
    expect(noteSlug('   ')).toBe('');
    expect(noteSlug('一二三四五六七八九十一二三四五六七八九十一二三四五六七八九十')).toHaveLength(24);
  });

  it('檔名=日期-slug(或 note)-id尾6碼.md;日期取 createdAt', () => {
    const name = noteFileName(mk({ id: 'note-3f2a1b', title: '晨間靈感' }));
    expect(name).toBe('2026-11-12-晨間靈感-3f2a1b.md');
    expect(noteFileName(mk({ id: 'note-3f2a1b', title: '' }))).toBe('2026-11-12-note-3f2a1b.md');
    const later = noteFileName(mk({ id: 'note-3f2a1b', title: '晨間靈感', createdAt: at(22) }));
    expect(later).toBe('2026-11-12-晨間靈感-3f2a1b.md'); // 同日同 id 同名——id 尾碼唯一性
    const otherDay = noteFileName(
      mk({ id: 'note-3f2a1b', title: '晨間靈感', createdAt: new Date(2026, 9, 30, 9).getTime() }),
    );
    expect(otherDay).toBe('2026-10-30-晨間靈感-3f2a1b.md');
  });
});

describe('便條匯出:markdown 組裝', () => {
  it('新建檔:frontmatter 只有出生固定欄位;可變內容(類型/標籤/內文/網址)全在標記區塊內', () => {
    const md = buildNoteMarkdown(
      mk({ id: 'note-x1', title: '值得讀的文章', kind: 'article', body: '要点整理', url: 'https://example.com/a', tags: ['寫作', 'AI'] }),
    );
    expect(md).toContain('---\ncreated: 2026-11-12\nsource: text-message-post\n---');
    expect(md).toContain('# 值得讀的文章');
    expect(md.indexOf(NOTE_BLOCK_START)).toBeGreaterThan(md.indexOf('# 值得讀的文章'));
    expect(md).toContain('🔗 好文章 · #寫作 · #AI');
    expect(md).toContain('要点整理');
    expect(md).toContain('🔗 https://example.com/a');
    expect(md.split(NOTE_BLOCK_START)).toHaveLength(2); // 標記恰好一組
  });

  it('無標題=無 H1;無網址=無網址行;無標籤=meta 行只有類型', () => {
    const md = buildNoteMarkdown(mk({ id: 'note-x2', body: '一句話' }));
    expect(md).not.toContain('\n# ');
    expect(md).toContain('📝 筆記\n');
    expect(md).not.toContain('🔗 http');
  });

  it('splice:既有檔只換標記區塊,手寫內容與 frontmatter 原封不動;冪等', () => {
    const existing = [
      '---',
      'created: 2026-11-12',
      'source: text-message-post',
      '---',
      '',
      '# 標題',
      '',
      '我在 Obsidian 手寫的備註,不能被動到',
      '',
      NOTE_BLOCK_START,
      '',
      '舊內容',
      NOTE_BLOCK_END,
      '',
    ].join('\n');
    const block = buildNoteBlock(mk({ id: 'note-x3', body: '新內容' }));
    const out = spliceNoteBlock(existing, block);
    expect(out).toContain('我在 Obsidian 手寫的備註,不能被動到');
    expect(out).toContain('source: text-message-post');
    expect(out).toContain('新內容');
    expect(out).not.toContain('舊內容');
    expect(out.split(NOTE_BLOCK_START)).toHaveLength(2);
    expect(spliceNoteBlock(out, block)).toBe(out);
  });

  it('增量:戳記等於 updatedAt 就跳過;範圍以 createdAt 日期過濾;清單新→舊', () => {
    const a = mk({ id: 'a', createdAt: at(9), updatedAt: at(10) });
    const b = mk({ id: 'b', createdAt: new Date(2026, 9, 20, 9).getTime(), updatedAt: at(8) }); // 10-20
    const c = mk({ id: 'c', createdAt: new Date(2026, 11, 5, 9).getTime(), updatedAt: at(9) }); // 12-05(未來,範圍外)
    expect(notesNeedingExport([a, b, c], {})).toEqual([c, a, b]); // 新→舊,無戳記全要
    expect(notesNeedingExport([a, b, c], { a: at(10) })).toEqual([c, b]); // a 已寫過且未變
    expect(
      notesNeedingExport([a, b, c], {}, { from: '2026-11-01', to: '2026-11-30' }),
    ).toEqual([a]); // 年月範圍只收 11 月
  });

  it('下載退路:彙整檔一張一節(# 日期 標題 + 區塊)', () => {
    const md = buildNotesCombinedMarkdown([
      mk({ id: 'a', title: '第一張' }),
      mk({ id: 'b', title: '', kind: 'idea' }),
    ]);
    expect(md).toContain('# 2026-11-12 第一張');
    expect(md).toContain('# 2026-11-12 💡 靈感');
    expect(md.split(NOTE_BLOCK_START)).toHaveLength(3); // 兩張各一組標記
  });
});
