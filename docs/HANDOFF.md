# Handoff: 社群媒體罐頭訊息 WebAPP(每日發文助手 v2)

## Overview
個人自媒體經營者用的每日社群發文工具。核心價值:把 Gmail 內容、文管庫的常用內容、以及過去發布過的社群貼文,快速轉換成跨平台貼文草稿,並管理跨平台發佈排程。v2 在 v1 的基礎上,將原本單一的「罐頭訊息庫」拆分為職責更清楚的「文管庫」(訊息管理 + 文案管理)與獨立的「社群媒體」發文歷史頁,並讓草稿撰寫可直接串接社群媒體歷史內容。

## About the Design Files
本包內的 HTML 檔(`罐頭訊息APP.dc.html`)是**設計參考原型**,展示畫面外觀與互動行為,並非可直接沿用的正式程式碼。請在目標專案既有的技術環境(React / Vue / 其他既有框架)中,依本文件描述**重新實作**;若專案尚無既有前端環境,建議選用 React + TypeScript。

## Fidelity
**高保真(hifi)**:顏色、字體、間距、互動狀態均為設計終版。文字內容(郵件、範本文案、歷史貼文)為示範假資料,實作時需改為真實 Gmail API 資料、使用者輸入、以及各平台發文歷史資料。

## 導覽結構(側邊欄,由上到下)
1. 首頁總覽(Dashboard)
2. Gmail 郵件匣(Inbox)
3. 社群媒體(Social,發文歷史)
4. 排程管理(Schedule)
5. 草稿撰寫(Draft)
6. 文管庫(Library:訊息管理 / 文案管理)

> 導覽順序為使用者手動調整過的最終順序,實作時請依此順序呈現,不要沿用舊版(Gmail 收件匣→草稿撰寫→文管庫→排程管理)的排列。

## Screens / Views

### 1. Dashboard(首頁總覽)
- **Purpose**: 每日進入的總覽頁,快速看到本週統計、近期排程、Gmail 靈感。
- **Layout**: 左側固定 232px 側邊欄 + 右側主內容區(padding 32px 40px)。頂部標題列(問候語 + 日期 + 兩個 CTA:「從 Gmail 建立草稿」「瀏覽文管庫」)。下方 4 欄統計卡片橫排。再下方左右各半的「近期排程」與「來自 Gmail 的靈感」卡片。
- **Components**: 統計卡片(白底、radius 16px、陰影 `0 2px 10px rgba(108,92,231,0.06)`);排程列表項(34×34px 平台色塊圖示 + 標題 + 日期時間);Gmail 靈感卡(標籤 pill + 摘要 + 「轉為草稿→」連結)。

### 2. Inbox(Gmail 郵件匣)
- **Purpose**: 瀏覽/搜尋/篩選 Gmail 內容,標示 AI 判斷適合轉發文的郵件,一鍵轉草稿。
- **Layout**: 頂部搜尋框 + 篩選 chip 群(全部/電子報/合作邀約/讀者來信/活動通知)。下方白底卡片列表,每列含頭像縮寫、寄件者/主旨/摘要、標籤 pill、右側「轉為草稿」按鈕。
- **Note**: 頁面標題已改為「Gmail 郵件匣」(原「Gmail 收件匣」),實作時請統一沿用此名稱;Draft 頁空狀態按鈕文字目前仍寫「前往收件匣挑選」,建議實作時一併統一為「前往郵件匣挑選」以維持一致性。

### 3. 社群媒體(Social,新增頁面)
- **Purpose**: 呈現各社群平台過去已發佈貼文的歷史記錄,作為草稿撰寫時的內容參考來源。
- **Layout**: 頂部平台篩選 chip(全部 + Facebook/Instagram/Threads/LINE),下方白底卡片列表。
- **Components**: 每列含 34×34px 平台色塊圖示、標題、日期時間、內容摘要(單行截斷)、綠色「✓ 已發佈」狀態文字(`#06C755`)。
- **資料需求**: 為唯讀歷史記錄,正式環境應接各平台發文 API 或內部發文紀錄資料庫,欄位對應:platform、title、content、date、time。

### 4. 排程管理(Schedule)
- **Purpose**: 週曆檢視 + 選定日排程清單 + 全部排程總表,可新增/刪除。
- **Layout**: 7 欄週曆格,選中日高亮 `#6C5CE7`,有排程日顯示小圓點。下方「選定日排程」卡與「所有排程(依日期排序)」卡。
- **Components**: 排程列同 Dashboard 排程項樣式;新增排程走 modal(標題、日期、時間、平台單選)。

