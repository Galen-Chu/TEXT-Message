import type { DocKind, EmailTag, PlatformKey, PlatformMeta } from './types';
import type { GmailErrorCode } from './services/gmail/errors';

/** Gmail 連線錯誤的使用者文案(依 errors.ts 的 code 對應)。 */
export const GMAIL_ERROR_COPY: Record<GmailErrorCode, string> = {
  disabled: '此版本未設定 Gmail 連線',
  gis_load_failed: 'Google 登入服務載入失敗,請確認網路後重試',
  popup_blocked: '無法開啟 Google 登入視窗,請允許彈出視窗後重試',
  access_denied: '已取消授權,未連接 Gmail',
  cancelled: '已取消連接',
  network: '網路連線異常,請稍後再試',
  unauthorized: 'Gmail 授權已過期,請重新連接',
  quota: '暫時達到 Gmail 用量上限,請稍後再試',
  server: 'Gmail 服務暫時無法使用,請稍後再試',
  parse: '郵件資料解析失敗',
  unknown: '發生未預期的錯誤,請重試',
};

/** 連接前提示:測試模式的「未驗證應用」警告是預期行為(對應 SETUP.md §7)。 */
export const CONNECT_UNVERIFIED_HINT =
  '首次連接若出現「未驗證的應用程式」警告,屬測試模式預期:點「進階」→「前往 文管庫(不安全)」即可繼續。';

/** 已連接但收件匣空白時的引導(查詢條件=近 7 天且仍在收件匣)。 */
export const INBOX_EMPTY_CONNECTED = {
  title: '已連接成功,但收件匣沒有近 7 天的郵件',
  desc: '這裡只顯示「近 7 天且仍在收件匣」的信——已封存、垃圾郵件不列入,所以 quiet 的信箱會是空的。',
  action: '用 Gmail 寄一封測試信給自己',
  after: '寄出後等約 30 秒,回來點上方「重新整理」;這封信會被自動分類為「電子報」。',
  subject: '測試電子報:本週精選趨勢觀察',
  body:
    '這是「TEXT-Message」驗收流程產生的測試信。收到後回到網站點「重新整理」,'
    + '這封信應出現在清單中,並帶有「電子報」分類標籤與「✨ AI 建議可發文」。',
};

export const PLATFORM_META: Record<PlatformKey, PlatformMeta> = {
  fb: { key: 'fb', label: 'Facebook', color: '#1877F2', badge: 'f', limit: 63206 },
  ig: { key: 'ig', label: 'Instagram', color: '#C13584', badge: 'IG', limit: 2200 },
  threads: { key: 'threads', label: 'Threads', color: '#101010', badge: '@', limit: 500 },
  line: { key: 'line', label: 'LINE', color: '#06C755', badge: 'L', limit: 1000 },
  yt: { key: 'yt', label: 'YouTube', color: '#FF0000', badge: '▶', limit: 5000 },
};

export const PLATFORM_LIST: PlatformMeta[] = Object.values(PLATFORM_META);

export const INBOX_FILTERS: Array<'全部' | EmailTag> = [
  '全部',
  '電子報',
  '合作邀約',
  '讀者來信',
  '互動通知',
  '活動通知',
];

/** 自媒體頁「最新互動」卡(IA Phase 5 D6 一期:平台互動通知信分類)。 */
export const SOCIAL_NOTIFY_COPY = {
  cardTitle: '📬 最新互動',
  demoNote: '(示範資料)',
  desc: '來自各平台的互動通知信(留言/提及/追蹤)——即時性取決於平台通知設定,回覆請到平台 App',
  empty: '還沒有互動通知——連接 Gmail 後,平台的留言與追蹤通知信會出現在這裡',
  openMail: '查看信件',
};

