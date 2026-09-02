/**
 * 範本插入文字的組裝(文管庫深化第二期:平台變體)。
 * 規則(D3 決議,2026-09-02):
 * - 勾選平台中「有變體」者 → 各自成段,前綴 `[<平台名> 版]`
 * - 勾選平台中「無變體」者 → 共用一段通用文字,前綴 `[通用版]`
 * - 完全沒有符合的變體(或未勾選平台)→ 直接回通用文字(= 第一期行為)
 * 變數填值對所有段落一體適用。
 */
import { PLATFORM_META } from '../constants';
import type { PlatformKey, Template } from '../types';
import { applyVariables } from './variables';

/** 依已勾選平台組出要插入草稿的文字。 */
export function buildTemplateInsertText(
  tpl: Template,
  selectedPlatforms: PlatformKey[],
  values: Record<string, string> = {},
): string {
  const variants = tpl.platformVariants ?? {};
  const withVariant = selectedPlatforms.filter((p) => (variants[p] ?? '').trim());
  if (withVariant.length === 0) return applyVariables(tpl.text, values);

  const segments = withVariant.map(
    (p) => `[${PLATFORM_META[p].label} 版]\n${applyVariables(variants[p] ?? '', values)}`,
  );
  if (selectedPlatforms.length > withVariant.length) {
    segments.push(`[通用版]\n${applyVariables(tpl.text, values)}`);
  }
  return segments.join('\n\n');
}

/** 複製用:指定平台的變體文字;無變體或指定 'generic' 時回通用文字。 */
export function templateCopyText(
  tpl: Template,
  choice: PlatformKey | 'generic',
  values: Record<string, string> = {},
): string {
  if (choice !== 'generic') {
    const variant = tpl.platformVariants?.[choice];
    if (variant && variant.trim()) return applyVariables(variant, values);
  }
  return applyVariables(tpl.text, values);
}
