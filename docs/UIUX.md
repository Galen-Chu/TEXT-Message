# UI/UX 與文案慣例手冊(UIUX)

> 2026-11-02 建立。定位:**活躍的慣例手冊**——收斂散落在 CLAUDE.md 慣例段、時間軸條目與稽核腳本裡的 UI 紀律,每次 UI 批動工前先讀;新教訓隨批 append(功能決策記錄不走本檔,走各 `-PLAN` 檔)。文件導覽見 `docs/README.md`。

## 一、命名紀律

- **命名前先掃既有語彙**:頁籤名、卡片標題、按鈕用語不得與既有功能撞名或共用模糊字眼。案例:備份卡原標題「☁️ 雲端備份」與頁籤「雲端列 Drive」(Google Drive)撞名——兩者完全無關,維護者實際混淆過,2026-11-02 更名「Cloudflare worker 備份」並連動所有操作與提示字串(按鈕/toast/衝突提示)。同類保留不動的:「雲端佇列/雲端發佈佇列」指排程代發佇列,是另一個功能。
- **顯示名與內部識別字分離**:UI 標籤可改,Tab key、資料集名不隨之改(歷史债:2026-09-04 IA 重整更名後內部識別字未改;例外:「編發器 Draft」更名後 Tab key `'draft'` 反而與標籤一致)。
- **更名要留橋**:新舊名任一方向 grep 都要找得到——改名處留理由註解,歷史名所在的模組檔頭補「(UI 現名「…」)」。正式功能名(如「文庫雲端備份(方案 A)」)在文件與 git 歷史中不全面改寫。

## 二、文案慣例

- **字串集中 `constants.ts`**(`*_COPY` 物件),不散落元件;行為關鍵文案配 `constants.test.ts` 守門(範例:還原確認文案的「0 筆 ≠ 不含」分支,5 測釘住)。
- **描述列全當前功能**:頁面/卡片描述是功能契約的鏡子,功能上線或擴充時同步更新——2026-11-02 稽核一次修了 8 處過期(管線卡還寫「P2 將改為」、Drive 頁漏二期功能、日記頁沒提備份與匯出)。新增功能批的 checklist 應含「受影響頁面的描述」。
- **誠實標示是慣例不是客套**:每個新功能的真限制要寫進 UI(Threads 留言=「按下才讀、內容不經儲存、只掃最近 N 篇」;日記匯出=「重開要重挑資料夾、單向寫入、只動標記區塊、app 刪除不影響 vault」;管線=三條誠實說明)。降級狀態(示範模式/未連線/未設後端/瀏覽器不支援)也都要有明確文案,不可靜默消失。
- **錯誤文案對應 error code 表**(`GMAIL_ERROR_COPY`/`DRIVE_ERROR_COPY`/`BACKEND_ERROR_COPY`/`YOUTUBE_ERROR_COPY`/`GEMINI_ERROR_COPY`);**可行動的狀態不可以被收斂成通用錯誤**(案例:`scope_required` 刻意用 403 而非 5xx,否則「重新連接 Threads」這個可行動提示會消失在 generic 裡)。
- **配額/儲存不可用提示不斷言來源**:兩庫同源共用 localStorage 配額,佔滿的可能是對方——文案不寫「刪除文庫內容」這類指引。

## 三、視覺與無障礙

- **token 制**:色值只存在 `src/index.css` 的 `:root` 與 dark `@media` 區塊;元件一律 `var(--token)`。
- **對比度是回歸閘門**:`npm run test:contrast`(`scripts/contrast-audit.mjs` 解析 index.css token,未達 WCAG AA 4.5:1 即 exit 1)在 ci.yml 與 deploy.yml 都會跑——改 token 後本地必跑。唯一例外:PlatformBadge 平台識別色(識別優先於對比)。
- 深色模式記得 `color-scheme`(教訓:缺失造成輸入框白底白字,對比 1.19:1);brand/accent 分離「文字色調/填充」雙 token。
- 無障礙基線:toast `role="status"`、Modal `role="dialog"` + Esc 關閉 + focus trap、✕ 按鈕 aria-label、`crypto.randomUUID` 作 id。

## 四、icon 紀律

- 導覽 icon 用 **Uniconsign**;新增前先查**本機 checkout** `~/Github-Projects/Uniconsign` 的 `icons/order.json` 與 `codepoints.json`——「這個 repo 裡找不到」不等於「設計系統沒有」(2026-11-01 教訓:初版手繪 IconNote,其實 science 序列裡已有 sticky-note)。
- 幾何**逐字取自 svg 原始路徑**,僅 fill 改 `currentColor`;幾何來源註記在 `BrandIcons.tsx` 檔頭。

## 五、元件與互動慣例

- **不可再生內容刪除需確認 Modal**(日記、便條、草稿、排程);文庫範本直接刪(可重建)。判準:內容是否可由使用者重新產出。
- **狀態與操作分離**:總覽頁(Dashboard)只放狀態小卡與入口按鈕,操作集中在功能頁——避免兩處操作造成狀態不同步(2026-11-02 備份狀態卡案例:顯示在 Dashboard、操作在文庫)。
- 列表慣例:**新→舊排序**、分頁 20 筆 + 載入更多(`DIARY_PAGE_SIZE`/`NOTES_PAGE_SIZE`,換篩選條件縮回第一頁)、搜尋為頁面本地狀態不落地。
- 搜尋比對涵蓋所有自然線索:日記搜尋含日期字串(月份前綴=當月篩選)、便條含標籤與網址。
- 連外連結一律 `<a target="_blank" rel="noopener noreferrer">`;app 不抓取、不預覽使用者貼入的網址(資料邊界紅線的 UI 面)。