/** 收件匣唯讀輔助(2026-09-03 C+B 決議):Gmail 標籤篩選與「在 Gmail 建立篩選器」。 */
export const INBOX_GMAIL_COPY = {
  labelRowTitle: 'Gmail 標籤',
  connectedSubtitle: '已串接帳號:{email} · 近 7 天郵件(分類為本機規則建議)',
  autoFileButton: '自動分類',
  autoFileTitle: '在 Gmail 為此寄件者建立篩選器(開新視窗;由 Gmail 套用標籤,本工具僅唯讀)',
  autoFileToast: '已開啟 Gmail——在搜尋框建立篩選器後,此寄件者的信會自動套用你設的標籤',
};

// 文管庫「訊息管理」分類
export const LIBRARY_CATEGORIES = [
  '全部',
  '節慶祝賀',
  '業配/產品促銷',
  '粉絲互動',
  '常見問答',
  '感謝訊息',
];

// 文管庫「文案管理」分類
export const COPY_CATEGORIES = ['全部', '日常分享', '新品/業配', '活動宣傳', '品牌故事'];

export type LibraryMainTab = 'message' | 'copy' | 'draft';

/** 三大類文檔的通用顯示名(文庫徽章、排程徽章、編輯器 chips 共用)。 */
export const DOC_KIND_LABELS = { draft: '草稿', copy: '文案', message: '訊息' } as const;

/** 草稿管理(IA 重整 Phase 2:三大類文檔,D8)的使用者文案。 */
export const DRAFT_LIBRARY_COPY = {
  tabLabel: '草稿管理',
  subtitle: '保存的草稿文檔,依更新時間排序(編輯器選「草稿」文體、按「儲存文體」即存入)',
  emptyTitle: '還沒有保存的草稿',
  emptyDesc: '在編輯器選「草稿」文體、完成內容後按「儲存文體」,內容會保存在這裡',
  openToEditor: '開啟至編輯器',
  copyButton: '複製',
  deleteButton: '刪除',
  deletedToast: '已刪除草稿',
  openedToast: '已開啟草稿至編輯器',
  kindBadge: DOC_KIND_LABELS,
};

/** 定排程類別篩選(IA Phase 4 D10)。「全部」+ 三大類。 */
export const SCHEDULE_KIND_FILTERS: Array<'全部' | DocKind> = ['全部', 'draft', 'copy', 'message'];

/** 雲端列 Drive(docs/DRIVE-PLAN)的使用者文案。 */
export const DRIVE_COPY = {
  title: '雲端列 Drive',
  subtitle: '搜尋 Google Drive 裡自己寫的文章與筆記,引用到編發器作為素材',
  demoNote: '(示範資料)',
  connect: '連接 Google Drive',
  connecting: '連線中…',
  disconnect: '中斷連線',
  connectedHint: '已連線 · 唯讀(token 僅存記憶體,中斷即撤銷;內容不落地)',
  searchPlaceholder: '搜尋文檔名稱…',
  searchButton: '搜尋',
  listAll: '全部列出',
  empty: '沒有找到符合的文檔',
  previewTitle: '文檔預覽',
  referenceButton: '引用到編發器',
  referenceToast: '已引用 Drive 文檔到編發器 ✨',
  copyButton: '複製全文',
  copiedToast: '已複製全文到剪貼簿',
  loading: '載入中…',
  styleMark: '設為風格樣本',
  styleUnmark: '取消風格樣本',
  styleFullToast: (n: number) => `風格樣本上限 ${n} 篇,請先取消其他樣本`,
  styleMarkedToast: '已加入風格樣本 ✨(編發器 AI 生成將參照)',
  styleUnmarkedToast: '已移除風格樣本',
  styleNotConnected: 'Drive 未連線,本次生成不參照風格樣本',
  stylePartialFail: (n: number) => `${n} 篇樣本抓取失敗,本次以其餘樣本生成`,
  styleToggleLabel: (n: number) => `參照我的 Drive 風格(${n} 篇)`,
  styleHint: '開啟後,語氣改寫/自訂指令/平台版本生成會模仿入選文章的行文風格(需連接 Drive)',
  saveAsTemplate: '存為範本',
  saveAsTemplateTitle: '存為範本(選擇類別)',
  savedAsTemplateToast: (label: string) => `已存入文庫 · ${label} ✅`,
};

