# 每日自動發文管線:可行性評估與架構(Threads 先行)

2026-10-14 提案、**同日維護者拍板 D1–D6(見 §7)**。依本 repo 慣例:先評估、拍板、再動工。
本文件評估「以 Threads 建立每日自動發文 pipeline」在本專案的可行性、所需資料與架構。

## 1. 結論(先說可行性)

**可行,而且大約七成機件已經在了。** 現有可直接複用:

| 已有 | 位置 |
| --- | --- |
| OAuth 代管 + token 加密保存 + 刷新 | `worker/src/threads/oauth.ts`、`store/kv.ts`(token 90 天 TTL) |
| 「排定時間 → 到點自動發」整條路徑 | `POST /api/schedule` → KV `queue:<installId>:<itemId>` → `scheduled()` cron → `publishThreadsText` |
| 失敗退避重試(60s→2m→4m,3 次後 failed) | `worker/src/queue/due.ts` |
| 佇列檢視/取消 UI | 定排程 Task 頁雲端佇列卡、`useThreadsProxy` |
| **Drive 唯讀匯出純文字**(日誌素材的取得方式) | `services/drive/driveApi.ts` 的 `exportDocText`、`useDrive.previewText` |
| **Gemini 風格參照**(生成要模仿自己的行文) | `useAppStore.ts:1099` `getDriveStyleSampleTexts()` + `driveStyleEnabled`/`driveStyleSamples` |
| 內容來源(範本/分類/使用統計/平台變體) | 文庫 Library + `utils/variants.ts` |

**缺的只有三件**:①**週期性**(現在每筆都要人排)②**內容供給**(每天發什麼 → D2 定案為日誌+AI,見 §3)③**不會乾掉的保護**(預排用完就停)。

平台額度完全不是問題:Threads 限 **250 篇/24 小時**(移動視窗),每日一篇用掉 0.4%;另有 `GET /{threads-user-id}/threads_publishing_limit` 可查當下用量(需 `threads_basic`+`threads_content_publish`),適合做發佈前預檢與誠實顯示。

## 2. 決定架構的那條紅線

**Gemini 金鑰只在瀏覽器**(紅線,未修訂)→ **worker 不能生成內容**。
所以「每天自動發一篇」的文字必須在**瀏覽器**先產生或先挑好,再以**成品文字**進入雲端佇列。這把架構空間壓到只剩兩種,差別只在「每日那個時間點是誰算的」:

### 架構 1:前端批次預排(補糧模式)**← D1 定案**

```
瀏覽器(開站 / 按「補糧」)
  → 取日誌素材與風格樣本(Drive 唯讀,當下匯出不落地)
  → Gemini 逐篇生成未來 N 天的貼文(BYOK,瀏覽器內)
  → 先 GET /api/queue 比對,略過已經有排的日期(冪等)
  → 逐筆 POST /api/schedule(既有端點,零改動)
雲端 cron(每小時整點)→ 到點發佈(既有邏輯,零改動)
```

- **worker 零改動、KV 鍵形狀不變、紅線零修訂**
- 每一筆都在既有排程頁看得到/改得動/取消得掉 → 天然有「人審一次」的機會
- 缺點:**會乾**——預排 N 天用完後若沒開 app 就停止發文。緩解=低水位提醒(剩 ≤3 天在 Dashboard 與側欄提示)
- KV 成本:補一次糧 = N 筆寫入(免費方案 1,000 寫/日,無虞)

### 架構 2:worker 側週期規則 + 內容池(二期以上,**未採用**)

```
新 KV:rule:<installId>  { time, platform, enabled, lastPostedDate }
       pool:<installId>  [ {id, text}, … ]   ← 前端補,一次可補 30–90 筆
cron 每小時整點:今天還沒發 && 到了規則時間 && 池裡有料 → 取一筆發、標記已用
```

- 優點:**真正無人值守**(只要池裡有料,幾個月不開 app 也會發)
- 缺點:新增兩類 KV 資料 + 一塊 worker 排程邏輯;UI 要同時顯示「規則狀態」與「佇列狀態」兩套
- 紅線:池裡是「排程貼文內容」,**落在現有紅線內,不需修訂**(與互動代讀不同,那次要修訂是因為多了「代讀」這個動作)
- 注意:日誌/AI 生成仍只能在瀏覽器,所以架構 2 也不是「無人生成」,只是「無人發佈」

