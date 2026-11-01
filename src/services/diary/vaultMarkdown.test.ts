import { describe, expect, it } from 'vitest';
import type { DiaryEntry } from '../../types';
import {
  BLOCK_END,
  BLOCK_START,
  buildCombinedMarkdown,
  buildDiaryBlock,
  buildNewVaultNote,
  dateVersion,
  datesNeedingExport,
  entriesOfDate,
  exportDates,
  isoWeekLabel,
  rangeBounds,
  spliceDiaryBlock,
  vaultNoteName,
} from './vaultMarkdown';

const at = (h: number, min = 0) => new Date(2026, 9, 24, h, min).getTime();

const mk = (p: Partial<DiaryEntry> & { date: string }): DiaryEntry => ({
  id: `d-${p.date}-${p.createdAt ?? 0}`,
  title: '',
  body: '內容',
  createdAt: at(9),
  updatedAt: at(9),
  ...p,
});

describe('日記匯出:檔名與週標籤', () => {
  it('每日筆記檔名=YYYY-MM-DD.md,不加描述文字', () => {
    expect(vaultNoteName('2026-11-01')).toBe('2026-11-01.md');
  });

  it('ISO 週標籤對齊 vault journal.py 的 _iso_week(GGGG-[W]WW)', () => {
    expect(isoWeekLabel('2026-11-01')).toBe('2026-W44'); // 週日=該週最後一天
    expect(isoWeekLabel('2026-11-02')).toBe('2026-W45'); // 隔天週一=下一週
    expect(isoWeekLabel('2026-09-11')).toBe('2026-W37'); // 對齊 journal.py docstring 的例子
  });

  it('跨年邊界:週編號年份不等於日曆年份(不能用 getFullYear)', () => {
    expect(isoWeekLabel('2027-01-01')).toBe('2026-W53'); // 2027/1/1 屬 2026 的第 53 週
    expect(isoWeekLabel('2026-01-01')).toBe('2026-W01');
    expect(isoWeekLabel('2025-12-29')).toBe('2026-W01'); // 反向:12/29 已屬次年第 1 週
  });
});

describe('日記匯出:區塊組裝', () => {
  it('單筆:標題為小節名,無標題退回「日記」', () => {
    const block = buildDiaryBlock([mk({ date: '2026-10-24', title: '散步的下午', body: '走了 3.5 公里' })], '2026-10-24');
    expect(block.startsWith(BLOCK_START)).toBe(true);
    expect(block.endsWith(BLOCK_END)).toBe(true);
    expect(block).toContain('## 散步的下午');
    expect(block).toContain('走了 3.5 公里');

    const noTitle = buildDiaryBlock([mk({ date: '2026-10-24' })], '2026-10-24');
    expect(noTitle).toContain('## 日記');
  });

  it('同日多筆:時間早→晚,標題加 HH:mm 前綴避免撞名', () => {
    const block = buildDiaryBlock(
      [
        mk({ date: '2026-10-24', title: '日記', body: '晚上寫的', createdAt: at(21, 5) }),
        mk({ date: '2026-10-24', title: '日記', body: '早上寫的', createdAt: at(7, 30) }),
      ],
      '2026-10-24',
    );
    expect(block).toContain('## 07:30 · 日記');
    expect(block).toContain('## 21:05 · 日記');
    expect(block.indexOf('早上寫的')).toBeLessThan(block.indexOf('晚上寫的'));
  });

  it('心情寫成區塊內的一行(不去動 frontmatter——splice 時那是別人的地盤)', () => {
    const block = buildDiaryBlock([mk({ date: '2026-10-24', mood: '😊 開心' })], '2026-10-24');
    expect(block).toContain('**心情**:😊 開心');
    expect(buildDiaryBlock([mk({ date: '2026-10-24' })], '2026-10-24')).not.toContain('**心情**');
  });

  it('只收該日期的條目', () => {
    const list = [mk({ date: '2026-10-24', body: '當天' }), mk({ date: '2026-10-25', body: '隔天' })];
    expect(buildDiaryBlock(list, '2026-10-24')).toContain('當天');
    expect(buildDiaryBlock(list, '2026-10-24')).not.toContain('隔天');
    expect(entriesOfDate(list, '2026-10-25')).toHaveLength(1);
  });
});