/** Drive 模組錯誤文案(依 services/drive/errors.ts 的 code 對應)。 */
export const DRIVE_ERROR_COPY: Record<string, string> = {
  disabled: '此版本未設定 Drive 連線',
  gis_load_failed: 'Google 登入服務載入失敗,請確認網路後重試',
  popup_blocked: '無法開啟 Google 登入視窗,請允許彈出視窗後重試',
  access_denied: '已取消授權,未連接 Drive',
  cancelled: '已取消連接',
  network: '網路連線異常,請稍後再試',
  unauthorized: 'Drive 授權已過期,請重新連接',
  quota: '暫時達到 Google 用量上限,請稍後再試',
  server: 'Google 服務暫時無法使用,請稍後再試',
  parse: '文檔資料解析失敗',
  unknown: '發生未預期的錯誤,請重試',
};

/** 編輯器「文檔類型」chip(IA Phase 3 D9):影響 AI 生成文體與「儲存文體」的文庫歸檔。 */
export const DRAFT_KIND_META: Array<{ key: DocKind; label: string }> = [
  { key: 'draft', label: '草稿' },
  { key: 'copy', label: '文案' },
  { key: 'message', label: '訊息' },
];
export const DRAFT_KIND_HINT = '文檔類型——影響 AI 生成的文體與「儲存文體」的文庫歸檔';

/** 「儲存文體」(2026-09-11 B4):依文檔類型歸檔到文庫對應頁簽(沿 saveDriveDocAsTemplate 慣例)。 */
export const DRAFT_SAVE_COPY = {
  saveButton: '儲存文體',
  deleteButton: '刪除內容',
  deletedToast: '已刪除內容',
  needTextToast: '沒有可保存的內容',
  savedToast: {
    draft: '已存入文庫 · 草稿管理 ✅',
    copy: '已存入文庫 · 文案管理 ✅',
    message: '已存入文庫 · 訊息管理 ✅',
  } as Record<DocKind, string>,
  /** 文案/訊息直接存入範本集的預設分類(同 Drive 存為範本 D7)。 */
  defaultCategory: { copy: '日常分享', message: '粉絲互動' } as Record<'copy' | 'message', string>,
};

/** 語氣(2026-09-11 B1 擴充至十種):按鈕列即點即改寫;規則示範為無 key 時的輕量退回。 */
export const TONE_OPTIONS = [
  '專業',
  '親切',
  '活潑',
  '簡短',
  '溫暖',
  '幽默',
  '勵志',
  '敘事',
  '教學',
  '行銷',
] as const;
export type Tone = (typeof TONE_OPTIONS)[number];

// 純前端規則示範(非真實 AI),生產環境應接後端 AI 改寫 API
export const TONE_REWRITES: Record<Tone, (t: string) => string> = {
  專業: (t) => t,
  親切: (t) => (t ? t + '\n\n謝謝你一直以來的陪伴 🌿' : t),
  活潑: (t) => (t ? t.replace(/。/g, '!') + ' ✨' : t),
  簡短: (t) => (t ? t.split('\n')[0] : t),
  溫暖: (t) => (t ? t + '\n\n記得照顧好自己 ☀️' : t),
  幽默: (t) => (t ? t + ' 😆' : t),
  勵志: (t) => (t ? t + '\n\n今天也要繼續前進 💪' : t),
  敘事: (t) => (t ? '話說從頭——\n' + t : t),
  教學: (t) => (t ? '三分鐘看重點:\n' + t : t),
  行銷: (t) => (t ? t + '\n\n👉 立即查看了解更多!' : t),
};

/** 角色(2026-09-11 B2):覆寫 AI 生成的發言身份;未選 = 依文檔類型 persona。 */
export const ROLE_OPTIONS = ['品牌主理人', '行銷小編', '客服人員', '專業講師', '創作者本人'] as const;
export type Role = (typeof ROLE_OPTIONS)[number];

