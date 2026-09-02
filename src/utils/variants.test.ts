import { describe, expect, it } from 'vitest';
import type { Template } from '../types';
import { buildTemplateInsertText, templateCopyText } from './variants';

function tpl(overrides: Partial<Template> = {}): Template {
  return {
    id: 't',
    category: '日常分享',
    title: '範本',
    text: '通用內容 {{品牌}}',
    ...overrides,
  };
}

describe('buildTemplateInsertText', () => {
  it('未勾選平台或無符合變體 → 通用文字(第一期行為,無前綴)', () => {
    const base = tpl({ platformVariants: { threads: '短版' } });
    expect(buildTemplateInsertText(base, [])).toBe('通用內容 {{品牌}}');
    expect(buildTemplateInsertText(base, ['fb', 'ig'])).toBe('通用內容 {{品牌}}');
    expect(buildTemplateInsertText(tpl(), ['threads'])).toBe('通用內容 {{品牌}}');
  });

  it('有變體的勾選平台各成段並加前綴;其餘平台共用 [通用版] 段', () => {
    const base = tpl({ platformVariants: { threads: '短版 {{品牌}}', yt: '影片說明' } });
    const out = buildTemplateInsertText(base, ['fb', 'threads', 'yt']);
    expect(out).toBe(
      '[Threads 版]\n短版 {{品牌}}\n\n[YouTube 版]\n影片說明\n\n[通用版]\n通用內容 {{品牌}}',
    );
  });

  it('全部勾選平台都有變體 → 不加通用段', () => {
    const base = tpl({ platformVariants: { threads: '短版', yt: '影片說明' } });
    expect(buildTemplateInsertText(base, ['threads', 'yt'])).toBe(
      '[Threads 版]\n短版\n\n[YouTube 版]\n影片說明',
    );
  });

  it('變數填值一體適用於所有段落', () => {
    const base = tpl({ platformVariants: { threads: '短版 {{品牌}}' } });
    const out = buildTemplateInsertText(base, ['threads', 'fb'], { 品牌: '小日子' });
    expect(out).toBe('[Threads 版]\n短版 小日子\n\n[通用版]\n通用內容 小日子');
  });

  it('只有空白的變體視為無變體', () => {
    const base = tpl({ platformVariants: { threads: '   ' } });
    expect(buildTemplateInsertText(base, ['threads'])).toBe('通用內容 {{品牌}}');
  });
});

describe('templateCopyText', () => {
  it('generic 或無變體 → 通用文字(含填值)', () => {
    const base = tpl({ platformVariants: { threads: '短版' } });
    expect(templateCopyText(base, 'generic', { 品牌: 'B' })).toBe('通用內容 B');
    expect(templateCopyText(tpl(), 'threads', { 品牌: 'B' })).toBe('通用內容 B');
  });

  it('指定平台 → 該變體文字(含填值)', () => {
    const base = tpl({ platformVariants: { threads: '短版 {{品牌}}' } });
    expect(templateCopyText(base, 'threads', { 品牌: 'B' })).toBe('短版 B');
  });
});
