import { describe, expect, it } from 'vitest';
import { YoutubeError } from './errors';
import {
  YT_TITLE_MAX_BYTES,
  buildVideoMetadata,
  clampUtf8,
  fileSizeMb,
  resolvePublishPlan,
} from './video';

describe('clampUtf8', () => {
  it('以位元組為單位截斷:中文 3 bytes/字,ASCII 1 byte/字', () => {
    expect(clampUtf8('abcdefghij', 5)).toBe('abcde');
    expect(clampUtf8('一二三四五', 9)).toBe('一二三'); // 3 字=9 bytes,第 4 字會爆
    expect(clampUtf8('一二三四五', 10)).toBe('一二三'); // 第 4 字(12 bytes)超過 10
    expect(clampUtf8('一二三四五', 12)).toBe('一二三四');
  });

  it('不切壞 emoji(以 code point 迭代)', () => {
    expect(clampUtf8('a✨b', 4)).toBe('a✨'); // ✨ 佔 3 bytes,放不下 b
  });

  it('在限制內原樣回傳', () => {
    expect(clampUtf8('短文字', 100)).toBe('短文字');
    expect(clampUtf8('', 100)).toBe('');
  });
});

describe('buildVideoMetadata', () => {
  it('標題空白退回未命名影片;標題與說明依 bytes 上限截斷', () => {
    const meta = buildVideoMetadata({
      title: '   ',
      description: '說',
      privacyStatus: 'public',
    });
    expect(meta.snippet.title).toBe('未命名影片');
    expect(meta.snippet.description).toBe('說');
    expect(meta.status.privacyStatus).toBe('public');
    expect(meta.status.selfDeclaredMadeForKids).toBe(false);
    expect(meta.status.publishAt).toBeUndefined();
  });

  it('超長中文標題截斷至 100 bytes 以內', () => {
    const long = '標'.repeat(50); // 150 bytes
    const meta = buildVideoMetadata({ title: long, description: '', privacyStatus: 'public' });
    expect(new TextEncoder().encode(meta.snippet.title).length).toBeLessThanOrEqual(
      YT_TITLE_MAX_BYTES,
    );
  });

  it('publishAt 僅在 private 時帶入(YouTube 原生排程規則)', () => {
    const scheduled = buildVideoMetadata({
      title: 't',
      description: 'd',
      privacyStatus: 'private',
      publishAt: '2030-01-01T01:00:00.000Z',
    });
    expect(scheduled.status.publishAt).toBe('2030-01-01T01:00:00.000Z');
    const notPrivate = buildVideoMetadata({
      title: 't',
      description: 'd',
      privacyStatus: 'public',
      publishAt: '2030-01-01T01:00:00.000Z',
    });
    expect(notPrivate.status.publishAt).toBeUndefined();
  });
});

describe('resolvePublishPlan', () => {
  const NOW = new Date('2026-09-02T12:00:00');

  it('now 模式=立即公開(public)', () => {
    expect(resolvePublishPlan('now', '', NOW)).toEqual({
      mode: 'now',
      privacyStatus: 'public',
    });
  });

  it('schedule 模式=private+publishAt(ISO UTC),並拆出本地日期時間', () => {
    const plan = resolvePublishPlan('schedule', '2030-01-01T09:30', NOW);
    if (plan.mode !== 'schedule') throw new Error('expected schedule plan');
    expect(plan.privacyStatus).toBe('private');
    expect(plan.date).toBe('2030-01-01');
    expect(plan.time).toBe('09:30');
    expect(plan.publishAt).toMatch(/^2030-01-01T.*Z$/);
  });

  it('空白或過去的時間拒絕(invalid_request)', () => {
    expect(() => resolvePublishPlan('schedule', '', NOW)).toThrow(YoutubeError);
    expect(() => resolvePublishPlan('schedule', '2020-01-01T09:30', NOW)).toThrow(
      YoutubeError,
    );
  });
});

describe('fileSizeMb', () => {
  it('以 MB 一位小數顯示', () => {
    expect(fileSizeMb(1024 * 1024)).toBe('1.0');
    expect(fileSizeMb(15 * 1024 * 1024 + 300 * 1024)).toBe('15.3');
  });
});