describe('日記匯出:新建筆記(比照 templates/life-daily.md)', () => {
  const note = buildNewVaultNote([mk({ date: '2026-11-01', title: '散步', mood: '😌 平靜' })], '2026-11-01');

  it('frontmatter 形狀正確(--- 包夾、冒號後有空格、date 帶引號、tags 陣列)', () => {
    const lines = note.split('\n');
    expect(lines[0]).toBe('---');
    expect(note).toContain('type: life');
    expect(note).toContain('date: "2026-11-01"');
    expect(note).toContain('tags: [life]');
    expect(note.split('---')[1]).toContain('energy:');
  });

  it('新建時才填 frontmatter mood(取當天最早一筆有心情的)', () => {
    expect(note).toContain('mood: 😌 平靜');
    expect(buildNewVaultNote([mk({ date: '2026-11-01' })], '2026-11-01')).toContain('mood: \n');
  });

  it('沿用範本的標題、四個固定小節與週回顧反向連結', () => {
    expect(note).toContain('# 🌱 Life · 2026-11-01');
    for (const h of ['## Moment Worth Remembering', '## How I Felt', '## Something New', '## Grateful For']) {
      expect(note).toContain(h);
    }
    expect(note).toContain('*[[weekly-2026-W44]]*');
  });

  it('區塊在尾段分隔線之前', () => {
    expect(note.indexOf(BLOCK_START)).toBeLessThan(note.lastIndexOf('---'));
    expect(note.indexOf(BLOCK_END)).toBeLessThan(note.lastIndexOf('---'));
  });
});

describe('日記匯出:splice(vault「只改自己標記區段」紀律)', () => {
  const block = buildDiaryBlock([mk({ date: '2026-11-01', title: '新版', body: '改過的內容' })], '2026-11-01');

  it('已有標記:只換掉標記之間,手寫內容原封不動', () => {
    const existing = [
      '---',
      'type: life',
      'mood: 😊 開心',
      '---',
      '',
      '## Moment Worth Remembering',
      '',
      '- 我手寫的這一行不能被動到',
      '',
      BLOCK_START,
      '',
      '## 舊版',
      '',
      '舊內容',
      BLOCK_END,
      '',
      '---',
      '*[[weekly-2026-W44]]*',
      '',
    ].join('\n');

    const out = spliceDiaryBlock(existing, block);
    expect(out).toContain('- 我手寫的這一行不能被動到');
    expect(out).toContain('mood: 😊 開心'); // 既有 frontmatter 不碰
    expect(out).toContain('改過的內容');
    expect(out).not.toContain('舊內容');
    expect(out).toContain('*[[weekly-2026-W44]]*');
    // 只有一組標記(沒有重複插入)
    expect(out.split(BLOCK_START)).toHaveLength(2);
    // 冪等:同樣輸入再跑一次結果相同
    expect(spliceDiaryBlock(out, block)).toBe(out);
  });

  it('沒有標記但有尾段:插在分隔線與週連結之前', () => {
    const existing = ['# 🌱 Life · 2026-11-01', '', '## How I Felt', '', '- 手寫', '', '---', '*[[weekly-2026-W44]]*', ''].join('\n');
    const out = spliceDiaryBlock(existing, block);
    expect(out).toContain('- 手寫');
    expect(out.indexOf(BLOCK_START)).toBeLessThan(out.lastIndexOf('---'));
    expect(out.trimEnd().endsWith('*[[weekly-2026-W44]]*')).toBe(true);
    expect(spliceDiaryBlock(out, block)).toBe(out);
  });

  it('連尾段都沒有:接在最後面,原內容保留', () => {
    const out = spliceDiaryBlock('# 隨手筆記\n\n只有一行\n', block);
    expect(out).toContain('只有一行');
    expect(out.indexOf('只有一行')).toBeLessThan(out.indexOf(BLOCK_START));
    expect(spliceDiaryBlock(out, block)).toBe(out);
  });

  it('frontmatter 的 --- 不會被誤認成尾段分隔線', () => {
    const existing = '---\ntype: life\n---\n\n# 標題\n\n內文\n';
    const out = spliceDiaryBlock(existing, block);
    expect(out.startsWith('---\ntype: life\n---')).toBe(true);
    expect(out.indexOf('內文')).toBeLessThan(out.indexOf(BLOCK_START));
  });

  it('內文中間當分隔用的 --- 也不算尾段(其後還有大段內容)', () => {
    const existing = ['# 標題', '', '前半段', '', '---', '', '後半段一', '後半段二', '後半段三', ''].join('\n');
    const out = spliceDiaryBlock(existing, block);
    // 區塊接在最後面,中間那條分隔線與其後內容的相對位置不變
    expect(out.indexOf('後半段三')).toBeLessThan(out.indexOf(BLOCK_START));
    expect(out).toContain('前半段');
    expect(spliceDiaryBlock(out, block)).toBe(out);
  });
});

