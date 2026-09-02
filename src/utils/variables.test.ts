import { describe, expect, it } from 'vitest';
import { applyVariables, extractVariables } from './variables';

describe('extractVariables', () => {
  it('取出所有變數,去重且依首次出現順序', () => {
    expect(extractVariables('{{品牌}} × {{品牌}} 與 {{產品名稱}}')).toEqual(['品牌', '產品名稱']);
  });

  it('無變數回空陣列;空字串亦然', () => {
    expect(extractVariables('完全沒有佔位符的文字')).toEqual([]);
    expect(extractVariables('')).toEqual([]);
  });

  it('大括號內含空白或冒號者不視為變數', () => {
    expect(extractVariables('{{ 品牌 }} {{a:b}} {{x}}')).toEqual(['x']);
  });

  it('相鄰變數與中文變數名皆可偵測', () => {
    expect(extractVariables('{{a}}{{折扣碼}}')).toEqual(['a', '折扣碼']);
  });
});

describe('applyVariables', () => {
  it('填寫的變數被替換(同名全部替換),未填的保留原樣', () => {
    expect(applyVariables('{{品牌}}的{{產品}}上市,{{品牌}}首發', { 品牌: '小日子' })).toBe(
      '小日子的{{產品}}上市,小日子首發',
    );
  });

  it('值為純空白視同未填寫(保留佔位符)', () => {
    expect(applyVariables('a {{x}} b', { x: '   ' })).toBe('a {{x}} b');
  });

  it('值可包含特殊字元(含大括號),不做遞迴展開', () => {
    expect(applyVariables('{{x}}', { x: '{{y}}' })).toBe('{{y}}');
    expect(applyVariables('{{x}}', { x: '100% 折扣 🎉' })).toBe('100% 折扣 🎉');
  });

  it('無變數文字原樣回傳', () => {
    expect(applyVariables('一般文字', {})).toBe('一般文字');
  });
});
