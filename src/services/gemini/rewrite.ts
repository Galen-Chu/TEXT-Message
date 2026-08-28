/**
 * Gemini 語氣改寫(BYOK:Bring Your Own Key)。
 *
 * 使用者自帶的 API key 只存在自己瀏覽器的 localStorage,由瀏覽器直接
 * 呼叫 Google API——本專案沒有後端,key 不會經過(也不可能經過)任何
 * 第三方伺服器。未設 key 時,呼叫端(useAppStore.applyTone)退回既有
 * 的純前端規則示範路徑。
 *
 * 純邏輯(prompt 組裝/回應解析/狀態碼對應)與 DOM 依賴(key 的
 * localStorage 存取)集中於此,方便 vitest 測試與日後替換模型。
 */
import type { Tone } from '../../constants';

/** 模型名稱會隨 Google 更新淘汰,調整只需改這裡。 */
export const GEMINI_MODEL = 'gemini-2.5-flash';

export type RewriteErrorCode =
  | 'invalid_key'
  | 'quota'
  | 'server'
  | 'network'
  | 'no_content'
  | 'unknown';

export type RewriteResult = { ok: true; text: string } | { ok: false; code: RewriteErrorCode };

/** 各語氣給模型的具體指引(按鈕文字之外的完整定義)。 */
const TONE_PROMPT_HINTS: Record<Tone, string> = {
  專業: '專業——清晰、可信、條理分明,適合品牌對外發言',
  親切: '親切——溫暖、口語,像朋友分享般自然',
  活潑: '活潑——有活力、節奏輕快,可多用具互動語氣',
  簡短: '簡短——精煉,一至兩句內直切重點',
};

export function buildRewritePrompt(text: string, tone: Tone, limit?: number): string {
  const lines = [
    `你是社群媒體文案編輯。請把「原始草稿」改寫為${TONE_PROMPT_HINTS[tone]}的繁體中文貼文。`,
    '規則:',
    '- 保留原意與關鍵資訊,不改變任何事實',
    '- 保留原有的 emoji 與換行結構,可適度增減',
    '- 只輸出改寫後的全文,不要任何前言、說明或引號',
  ];
  if (limit && limit > 0) lines.push(`- 總長度不得超過 ${limit} 字(含空白與 emoji)`);
  return [...lines, '', '原始草稿:', text].join('\n');
}

/** 從 generateContent 回應 JSON 取出文字;結構不符回 null。 */
export function parseGeminiReply(json: unknown): string | null {
  const candidates = (json as { candidates?: unknown[] })?.candidates;
  const parts = (candidates?.[0] as { content?: { parts?: Array<{ text?: string }> } })?.content
    ?.parts;
  const text = parts?.map((p) => p?.text ?? '').join('').trim();
  return text || null;
}

/** fetch 回應的 HTTP 狀態 → 錯誤碼(純函式,便於測試)。 */
export function statusToCode(status: number): RewriteErrorCode {
  if (status === 400 || status === 401 || status === 403) return 'invalid_key';
  if (status === 429) return 'quota';
  if (status >= 500) return 'server';
  return 'unknown';
}

export async function rewriteWithGemini(input: {
  apiKey: string;
  text: string;
  tone: Tone;
  limit?: number;
  signal?: AbortSignal;
}): Promise<RewriteResult> {
  let resp: Response;
  try {
    resp = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': input.apiKey },
        body: JSON.stringify({
          contents: [{ parts: [{ text: buildRewritePrompt(input.text, input.tone, input.limit) }] }],
          generationConfig: { temperature: 0.7, maxOutputTokens: 2048 },
        }),
        signal: input.signal,
      },
    );
  } catch {
    return { ok: false, code: 'network' };
  }
  if (!resp.ok) return { ok: false, code: statusToCode(resp.status) };
  let json: unknown;
  try {
    json = await resp.json();
  } catch {
    return { ok: false, code: 'unknown' };
  }
  const text = parseGeminiReply(json);
  return text ? { ok: true, text } : { ok: false, code: 'no_content' };
}

// ---- key 存取(僅使用者自己的瀏覽器;與內容資料的 text-message:v2 分開) ----

const KEY_STORAGE = 'text-message:gemini-key';

export function loadGeminiKey(): string {
  try {
    return localStorage.getItem(KEY_STORAGE) ?? '';
  } catch {
    return '';
  }
}

export function saveGeminiKey(key: string): void {
  try {
    localStorage.setItem(KEY_STORAGE, key);
  } catch {
    // 隱私模式等情境下靜默退回記憶體模式
  }
}

export function clearGeminiKey(): void {
  try {
    localStorage.removeItem(KEY_STORAGE);
  } catch {
    // 同上
  }
}
