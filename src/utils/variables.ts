/**
 * 範本變數(文管庫深化第一期):
 * `{{變數名}}` 佔位符的偵測與填值替換——純邏輯,node 環境可測。
 * 變數名不含空白、冒號與大括號;未填寫(或值為空白)的變數保留原樣,
 * 方便套用後回草稿手動補上。
 */

const VARIABLE_RE = /\{\{([^{}:\s]+)\}\}/g;

/** 取出範本中的變數名(去重、依首次出現順序)。 */
export function extractVariables(text: string): string[] {
  const seen = new Set<string>();
  for (const m of text.matchAll(VARIABLE_RE)) {
    seen.add(m[1]);
  }
  return [...seen];
}

/** 以填寫值替換變數;未填寫的保留 `{{原樣}}`。 */
export function applyVariables(text: string, values: Record<string, string>): string {
  return text.replace(VARIABLE_RE, (match, name: string) => {
    const v = values[name];
    return typeof v === 'string' && v.trim() ? v : match;
  });
}
