import { describe, expect, it } from 'vitest';
import { HANDOFF_KEY, HANDOFF_MAX_ITEMS, STALE_MS } from './config';
import {
  appendHandoff,
  parseHandoff,
  pendingToPeerCount,
  pruneHandoff,
  sendCaptionToPeer,
  serializeHandoff,
  type FamilyStorage,
  type HandoffItem,
} from './handoff';

const NOW = 1_760_000_000_000;

function item(over: Partial<HandoffItem> = {}): HandoffItem {
  return {
    id: 'i1',
    from: 'text-message',
    to: 'media-message',
    kind: 'caption',
    text: '文案',
    createdAt: NOW,
    ...over,
  };
}

/** 記憶體 storage;可模擬配額滿。 */
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

describe('parseHandoff:防禦式解析', () => {
  it('無資料/壞 JSON/非物件一律回空佇列', () => {
    expect(parseHandoff(null)).toEqual([]);
    expect(parseHandoff('')).toEqual([]);
    expect(parseHandoff('{不是 JSON')).toEqual([]);
    expect(parseHandoff('"字串"')).toEqual([]);
    expect(parseHandoff('null')).toEqual([]);
  });

  it('版本不符視為不存在(對方日後升 v2 時我方不得誤讀)', () => {
    expect(parseHandoff(JSON.stringify({ v: 2, items: [item()] }))).toEqual([]);
    expect(parseHandoff(JSON.stringify({ items: [item()] }))).toEqual([]);
  });

  it('items 非陣列回空;單筆形狀壞只丟那一筆,不連坐整個佇列', () => {
    expect(parseHandoff(JSON.stringify({ v: 1, items: {} }))).toEqual([]);
    const good = item({ id: 'ok' });
    const raw = JSON.stringify({
      v: 1,
      items: [{ id: 'bad', from: 'text-message' }, good, { ...item(), kind: 'video' }, null],
    });
    expect(parseHandoff(raw)).toEqual([good]);
  });

  it('serializeHandoff 的輸出回得去(契約封裝 v:1 + items)', () => {
    const items = [item({ id: 'a' }), item({ id: 'b' })];
    expect(JSON.parse(serializeHandoff(items))).toEqual({ v: 1, items });
    expect(parseHandoff(serializeHandoff(items))).toEqual(items);
  });
});

describe('pruneHandoff / appendHandoff', () => {
  it('超過 7 天的項目剔除,剛好 7 天的留著(邊界)', () => {
    const fresh = item({ id: 'fresh', createdAt: NOW });
    const edge = item({ id: 'edge', createdAt: NOW - STALE_MS });
    const stale = item({ id: 'stale', createdAt: NOW - STALE_MS - 1 });
    expect(pruneHandoff([fresh, edge, stale], NOW).map((i) => i.id)).toEqual(['fresh', 'edge']);
  });

  it('append 放在尾端,並順手剔除陳舊項目', () => {
    const stale = item({ id: 'stale', createdAt: NOW - STALE_MS - 1 });
    const next = appendHandoff([stale], item({ id: 'new' }), NOW);
    expect(next.map((i) => i.id)).toEqual(['new']);
  });

  it('超量淘汰最舊(上限 20,保留最新的)', () => {
    const existing = Array.from({ length: HANDOFF_MAX_ITEMS }, (_, n) =>
      item({ id: `old-${n}`, createdAt: NOW - n }),
    );
    const next = appendHandoff(existing, item({ id: 'newest' }), NOW);
    expect(next).toHaveLength(HANDOFF_MAX_ITEMS);
    expect(next[0].id).toBe('old-1');
    expect(next[next.length - 1].id).toBe('newest');
  });
});

describe('sendCaptionToPeer', () => {
  it('寫入完整契約形狀(定址 to=media-message、from=text-message、kind=caption)', () => {
    const storage = memStorage();
    const count = sendCaptionToPeer('今天的貼文', { storage, now: NOW, id: 'uuid-1' });
    expect(count).toBe(1);
    expect(JSON.parse(storage.map.get(HANDOFF_KEY)!)).toEqual({
      v: 1,
      items: [
        {
          id: 'uuid-1',
          from: 'text-message',
          to: 'media-message',
          kind: 'caption',
          text: '今天的貼文',
          createdAt: NOW,
        },
      ],
    });
  });

  it('連送兩筆是 append 不覆蓋(改佇列的理由:媒庫收件匣可列多筆)', () => {
    const storage = memStorage();
    sendCaptionToPeer('第一筆', { storage, now: NOW, id: 'a' });
    const count = sendCaptionToPeer('第二筆', { storage, now: NOW + 1, id: 'b' });
    expect(count).toBe(2);
    expect(parseHandoff(storage.map.get(HANDOFF_KEY)!).map((i) => i.text)).toEqual(['第一筆', '第二筆']);
  });

  it('只動 family:handoff:v1,不碰對方或自己的內部鍵', () => {
    const storage = memStorage({ 'text-message:v2': '{}', 'media-message:v1': '{}' });
    sendCaptionToPeer('文案', { storage, now: NOW, id: 'a' });
    expect([...storage.map.keys()].sort()).toEqual([HANDOFF_KEY, 'media-message:v1', 'text-message:v2']);
  });

  it('回傳值只數待媒管庫取用的筆數,不把對方送來的 inbound 也算進去', () => {
    const raw = serializeHandoff([item({ id: 'inbound', from: 'media-message', to: 'text-message' })]);
    const storage = memStorage({ [HANDOFF_KEY]: raw });
    expect(sendCaptionToPeer('文案', { storage, now: NOW, id: 'a' })).toBe(1);
    expect(parseHandoff(storage.map.get(HANDOFF_KEY)!)).toHaveLength(2);
  });

  it('儲存不可用(配額滿)回 null——交接是明確動作,呼叫端必須能提示失敗', () => {
    const storage = memStorage({}, true);
    expect(sendCaptionToPeer('文案', { storage, now: NOW, id: 'a' })).toBeNull();
  });
});

describe('pendingToPeerCount', () => {
  it('只數送給媒管庫且未陳舊的項目(對方取用後會自行刪除)', () => {
    const raw = serializeHandoff([
      item({ id: 'a' }),
      item({ id: 'b' }),
      item({ id: 'inbound', from: 'media-message', to: 'text-message' }),
      item({ id: 'stale', createdAt: NOW - STALE_MS - 1 }),
    ]);
    expect(pendingToPeerCount({ storage: memStorage({ [HANDOFF_KEY]: raw }), now: NOW })).toBe(2);
  });

  it('無資料回 0', () => {
    expect(pendingToPeerCount({ storage: memStorage(), now: NOW })).toBe(0);
  });
});