/** 語言(2026-09-11 B3):潤飾/改寫的輸出語言;預設繁體中文。 */
export const LANGUAGE_OPTIONS = [
  '繁體中文',
  '英文',
  '西班牙文',
  '德文',
  '法文',
  '日文',
  '韓文',
  '泰文',
  '台語文',
  '南島語文',
] as const;
export type RewriteLanguage = (typeof LANGUAGE_OPTIONS)[number];

export const WEEKDAY_LABELS = ['週一', '週二', '週三', '週四', '週五', '週六', '週日'];

/** Gemini 語氣改寫(BYOK)的使用者文案。 */
export const GEMINI_ERROR_COPY: Record<string, string> = {
  invalid_key: 'Gemini API key 無效或已停用,請至「AI 設定」檢查',
  quota: 'Gemini 用量達到上限(免費方案有每分鐘/每日請求數限制)——約等 1 分鐘再試;經常發生的話可考慮付費方案',
  server: 'Gemini 模型暫時過載,請稍後再試(已自動換模型重試)',
  network: '網路連線異常,請稍後再試',
  no_content: 'Gemini 沒有回傳改寫內容,請再試一次',
  model_unavailable: '此 key 無法使用任何內建模型候選,請確認 key 已啟用 Generative Language API',
  unknown: '改寫失敗,草稿保持原狀,請再試一次',
};

export const GEMINI_KEY_MODAL = {
  title: 'AI 設定(Gemini API key)',
  desc:
    '輸入你自己的 Google AI Studio API key 後,語氣改寫會改用真實的 Gemini 模型;'
    + '未設定時維持規則示範模式。',
  privacy:
    '🔒 key 只儲存在你目前的瀏覽器(localStorage),僅由你的瀏覽器直接呼叫 Google,'
    + '不會傳給本站或其他任何伺服器。清除後即完全移除。',
  getKeyTip: '還沒有 key?到 Google AI Studio 免費申請:',
  getKeyUrl: 'https://aistudio.google.com/apikey',
  placeholder: '貼上 API key(AI Studio 提供,新舊格式皆可)',
  save: '儲存 key',
  clear: '清除 key',
  savedToast: '已儲存 Gemini API key,語氣改寫升級為真實 AI ✨',
  clearedToast: '已清除 key,回到規則示範模式',
};

export const GEMINI_MODE_LABEL = {
  off: 'AI 語氣輔助改寫(規則示範模式)',
  on: 'AI 語氣改寫(Gemini)',
  busy: 'Gemini 處理中…',
};

/** 草稿頁 AI 相關文案(郵件摘要、自訂指令、超字數提示)。 */
export const DRAFT_AI_COPY = {
  convertFallbackNote: '(已節錄郵件內容,歡迎編輯調整;於「AI 設定」輸入 key 可改用 AI 摘要)',
  convertDoneToast: 'Gemini 已將郵件摘要為草稿 ✨',
  customInstructionLabel: '自訂指令',
  customInstructionPlaceholder: '例如:改寫成 3 行重點、多加 emoji',
  customInstructionApply: '套用',
  customInstructionNeedKey: '自訂指令需要 Gemini key:於「AI 設定」輸入後即可使用',
  customInstructionEmptyDraft: '請先撰寫草稿內容,再套用自訂指令',
  customInstructionEmpty: '請先輸入自訂指令',
  customInstructionDoneToast: 'Gemini 已套用自訂指令 ✨',
  overLimitHint: (limit: number) => `目前內容超過所選平台中最嚴格的上限(${limit} 字),建議啟用 AI 或手動精簡`,
  roleRowLabel: '角色',
  roleDefault: '依文檔預設',
  langRowLabel: '語言',
  roleLangNeedKey: '角色與非中文語言需真實 AI:於「AI 設定」輸入 key 後生效',
  toneDemoToast: (tone: string) => `已套用「${tone}」語氣(規則示範;於「AI 設定」輸入 key 可啟用真實 AI)`,
  toneDemoExtrasToast: (tone: string) => `已套用「${tone}」語氣(規則示範;角色/語言潤飾需於「AI 設定」輸入 key)`,
};