### D1 定案理由(一期走架構 1)

1. 架構 1 **不動 worker**(目前 worker 還有一批互動代讀待部署,不要再疊變更);
2. 自動發文最大的風險不是技術而是**連續發出沒人看過的文字**——架構 1 每筆都在排程頁,保留人審窗口。素材是**夢境靈感日誌**(高度私人)之後,這條從「偏好」升級為「必要」;
3. 「乾掉」的後果輕(停止發文),「發錯/發重複/發出不該公開的私密細節」的後果重,偏保守正確;
4. 架構 1 的補糧 UI 日後幾乎可原封不動複用到架構 2(只是改打別的端點)。

## 3. 內容供給:Drive 夢境靈感日誌 + 風格參照(D2 定案)

**維護者定案**:內容由 **AI 生成**;**行文風格**取自雲端硬碟中他自己的書寫文章(沿用既有 Drive 風格參照);**每日素材**取自他每天早上寫在 Google Doc 的「夢境靈感日誌」。

### 3.1 資料流(全程在瀏覽器)

```
Google Doc(夢境靈感日誌,使用者每天早上寫)
  │  Drive 唯讀 exportDocText(既有)
  ▼
純文字全文 ──► parseJournal() ──► 條目陣列 [{ date, title?, body }]
  │                                      │
  │  用完即棄(不落地)                   ▼
  │                        pickJournalEntries(entries, { today, usedDates, count })
  │                                      │  D6:日期新→舊取「未用過」的條目
  ▼                                      ▼
風格樣本(至多 3 篇 × 截 800 字)──► Gemini 生成(BYOK)──► 貼文文字
  getDriveStyleSampleTexts()                                   │
                                                               ▼
                                            預排進佇列(POST /api/schedule)
                                            + 記錄 usedJournalDates(只記日期)
```

### 3.2 日誌格式慣例(D5,維護者授權由本專案指定)

維護者表示「如果有需要可以變更形式或增加日期工具」,因此由工具端定義一個**寬容但明確**的慣例:

**一個 Doc 累積所有條目;「整行只有一個日期」就是新條目的開始。**

```
2026-10-14
夢到在一條沒有盡頭的長廊裡找一扇門,
每扇門後面都是同一個房間。

2026-10-13 海
站在退潮的沙灘上,腳印被自己填回去。
```

解析規則(`parseJournal`,純函式 + vitest):

| 規則 | 說明 |
| --- | --- |
| 日期行 | 行首到行尾只有日期(容許前後空白)即視為新條目。接受 `2026-10-14`、`2026/10/14`、`2026/10/4`、`2026年10月14日` |
| 選用標題 | 日期後面接空白再接文字 → 該文字為條目標題(`2026-10-13 海`) |
| 內文 | 日期行之後到下一個日期行之前的全部文字(含空行),`trim` 後為 `body` |
| 空內文 | `body` 為空的條目直接丟棄(只寫了日期還沒寫內容的那天) |
| 同日多行 | 同一天出現多個日期行 → 合併為同一條目(append),不丟資料 |
| 新舊順序 | Doc 內由新到舊或由舊到新都可以——解析完一律依日期排序 |
| 無法解析 | 整份都沒有日期行 → 回空陣列,UI 誠實提示「日誌格式不符」並附格式說明,**不猜、不把全文當一篇** |
| 匯出格式 | `exportDocText` 回的是**純文字**,Docs 的標題樣式會消失,所以慣例只能靠「這一行的內容」判斷,不能靠 `#` 或粗體 |

**日期工具**(維護者允許新增):編發器/Dashboard 放一顆「📋 複製今日日期標頭」,複製 `2026-10-14` 供貼進 Doc 開新條目——把格式合規的成本壓到一次點擊,比寫說明文件有效。

### 3.3 選料規則(D6 定案:沒寫就用較舊、還沒用過的條目)

`pickJournalEntries(entries, { today, usedDates, count })`:

