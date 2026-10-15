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
import type { RewriteLanguage, Role, Tone } from '../../constants';
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
  | 'aborted'
  | 'unknown';

/** 模型候選間的換檔等待(讓限流窗口呼吸;免費方案常見 429/503 過載)。 */
export const GEMINI_FALLBACK_DELAY_MS = 800;

export type RewriteResult = { ok: true; text: string } | { ok: false; code: RewriteErrorCode };

/** 各語氣給模型的具體指引(按鈕文字之外的完整定義;2026-09-11 B1 擴充至十種)。 */
const TONE_PROMPT_HINTS: Record<Tone, string> = {
  專業: '專業——清晰、可信、條理分明,適合品牌對外發言',
  親切: '親切——溫暖、口語,像朋友分享般自然',
  活潑: '活潑——有活力、節奏輕快,可多用具互動語氣',
  簡短: '簡短——精煉,一至兩句內直切重點',
  溫暖: '溫暖——柔和、關懷,像對身邊的人說話',
  幽默: '幽默——輕鬆詼諧,可以玩梗,但不失分寸',
  勵志: '勵志——正向激勵,給人行動的能量,避免說教',
  敘事: '敘事——像說故事,有場景與起伏,引人想看下去',
  教學: '教學——清楚拆解重點與步驟,像耐心的小老師',
  行銷: '行銷——突顯價值、有號召力,引導讀者行動(CTA)',
};

/** 角色列(2026-09-11 B2)給模型的發言身份;覆寫文檔類型 persona。 */
const ROLE_PERSONA: Record<Role, string> = {
  品牌主理人: '品牌主理人——對品牌理念有立場與熱情,以真誠的第一人稱發言',
  行銷小編: '行銷小編——親民、跟得上流行,擅長與粉絲打成一片',
  客服人員: '客服人員——禮貌、耐心、條理清楚,以解決對方的問題為優先',
  專業講師: '專業講師——深入淺出、有條理,樂於把知識講清楚',
  創作者本人: '創作者本人——真實直白,像和讀者面對面聊天',
};

/** 語言列(2026-09-11 B3)的輸出語言規則;台語文/南島語文附書寫系統指引。 */
const LANGUAGE_RULES: Record<RewriteLanguage, string> = {
  繁體中文: '繁體中文',
  英文: '英文(自然流暢,台灣慣用譯名)',
  西班牙文: '西班牙文',
  德文: '德文',
  法文: '法文',
  日文: '日文',
  韓文: '韓文',
  泰文: '泰文',
  台語文: '台語書面語(台灣台語,漢字為主、可輔以台羅拼音)',
  南島語文: '台灣南島語言(依內容擇最合適的一種,如阿美語、排灣語、泰雅語;難以對應的詞彙可保留中文)',
};

/** 語氣/指令/平台版本生成共用的角色與語言維度(B2/B3)。 */
export interface RewriteExtras {
  /** 角色:覆寫文檔類型 persona(未選 = null/undefined)。 */
  role?: Role | null;
  /** 輸出語言(預設繁體中文)。 */
  language?: RewriteLanguage;
}

/** persona 一行字:角色覆寫 > 文檔類型;variants 等其他 prompt 共用。 */
export function personaText(kind: DocKind, extras?: RewriteExtras): string {
  return extras?.role ? ROLE_PERSONA[extras.role] : KIND_PERSONA[kind];
}