/** 排程即時狀態(含推導的 overdue)的顯示文案與顏色。 */
export const SCHEDULE_STATUS_META: Record<
  'draft' | 'scheduled' | 'overdue' | 'published',
  { label: string; color: string }
> = {
  draft: { label: '草稿排程', color: 'var(--text-faint)' },
  scheduled: { label: '已確認排程', color: 'var(--brand)' },
  overdue: { label: '逾期未發佈', color: '#E74C3C' },
  published: { label: '✓ 已發佈', color: '#06C755' },
};

/** 排程管理與發佈輔助的使用者文案。 */
export const SCHEDULE_COPY = {
  overdueBanner: (n: number) => `⚠ 有 ${n} 筆排程已逾期未發佈`,
  overdueBannerAction: '查看逾期排程',
  copyAction: '複製',
  openAction: '前往發佈',
  publishAction: '標記已發佈',
  editAction: '編輯',
  deleteAction: '刪除',
  contentLabel: '貼文內容(選填,供複製與預填)',
  contentPlaceholder: '輸入完整貼文內容,排程後可一鍵複製或帶入平台',
  editModalTitle: '編輯排程',
  newModalTitle: '手動新增排程',
  emptyTitleToast: '請輸入貼文標題',
  addedToast: '已新增排程',
  updatedToast: '已更新排程',
  deletedToast: '已刪除排程',
  copyDoneToast: '已複製貼文內容',
  copyFailToast: '複製失敗,請手動選取複製',
  openPrefillToast: (label: string) => `已開啟 ${label} 並預填文字,送出前請檢查`,
  openPasteToast: (label: string) => `已複製內容並開啟 ${label},貼上後即可發佈`,
  publishedToast: '已標記發佈,寫入社群媒體歷史 ✅',
};

/** 文管庫深化(第一期:範本填值、存為範本、使用統計)的使用者文案。 */
export const LIBRARY_COPY = {
  fillTitle: '填寫範本變數',
  fillDesc: (n: number) => `此範本包含 ${n} 個 {{變數}},填寫後套用;留空的變數會保留原樣,之後可在編發器補上`,
  fillPlaceholder: (name: string) => `輸入 ${name} 的內容`,
  fillPreview: '預覽',
  fillSkip: '略過,直接用原文',
  fillApply: '填完套用到編發器',
  fillCopy: '填完複製',
  copiedFilledToast: '已複製到剪貼簿(變數已填入)',
  copyFailToast: '複製失敗,請手動選取複製',
  saveAsTemplate: '存為範本',
  saveAsTemplateTitle: '存為文案範本',
  saveAsTemplateCategory: '分類(文案管理)',
  saveAsTemplateContentLabel: '範本內容(來自發文記錄,可稍後編輯)',
  savedToast: '已存入文庫 · 文案管理 ✅',
  titleRequiredToast: '請輸入標題',
  sortDefault: '預設',
  sortMostUsed: '最常用',
  sortRecent: '最近使用',
  usedCount: (n: number) => `已用 ${n} 次`,
  lastUsedAt: (d: string) => `最近 ${d}`,
  variantSectionLabel: '平台版本(選填)',
  variantSectionHint: '為特定平台撰寫專屬版本;留空 = 套用時使用上方通用內容',
  variantPicker: (label: string) => `${label} 版`,
  variantPickerGeneric: '通用版',
  variantClear: '清除本平台版本',
  variantClearedToast: '已清除該平台版本',
  copyVariantTitle: '選擇要複製的版本',
  hasVariantBadge: '含平台版本',
};

