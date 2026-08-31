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

/**
 * 模型候選(依序嘗試):新發行的 key(尤其新格式 AQ 開頭)未必有
 * 舊模型的存取權,反之亦然 — TASK-Schedule 的經驗是逐一探測並記住
 * 第一個可用的。404 = 換下一個;401/403 = key 問題,直接結束。
 */
export const GEMINI_MODEL_CANDIDATES = [
  'gemini-2.5-flash',
  'gemini-flash-latest',
  'gemini-flash-lite-latest',
  'gemini-2.0-flash',
] as const;

export type RewriteErrorCode =
  | 'invalid_key'
  | 'quota'
  | 'server'
  | 'network'
  | 'no_content'
  | 'model_unavailable'
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

/** 郵件 → 貼文草稿的摘要 prompt(輸入為已解析的 Email 欄位)。 */
export function buildSummarizePrompt(input: {
  subject: string;
  from: string;
  body: string;
  limit?: number;
}): string {
  const lines = [
    '你是社群媒體文案編輯。請把以下電子郵件摘要成一則適合社群平台的繁體中文貼文草稿。',
    '規則:',
    '- 只取郵件中值得分享的重點,不添加郵件裡沒有的內容',
    '- 捨棄問候語、簽名檔與退訂等行銷雜訊',
    '- 適度使用 emoji 與換行,讓貼文易讀',
    '- 只輸出貼文全文,不要任何前言、說明或引號',
  ];
  if (input.limit && input.limit > 0) lines.push(`- 總長度不得超過 ${input.limit} 字(含空白與 emoji)`);
  return [
    ...lines,
    '',
    `郵件主旨:${input.subject}`,
    `寄件者:${input.from}`,
    '',
    '郵件內容:',
    input.body,
  ].join('\n');
}

/** 自訂指令改寫 prompt:使用者自由輸入指令(例:「改成 3 行重點」)。 */
export function buildInstructionPrompt(text: string, instruction: string, limit?: number): string {
  const lines = [
    '你是社群媒體文案編輯。請依「使用者指令」改寫「原始草稿」,輸出繁體中文貼文。',
    '規則:',
    '- 嚴格遵守使用者指令,但不改變任何事實',
    '- 只輸出改寫後的全文,不要任何前言、說明或引號',
  ];
  if (limit && limit > 0) lines.push(`- 總長度不得超過 ${limit} 字(含空白與 emoji)`);
  return [...lines, '', `使用者指令:${instruction}`, '', '原始草稿:', text].join('\n');
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
  if (status === 401 || status === 403) return 'invalid_key';
  if (status === 400) return 'invalid_key';
  if (status === 404) return 'model_unavailable';
  if (status === 429) return 'quota';
  if (status >= 500) return 'server';
  return 'unknown';
}

/** 已探測可用的模型(存 localStorage,之後直接用,不再逐一重試)。 */
const MODEL_STORAGE = 'text-message:gemini-model';

function loadResolvedModel(): string {
  try {
    return localStorage.getItem(MODEL_STORAGE) ?? '';
  } catch {
    return '';
  }
}

function saveResolvedModel(model: string): void {
  try {
    localStorage.setItem(MODEL_STORAGE, model);
  } catch {
    // 記不住就每次重試,不影響功能
  }
}

/** 共用呼叫:模型候選逐一降級、記住第一個可用的模型。三個對外函式皆走這裡。 */
async function generateContent(
  apiKey: string,
  prompt: string,
  signal?: AbortSignal,
): Promise<RewriteResult> {
  const body = JSON.stringify({
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: { temperature: 0.7, maxOutputTokens: 2048 },
  });
  const candidates = [loadResolvedModel(), ...GEMINI_MODEL_CANDIDATES].filter(
    (m, i, arr): m is string => !!m && arr.indexOf(m) === i,
  );

  let lastCode: RewriteErrorCode = 'unknown';
  for (const model of candidates) {
    let resp: Response;
    try {
      resp = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
          body,
          signal,
        },
      );
    } catch {
      return { ok: false, code: 'network' };
    }
    if (!resp.ok) {
      lastCode = statusToCode(resp.status);
      // 404 = 此 key 無此模型 → 試下一個候選;其餘錯誤(key/額度/服務)立即結束
      if (lastCode !== 'model_unavailable') return { ok: false, code: lastCode };
      continue;
    }
    let json: unknown;
    try {
      json = await resp.json();
    } catch {
      lastCode = 'unknown';
      continue;
    }
    const text = parseGeminiReply(json);
    if (text) {
      saveResolvedModel(model);
      return { ok: true, text };
    }
    lastCode = 'no_content';
  }
  return { ok: false, code: lastCode };
}

export async function rewriteWithGemini(input: {
  apiKey: string;
  text: string;
  tone: Tone;
  limit?: number;
  signal?: AbortSignal;
}): Promise<RewriteResult> {
  return generateContent(input.apiKey, buildRewritePrompt(input.text, input.tone, input.limit), input.signal);
}

/** 郵件 → 貼文草稿:把整封郵件交給 Gemini 摘要(useAppStore.convertToDraft 使用)。 */
export async function summarizeWithGemini(input: {
  apiKey: string;
  subject: string;
  from: string;
  body: string;
  limit?: number;
  signal?: AbortSignal;
}): Promise<RewriteResult> {
  return generateContent(
    input.apiKey,
    buildSummarizePrompt({ subject: input.subject, from: input.from, body: input.body, limit: input.limit }),
    input.signal,
  );
}

/** 自訂指令改寫:使用者自由下指令(無 key 時呼叫端不會走到這裡)。 */
export async function rewriteWithInstruction(input: {
  apiKey: string;
  text: string;
  instruction: string;
  limit?: number;
  signal?: AbortSignal;
}): Promise<RewriteResult> {
  return generateContent(
    input.apiKey,
    buildInstructionPrompt(input.text, input.instruction, input.limit),
    input.signal,
  );
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
