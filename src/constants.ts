import type { DiarySectionKey, DocKind, EmailTag, NoteKind, PlatformKey, PlatformMeta } from './types';
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
  linkedin: { key: 'linkedin', label: 'LinkedIn', color: '#0A66C2', badge: 'in', limit: 3000 },
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

/**
 * 自媒體頁「平台帳號」卡(2026-11-02 UIUX 批)。
 *
 * 動機:連接平台帳號原本只在編發器的發佈卡裡,等於「要先進編發器才能把自媒體頁串起來」。
 * 連接屬於帳號管理、發佈屬於撰稿,操作點放在自媒體頁才合單頁流程。
 *
 * 刻意只放卡層級文案:各平台的「連接按鈕字樣/已連線說明/授權提示」一律沿用
 * BACKEND_COPY / BACKEND_FB_COPY / BACKEND_LINKEDIN_COPY / YOUTUBE_COPY——
 * 同一句話不得有兩份,否則編發器與自媒體顯示的連線說明會漂移。
 */
export const ACCOUNTS_COPY = {
  cardTitle: '🔗 平台帳號',
  cardDesc: '連接或重新連接各平台;與編發器共用同一組連線狀態,任一處連接後兩邊同步生效',
  statusConnected: '已連線',
  statusDisconnected: '未連線',
  statusUnknown: '檢查中',
  statusError: '連線異常',
  statusSemiAuto: '半自動',
  reconnect: '重新連接',
  semiAutoNote: '未設定後端,此平台維持半自動發佈(在編發器一鍵複製內容並開啟平台)',
  notes: [
    '連接會開新分頁完成平台授權,完成後自動回到本頁',
    'Threads / Facebook / LinkedIn 的 token 由你自己的 worker 加密保管;YouTube token 只存在這個分頁的記憶體,關閉分頁即失效',
    '郵件匣 Gmail 與雲端列 Drive 的連線各自留在它們的頁籤——資料邊界不同(兩者皆唯讀且內容不落地),刻意不收進這張卡',
  ],
};

/** 自媒體頁「最新互動」卡(IA Phase 5 D6 一期:平台互動通知信分類)。 */
export const SOCIAL_NOTIFY_COPY = {
  cardTitle: '📬 最新互動',
  demoNote: '(示範資料)',
  desc: '來自各平台的互動通知信(留言/提及/追蹤)——即時性取決於平台通知設定,回覆請到平台 App',
  empty: '還沒有互動通知——連接 Gmail 後,平台的留言與追蹤通知信會出現在這裡',
  openMail: '查看信件',
};

/**
 * Threads 互動唯讀代讀(2026-10-14,NOTIFY-PLAN 方案 A 改版:即時唯讀代讀、零儲存)。
 * 文案必須撐住三件誠實標示:①只掃最近幾篇貼文,不是全部;②按下才讀,不是背景同步;
 * ③互動內容不經儲存(後端不留、本機只留一個「最後查看時間」)。
 */