/** 「輸出語言」規則行內文;variants 等其他 prompt 共用。 */
export function languageRuleText(extras?: RewriteExtras): string {
  return LANGUAGE_RULES[extras?.language ?? '繁體中文'];
}

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
  extras?: RewriteExtras,
): string {
  const lines = [
    `你是${personaText(kind, extras)}。請以${extras?.language ?? '繁體中文'}把「原始草稿」改寫為${TONE_PROMPT_HINTS[tone]}的${KIND_OUTPUT[kind]}。`,
    '規則:',
    '- 保留原意與關鍵資訊,不改變任何事實',
    KIND_RULES[kind],
    `- 輸出語言:${languageRuleText(extras)}`,
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

/** 自訂指令改寫 prompt:使用者自由輸入指令(例:「改成 3 行重點」);文體依文檔類型,含角色/語言維度。 */
export function buildInstructionPrompt(
  text: string,
  instruction: string,
  limit?: number,
  kind: DocKind = 'copy',
  styleSamples?: string[],
  extras?: RewriteExtras,
): string {
  const lines = [
    `你是${personaText(kind, extras)}。請以${extras?.language ?? '繁體中文'}依「使用者指令」改寫「原始草稿」,輸出${KIND_OUTPUT[kind]}。`,
    '規則:',
    '- 嚴格遵守使用者指令,但不改變任何事實',
    KIND_RULES[kind],
    `- 輸出語言:${languageRuleText(extras)}`,
    '- 只輸出改寫後的全文,不要任何前言、說明或引號',
  ];
  if (limit && limit > 0) lines.push(`- 總長度不得超過 ${limit} 字(含空白與 emoji)`);
  return [...lines, ...styleSampleBlock(styleSamples ?? []), '', `使用者指令:${instruction}`, '', '原始草稿:', text].join('\n');
}

/**
 * 管線日誌生成 prompt(PIPELINE-PLAN D2/P2,2026-10-15):把一則夢境日誌條目
 * 轉成一篇 Threads 貼文——靈感素材 + 風格樣本雙輸入,輸出長度受平台上限約束。
 * 誠實規則內建:不得照抄日誌原文(那是私人素材),靈感提煉為意象與氛圍。
 */
export function buildJournalPostPrompt(opts: {
  entryTitle?: string;
  entryBody: string;
  styleSamples?: string[];
  limit?: number;
}): string {
  const lines = [
    '你是社群媒體文案編輯。請把「靈感素材」提煉成一篇適合 Threads 的繁體中文貼文。',
    '規則:',
    '- 靈感素材是私人的日記內容:只取其意象、情緒與氛圍做發想,**不得照抄原文或出現可辨識的私人細節**',
    '- 貼文要能獨立成篇,不提「日記」「夢到」等來源',
    '- 語氣自然、有畫面感,適合一般追蹤者閱讀',
    '- 只輸出貼文全文,不要任何前言、說明或引號',
  ];
  if (opts.limit && opts.limit > 0) lines.push(`- 總長度不得超過 ${opts.limit} 字(含空白與 emoji)`);
  const head = opts.entryTitle ? `【${opts.entryTitle}】\n${opts.entryBody}` : opts.entryBody;
  return [...lines, ...styleSampleBlock(opts.styleSamples ?? []), '', '靈感素材:', head].join('\n');
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
    } catch (err) {
      // 使用者按下「停止」:中止不是錯誤,回專屬碼供 UI 顯示「已停止」而非網路錯誤
      if (err instanceof Error && err.name === 'AbortError') return { ok: false, code: 'aborted' };
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
  role?: Role | null;
  language?: RewriteLanguage;
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
      { role: input.role, language: input.language },
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

/** 自訂指令改寫:使用者自由下指令(無 key 時呼叫端不會走到這裡);文體依文檔類型,含角色/語言維度。 */
export async function rewriteWithInstruction(input: {
  apiKey: string;
  text: string;
  instruction: string;
  limit?: number;
  kind?: DocKind;
  styleSamples?: string[];
  role?: Role | null;
  language?: RewriteLanguage;
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
      { role: input.role, language: input.language },
    ),
    input.signal,
  );
}

/** 管線日誌生成(BYOK):一則日誌條目 → 一篇 Threads 貼文(P2 補糧使用)。 */
export async function generateJournalPost(input: {
  apiKey: string;
  entryTitle?: string;
  entryBody: string;
  styleSamples?: string[];
  limit?: number;
  signal?: AbortSignal;
}): Promise<RewriteResult> {
  return generateContent(
    input.apiKey,
    buildJournalPostPrompt({
      entryTitle: input.entryTitle,
      entryBody: input.entryBody,
      styleSamples: input.styleSamples,
      limit: input.limit,
    }),
    input.signal,
  );
}

// ---- key 存取(僅使用者自己的瀏覽器;與內容資料的 text-message:v2 分開) ----

/**
 * **跨產品契約(2026-10-12 兩庫維護者定案,媒管庫 `docs/IA-PLAN.md` IA-D8)。**
 *
 * 媒管庫(MEDIA-Message)會**唯讀**這把鍵:使用當下才讀、不複製、永不寫入或清除;
 * 介面由使用者自行勾選「使用文管庫已設定的金鑰」並標示來源。這是「不互讀對方
 * 內部鍵」原則(IA-D4)的**唯一明文例外**——金鑰因此仍**不進入** `family:*` 任何契約鍵。
 *
 * 文管庫承諾:**未與媒管庫協調前不改鍵名 `text-message:gemini-key`,也不改
 * 「純字串即金鑰」的格式**(不加 JSON 封裝、不加前綴、不加密)。要改就兩邊同時改。
 * `text-message:gemini-model` 不在契約內,媒管庫不讀,可自由變動。
 *
 * 紅線不變:兩庫同源(`galen-chu.github.io`),金鑰自始至終只在使用者瀏覽器,
 * 不落地後端、不上傳。但共用意味著**兩個產品會花到同一份 Gemini 配額**——
 * UI 文案須誠實說明(見 `GEMINI_KEY_MODAL.familyShareNote`)。OAuth token 與
 * 郵件內容不在此例外範圍:依舊不跨產品流動。
 */
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