1. 依日期**新→舊**掃,跳過 `usedDates` 已含的日期、跳過**晚於 today** 的條目(未來日期視為筆誤);
2. 取滿 `count` 筆為止 → 一天一筆對應 `buildDailyPlan` 算出的 `publishAt`;
3. **取不滿就只排到取得的筆數**(例如只有 3 則未用素材就只排 3 天),不湊數、不重用已用過的條目;
4. **全部用過 → 回空陣列**,補糧停止並提示「日誌沒有新素材」。**不生成憑空內容**——這是誠實紅線:管線寧可乾掉,不能假裝有素材。

`usedDates` 存 `autoPipeline.usedJournalDates`(**只有日期字串**)。條目被取消或刪除後是否「退還」該日期:一期**不退還**(簡單、可預期;要重用請在 Doc 裡改日期)。

### 3.4 紅線分界(這一節是本批最需要看清的地方)

| 資料 | 落地? | 依據 |
| --- | --- | --- |
| 日誌**原文**(夢境內容) | **絕不落地** | 「Drive 文檔內容絕不落地」紅線。只在生成當下匯出、送 Gemini、用完即棄;不進 localStorage、不進 `text-message:v2`、不進文庫雲端備份、不進 worker |
| 日誌**日期**(`usedJournalDates`) | 落地 | 中繼資料,與既有 `driveStyleSamples` 只存 `{id, name, mimeType}` 同一個慣例 |
| 日誌 Doc 的 **id/檔名** | 落地 | 同上(`journalFileId`/`journalFileName`) |
| **生成出來的貼文文字** | 落地(本機 + 雲端佇列) | 這是使用者明確的發佈意圖,本來就在既有紅線內(「後端僅接收排程貼文內容」) |
| Gemini key / Drive token | 不落地(key 只在 localStorage 本機、token 只在記憶體) | 既有紅線,不動 |

**誠實標示(UI 必須寫出來的三件)**:
1. **日誌內容會送到 Google Gemini**(使用者自己的 key)用於生成貼文——這與既有 Drive 風格參照是同一個事實,但夢境日誌更私密,值得在管線設定處再說一次,而不是只寫在 AI 設定裡;
2. **生成的貼文會進入雲端佇列並由 worker 代發**,日誌原文不會;
3. **Gemini 配額與媒管庫共用**(家族串接 L3),批次生成 N 天 = N 次呼叫。

**兩個內建緩解**(抵銷「發出沒人看過的私密內容」風險):
- **預排一律從「明天」起算**——今天不會突然冒出一篇沒看過的貼文,永遠至少有一個晚上可以改或刪;
- **Dashboard 顯示「明天要發什麼」**(文字全文 + 時間 + 一鍵改/刪),把人審成本壓到開站就看得見,不必自己去翻排程頁。

### 3.5 Drive 連線的真實摩擦(誠實寫在前面)

Drive token **只存記憶體、中斷即 revoke**(紅線)→ **每次開站補糧前都要按一次「連接 Drive」**。所以一期的實際使用節奏是:

> 開站 → 連 Drive → 按「補糧 7 天」→ 看一眼明天那篇 → 關掉。往後 7 天由 cron 自動發。

這不是 bug,是紅線的必然結果;UI 文案要照這個節奏寫(「補糧需要連接 Drive 讀取日誌」),不要讓使用者以為它會自己去讀。未連線時走示範文檔(沿用 `DEMO_DRIVE_DOC_TEXT`,`getDriveStyleSampleTexts` 既有行為),示範模式可完整體驗流程。

## 4. 所需資料

### 前端(併入 `text-message:v2`,可進文庫雲端備份)

```ts
autoPipeline: {
  enabled: boolean;          // 一期預設 false
  platform: PlatformKey;     // 一期 threads;FB/LinkedIn 同機制可擴
  time: string;              // 'HH:mm',**本機時區**
  daysOfWeek: number[];      // 一期固定每日,欄位先留
  source: 'journal-ai' | 'templates' | 'manual';  // D2 定案:journal-ai
  horizonDays: number;       // 一次預排幾天(7 / 14 / 30)
  queuedThrough: string;     // 'YYYY-MM-DD' 已排到哪天(低水位判斷)
  lastFilledAt: number;
  // ── 日誌來源(D2/D5/D6)──
  journalFileId: string;     // Drive Doc id(只有 id/檔名,內容絕不落地)
  journalFileName: string;   // 顯示用(檔案改名時只是顯示舊名,不影響讀取)
  usedJournalDates: string[];  // 'YYYY-MM-DD'[],選料游標;**只有日期**
  // ── 範本來源(fallback / source='templates' 時用)──
  sourceCategory?: string;
  usedTemplateIds: string[];
}
```