export const THREADS_INTERACTIONS_COPY = {
  cardTitle: '💬 Threads 留言',
  desc: '讀取你最近貼文下的留言(按下才讀,內容不經儲存;回覆請到 Threads)',
  refresh: '重新整理',
  refreshing: '讀取中…',
  markSeen: '標記為已讀',
  unseenLabel: (n: number) => `${n} 筆新留言`,
  scannedNote: (n: number) => `已掃描最近 ${n} 篇貼文`,
  notLoaded: '按「重新整理」讀取最近的留言',
  empty: '最近的貼文下還沒有別人的留言',
  notConnected: '連接 Threads 後可讀取留言',
  openReply: '到 Threads 回覆',
  /** 缺 threads_read_replies:舊 token 沒有這個權限,必須重新授權一次。 */
  scopeRequired:
    '需要重新連接 Threads:讀取留言是新增的唯讀權限,先前的授權沒有包含它(重新連接後即可)',
  reconnect: '重新連接 Threads',
  readFailed: '讀取失敗,稍後再試',
  anonymous: '(未知帳號)',
  noText: '(無文字內容)',
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

/** 自動發文管線 P1 骨架(PIPELINE-PLAN 架構 1,2026-10-15)。 */
export const PIPELINE_COPY = {
  cardTitle: '⚙️ 自動發文管線',
  desc: '每天固定時間自動排程發文——從明天起預排數天,內容來源可選文庫範本輪替或 Drive 日誌 + AI 生成',
  enable: '啟用管線',
  enableHint: '啟用後每次開站自動補糧(冪等:已排的日期不重排)',
  timeLabel: '每天發佈時間(本機時區)',
  horizonLabel: '一次預排天數',
  horizonUnit: '天',
  statusQueued: (d: string) => `已排到 ${d || '(未排)'}`,
  statusRemaining: (n: number) => `存量 ${n} 天`,
  lowWater: '⚠ 管線存量不足 3 天——開站會自動補糧,或按「立即補糧」',
  notConnected: '需先連接 Threads(排程走雲端佇列)',
  backendOff: '後端未設定,管線不作用(僅設定可改)',
  fillNow: '立即補糧',
  filling: '補糧中…',
  fillDoneToast: (n: number, d: string) => `自動管線已排 ${n} 天(至 ${d})`,
  fillSkippedToast: '管線存量充足,無須補糧',
  fillFailedToast: '補糧失敗(佇列寫入未成功),稍後再試',
  fillNoPoolToast: '文庫沒有可用範本——先在文庫新增內容或換分類',
  // P2(journal-ai 來源)文案
  sourceLabel: '內容來源',
  sourceTemplates: '文庫範本輪替',
  sourceJournal: 'Drive 日誌 + AI 生成',
  journalPickerLabel: '夢境靈感日誌(Drive 文檔)',
  journalPickerButton: '選擇日誌文檔…',
  journalNone: '尚未選擇',
  journalChanged: '更換',
  journalDriveOff: '需連接 Drive 才能選擇日誌文檔(補糧前也要連)',
  needKeyToast: '日誌生成需要 Gemini key:於「AI 設定」輸入後即可使用',
  needJournalToast: '請先選擇夢境靈感日誌文檔(管線卡內選擇)',
  driveReadFailedToast: '讀取日誌文檔失敗——確認 Drive 已連線後重試',
  journalFormatToast: '日誌裡找不到任何日期行——格式為「一行只有日期」開頭一則,例:2026-10-14(下一行起寫內容)',
  journalEmptyToast: '日誌素材已全部用過——補糧停止(在日誌 Doc 寫新條目即可恢復)',
  todayDateButton: '📋 複製今日日期行',
  todayDateToast: '已複製日期行,貼到日誌 Doc 開頭即可開新條目',
  honestyTitle: '誠實說明',
  honesty1: '每次開站補糧前需連接 Drive(token 僅記憶體的紅線必然結果)',
  honesty2: '日誌原文只在生成當下匯出、用完即棄,絕不落地;本機只保留已用日期',
  honesty3: 'AI 生成的貼文會在 Dashboard「明天要發什麼」顯示——首批建議逐篇看過',
  dashboardTitle: '📅 明天要發什麼',
  dashboardNone: '明天沒有自動排程(管線未啟用或尚未補糧)',
  dashboardPreview: 'Threads · 自動排程',
};

/** 雲端列 Drive(docs/DRIVE-PLAN)的使用者文案。 */
export const DRIVE_COPY = {
  title: '雲端列 Drive',
  subtitle: '搜尋 Google Drive 裡自己寫的文章與筆記,引用到編發器作為素材;可標記風格樣本讓 AI 生成模仿你的行文,或把文檔存為文庫範本',
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
  aborted: '已停止 AI 處理,草稿維持原狀',
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
  /**
   * 家族共用的誠實標示(L3 / IA-D8,2026-10-12)。媒管庫與本站同源,會唯讀同一把
   * key(使用當下才讀、不複製、不寫入也不清除)。金鑰仍只在你的瀏覽器,但兩個
   * 產品會花到同一份配額——必須說清楚,不能讓使用者在別處才發現。
   */
  familyShareNote:
    '👨‍👩‍👧 這把 key 由文管庫與媒管庫共用(兩站同源,金鑰仍只在你的瀏覽器、不經任何伺服器)。'
    + '媒管庫只會在你勾選「使用文管庫已設定的金鑰」時唯讀取用,不會寫入或清除它;'
    + '共用代表兩個產品花的是同一份 Gemini 配額。在這裡清除後,媒管庫也就讀不到了。',
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
  stopButton: '⏹ 停止',
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
  queueTitle: '☁️ 雲端發佈佇列',
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

/** FB 粉專發佈卡(2026-09-30;鏡像 Threads 卡,同 worker 後端輔助)。 */
export const BACKEND_FB_COPY = {
  cardTitle: '📘 Facebook 粉專發佈(後端輔助)',
  cardDesc: '由你的後端 worker 代為發佈至粉專;只送貼文內容與安裝識別碼,不送其他資料',
  connect: '連接 Facebook 粉專',
  connectHint: '開啟新分頁完成 Meta 授權(需要粉專管理權限),完成後會自動返回此頁',
  refreshStatus: '檢查連線',
  connectedHint: (name: string | null) =>
    name
      ? `已連線 · 粉專「${name}」(worker 保管加密 page token,可隨時重新授權取代)`
      : '已連線(系統工作人員模式:token 由 worker secret 保管,撤銷請至商業組合後台)',
  publishNow: '立即發佈',
  publishingLabel: '發佈中…',
  scheduleLabel: '排程發佈(由後端 cron 到點自動發佈)',
  scheduleAtLabel: '排定時間',
  schedulePublish: '排程發佈',
  schedulingLabel: '加入排程中…',
  needTextToast: '請先撰寫草稿內容',
  pastTimeToast: '排定時間已過,請選擇未來時間',
  publishedToast: '已發佈至 Facebook 粉專 ✅(已記錄至社群媒體歷史)',
  scheduledToast: '已加入雲端佇列,後端會在排定時間自動發佈(本地同步建立排程)',
  connectedQueryParam: 'facebook',
  connectedBackToast: 'Facebook 連接成功 ✨',
  connectErrorToast: 'Facebook 授權未完成(帳號需具粉專管理權限),可重新再試',
};

/** FB 卡專屬錯誤文案(覆寫平台相關者,其餘沿用 BACKEND_ERROR_COPY)。 */
export const BACKEND_FB_ERROR_COPY: Record<string, string> = {
  not_connected: '尚未連接 Facebook 粉專,請先完成授權',
  invalid_text: '貼文內容無效(空白或超過 Facebook 上限)',
};

/** LinkedIn 發佈卡(2026-10-07;鏡像 Threads 卡,個人檔案文字貼文)。 */
export const BACKEND_LINKEDIN_COPY = {
  cardDesc: '由你的後端 worker 代為發佈至你的 LinkedIn 個人檔案;只送貼文內容與安裝識別碼,不送其他資料',
  connect: '連接 LinkedIn',
  connectHint: '開啟新分頁完成 LinkedIn 授權(需要以你的帳號登入),完成後會自動返回此頁',
  refreshStatus: '檢查連線',
  connectedHint: (name: string | null) =>
    name
      ? `已連線 · ${name}(worker 保管加密 token,可隨時重新授權取代)`
      : '已連線(worker 保管加密 token,可隨時重新授權取代)',
  publishNow: '立即發佈',
  publishingLabel: '發佈中…',
  scheduleLabel: '排程發佈(由後端 cron 到點自動發佈)',
  scheduleAtLabel: '排定時間',
  schedulePublish: '排程發佈',
  schedulingLabel: '加入排程中…',
  needTextToast: '請先撰寫草稿內容',
  pastTimeToast: '排定時間已過,請選擇未來時間',
  publishedToast: '已發佈至 LinkedIn ✅(已記錄至社群媒體歷史)',
  scheduledToast: '已加入雲端佇列,後端會在排定時間自動發佈(本地同步建立排程)',
  connectedBackToast: 'LinkedIn 連接成功 ✨',
  connectErrorToast: 'LinkedIn 授權未完成,可重新再試',
};

/** LinkedIn 卡專屬錯誤文案(覆寫平台相關者,其餘沿用 BACKEND_ERROR_COPY)。 */
export const BACKEND_LINKEDIN_ERROR_COPY: Record<string, string> = {
  not_connected: '尚未連接 LinkedIn,請先完成授權',
  invalid_text: '貼文內容無效(空白或超過 LinkedIn 3000 字上限)',
};

/** 發佈卡(D14,2026-10-03):單卡+平台頁簽;連接/發佈依平台,半自動平台提供複製+深連結。 */
export const PUBLISH_CARD_COPY = {
  cardTitle: '🚀 發佈',
  noPlatformHint: '勾選上方「選擇發布平台」,這裡會出現各平台的發佈頁簽',
  emptyTextToast: '請先撰寫草稿內容',
  semiAutoHint: '此平台為半自動:一鍵複製內容並開啟平台,貼上後即可發佈',
  youtubeDisabledHint: '此版本未設定 YouTube 連線(設定方式見 docs/SETUP.md)',
};

/**
 * 本機儲存狀態提示(2026-10-09)。localStorage 配額用盡時整個 `text-message:v2`
 * 區塊寫入會失敗——包含 publishedHistory 這類真實記錄,故必須明確告知使用者,
 * 不可靜默吞掉。每個 session 只提示一次,避免每次變更都彈。
 *
 * 文案不指定佔用方(2026-10-12):文管庫與媒管庫同為 galen-chu.github.io
 * (origin 只看 scheme+host+port,路徑不計),約 5MB 配額兩庫共吃,佔滿的可能是
 * 對方的資料——叫使用者刪文庫內容會是錯的指引。兩產品的提示一致不斷言來源。
 */
export const STORAGE_COPY = {
  quotaExceededToast: '⚠️ 瀏覽器儲存空間已滿,這次變更沒能存進這台裝置——建議先備份至 Cloudflare worker,再清理本機資料後重試',
};

/**
 * 家族串接(U2–U4,2026-10-12)。文管庫 ↔ 媒管庫:側欄常駐切換 + 文庫 Library
 * 深層串接(交接文案、互看近期排程)。契約與分期見 `services/family/config.ts`
 * 與媒管庫 `docs/IA-PLAN.md` §1 IA-D7/§3.2——兩邊位置與文案須一致。
 */
export const FAMILY_COPY = {
  /** U2:側欄左下識別塊的常駐切換連結(兩產品同位置、同樣式)。 */
  switchLink: '媒管庫 ↗',
  switchTitle: '前往媒管庫(圖片/影片發佈)',

  cardTitle: '👨‍👩‍👧 家族串接',
  cardDesc: '媒管庫負責圖片與影片發佈;這裡可以把文案送過去當說明,也能看到彼此的近期排程',
  openPeerButton: '開啟媒管庫 ↗',

  /** U3:交接。 */
  sendButton: '送至媒管庫',
  sendTitle: '把這段文案送到媒管庫的媒庫收件匣,當作圖片/影片的說明',
  sentToast: (n: number) => `已送至媒管庫(收件匣待取用 ${n} 筆)✅`,
  sendEmptyToast: '內容是空的,沒有東西可以送',
  sendFailToast: '送出失敗:瀏覽器儲存空間不足或不可用',
  pendingLabel: (n: number) => `已送出、媒管庫尚未取用:${n} 筆`,
  pendingNone: '目前沒有待取用的交接',
  pendingHint: '在媒管庫的「媒庫 Library」取用;超過 7 天未取用會自動失效',

  /** U4:對方的排程摘要。 */
  peerFeedTitle: '媒管庫近期排程',
  peerFeedAsOf: (d: string) => `資料截至 ${d}`,
  peerFeedEmpty: '媒管庫目前沒有待發的排程',
  /** 對方從未發佈摘要、或摘要超過 7 天陳舊時顯示(整區不顯示排程內容)。 */
  peerFeedUnavailable: '還沒收到媒管庫的排程摘要(開啟過媒管庫後就會出現)',
};

/**
 * 文庫雲端備份(方案 A,2026-10-05):同步碼身分、瀏覽器端加密、worker 只存密文。
 * 2026-11-02 標題改「Cloudflare worker 備份」並在描述點明與 Google Drive 無關——
 * 原標題與「雲端列 Drive」頁籤撞名,造成實際混淆(維護者誤以為備份功能在雲端列)。
 * 備份範圍=全部本地內容(見 payload.ts),文案列全,不用「文庫與日記」這種局部列舉。
 */
export const LIBRARY_BACKUP_COPY = {
  cardTitle: 'Cloudflare worker 備份',
  cardDesc:
    '以同步碼加密你的全部本地內容(文庫範本、排程、發佈記錄、草稿、日記、便條)存至你自架的 Cloudflare worker——與 Google Drive 無關;金鑰只在你的瀏覽器衍生,worker 僅保管密文,換瀏覽器可用同一組同步碼還原。emails 與 AI key 永不備份',
  codeLabel: '同步碼',
  codePlaceholder: '自訂 8–64 字(遺失即無法還原,請妥善保管)',
  backupButton: '備份至 Cloudflare worker',
  backingUpLabel: '備份中…',
  backedUpToast: (d: string) => `已備份至 Cloudflare worker(${d})✅`,
  restoreButton: '從 Cloudflare worker 還原',
  restoringLabel: '還原中…',
  confirmTitle: '從 Cloudflare worker 還原',
  /**
   * 還原確認文案:誠實標示備份含哪些獨立鍵內容(日記=篇、便條=張、管線設定=有無)。
   * count 為 null / hasPipeline 為 false = 舊備份沒有該欄位 → 還原時不動本機該類資料
   * (見 restoreLibraryApply)。管線設定一併標示「啟用狀態不隨備份」(2026-11-02 折衷)。
   */
  confirmDesc: (d: string, diaryCount: number | null, noteCount: number | null, hasPipeline: boolean) => {
    const has: string[] = [];
    if (diaryCount !== null) has.push(`日記(${diaryCount} 篇)`);
    if (noteCount !== null) has.push(`便條(${noteCount} 張)`);
    if (hasPipeline) has.push('自動發文管線設定(啟用狀態不隨備份,維持本機現況)');
    const missing: string[] = [];
    if (diaryCount === null) missing.push('日記');
    if (noteCount === null) missing.push('便條');
    if (!hasPipeline) missing.push('管線設定');
    /** 兩項以上用「A、B 與 C」;單項直接接。 */
    const joinZh = (arr: string[]) => (arr.length <= 1 ? arr.join('') : `${arr.slice(0, -1).join('、')}與${arr[arr.length - 1]}`);
    const hasPart = has.length ? `與${has.join('、')}` : '';
    const missingPart = missing.length
      ? `此備份較舊、不含${joinZh(missing)},本機${joinZh(missing)}保持不變。`
      : '';
    return `Cloudflare worker 備份時間:${d}。還原會以其內容覆蓋本機全部內容(範本/排程/發佈記錄/草稿)${hasPart}。${missingPart}確認嗎?`;
  },
  confirmApply: '覆蓋本機並還原',
  restoredToast: '已從 Cloudflare worker 還原 ✅',
  emptyCodeToast: '請先輸入同步碼(8–64 字)',
  notFoundToast: 'Cloudflare worker 上沒有這組同步碼的備份',
  wrongCodeToast: '同步碼不正確或備份已損毀,無法解密',
  badPayloadToast: '備份內容格式不符,取消還原',
  failToast: '備份/還原失敗,請稍後再試',
  autoSyncOn: '已啟用自動同步',
  autoSyncHint: '內容變更後約 30 秒自動備份;開啟網站時也會自動同步一次',
  neverSynced: '尚未同步',
  lastSyncedLabel: (d: string) => `上次同步:${d}`,
  backupNowButton: '立即備份',
  disableButton: '停用自動同步',
  disabledToast: '已停用自動同步(同步碼已清除)',
  cloudNewerHint: (d: string) => `Cloudflare worker 有較新的備份(${d})——本機內容較舊`,
  keepLocalButton: '以此機覆蓋備份',
};

/**
 * 文管 Dashboard 的備份狀態小卡(2026-11-02):只顯示狀態與入口,操作仍在文庫頁的
 * 備份卡——單一操作點避免兩處狀態不同步。未啟用時提示內容只在本機,已啟用時顯示
 * 上次備份時間。僅 BACKEND_ENABLED 顯示(與文庫備份卡同一閘門)。
 */
export const BACKUP_STATUS_COPY = {
  cardTitle: 'Cloudflare worker 備份',
  enabledHint: '已啟用自動同步',
  lastBackupLabel: (d: string) => `上次備份:${d}`,
  neverBackup: '尚未備份過',
  offDesc:
    '範本、排程、草稿、日記與便條目前只存在這台瀏覽器——設定同步碼後即加密備份,換瀏覽器可還原',
  goButton: '前往文庫設定',
  manageButton: '管理備份',
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

/**
 * 貼便條(POST-PLAN,2026-11-01):小筆記/好文章/靈感的落點,純前端、零後端;
 * 內容隨文庫雲端備份(D2)。與日記的分工:日記=按日期寫的長文(100–500 字、
 * 管線素材),便條=隨手貼的短素材(無長度門檻、可帶連結與標籤)。
 */
export const NOTE_KIND_OPTIONS: Array<{ key: NoteKind; label: string; hint: string }> = [
  { key: 'note', label: '📝 筆記', hint: '自己寫下的重點、備忘' },
  { key: 'article', label: '🔗 好文章', hint: '外部來源,建議附上連結' },
  { key: 'idea', label: '💡 靈感', hint: '可長成貼文的種子' },
];

export const NOTE_BODY_MAX = 2000;
export const NOTES_PAGE_SIZE = 20;

export const NOTES_COPY = {
  pageTitle: '貼便條 Post',
  pageDesc: '小筆記、好文章、靈感隨手貼在這裡——內容隨 Cloudflare worker 備份加密保存;可搜尋篩選後一鍵套用到編發器',
  composeTitle: '新增便條',
  kindLabel: '類型',
  titleLabel: '標題(選填)',
  urlLabel: '連結(選填)',
  urlPlaceholder: 'https://',
  bodyLabel: '內容',
  bodyPlaceholder: '貼上或寫下想留著的東西',
  tagsLabel: '標籤(選填)',
  tagsPlaceholder: '以逗號或空白分隔,例:寫作 靈感',
  bodyCountLabel: (n: number) => `字數 ${n}/${NOTE_BODY_MAX}`,
  saveButton: '貼上便條',
  searchPlaceholder: '搜尋便條(標題、內容、連結或標籤)',
  countLabel: (n: number) => `共 ${n} 張`,
  loadMoreButton: (n: number) => `載入更多(還有 ${n} 張)`,
  filterAll: '全部',
  tagFilterAll: '所有標籤',
  emptyTitle: '還沒有便條',
  emptyDesc: '看到好文章、想到一句話,先貼上來再說',
  emptyFiltered: '找不到符合的便條',
  emptyFilteredDesc: '換個關鍵字或類型試試',
  openLink: '開啟連結 ↗',
  applyButton: '套用到編發器',
  appliedToast: '已套用便條到草稿 ✨',
  copyButton: '複製內容',
  copiedToast: '便條內容已複製 📋',
  editButton: '編輯',
  deleteButton: '刪除',
  saveChangesButton: '儲存變更',
  cancelButton: '取消',
  deleteModalTitle: '刪除這張便條?',
  deleteModalDesc: '刪除後無法復原。',
  deleteConfirmButton: '刪除便條',
  savedToast: '便條已貼上 📌',
  updatedToast: '便條已更新',
  deletedToast: '便條已刪除',
  emptyBodyToast: '內容是空的,寫點什麼再貼上吧',
};

/**
 * 便條匯出到 Obsidian vault(POST-PLAN P3,2026-11-12)。落點=**Obsidian_Library**
 * 的**頂層 `notes/`**(2026-11-12 維護者拍板——兩 vault 實況均為私人,Library 為原始
 * 意願;刻意不在 raw/ 之下,避開 compile.py 的掃描,私密便條不進編譯管線——見
 * Library CLAUDE.md 的 notes/ 子樹章節)。誠實標示沿用日記的框架(見 DIARY_EXPORT_COPY)。
 */
export const NOTES_EXPORT_COPY = {
  cardTitle: '📤 匯出到 Obsidian',
  cardDesc: '把便條寫進你的 Obsidian_Library(notes/ 資料夾,一張一檔),資料不離開這台電腦',
  stepFolderLabel: '① vault 資料夾(挑 Obsidian_Library 根目錄)',
  pickButton: '選擇 vault 資料夾',
  repickButton: '重新選擇資料夾',
  folderLabel: (name: string) => `資料夾:${name}`,
  needPickHint: '每次重開網頁都要再選一次資料夾(網頁無法長期保留資料夾權限)',
  stepExportLabel: '② 匯出範圍與執行',
  exportButton: '匯出便條',
  exportingButton: '匯出中…',
  lastExportLabel: (when: string) => `上次匯出:${when}`,
  neverExported: '還沒匯出過',
  pendingLabel: (n: number) => (n === 0 ? '沒有需要更新的便條' : `有 ${n} 張需要寫入`),
  notes: [
    '單向寫入:只建立/更新便條檔裡 text-message:note 標記的區塊,你在 Obsidian 手寫的內容不會被動到',
    '在 app 刪掉的便條不會從 vault 移除——匯出檔是當下的凍結副本',
    '便條改標題會以新檔名寫新檔,舊檔留在原地(凍結)',
    '放在 notes/(不在 raw/ 之下)——Library 的編譯管線不會讀到便條',
  ],
  nothingToast: '這個範圍內沒有需要更新的便條',
  doneToast: (n: number) => `已寫入 ${n} 張便條到 vault ✅`,
  partialToast: (ok: number, failed: number) => `寫入 ${ok} 張,有 ${failed} 張失敗`,
  cancelledToast: '已取消選擇資料夾',
  pickedToast: (name: string) => `已選擇「${name}」,可以開始匯出`,
  downloadedToast: '已下載彙整檔',
  downloadButton: '下載彙整 markdown',
  unsupportedTitle: '這個瀏覽器不支援直接寫入資料夾',
  unsupportedDesc: 'Chrome 或 Edge 可直接寫進 vault;此處改為下載一個彙整的 markdown 檔',
  errorToast: {
    unsupported: '這個瀏覽器不支援直接寫入資料夾',
    cancelled: '已取消',
    permission: '沒有資料夾權限,請重新選擇資料夾',
    write_failed: '寫入失敗,請確認資料夾仍可存取',
  } as Record<string, string>,
};

/** 寫日記(DIARY-PLAN P1,2026-10-24):私密的第一方內容,純前端、零後端。
 * 2026-10-24 追加(維護者指示):心情(選填,固定選項)+內容長度 100–500 字。 */
export const DIARY_MOODS = [
  '😊 開心',
  '😌 平靜',
  '🤩 興奮',
  '🥹 感動',
  '😔 低落',
  '😤 煩躁',
  '😰 焦慮',
  '😣 疲憊',
];

export const DIARY_BODY_MIN = 100;
export const DIARY_BODY_MAX = 500;

/**
 * 沉澱小節(DIARY-PLAN D9,2026-11-10 路二拍板):label=app 表單顯示、heading=vault
 * `templates/life-daily.md` 的四個固定小節標題——**vault 模板改版須同步此表**。
 * 小節值是 `weekly_digest.py`/`review.py` 的輸入(`_extract_section` 按 `## 標題` 抓 bullet),
 * 所以匯出端把小節寫在標記區塊內(唯一出現處),app 新建檔不再帶空的範本小節。
 */
export const DIARY_SECTIONS: Array<{ key: DiarySectionKey; label: string; heading: string }> = [
  { key: 'moment', label: '今日片刻', heading: 'Moment Worth Remembering' },
  { key: 'feeling', label: '當下感受', heading: 'How I Felt' },
  { key: 'somethingNew', label: '新鮮事', heading: 'Something New' },
  { key: 'grateful', label: '感恩', heading: 'Grateful For' },
];

/** 單一小節一行欄的上限(主文 maxLength 500 不變;合計 100–500 由 UI 統計把關)。 */
export const DIARY_SECTION_MAX = 200;

/** 列表每頁篇數(2026-11-01 補缺口:長期累積後整頁全文渲染會過長)。 */
export const DIARY_PAGE_SIZE = 20;

export const DIARY_COPY = {
  pageTitle: '寫日記 Diary',
  pageDesc: '每天的心情與觀察寫在這裡——內容隨 Cloudflare worker 備份加密保存,可匯出到自己的 Obsidian vault',
  composeTitle: '新增日記',
  dateLabel: '日期',
  titleLabel: '標題(選填)',
  moodLabel: '心情(選填)',
  bodyLabel: '內容',
  bodyPlaceholder: '今天想記下什麼?',
  bodyCountLabel: (n: number) => `字數 ${n}/${DIARY_BODY_MAX}`,
  saveButton: '儲存日記',
  searchPlaceholder: '搜尋日記(日期、標題、內容或心情)',
  countLabel: (n: number) => `共 ${n} 篇`,
  loadMoreButton: (n: number) => `載入更多(還有 ${n} 篇)`,
  emptyTitle: '還沒有日記',
  emptyDesc: '從今天的一件小事開始,寫下第一篇吧',
  editButton: '編輯',
  deleteButton: '刪除',
  saveChangesButton: '儲存變更',
  cancelButton: '取消',
  deleteModalTitle: '刪除這篇日記?',
  deleteModalDesc: '刪除後無法復原。',
  deleteConfirmButton: '刪除日記',
  savedToast: '日記已儲存 ✍️',
  updatedToast: '日記已更新',
  deletedToast: '日記已刪除',
  emptyBodyToast: '內容是空的,寫點什麼再儲存吧',
  bodyLengthToast: (n: number) => `內容需 ${DIARY_BODY_MIN}–${DIARY_BODY_MAX} 字(目前 ${n} 字)`,
  // 日記 P2 路徑 B(2026-11-03):條目卡「✨ 生成貼文」——人審後任平台,風格校準迴路
  genButton: '✨ 生成貼文',
  generatingLabel: '生成中…',
  genNeedKeyToast: '生成貼文需要 Gemini key:於「AI 設定」輸入後即可使用',
  genModalTitle: '✨ 生成貼文(可編輯)',
  genFromLabel: (date: string, mood?: string) => `來源日記:${date}${mood ? ` · ${mood}` : ''}`,
  genHonesty: '經 Gemini 生成;日記原文只在生成當下送出,不照抄原文、不提來源',
  genToDraftButton: '帶入編發器',
  genCopyButton: '複製',
  genCopiedToast: '已複製生成貼文 📋',
  genToDraftToast: '已帶入編發器草稿 ✨',
  // 沉澱小節(D9,2026-11-10):對映 vault 模板四小節的選填一行欄
  sectionsLabel: '沉澱小節(選填)',
  sectionsHint: '字數計入統計;匯出時寫進 Obsidian 條目的對應小節,供週/月回顧腳本取用',
};

/**
 * 日記匯出到 Obsidian vault(DIARY-PLAN D6/D7,2026-11-01)。
 * 文案的誠實標示有四件事必須講清楚(都是真實限制,不是客套):
 * ①重開網頁要再挑一次資料夾(handle 只在記憶體);②單向 app→vault、只寫自己的標記
 * 區塊;③app 會**讀**當天那個檔案(splice 需要);④在 app 刪掉的日記不會同步刪除 vault。
 */
export const DIARY_EXPORT_RANGES = [
  { value: 'all' as const, label: '全部' },
  { value: 'year' as const, label: '今年' },
  { value: 'month' as const, label: '本月' },
];

export const DIARY_EXPORT_COPY = {
  cardTitle: '📤 匯出到 Obsidian',
  cardDesc: '把日記寫進你自己的 vault(daily/life/YYYY-MM-DD.md),資料不離開這台電腦',
  pickButton: '選擇 vault 資料夾',
  repickButton: '重新選擇資料夾',
  exportButton: '匯出日記',
  exportingButton: '匯出中…',
  /* 2026-11-02 UIUX 批:卡片改為兩步驟。原本按鈕與即時狀態交錯(選資料夾的鈕排在匯出鈕
     之後、它的狀態又落在兩顆鈕下方),讀的順序和做的順序不一致,使用者回報「來來回回的
     卡頓感」。現在每個步驟=標題+它自己的即時狀態+它自己的按鈕,動作一律在該步驟末尾。 */
  stepFolderLabel: '① vault 資料夾',
  stepExportLabel: '② 匯出範圍與執行',
  folderLabel: (name: string) => `資料夾:${name}`,
  lastExportLabel: (when: string) => `上次匯出:${when}`,
  neverExported: '還沒匯出過',
  pendingLabel: (n: number) => (n === 0 ? '沒有需要更新的日期' : `有 ${n} 天需要寫入`),
  needPickHint: '每次重開網頁都要再選一次資料夾(網頁無法長期保留資料夾權限)',
  notes: [
    '單向寫入:只建立/更新筆記裡 text-message:diary 標記的區塊,你在 Obsidian 手寫的內容不會被動到',
    '為了併入既有筆記,匯出時 app 會讀取當天那個 .md 檔的內容',
    '在 app 刪掉的日記不會從 vault 移除——匯出檔是當下的凍結副本',
  ],
  cancelledToast: '已取消選擇資料夾',
  pickedToast: (name: string) => `已選擇「${name}」,可以開始匯出`,
  nothingToast: '這個範圍內沒有需要更新的日記',
  doneToast: (n: number) => `已寫入 ${n} 天的日記到 vault ✅`,
  partialToast: (ok: number, failed: number) => `寫入 ${ok} 天,有 ${failed} 天失敗`,
  unsupportedTitle: '這個瀏覽器不支援直接寫入資料夾',
  unsupportedDesc: 'Chrome 或 Edge 可直接寫進 vault;此處改為下載一個彙整的 markdown 檔',
  downloadButton: '下載彙整 markdown',
  downloadedToast: '已下載彙整檔',
  errorToast: {
    unsupported: '這個瀏覽器不支援直接寫入資料夾',
    cancelled: '已取消',
    permission: '沒有資料夾權限,請重新選擇資料夾',
    write_failed: '寫入失敗,請確認資料夾仍可存取',
  } as Record<string, string>,
};
