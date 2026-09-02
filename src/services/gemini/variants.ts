/**
 * Gemini 平台適配變體生成與 hashtag 建議(文管庫深化第四期,BYOK)。
 * 沿用 rewrite.ts 的模型降級迴圈與錯誤碼;prompt 組裝/回應解析為純函式。
 * 回應要求 JSON(變體=物件、標籤=陣列),解析容忍 ```json 圍欄。
 */
import { generateContent, type RewriteErrorCode } from './rewrite';

export interface PlatformSpec {
  key: string;
  label: string;
  limit: number;
}

export type VariantsResult =
  | { ok: true; variants: Partial<Record<string, string>> }
  | { ok: false; code: RewriteErrorCode };

export type HashtagsResult =
  | { ok: true; hashtags: string[] }
  | { ok: false; code: RewriteErrorCode };

function stripCodeFence(raw: string): string {
  return raw
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '');
}

export function buildVariantsPrompt(text: string, platforms: PlatformSpec[]): string {
  const spec = platforms.map((p) => `- ${p.key}(${p.label}):上限 ${p.limit} 字`).join('\n');
  return [
    '你是社群媒體文案編輯。請把「原始草稿」改寫為下列每個平台各一版的繁體中文貼文。',
    '規則:',
    '- 保留原意與關鍵資訊,不改變任何事實',
    '- 依各平台特性調整語氣、結構與長度(上限如下,含空白與 emoji)',
    '- 每一版都要完整可用,不是摘要',
    '- 只輸出一個 JSON 物件:鍵為平台代碼、值為該版全文,不要任何前言、說明或程式碼圍欄',
    '',
    '平台清單:',
    spec,
    '',
    '原始草稿:',
    text,
  ].join('\n');
}

/** 解析變體回應:取鍵值屬於平台清單且非空白的欄位;完全無有效欄位回 null。 */
export function parseVariantsResponse(
  raw: string,
  keys: string[],
): Partial<Record<string, string>> | null {
  let obj: unknown;
  try {
    obj = JSON.parse(stripCodeFence(raw));
  } catch {
    return null;
  }
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return null;
  const rec = obj as Record<string, unknown>;
  const out: Partial<Record<string, string>> = {};
  for (const k of keys) {
    const v = rec[k];
    if (typeof v === 'string' && v.trim()) out[k] = v.trim();
  }
  return Object.keys(out).length ? out : null;
}

export function buildHashtagsPrompt(text: string): string {
  return [
    '你是社群媒體企劃。請從以下貼文內容產生 3 到 5 個適合的 hashtag(繁體中文或通用英文皆可)。',
    '規則:',
    '- 標籤須與內容直接相關,不要虛構內容中沒有的主題',
    '- 每個標籤以 # 開頭、不含空白',
    '- 只輸出一個 JSON 字串陣列,不要任何前言、說明或程式碼圍欄',
    '',
    '貼文內容:',
    text,
  ].join('\n');
}

/** 解析標籤回應:統一 # 前綴、去空白、去重、上限 5 個;解析失敗回空陣列。 */
export function parseHashtagsResponse(raw: string): string[] {
  let arr: unknown;
  try {
    arr = JSON.parse(stripCodeFence(raw));
  } catch {
    return [];
  }
  if (!Array.isArray(arr)) return [];
  const tags = arr
    .filter((v): v is string => typeof v === 'string' && !!v.trim())
    .map((v) => {
      const t = v.replace(/\s+/g, '');
      return t.startsWith('#') ? t : `#${t}`;
    });
  return [...new Set(tags)].slice(0, 5);
}

export async function generatePlatformVariants(input: {
  apiKey: string;
  text: string;
  platforms: PlatformSpec[];
  signal?: AbortSignal;
}): Promise<VariantsResult> {
  const result = await generateContent(
    input.apiKey,
    buildVariantsPrompt(input.text, input.platforms),
    input.signal,
  );
  if (!result.ok) return result;
  const variants = parseVariantsResponse(result.text, input.platforms.map((p) => p.key));
  return variants ? { ok: true, variants } : { ok: false, code: 'no_content' };
}

export async function suggestHashtagsFor(input: {
  apiKey: string;
  text: string;
  signal?: AbortSignal;
}): Promise<HashtagsResult> {
  const result = await generateContent(input.apiKey, buildHashtagsPrompt(input.text), input.signal);
  if (!result.ok) return result;
  const hashtags = parseHashtagsResponse(result.text);
  return hashtags.length ? { ok: true, hashtags } : { ok: false, code: 'no_content' };
}