**只有文字、日期與偏好**:不含 token、不含 emails、不含 Gemini key、**不含任何日誌原文**。`payload.ts` 的 schema v1 → v2 需加欄位並保持回溯相容(舊備份還原時缺欄位走預設值)。

風格樣本沿用既有 `driveStyleSamples` / `driveStyleEnabled`,**不新增一套**——管線生成時直接呼叫 `getDriveStyleSampleTexts()`(`useAppStore.ts:1099`),連「未連線退示範文檔」「部分匯出失敗提示」都是現成行為。

### worker

- 架構 1(一期):**零新增**
- 架構 2(未採用):`rule:<installId>`、`pool:<installId>` 兩類鍵(+ `lastPostedDate` 冪等欄位)

### 新增純邏輯(一律配 vitest)

| 函式 | 職責 | 踩點 |
| --- | --- | --- |
| `buildDailyPlan({ from, horizonDays, time, skipDates })` | 算出未來 N 天的 `publishAt` | **時區**:使用者填的 09:00 是本機時間,要用本機 `Date` 組 epoch,別自己算 UTC 偏移。**`from` 固定為明天**(§3.4) |
| `parseJournal(text)` | 日誌純文字 → `[{ date, title?, body }]` | 規則表見 §3.2。**無日期行要回空陣列而不是把全文當一篇**;同日合併;空內文丟棄 |
| `pickJournalEntries(entries, { today, usedDates, count })` | 選料 | D6:新→舊取未用過;**取不滿就少排,不湊數**;全用過回空 |
| `pickNextTemplates(templates, usedIds, count)` | 範本輪替挑選(`source='templates'`) | 用既有 `usageCount`/`lastUsedAt`,避免 N 天內重複 |
| `needsTopUp(queuedThrough, today, threshold)` | 低水位判斷 | — |
| 補糧前的日期比對 | 冪等 | **架構 1 最容易出的 bug**:每次開站都補 → 同一天排到多筆。必須先 `GET /api/queue` 比對 pending 的 `publishAt` 日期 |

## 5. 風險與誠實清單

1. **私密內容外流(D2 之後躍升為第一順位)**:夢境日誌是高度私人的素材,AI 生成的貼文可能無意帶出不想公開的細節。緩解=預排從明天起算 + Dashboard 顯示明天要發什麼 + 一期預設關閉 + 首批建議逐筆看過(§3.4)。這條**不能只靠文案**,要靠「發佈前必然看得見」的版面位置。
2. **內容品質/帳號風險**(非技術):連續自動發 AI 文字有被視為 spam 的風險。量上無虞(250 篇/24h 額度、我們 1 篇/日)。
3. **重複內容**:平台對「完全相同文字重複發佈」的處置**文件沒明說,未實測**。D6 的「不重用已用條目」已從源頭降低;`platformVariants` 可再降。
4. **日誌沒寫 / 格式寫壞**:D6 退路(較舊未用條目)吸收大部分情況;整份解析不到就誠實提示格式並附範例,**不生成憑空內容**。日期工具按鈕降低寫壞機率。
5. **Gemini 配額與失敗**:批次生成 N 天 = N 次呼叫,且**與媒管庫共用同一份 key 配額**(L3)。生成中途失敗 → 已成功的照排、失敗的跳過並回報「排了 X/N 天」,不整批回滾(半成品比全無好,且佇列本身可改)。沿用既有降級迴圈與 `stopAi`(AbortController)讓使用者可中止。
6. **Drive 每次開站要重連**:§3.5,紅線的必然結果,文案要誠實。
7. **token 壽命**:長效 token 刷新發生在 cron 發佈前(`needsRefresh`)。每日都有發佈 → 會持續刷新;但**管線乾掉超過 token 壽命就會失效、需重新連接**。
8. **KV 累積(現有技術債,管線會放大)**:`listQueueItems` 會把所有 `queue:*`(含 done)讀出來。每日一筆跑一年 = 365 筆,每次 cron 讀 365 次 × 24 = 約 8.7k 讀/日(免費 10 萬/日內,但只增不減)。**建議與管線一併處理**:done/failed/cancelled 加 `expirationTtl`(如 30 天)。
9. **`publishedHistory` 會失真**(容易被忽略):雲端佇列發出去的貼文,前端目前靠使用者手動「標記已發佈」才會進 `publishedHistory`。自動管線跑起來後沒人去標記 → **「發文趨勢」面板會變空殼**。需要從 `/api/queue` 的 `done` 項目回填,或至少在趨勢面板誠實標示。
10. **cron 精度 ±60 分**:每小時整點批次(KV list 額度約束,2026-09-08 定案,勿改回每分鐘)。台灣 UTC+8 是整小時偏移,09:00 會準點;半小時時區(如印度 +5:30)會延到下個整點 → UI 要誠實寫「約」。

