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

## 六、字體與排版規格(2026-11-03 制定)

> 背景:色彩很早就 token 化且有對比度閘門守著,字體卻一直散在元件的 inline style 裡——累積出 **19 種字級**(8/9/10/10.5/11/11.5/12/12.5/13/13.5/14/15/16/17/18/20/22/26/36)與 **5 種字重**(含 800/900),其中 11~13.5 那六級肉眼幾無差別,純粹是噪音,同一個角色(例如卡片標題)在不同頁長得不一樣。本節是規格,`scripts/typography-audit.mjs` 是擋住回頭路的閘門。

### 6.1 字級級數(7 級,token 在 `src/index.css` 的 `:root`)

| token | 值 | 用途 |
| --- | --- | --- |
| `--text-micro` | 10px | 徽章內字、極小註記 |
| `--text-meta` | 11px | 中繼資料、時間戳、誠實標示 |
| `--text-sub` | 12px | 次要描述、chips、小按鈕 |
| `--text-body` | 13px | 內文基準、頁面描述、列表內容 |
| `--text-card` | 15px | 卡片與 Modal 標題 |
| `--text-page` | 20px | 頁面標題 |
| `--text-stat` | 26px | 統計數字 |

**與 Uniconsign 的關係(刻意偏離並記錄)**:字族(Inter + Noto Sans TC)、字重階層、行高三級**沿用** Uniconsign;**字級級數刻意不同**——Uniconsign 的 12/14/16/18/22/28/34/44 是以 16px 為內文基準的文件型級數,本專案是**高密度工具型介面**(九個頁籤、每頁多張卡、列表密集),內文基準壓到 13px、級距收緊。偏離只在「尺寸數值」這一項,其餘規格不自創。

- **字重只有四級**:`--weight-regular` 400 / `--weight-medium` 500 / `--weight-semibold` 600 / `--weight-bold` 700。原本散落的 800/900 一律收斂到 bold(Uniconsign 原生沒有 800/900)。
- **行高三級**:`--leading-tight` 1.25(標題)/ `--leading-snug` 1.45(單行或短段)/ `--leading-normal` 1.7(多行段落、誠實標示、textarea)。
- **emoji 與字級分家**:`--emoji-sm` 16px / `--emoji-md` 18px / `--emoji-art` 36px。圖示大小是視覺重量不是文字級數,綁在一起會讓「調字級」連帶改圖。

### 6.2 `.t-*` 角色類別(實作層)

元件不寫 inline 字級,改掛 `.t-*`。**每個類別是一個「角色」而不是一個尺寸**——要的是「這是卡片標題」,不是「這是 15px」;日後整體調級只改 CSS 一處。

| 類別 | 角色 | 規格 |
| --- | --- | --- |
| `.t-page-title` | 頁面標題 | page / bold / tight / text-main |
| `.t-page-desc` | 頁面描述 | body / normal / text-weak |
| `.t-card-title` | 卡片與 Modal 標題 | card / bold / tight / text-main |
| `.t-sec-title` | 卡內小標題(副標題) | body / bold / snug / text-main |
| `.t-body` | 內文 | body / normal / text-main |
| `.t-item-title` | 列表項標題 | body / semibold / snug / text-main |
| `.t-sub` | 次要描述、chips | sub / snug / text-weak |
| `.t-meta` | 單行中繼(時間/計數) | meta / snug / text-faint |
| `.t-note` | 多行誠實標示 | meta / **normal** / text-faint |
| `.t-micro` | 徽章內字 | micro / semibold / 1.2 |
| `.t-stat` | 統計數字 | stat / bold / tight / tabular-nums |
| `.t-num` | 等寬數字(只加這一件事) | tabular-nums |
| `.t-emoji-sm` `.t-emoji` `.t-emoji-art` | emoji 圖示 | emoji token |

**副標題 vs 小標題的分界**(維護者點出的不統一處):頁面層只有一組 `.t-page-title` + `.t-page-desc`;卡片標題用 `.t-card-title`;卡**內**再分段的小標題用 `.t-sec-title`(與內文同字級、靠字重區分,避免同一張卡出現三種字級)。列表每一列的標題是 `.t-item-title`(semibold,比 sec-title 輕——它是資料不是結構)。

- **色彩仍走既有色 token**:`.t-*` 帶的 color 只是預設值;狀態色(選取/錯誤/平台色)用 inline `color` 覆蓋即可——inline 贏類別,兩者可安全並存。
- `.t-meta` 與 `.t-note` 的差別只在行高:**單行**用 meta,**多行**用 note(1.7 才讀得下去)。誠實標示幾乎都是 note。

### 6.3 日期與數字

- 格式一律走 `src/utils/date.ts`,不在元件裡自己組:`fullDateLabel()`(頁面標頭)/`dateLabel(iso)`/`shortDateLabel(date)`/`shortDateTimeLabel(epochMs)`(M/D HH:mm,卡片時間戳);日記與排程的資料格式是含西元年的 `YYYY-MM-DD`。
- **所有數字欄位加 `t-num`**(時間戳、計數、統計、並排數列):等寬數字,否則逐日變動的位數會讓欄位左右跳動。統計數字用 `.t-stat`(已內含)。

### 6.4 回歸閘門

- `npm run test:typography`(`scripts/typography-audit.mjs`),已接入 `ci.yml` 與 `deploy.yml`。三條規則:①元件不得寫 inline 字級/字重/行高**字面值**;②`index.css` 的 `font-size`/`font-weight` 必須引用 token;③字重只有 400/500/600/700。
- **擋的是字面值,不是動態**:`fontWeight: active ? 'var(--weight-bold)' : 'var(--weight-medium)'` 這類 token 三元式過關(腳本把 token 抽掉後只看有沒有殘留數字)。
- **允許的 inline escape hatch**(值必須是 `var(--text-*)` / `var(--emoji-*)` / `var(--weight-*)` / `var(--leading-*)`),只有兩種正當情形:
  1. 元素的字色必須**繼承 `currentColor`**——套類別會把預設色一起帶進來(案例:排程頁週曆格,字色跟著選取狀態走)。
  2. 元素已掛了**排在 `.t-*` 之後**的既有類別(`.pill`/`.text-input`/`.btn`),同屬性會被後者贏(案例:便條頁篩選 chip 借用 `.pill` 配色但要 chip 字級)。
- **唯一豁免檔**:`src/components/PlatformBadge.tsx`——徽章字級是**幾何參數**(跟著 `size`/`radius` 由呼叫端整組給定),收進 `--text-*` 會讓徽章在不同尺寸下比例跑掉。豁免寫在腳本的 `EXEMPT` 常數旁並註明理由(對照 contrast-audit 的平台色例外)。
- 新 UI 動工前先讀本節;改 `.t-*` 或 token 後本地先跑 `npm run test:typography` 與 `npm run test:contrast`。