describe('日記匯出:增量判定與範圍', () => {
  const entries = [
    mk({ date: '2026-11-01', createdAt: at(9), updatedAt: at(10) }),
    mk({ date: '2026-10-24', createdAt: at(8), updatedAt: at(8) }),
    mk({ date: '2026-10-24', createdAt: at(21), updatedAt: at(22) }), // 當天版本=最大 updatedAt
    mk({ date: '2025-12-31', createdAt: at(7), updatedAt: at(7) }),
  ];

  it('日期清單新→舊、去重', () => {
    expect(exportDates(entries)).toEqual(['2026-11-01', '2026-10-24', '2025-12-31']);
  });

  it('當天版本=該日期條目的最大 updatedAt', () => {
    expect(dateVersion(entries, '2026-10-24')).toBe(at(22));
    expect(dateVersion(entries, '沒有這天')).toBe(0);
  });

  it('戳記等於當前版本=跳過;版本變新=要重寫', () => {
    const stamps = { '2026-11-01': at(10), '2026-10-24': at(8) }; // 10-24 的戳記是舊版本
    expect(datesNeedingExport(entries, stamps)).toEqual(['2026-10-24', '2025-12-31']);
    // 全部都寫過且無變更 → 空陣列(按再多次也不重寫)
    const all = { '2026-11-01': at(10), '2026-10-24': at(22), '2025-12-31': at(7) };
    expect(datesNeedingExport(entries, all)).toEqual([]);
  });

  it('範圍界線:年/月以今天為基準,all 無界線', () => {
    expect(rangeBounds('all', '2026-11-01')).toEqual({});
    expect(rangeBounds('year', '2026-11-01')).toEqual({ from: '2026-01-01', to: '2026-12-31' });
    expect(rangeBounds('month', '2026-11-01')).toEqual({ from: '2026-11-01', to: '2026-11-31' });

    expect(datesNeedingExport(entries, {}, rangeBounds('year', '2026-11-01'))).toEqual(['2026-11-01', '2026-10-24']);
    expect(datesNeedingExport(entries, {}, rangeBounds('month', '2026-11-01'))).toEqual(['2026-11-01']);
  });

  it('app 刪掉整天不會同步刪除 vault(匯出檔的意義是凍結於時間點)', () => {
    const afterDelete = entries.filter((e) => e.date !== '2026-10-24');
    const stamps = { '2026-10-24': at(22) };
    expect(datesNeedingExport(afterDelete, stamps)).not.toContain('2026-10-24');
  });
});

describe('日記匯出:不支援目錄寫入時的彙整檔', () => {
  it('一個 markdown 含多天,每天一個 # 日期標頭', () => {
    const entries = [mk({ date: '2026-11-01', body: '十一月' }), mk({ date: '2026-10-24', body: '十月' })];
    const md = buildCombinedMarkdown(entries, exportDates(entries));
    expect(md).toContain('# 2026-11-01');
    expect(md).toContain('# 2026-10-24');
    expect(md.indexOf('十一月')).toBeLessThan(md.indexOf('十月'));
  });
});
