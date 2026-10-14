# 每日自動發文管線:可行性評估與架構(Threads 先行)

2026-10-14 提案。依本 repo 慣例:**先評估、維護者拍板(D1–D4)、再動工**。
本文件評估「以 Threads 建立每日自動發文 pipeline」在本專案的可行性、所需資料與架構選項。

## 1. 結論(先說可行性)

**可行,而且大約七成機件已經在了。** 現有可直接複用:

| 已有 | 位置 |
| --- | --- |
| OAuth 代管 + token 加密保存 + 刷新 | `worker/src/threads/oauth.ts`、`store/kv.ts`(token 90 天 TTL) |
| 「排定時間 → 到點自動發」整條路徑 | `POST /api/schedule` → KV `queue:<installId>:<itemId>` → `scheduled()` cron → `publishThreadsText` |
| 失敗退避重試(60s→2m→4m,3 次後 failed) | `worker/src/queue/due.ts` |
| 佇列檢視/取消 UI | 定排程 Task 頁雲端佇列卡、`useThreadsProxy` |
| 內容來源(範本/分類/使用統計/平台變體) | 文庫 Library + `utils/variants.ts` |

**缺的只有三件**:①**週期性**(現在每筆都要人排)②**內容供給**(每天發什麼)③**不會乾掉的保護**(預排用完就停)。

平台額度完全不是問題:Threads 限 **250 篇/24 小時**(移動視窗),每日一篇用掉 0.4%;另有 `GET /{threads-user-id}/threads_publishing_limit` 可查當下用量(需 `threads_basic`+`threads_content_publish`),適合做發佈前預檢與誠實顯示。

## 2. 決定架構的那條紅線

**Gemini 金鑰只在瀏覽器**(紅線,未修訂)→ **worker 不能生成內容**。
所以「每天自動發一篇」的文字必須在**瀏覽器**先產生或先挑好,再以**成品文字**進入雲端佇列。這把架構空間壓到只剩兩種,差別只在「每日那個時間點是誰算的」:

### 架構 1:前端批次預排(補糧模式)

```
瀏覽器(開站 / 按「補糧」)
  → 挑未來 N 天的內容(文庫輪替 / AI 批次 / 手貼清單)
  → 先 GET /api/queue 比對,略過已經有排的日期(冪等)
  → 逐筆 POST /api/schedule(既有端點,零改動)
雲端 cron(每小時整點)→ 到點發佈(既有邏輯,零改動)
```

- **worker 零改動、KV 鍵形狀不變、紅線零修訂**
- 每一筆都在既有排程頁看得到/改得動/取消得掉 → 天然有「人審一次」的機會
- 缺點:**會乾**——預排 N 天用完後若沒開 app 就停止發文。緩解=低水位提醒(剩 ≤3 天在 Dashboard 與側欄提示)
- KV 成本:補一次糧 = N 筆寫入(免費方案 1,000 寫/日,無虞)

### 架構 2:worker 側週期規則 + 內容池

```
新 KV:rule:<installId>  { time, platform, enabled, lastPostedDate }
       pool:<installId>  [ {id, text}, … ]   ← 前端補,一次可補 30–90 筆
cron 每小時整點:今天還沒發 && 到了規則時間 && 池裡有料 → 取一筆發、標記已用
```

- 優點:**真正無人值守**(只要池裡有料,幾個月不開 app 也會發)
- 缺點:新增兩類 KV 資料 + 一塊 worker 排程邏輯;UI 要同時顯示「規則狀態」與「佇列狀態」兩套
- 紅線:池裡是「排程貼文內容」,**落在現有紅線內,不需修訂**(與互動代讀不同,那次要修訂是因為多了「代讀」這個動作)

### 建議:一期走架構 1,二期視實測再決定要不要上架構 2

理由:
1. 架構 1 **不動 worker**(目前 worker 還有一批互動代讀待部署,不要再疊變更);
2. 自動發文最大的風險不是技術而是**連續發出沒人看過的文字**——架構 1 每筆都在排程頁,保留人審窗口;
3. 「乾掉」的後果輕(停止發文),「發錯/發重複」的後果重,偏保守正確;
4. 架構 1 的補糧 UI 日後幾乎可原封不動複用到架構 2(只是改打別的端點)。

## 3. 所需資料

### 前端(併入 `text-message:v2`,可進文庫雲端備份)

```ts
autoPipeline: {
  enabled: boolean;          // 一期預設 false
  platform: PlatformKey;     // 一期 threads;FB/LinkedIn 同機制可擴
  time: string;              // 'HH:mm',**本機時區**
  daysOfWeek: number[];      // 一期固定每日,欄位先留
  source: 'templates' | 'manual' | 'ai';
  sourceCategory?: string;   // 文庫分類
  horizonDays: number;       // 一次預排幾天(7 / 14 / 30)
  queuedThrough: string;     // 'YYYY-MM-DD' 已排到哪天(低水位判斷)
  lastFilledAt: number;
  usedTemplateIds: string[]; // 輪替游標,避免短期重複
}
```

