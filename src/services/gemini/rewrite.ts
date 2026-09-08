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
import type { DocKind } from '../../types';

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

/** 模型候選間的換檔等待(讓限流窗口呼吸;免費方案常見 429/503 過載)。 */
export const GEMINI_FALLBACK_DELAY_MS = 800;

export type RewriteResult = { ok: true; text: string } | { ok: false; code: RewriteErrorCode };

/** 各語氣給模型的具體指引(按鈕文字之外的完整定義)。 */
const TONE_PROMPT_HINTS: Record<Tone, string> = {
  專業: '專業——清晰、可信、條理分明,適合品牌對外發言',
  親切: '親切——溫暖、口語,像朋友分享般自然',
  活潑: '活潑——有活力、節奏輕快,可多用具互動語氣',
  簡短: '簡短——精煉,一至兩句內直切重點',
};

/**
 * 各文檔類型的生成文體(IA Phase 3 D5/D9):persona、產出物與類型專屬規則。
 * kind 預設 'copy'(社群貼文)= 現行行為,既有呼叫端與測試不受影響。
 */
const KIND_PERSONA: Record<DocKind, string> = {
  draft: '電子報與內容編輯',
  copy: '社群媒體文案編輯',
  message: '社群小編(負責粉絲互動)',
};

const KIND_OUTPUT: Record<DocKind, string> = {
  draft: '電子報/資訊文章內容',
  copy: '社群貼文',
  message: '粉絲留言或私訊的回覆訊息',
};

const KIND_RULES: Record<DocKind, string> = {
  draft: '- 結構清楚、分段有條理,重點放前面,適合電子報或資訊型長文',
  copy: '- 適度使用 emoji 與換行,讓貼文易讀',
  message: '- 以對話口吻直接稱呼對方,一至三句內完成,可直接送出',
};

/** 風格樣本每篇擷取上限(DRIVE-PLAN D6:控制 prompt 長度與 token 成本)。 */
export const STYLE_SAMPLE_CHAR_LIMIT = 800;

/**
 * 行文風格樣本區塊(DRIVE-PLAN D6):模仿使用者既有文章的語氣與節奏,
 * 內容仍以原始草稿為準——樣本僅在生成請求中暫用,不落地。
 */
export function styleSampleBlock(samples: string[]): string[] {
  if (!samples.length) return [];
  return [
    '',
    '行文風格樣本(模仿其語氣、節奏與用詞習慣;內容與事實仍以原始草稿為準,不得引用樣本中的情節):',
    ...samples.map((s, i) => `【樣本 ${i + 1}】\n${s.slice(0, STYLE_SAMPLE_CHAR_LIMIT)}`),
  ];
}

export function buildRewritePrompt(
  text: string,
  tone: Tone,
  limit?: number,
  kind: DocKind = 'copy',
  styleSamples?: string[],
): string {
  const lines = [
    `你是${KIND_PERSONA[kind]}。請把「原始草稿」改寫為${TONE_PROMPT_HINTS[tone]}的繁體中文${KIND_OUTPUT[kind]}。`,
    '規則:',
    '- 保留原意與關鍵資訊,不改變任何事實',
    KIND_RULES[kind],
    '- 只輸出改寫後的全文,不要任何前言、說明或引號',
  ];
  if (limit && limit > 0) lines.push(`- 總長度不得超過 ${limit} 字(含空白與 emoji)`);
  return [...lines, ...styleSampleBlock(styleSamples ?? []), '', '原始草稿:', text].join('\n');
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

/** 自訂指令改寫 prompt:使用者自由輸入指令(例:「改成 3 行重點」);文體依文檔類型。 */
export function buildInstructionPrompt(
  text: string,
  instruction: string,
  limit?: number,
  kind: DocKind = 'copy',
  styleSamples?: string[],
): string {
  const lines = [
    `你是${KIND_PERSONA[kind]}。請依「使用者指令」改寫「原始草稿」,輸出繁體中文${KIND_OUTPUT[kind]}。`,
    '規則:',
    '- 嚴格遵守使用者指令,但不改變任何事實',
    KIND_RULES[kind],
    '- 只輸出改寫後的全文,不要任何前言、說明或引號',
  ];
  if (limit && limit > 0) lines.push(`- 總長度不得超過 ${limit} 字(含空白與 emoji)`);
  return [...lines, ...styleSampleBlock(styleSamples ?? []), '', `使用者指令:${instruction}`, '', '原始草稿:', text].join('\n');
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

/** 共用呼叫:模型候選逐一降級、記住第一個可用的模型。各對外函式皆走這裡(含 variants.ts)。 */
export async function generateContent(
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
      console.error(`[gemini] ${model} → HTTP ${resp.status}`);
      // 404(此 key 無此模型)、429(限流)、5xx(過載)→ 換下一個候選再試:
      // 免費方案各模型有獨立的每分鐘/每日限額,換模型常可即時恢復;
      // key 問題(400/401/403)換模型也沒救,立即結束
      if (lastCode === 'invalid_key') return { ok: false, code: lastCode };
      await new Promise((r) => setTimeout(r, GEMINI_FALLBACK_DELAY_MS));
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
  kind?: DocKind;
  styleSamples?: string[];
  signal?: AbortSignal;
}): Promise<RewriteResult> {
  return generateContent(
    input.apiKey,
    buildRewritePrompt(
      input.text,
      input.tone,
      input.limit,
      input.kind ?? 'copy',
      input.styleSamples,
    ),
    input.signal,
  );
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

/** 自訂指令改寫:使用者自由下指令(無 key 時呼叫端不會走到這裡);文體依文檔類型。 */
export async function rewriteWithInstruction(input: {
  apiKey: string;
  text: string;
  instruction: string;
  limit?: number;
  kind?: DocKind;
  styleSamples?: string[];
  signal?: AbortSignal;
}): Promise<RewriteResult> {
  return generateContent(
    input.apiKey,
    buildInstructionPrompt(
      input.text,
      input.instruction,
      input.limit,
      input.kind ?? 'copy',
      input.styleSamples,
    ),
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