### 5. 草稿撰寫(Draft)
- **Purpose**: 核心編輯頁——來源參考(郵件或社群歷史貼文)+ 文字編輯 + AI 語氣輔助 + 文管庫插入 + 社群媒體挑選 + 多平台預覽與字數檢查。
- **Layout**: 空狀態時置中提示卡,提供三個入口:「前往收件匣挑選」「從社群媒體挑選」「空白草稿開始撰寫」。有目標時三段式:左側 280px 原始郵件參考卡(僅來源為 Gmail 時顯示)+ 右側主欄(工具列含「📋 從文管庫插入」與「📣 從社群媒體挑選」兩個按鈕、AI 語氣 chip 列、textarea 編輯框、平台勾選 chip、逐平台預覽卡、底部「儲存草稿」/「加入排程」按鈕)。
- **社群媒體串接邏輯**: 點擊「從社群媒體挑選」開啟 modal,列出 `socialHistory` 全部貼文供選擇;點擊任一則會將該貼文內容附加到目前 `draftText` 尾端(若尚無草稿目標則視為空白草稿開始),並關閉 modal、顯示 toast「已套用社群媒體歷史貼文」。此功能在空狀態卡片與編輯區工具列都提供入口,行為一致。
- **Components**: AI 語氣 chip(專業/親切/活潑/簡短,前端規則示範改寫);textarea(min-height 160px,右下角字數);平台 chip(多選,含 20px 色塊 + 文字);逐平台預覽卡(顯示字數 / 上限,超字數變 `#E74C3C`)。

### 6. 文管庫(Library,原「罐頭訊息庫」重構)
- **Purpose**: 管理兩類可套用草稿的內容,以分頁(segmented tab)切分職責:
  - **訊息管理**:通用文字片段,適合直接套用(節慶祝賀、業配/產品促銷、粉絲互動、常見問答、感謝訊息)。
  - **文案管理**:完整社群貼文草稿範本,依內容企劃分類(日常分享、新品/業配、活動宣傳、品牌故事)。
- **Layout**: 頁首標題「文管庫」+「+ 新增內容」按鈕。標題下方為兩個分頁按鈕(訊息管理 / 文案管理),切換後下方分別呈現各自的左側分類清單(180px)+ 右側搜尋框 + 2 欄卡片網格。
- **新增內容邏輯**: 「+ 新增內容」開啟同一個 modal(標題「新增內容」),依目前所在分頁決定寫入「訊息管理」或「文案管理」的資料集,並使用該分頁當前選取的分類作為新項目分類。
- **草稿插入邏輯**: 草稿頁「從文管庫插入」modal 會合併「訊息管理」與「文案管理」兩個資料集一併列出供選擇,不分頁籤。
- **Components**: 分頁按鈕(選中態 `#6C5CE7` 底白字);分類清單項(選中態 `#F1EDFF` 底 / `#6C5CE7` 字);內容卡片(分類 pill + 標題 + 內文 + 「套用到草稿」主按鈕 + 「複製」次按鈕)。

### Modals(共用互動層)
- **文管庫插入 modal**(標題「插入文管庫內容」):合併訊息管理+文案管理內容供草稿頁選用。
- **社群媒體挑選 modal**(標題「從社群媒體挑選」):列出全部歷史貼文,點擊即套用到草稿。
- **新增內容 modal**(標題「新增內容」):標題輸入 + 內容 textarea,依文管庫當前分頁寫入對應資料集。
- **加入排程 modal** / **手動新增排程 modal**:日期/時間輸入,顯示目標平台文字。
- 所有 modal:遮罩 `rgba(31,35,51,0.45)`,卡片白底 radius 18px padding 24px,置中顯示。
- **Toast**:右下角固定,`#1F2333` 底白字,radius 10px,2.2 秒自動消失,進場動畫 `translateY(12px)→0` + fade,0.2s ease。

## Interactions & Behavior
- 側邊導覽 6 個分頁,依上列順序排列,點擊切換 `activeTab`,active 態文字 `#6C5CE7` + 底色 `#F1EDFF`。
- Gmail 列表「轉為草稿」→ 寫入 draftText(郵件摘要 + AI 產生提示文字)、記錄來源郵件 id、跳轉 Draft 分頁。
- 社群媒體歷史貼文「套用」→ 附加內容到 draftText、跳轉 Draft 分頁(從草稿頁內觸發時停留在原頁)。
- Draft 頁 AI 語氣 chip:純前端規則示範(非真實 AI),生產環境應接後端 AI 改寫 API。
- 平台 chip 為多選(toggle),對應顯示/隱藏該平台的預覽卡與字數上限檢查。
- 「加入排程」→ 開 modal 選日期時間 → 確認後依已選平台各建立一筆排程,寫回 Schedule 分頁對應日期並自動跳轉。若當下未勾選任何平台,則 fallback 以 Facebook 建立一筆(目前實作行為,見 `useAppStore.confirmSchedule`)。
- 文管庫套用範本 → 附加到目前 draftText 尾端(用兩個換行分隔),若尚無草稿目標則視為空白草稿開始。
- Schedule 週曆點日期切換 `selectedDay`,下方清單即時篩選;刪除排程即時移除該筆。