**只有文字與偏好**:不含 token、不含 emails、不含 Gemini key。`payload.ts` 的 schema v1 → v2 需加欄位並保持回溯相容(舊備份還原時缺欄位走預設值)。

### worker

- 架構 1:**零新增**
- 架構 2:`rule:<installId>`、`pool:<installId>` 兩類鍵(+ `lastPostedDate` 冪等欄位)

### 新增純邏輯(一律配 vitest)

| 函式 | 職責 | 踩點 |
| --- | --- | --- |
| `buildDailyPlan({ from, horizonDays, time, skipDates })` | 算出未來 N 天的 `publishAt` | **時區**:使用者填的 09:00 是本機時間,要用本機 `Date` 組 epoch,別自己算 UTC 偏移 |
| `pickNextTemplates(templates, usedIds, count)` | 範本輪替挑選 | 用既有 `usageCount`/`lastUsedAt`,避免 N 天內重複 |
| `needsTopUp(queuedThrough, today, threshold)` | 低水位判斷 | — |
| 補糧前的日期比對 | 冪等 | **架構 1 最容易出的 bug**:每次開站都補 → 同一天排到多筆。必須先 `GET /api/queue` 比對 pending 的 `publishAt` 日期 |

## 4. 風險與誠實清單

1. **內容品質/帳號風險**(最大的一條,非技術):連續自動發 AI 文字有被視為 spam 的風險。量上無虞(250 篇/24h 額度、我們 1 篇/日),但建議一期預設關閉 + 預排後人看一眼。
2. **重複內容**:平台對「完全相同文字重複發佈」的處置**文件沒明說,未實測**。輪替 + `platformVariants` 可降低;動手前要實測。
3. **「4800 × impressions」呼叫上限**:Threads 文件的呼叫額度公式含觸及數,**零觸及帳號的下限未明**,需實測(我們的量極小,但要知道這條存在)。
4. **token 壽命**:長效 token 刷新發生在 cron 發佈前(`needsRefresh`)。每日都有發佈 → 會持續刷新;但**管線乾掉超過 token 壽命就會失效、需重新連接**。
5. **KV 累積(現有技術債,管線會放大)**:`listQueueItems` 會把所有 `queue:*`(含 done)讀出來。每日一筆跑一年 = 365 筆,每次 cron 讀 365 次 × 24 = 約 8.7k 讀/日(免費 10 萬/日內,但只增不減)。**建議與管線一併處理**:done/failed/cancelled 加 `expirationTtl`(如 30 天)。
6. **`publishedHistory` 會失真**(容易被忽略):雲端佇列發出去的貼文,前端目前靠使用者手動「標記已發佈」才會進 `publishedHistory`。自動管線跑起來後沒人去標記 → **「發文趨勢」面板會變空殼**。需要從 `/api/queue` 的 `done` 項目回填,或至少在趨勢面板誠實標示。
7. **cron 精度 ±60 分**:每小時整點批次(KV list 額度約束,2026-09-08 定案,勿改回每分鐘)。台灣 UTC+8 是整小時偏移,09:00 會準點;半小時時區(如印度 +5:30)會延到下個整點 → UI 要誠實寫「約」。

## 5. 分期

| 期 | 內容 | 動 worker? |
| --- | --- | --- |
| P0 | 本評估 + D1–D4 拍板 | — |
| P1 | 架構 1:補糧(文庫輪替)、冪等比對、低水位提醒、排程頁「自動管線已排到 X/X」、預設關閉 | 否 |
| P2 | 風險 5、6 收尾:done 項目 TTL + 回填 `publishedHistory` | 是(TTL) |
| P3(選) | 架構 2:worker rule+pool 無人值守;FB/LinkedIn 共用 | 是 |
| P4(選) | 發佈前 `threads_publishing_limit` 預檢與用量顯示 | 是 |

## 6. 待拍板(D1–D4)

- **D1 自動化程度**:①一期只做前端批次預排(**建議**)②直接做 worker 無人值守
- **D2 內容來源**:①文庫範本輪替(**建議**,零 AI 依賴、零額外成本)②補糧時 AI 批次生成(需 key,品質與配額成本)③手動貼清單
- **D3 人審閘門**:①預排後可改但不強制確認(**建議**)②每天發前要人按確認(等於回到半自動,違背管線初衷)
- **D4 範圍**:①一期只 Threads(**建議**)②同時上 FB/LinkedIn(機制相同,`platform` 欄位已支援)

## 7. 參考(查證於 2026-10-14)

- Threads Overview(發佈額度 250 篇/24h、`threads_publishing_limit` 端點、呼叫額度公式):<https://developers.facebook.com/docs/threads/overview>
- 本專案既有實作:`worker/src/index.ts`(`/api/schedule`、`scheduled()`)、`worker/src/queue/due.ts`、`docs/BACKEND.md` §4/§5/§8