/** 發文趨勢(文管庫深化第三期)的使用者文案;資料僅計真實記錄。 */
export const TRENDS_COPY = {
  title: '📈 發文趨勢',
  note: '僅計真實記錄(標記已發佈/YouTube 上傳),不含示範資料',
  accumulating: (n: number, threshold: number) =>
    `累積發文記錄中(${n}/${threshold})——在排程頁「標記已發佈」後,這裡會出現你的發文趨勢`,
  period30: '近 30 天',
  period90: '近 90 天',
  platformCountsTitle: '各平台發文數',
  hourTitle: '發文時段分佈',
  hourLabels: ['清晨 0–6', '上午 6–12', '下午 12–18', '晚間 18–24'],
  streakLabel: '連續發文',
  longestLabel: '最長紀錄',
  daysUnit: (n: number) => `${n} 天`,
  dayMixTitle: '發文日形態',
  singleDay: '單平台日',
  multiDay: '跨平台日',
  daysUnitPlain: '天',
  postsUnit: '則',
  totalLabel: (n: number) => `共 ${n} 則`,
  dashboardTitle: '發文趨勢(近 30 天)',
};

/** Threads 平台發佈(階段三前端串接:Cloudflare Workers 後端輔助)的使用者文案。 */
export const BACKEND_COPY = {
  cardTitle: '🧵 Threads 發佈(後端輔助)',
  cardDesc: '由你的後端 worker 代為發佈;只送貼文內容與安裝識別碼,不送其他資料',
  checking: '檢查連線中…',
  connect: '連接 Threads',
  connectHint: '開啟新分頁完成 Meta 授權,完成後會自動返回此頁',
  refreshStatus: '檢查連線',
  connectedHint: '已連線(worker 保管加密 token,可隨時重新授權取代)',
  publishNow: '立即發佈',
  publishingLabel: '發佈中…',
  scheduleLabel: '排程發佈(由後端 cron 到點自動發佈)',
  scheduleAtLabel: '排定時間',
  schedulePublish: '排程發佈',
  schedulingLabel: '加入排程中…',
  needTextToast: '請先撰寫草稿內容',
  pastTimeToast: '排定時間已過,請選擇未來時間',
  publishedToast: '已發佈至 Threads ✅(已記錄至社群媒體歷史)',
  scheduledToast: '已加入雲端佇列,後端會在排定時間自動發佈(本地同步建立排程)',
  queueTitle: '🧵 Threads 雲端佇列',
  queueEmpty: '雲端佇列沒有項目',
  queueRefresh: '重新載入',
  queueCancel: '取消',
  cancelledToast: '已取消雲端排程',
  connectedQueryParam: 'threads',
  connectedBackToast: 'Threads 連接成功 ✨',
  connectErrorToast: 'Threads 授權未完成,可重新再試',
};

/** 後端輔助錯誤文案(依 services/backend/client.ts 的 code 對應)。 */
export const BACKEND_ERROR_COPY: Record<string, string> = {
  network: '無法連上後端 worker,請確認網址或稍後再試',
  not_connected: '尚未連接 Threads,請先完成授權',
  invalid_text: '貼文內容無效(空白或超過 Threads 500 字上限)',
  invalid_publish_at: '排定時間無效,請選擇未來時間',
  invalid_install_id: '安裝識別碼無效,請重新整理頁面',
  not_found: '找不到該項目(可能已發佈或移除)',
  not_pending: '該項目已處理,無法取消',
  forbidden_origin: '後端未允許此網站來源(檢查 worker 的 FRONTEND_URL 設定)',
  publish_failed: '後端發佈失敗,請稍後再試或檢查 worker 日誌',
  unknown: '後端服務異常,請稍後再試',
};