## 6. 分期

| 期 | 內容 | 動 worker? |
| --- | --- | --- |
| P0 | 本評估 + D1–D6 拍板 | — |
| P1 | **管線骨架**(架構 1):`autoPipeline` 資料與 schema v2、`buildDailyPlan`/`needsTopUp`、冪等比對、補糧動作、低水位提醒、排程頁「自動管線已排到 X/X」、Dashboard「明天要發什麼」、預設關閉。來源先接**文庫範本輪替**(不依賴 Drive/AI,好測好驗) | 否 |
| P2 | **日誌來源**(D2 主體):`parseJournal`/`pickJournalEntries`、日誌 Doc 選擇、Gemini 批次生成(沿用 `getDriveStyleSampleTexts` 風格參照)、日期工具按鈕、§3.4 的三項誠實標示 | 否 |
| P3 | 風險 8、9 收尾:done 項目 TTL + 回填 `publishedHistory` | 是(TTL) |
| P4(選) | 架構 2:worker rule+pool 無人值守;FB/LinkedIn 共用 | 是 |
| P5(選) | 發佈前 `threads_publishing_limit` 預檢與用量顯示 | 是 |

P1/P2 刻意分開:P1 跑得起來才有東西可以驗冪等與時區,P2 再換上真實素材;若 P2 的 Drive/AI 路徑出問題,P1 的範本輪替仍是可用的 fallback(`source` 欄位保留兩種值就是為此)。

## 7. 決議紀錄(D1–D6,2026-10-14 維護者拍板)

| 決議 | 定案 | 備註 |
| --- | --- | --- |
| **D1 自動化程度** | ①**前端批次預排**(架構 1) | worker 零改動、紅線零修訂、保留人審窗口;架構 2 留作 P4 |
| **D2 內容來源** | **AI 生成 + Drive 風格參照 + 夢境靈感日誌素材** | 取代原選項(文庫輪替/AI 批次/手貼清單);風格=雲端硬碟裡自己的書寫文章,素材=每天早上寫的 Google Doc 日誌。設計見 §3 |
| **D3 人審閘門** | ①**預排後可改,不強制確認** | 但 D2 之後加兩個內建緩解:預排從明天起算 + Dashboard 顯示明天要發什麼(§3.4) |
| **D4 範圍** | ①**一期只做 Threads** | `platform` 欄位已支援 FB/LinkedIn,機制相同可擴 |
| **D5 日誌格式慣例** | **由工具端指定**(維護者:「如果有需要可以變更形式或增加日期工具等等」) | 「整行只有日期=新條目」+ 選用標題 + 寬容日期格式 + 複製今日日期標頭按鈕。規則表見 §3.2 |
| **D6 沒寫日誌時** | **用較舊、還沒用過的日誌條目** | 新→舊取未用過;取不滿就少排;全用過則停止補糧並提示,不生成憑空內容(§3.3) |

## 8. 參考(查證於 2026-10-14)

- Threads Overview(發佈額度 250 篇/24h、`threads_publishing_limit` 端點、呼叫額度公式):<https://developers.facebook.com/docs/threads/overview>
- Drive 搜尋 q 語法(`buildListQuery` 的依據):<https://developers.google.com/drive/api/guides/search-files>
- 本專案既有實作:`worker/src/index.ts`(`/api/schedule`、`scheduled()`)、`worker/src/queue/due.ts`、`src/services/drive/driveApi.ts`、`src/hooks/useAppStore.ts:1099`、`docs/BACKEND.md` §4/§5/§8、`docs/DRIVE-PLAN.md`
