import { describe, expect, it } from 'vitest';
import { parseDateLine, parseEntryHeader, parseJournal, pickJournalEntries } from './journal';

describe('parseDateLine(整行只有日期)', () => {
  it('四種格式與補零;前後空白容許', () => {
    expect(parseDateLine('2026-10-14')).toBe('2026-10-14');
    expect(parseDateLine('2026/10/14')).toBe('2026-10-14');
    expect(parseDateLine('2026/10/4')).toBe('2026-10-04');
    expect(parseDateLine('2026年10月14日')).toBe('2026-10-14');
    expect(parseDateLine('2026年10月14')).toBe('2026-10-14');
    expect(parseDateLine('  2026-10-14  ')).toBe('2026-10-14');
  });

  it('非日期行/月份日期越界 → null', () => {
    expect(parseDateLine('2026-10-14 海')).toBeNull(); // 有標題 → 走 parseEntryHeader
    expect(parseDateLine('今天是個好日子')).toBeNull();
    expect(parseDateLine('2026-13-01')).toBeNull();
    expect(parseDateLine('2026-10-32')).toBeNull();
    expect(parseDateLine('')).toBeNull();
  });
});

describe('parseEntryHeader(日期行+選用標題)', () => {
  it('日期 + 空白 + 文字 → 標題;純日期 → 空標題', () => {
    expect(parseEntryHeader('2026-10-13 海')).toEqual({ date: '2026-10-13', title: '海' });
    expect(parseEntryHeader('2026/10/13 沙灘')).toEqual({ date: '2026-10-13', title: '沙灘' });
    expect(parseEntryHeader('2026-10-13')).toEqual({ date: '2026-10-13', title: '' });
  });

  it('日期後無空白文字(緊貼)不誤判為標題', () => {
    expect(parseEntryHeader('2026-10-14備忘')).toBeNull();
  });
});

describe('parseJournal(整份解析)', () => {
  it('標準多條目:分段、排序新→舊、空內文丟棄', () => {
    const doc = [
      '2026-10-14',
      '夢到在一條沒有盡頭的長廊裡找一扇門,',
      '每扇門後面都是同一個房間。',
      '',
      '2026-10-13 海',
      '站在退潮的沙灘上,腳印被自己填回去。',
      '',
      '2026-10-12',
      '',
      '2026-10-11 雨',
      '在屋簷下躲雨,聽見遠處的鐘聲。',
    ].join('\n');
    const entries = parseJournal(doc);
    // 10-12 只有日期無內文 → 丟棄
    expect(entries.map((e) => e.date)).toEqual(['2026-10-14', '2026-10-13', '2026-10-11']);
    expect(entries[0].body).toContain('長廊');
    expect(entries[1].title).toBe('海');
    expect(entries[2].title).toBe('雨');
  });

  it('同日多個日期行 → 合併(append),標題取第一個有標題者', () => {
    const doc = ['2026-10-14 上半', '第一段內容。', '', '2026-10-14 下半', '第二段內容。'].join('\n');
    const entries = parseJournal(doc);
    expect(entries).toHaveLength(1);
    expect(entries[0].title).toBe('上半');
    expect(entries[0].body).toContain('第一段內容。');
    expect(entries[0].body).toContain('第二段內容。');
  });

  it('舊→新順序寫的 Doc 一樣解析(一律新→舊排序)', () => {
    const doc = ['2026-10-11 舊的', '舊內容。', '', '2026-10-14 新的', '新內容。'].join('\n');
    expect(parseJournal(doc).map((e) => e.date)).toEqual(['2026-10-14', '2026-10-11']);
  });

  it('整份無日期行 → 空陣列(不猜、不把全文當一篇)', () => {
    expect(parseJournal('只是一段普通文字,沒有任何日期行。')).toEqual([]);
    expect(parseJournal('')).toEqual([]);
  });

  it('CRLF 換行容許', () => {
    const doc = '2026-10-14\r\n內文。\r\n\r\n2026-10-13\r\n另一段。';
    const entries = parseJournal(doc);
    expect(entries.map((e) => e.date)).toEqual(['2026-10-14', '2026-10-13']);
    expect(entries[0].body).toBe('內文。');
  });
});

describe('pickJournalEntries(D6 選料)', () => {
  const entries = [
    { date: '2026-10-16', body: 'a' }, // 晚於 today(筆誤)
    { date: '2026-10-15', body: 'b' },
    { date: '2026-10-14', body: 'c' },
    { date: '2026-10-13', body: 'd' }, // 已用
    { date: '2026-10-12', body: 'e' },
  ];

  it('新→舊掃,跳過已用與未來;取滿 count', () => {
    const picked = pickJournalEntries(entries, { today: '2026-10-15', usedDates: ['2026-10-13'], count: 2 });
    expect(picked.map((e) => e.date)).toEqual(['2026-10-15', '2026-10-14']);
  });

  it('取不滿就只回取得的筆數;全部用過 → 空陣列(不湊數)', () => {
    const picked = pickJournalEntries(entries, { today: '2026-10-12', usedDates: [], count: 5 });
    expect(picked.map((e) => e.date)).toEqual(['2026-10-12']); // 只剩一天可用
    const none = pickJournalEntries(entries, { today: '2026-10-12', usedDates: ['2026-10-12'], count: 3 });
    expect(none).toEqual([]);
  });
});
