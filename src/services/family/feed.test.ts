import { describe, expect, it } from 'vitest';
import type { ScheduleItem } from '../../types';
import { FEED_MAX_ITEMS, STALE_MS, scheduleFeedKey } from './config';
import { buildScheduleFeed, parseScheduleFeed, publishOwnFeed, readPeerFeed } from './feed';
import type { FamilyStorage } from './handoff';

function memStorage(seed: Record<string, string> = {}, failOnWrite = false) {
  const map = new Map(Object.entries(seed));
  const storage: FamilyStorage & { map: Map<string, string> } = {
    map,
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => {
      if (failOnWrite) throw new DOMException('quota', 'QuotaExceededError');
      map.set(k, v);
    },
  };
  return storage;
}

function sched(over: Partial<ScheduleItem> = {}): ScheduleItem {
  return {
    id: 's1',
    date: '2026-10-20',
    time: '09:00',
    platform: 'threads',
    title: '早安貼文',
    status: 'scheduled',
    ...over,
  };
}

/** 以本地時區解析,與 utils/schedule 的 scheduleDateTime 一致。 */
const at = (date: string, time: string) => new Date(`${date}T${time}:00`).getTime();
const NOW = at('2026-10-12', '12:00');

describe('buildScheduleFeed', () => {
  it('只收未來未發佈的排程,由近到遠', () => {
    const feed = buildScheduleFeed(
      [
        sched({ id: 'far', date: '2026-10-25', time: '08:00' }),
        sched({ id: 'near', date: '2026-10-13', time: '08:00' }),
        sched({ id: 'overdue', date: '2026-10-01', time: '08:00' }),
        sched({ id: 'published', date: '2026-10-22', time: '08:00', status: 'published' }),
        sched({ id: 'draft', date: '2026-10-23', time: '08:00', status: 'draft' }),
      ],
      NOW,
    );
    expect(feed.items.map((i) => i.when)).toEqual([at('2026-10-13', '08:00'), at('2026-10-25', '08:00')]);
  });

  it('輸出完整契約形狀(v/product/updatedAt/items)', () => {
    expect(buildScheduleFeed([sched()], NOW)).toEqual({
      v: 1,
      product: 'text-message',
      updatedAt: NOW,
      items: [{ platform: 'threads', when: at('2026-10-20', '09:00'), snippet: '早安貼文' }],
    });
  });

  it('snippet 截至 60 字並加省略號,換行壓成單一空白', () => {
    const long = 'あ'.repeat(80);
    const [one] = buildScheduleFeed([sched({ title: long })], NOW).items;
    expect(one.snippet).toBe(`${'あ'.repeat(60)}…`);

    const [two] = buildScheduleFeed([sched({ title: '第一行\n第二行' })], NOW).items;
    expect(two.snippet).toBe('第一行 第二行');
  });

  it('title 空白時退用 content;兩者皆空給空字串(不拋錯)', () => {
    expect(buildScheduleFeed([sched({ title: '', content: '內文' })], NOW).items[0].snippet).toBe('內文');
    expect(buildScheduleFeed([sched({ title: '', content: undefined })], NOW).items[0].snippet).toBe('');
  });

  it(`最多 ${FEED_MAX_ITEMS} 筆(對方只需近期,不是全量)`, () => {
    const many = Array.from({ length: FEED_MAX_ITEMS + 3 }, (_, n) =>
      sched({ id: `s${n}`, date: '2026-11-01', time: `0${n % 10}:00` }),
    );
    expect(buildScheduleFeed(many, NOW).items).toHaveLength(FEED_MAX_ITEMS);
  });
});

describe('parseScheduleFeed:防禦式解析', () => {
  const ok = { v: 1, product: 'media-message', updatedAt: NOW, items: [] };

  it('無資料/壞 JSON/非物件回 null', () => {
    expect(parseScheduleFeed(null, 'media-message', NOW)).toBeNull();
    expect(parseScheduleFeed('{壞', 'media-message', NOW)).toBeNull();
    expect(parseScheduleFeed('42', 'media-message', NOW)).toBeNull();
  });

  it('版本不符或產品不符回 null(不得把自己的摘要當對方的讀)', () => {
    expect(parseScheduleFeed(JSON.stringify({ ...ok, v: 2 }), 'media-message', NOW)).toBeNull();
    expect(
      parseScheduleFeed(JSON.stringify({ ...ok, product: 'text-message' }), 'media-message', NOW),
    ).toBeNull();
  });

  it('updatedAt 缺漏或非數字回 null', () => {
    expect(parseScheduleFeed(JSON.stringify({ ...ok, updatedAt: '昨天' }), 'media-message', NOW)).toBeNull();
  });

  it('陳舊(updatedAt 超過 7 天)回 null,好讓呼叫端隱藏整個區塊', () => {
    const edge = { ...ok, updatedAt: NOW - STALE_MS };
    expect(parseScheduleFeed(JSON.stringify(edge), 'media-message', NOW)).not.toBeNull();
    const stale = { ...ok, updatedAt: NOW - STALE_MS - 1 };
    expect(parseScheduleFeed(JSON.stringify(stale), 'media-message', NOW)).toBeNull();
  });

  it('items 非陣列回 null;單筆形狀壞只丟那一筆', () => {
    expect(parseScheduleFeed(JSON.stringify({ ...ok, items: 'x' }), 'media-message', NOW)).toBeNull();
    const good = { platform: 'fb', when: NOW + 1000, snippet: '影片發佈' };
    const raw = JSON.stringify({ ...ok, items: [good, { platform: 'ig' }, null] });
    expect(parseScheduleFeed(raw, 'media-message', NOW)?.items).toEqual([good]);
  });
});

describe('publishOwnFeed / readPeerFeed', () => {
  it('只寫自己那把鍵,不碰對方的', () => {
    const storage = memStorage();
    publishOwnFeed([sched()], { storage, now: NOW });
    expect([...storage.map.keys()]).toEqual([scheduleFeedKey('text-message')]);
  });

  it('讀對方那把鍵;寫入失敗靜默略過(摘要是輔助資訊,不搶配額提示)', () => {
    const peer = JSON.stringify({ v: 1, product: 'media-message', updatedAt: NOW, items: [] });
    const storage = memStorage({ [scheduleFeedKey('media-message')]: peer });
    expect(readPeerFeed({ storage, now: NOW })?.product).toBe('media-message');
    expect(() => publishOwnFeed([sched()], { storage: memStorage({}, true), now: NOW })).not.toThrow();
  });

  it('對方沒發佈過摘要時回 null', () => {
    expect(readPeerFeed({ storage: memStorage(), now: NOW })).toBeNull();
  });
});
