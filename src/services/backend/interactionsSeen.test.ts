// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { countUnseen, readSeenAt, writeSeenAt } from './interactionsSeen';

const KEY = 'text-message:threads-seen-at';

afterEach(() => {
  localStorage.clear();
});

describe('最後查看時間', () => {
  it('未查看過回 0,寫入後讀回同值', () => {
    expect(readSeenAt()).toBe(0);
    writeSeenAt(1_760_000_000_000);
    expect(readSeenAt()).toBe(1_760_000_000_000);
  });

  it('壞值(非數字/負數/空字串)視為未查看過', () => {
    localStorage.setItem(KEY, 'abc');
    expect(readSeenAt()).toBe(0);
    localStorage.setItem(KEY, '-5');
    expect(readSeenAt()).toBe(0);
    localStorage.setItem(KEY, '');
    expect(readSeenAt()).toBe(0);
  });

  it('只落地時間戳,不落地互動內容', () => {
    writeSeenAt(123);
    expect(Object.keys(localStorage)).toEqual([KEY]);
    expect(localStorage.getItem(KEY)).toBe('123');
  });
});

describe('countUnseen', () => {
  it('嚴格晚於最後查看時間才算未讀(等於不算)', () => {
    const items = [{ timestamp: 300 }, { timestamp: 200 }, { timestamp: 100 }];
    expect(countUnseen(items, 200)).toBe(1);
    expect(countUnseen(items, 0)).toBe(3);
    expect(countUnseen(items, 300)).toBe(0);
  });

  it('時間戳為 0(平台壞值)不計未讀——否則會有永遠消不掉的紅點', () => {
    expect(countUnseen([{ timestamp: 0 }, { timestamp: 0 }], 0)).toBe(0);
    expect(countUnseen([{ timestamp: 0 }, { timestamp: 50 }], 10)).toBe(1);
  });
});