### 動畫
- Toast 進場:`opacity 0→1`、`translateY(12px)→0`,0.2s ease。
- 其餘為即時狀態切換,無轉場動畫。

## State Management
建議的核心狀態:
- `activeTab`: 'dashboard' | 'inbox' | 'social' | 'schedule' | 'draft' | 'library'
- `emails[]`: Gmail 郵件列表 — 實作時應改為呼叫 Gmail API
- `templates[]`: 訊息管理內容(id, category, title, text)
- `copyTemplates[]`: 文案管理內容(id, category, title, text)— 分類集與 templates 不同
- `socialHistory[]`: 社群媒體發文歷史(id, platform, title, content, date, time)— 唯讀,來自各平台 API
- `scheduleItems[]`: 排程項目(id, date, time, platform, title, status)
- `selectedMailId`: 目前草稿來源郵件 id,或 'blank'
- `draftText` / `draftPlatforms`
- `libraryMainTab`: 'message' | 'copy'(文管庫目前分頁)
- `libraryCategory` / `librarySearch`(訊息管理篩選)、`copyCategory` / `copySearch`(文案管理篩選)
- `socialFilter`(社群媒體平台篩選)
- `inboxSearch` / `inboxFilter`、`selectedDay`
- 各 modal 開關與暫存輸入值(showTemplatePicker、showSocialPicker、showNewTemplateModal、showScheduleModal、showNewScheduleModal)

### 資料串接需求(下一階段)
- Gmail API 串接(OAuth、讀取郵件匣、真實分類/建議邏輯取代假資料標記)
- 文管庫(訊息管理 + 文案管理)需接後端儲存,目前僅前端 state
- 社群媒體發文歷史需接各平台 API(Facebook/IG/Threads/LINE)讀取真實已發佈貼文
- 排程需接各平台發文 API 或內部排程資料庫 + 提醒機制
- AI 語氣改寫需接真實 LLM API(目前為前端字串規則示範)

## Design Tokens

### Colors
- 主色(品牌紫):`#6C5CE7`
- 輔色(強調橘):`#FF7A59`
- 主背景:`#F6F5FB`
- 卡片背景:`#FFFFFF`
- 邊框/分隔線:`#ECEAF7` / `#F1EFFA` / `#E4E1F5`
- 主文字:`#1F2333`
- 次文字:`#5B5773`
- 弱文字:`#8B87A8` / `#B4AFCB`
- 淡紫底 pill:`#F1EDFF` / `#EDEAFB`
- 淡橘底 pill:`#FFF1EC`
- 已發佈狀態綠:`#06C755`
- 錯誤/超字數:`#E74C3C`
- 平台色:Facebook `#1877F2`、Instagram `#C13584`、Threads `#101010`、LINE `#06C755`

### Typography
- 字體:`Noto Sans TC`(中文)+ `Poppins`(數字/英文標題),sans-serif fallback
- 主標題:20–22px / 900;卡片標題:14–15px / 700;內文:12.5–13.5px / 400–600;輔助文字:11–12px / 500–700

### Spacing / Radius
- 卡片 radius:14–18px;chip/按鈕 radius:8–10px;圓形頭像:50%
- 卡片間距 gap:14–20px;內部 padding:14–24px
- 陰影統一:`0 2px 10px rgba(108,92,231,0.06)`(卡片);modal 遮罩 `rgba(31,35,51,0.45)`

## Assets
無外部圖片素材,全部為 emoji 圖示(🏠📥📣📅✍️🗂️✨📢💌等)與純色平台字母 badge。生產實作建議改用正式 icon set(如 Lucide/Feather)與各平台官方 badge/logo(需遵守平台品牌規範)。

## Files
- `docs/prototype.html` — 完整互動原型(單檔,含 Dashboard/Inbox/Social/Schedule/Draft/Library 六頁 + 5 個 modal + toast),可直接在瀏覽器開啟操作。即原設計交接包內的 `罐頭訊息APP.dc.html`,收入本 repo 時更名。
- 原設計交接包另附 `screenshots/01-dashboard.png`–`06-library.png` 六張畫面截圖,未隨本 repo 收錄;如需查看畫面,請直接開啟原型檔或線上版(見 README「部署」段)。

以上為最新版本(v2)畫面,反映目前導覽順序與命名。