/** 草稿頁 AI 產出輔助(文管庫深化第四期:平台變體生成與 hashtag 建議,BYOK)。 */
export const DRAFT_VARIANTS_COPY = {
  variantsButton: '✨ 產生平台版本',
  variantsTitle: '✨ 平台版本(可編輯後使用)',
  variantsHint: '由 Gemini 依各平台特性改寫,可先編輯再附加到草稿或存為範本(含平台版本)',
  variantsEmptyDraftToast: '請先撰寫草稿內容',
  variantsNoPlatformToast: '請先勾選至少一個發布平台',
  variantsNeedKeyToast: '產生平台版本需要 Gemini key:於「AI 設定」輸入後即可使用',
  variantsDoneToast: 'Gemini 已產生平台版本 ✨(可編輯後附加或存為範本)',
  variantsAppend: '附加到草稿',
  variantsSave: '存為範本',
  variantsClose: '關閉',
  variantsAppendedToast: '已附加平台版本到草稿',
  variantsSaveTitle: '存為範本(含平台版本)',
  variantsSaveCategory: '分類(文案管理)',
  variantsSavedToast: '已存入文庫 · 文案管理(含平台版本)✅',
  hashtagsButton: '#️⃣ 建議標籤',
  hashtagsDoneToast: '已產生標籤建議,點擊標籤即可加入草稿',
  hashtagsNeedKeyToast: '建議標籤需要 Gemini key:於「AI 設定」輸入後即可使用',
  hashtagsAddAll: '全部加入',
  hashtagAppendedToast: '已加入草稿',
};

/** YouTube 上傳(階段二:零後端,沿用瀏覽器端 Google OAuth)的使用者文案。 */
export const YOUTUBE_COPY = {
  cardTitle: '🎬 YouTube 上傳',
  cardDesc: '選擇影片/Shorts 檔案,以草稿內容作為影片標題與說明上傳',
  connect: '連接 YouTube 帳號',
  connecting: '連接中…',
  connectedHint: '已連線(僅申請上傳權限;token 僅存記憶體,中斷連線即撤銷)',
  disconnect: '中斷連線',
  pickFile: '選擇影片檔案',
  fileSize: (mb: string) => `${mb} MB`,
  publishNowLabel: '立即公開',
  publishScheduleLabel: '預約發佈',
  publishAtLabel: '排定公開時間(YouTube 將於此時間自動設為公開)',
  upload: '上傳到 YouTube',
  uploading: (pct: number) => `上傳中 ${pct}%…`,
  uploadedToast: '已上傳至 YouTube 並公開 ✅(已記錄至社群媒體歷史)',
  scheduledToast: '已上傳,YouTube 將於排定時間自動公開(已加入排程,屆時可標記已發佈)',
  noFileToast: '請先選擇影片檔案',
  noTextToast: '請先撰寫草稿內容(將作為影片標題與說明)',
  pastTimeToast: '排定時間已過,請選擇未來時間',
  auditCaveat:
    '注意:Google API 專案完成 YouTube 稽核前,上傳的影片會被鎖定為私人(可至 YouTube 手動改為公開);測試模式/自架說明見 docs/SETUP.md',
};

/** YouTube 模組錯誤的使用者文案(依 services/youtube/errors.ts 的 code 對應)。 */
export const YOUTUBE_ERROR_COPY: Record<string, string> = {
  disabled: '此版本未設定 YouTube 連線',
  gis_load_failed: 'Google 登入服務載入失敗,請確認網路後重試',
  popup_blocked: '無法開啟 Google 登入視窗,請允許彈出視窗後重試',
  access_denied: '已取消授權,未連接 YouTube',
  cancelled: '已取消連接',
  network: '網路連線異常,請稍後再試',
  unauthorized: 'YouTube 授權已過期,請重新連接',
  quota: '暫時達到 YouTube API 用量上限(每日上傳配額),請稍後再試',
  forbidden: 'YouTube API 拒絕請求(專案可能未啟用 YouTube Data API,見 SETUP.md)',
  invalid_request: '上傳參數無效,請檢查影片檔案與排定時間',
  server: 'YouTube 服務暫時無法使用,請稍後再試',
  parse: 'YouTube 回應解析失敗',
  unknown: '發生未預期的錯誤,請重試',
};
