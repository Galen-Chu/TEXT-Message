# Handoff: 罐頭訊息 WebAPP(社群媒體每日發文助手 v1)

## Overview
個人自媒體經營者用的每日社群發文工具。核心價值:把 Gmail 中的靈感/內容轉換成跨平台貼文草稿,搭配可重複使用的「罐頭訊息」範本庫,並管理跨平台發佈排程。v1 聚焦「Gmail → 草稿 → 排程」主流程,AI 僅作為語氣改寫的輔助功能。

## About the Design Files
本包內的 HTML 檔(`罐頭訊息APP.dc.html`)是**設計參考原型**,用來展示畫面外觀與互動行為,並非可直接沿用的正式程式碼。請在目標專案既有的技術環境(React / Vue / 其他既有框架與元件庫)中,依照本文件描述**重新實作**這些畫面與互動;若專案尚無既有前端環境,建議選用 React + TypeScript。

## Fidelity
**高保真(hifi)**:顏色、字體、間距、互動狀態均為設計終版,可依此精確還原。文字內容(郵件、範本文案)為示範用假資料,實作時需改為真實 Gmail API 資料與使用者輸入。

## Screens / Views

### 1. Dashboard(首頁總覽)
- **Purpose**: 每日進入的總覽頁,快速看到本週統計、近期排程、Gmail 靈感。
- **Layout**: 左側固定 232px 側邊欄 + 右側主內容區(padding 32px 40px)。頂部標題列(問候語 + 日期 + 兩個 CTA 按鈕)。下方 4 欄統計卡片橫排(flex, gap 16px)。再下方左右各半的「近期排程」與「來自 Gmail 的靈感」卡片(flex, gap 20px)。
- **Components**:
  - 統計卡片:白底、border-radius 16px、padding 20px、陰影 `0 2px 10px rgba(108,92,231,0.06)`;數值 26px/900,標籤 12.5px/#8B87A8。
  - 排程列表項:34×34px 平台色塊圖示(border-radius 9px)+ 標題(13.5px/600)+ 日期時間(12px/#8B87A8),底部 1px `#F1EFFA` 分隔線。
  - Gmail 靈感卡:border 1px `#F1EFFA`、radius 12px、內含主旨(13px/700)、標籤 pill(#F1EDFF 底 / #6C5CE7 字)、摘要(12px/#8B87A8)、「轉為草稿→」連結(12px/700/#FF7A59)。

### 2. Inbox(Gmail 收件匣)
- **Purpose**: 瀏覽/搜尋/篩選 Gmail 內容,標示 AI 判斷適合轉發文的郵件,一鍵轉草稿。
- **Layout**: 頂部搜尋框(最大寬 320px)+ 篩選 chip 群(全部/電子報/合作邀約/讀者來信/活動通知)。下方白底卡片列表,每列 flex 排列:38px 圓形頭像縮寫、寄件者/主旨/摘要、標籤 pill、右側「轉為草稿」按鈕。
- **Components**:
  - 篩選 chip:選中態 `#6C5CE7` 底白字,未選 白底 + `#E4E1F5` 邊框。
  - AI 建議 pill:`#FFF1EC` 底 / `#FF7A59` 字,文案「✨ AI 建議可發文」。

### 3. Draft(草稿撰寫)
- **Purpose**: 核心編輯頁——來源郵件參考 + 文字編輯 + AI 語氣輔助 + 罐頭訊息插入 + 多平台預覽與字數檢查。
- **Layout**: 空狀態時置中提示卡(前往收件匣 / 空白草稿兩個入口)。有目標時三段式:左側 280px 原始郵件參考卡(限有來源郵件時顯示)+ 右側主欄(AI 語氣 chip 列、textarea 編輯框、平台勾選 chip、逐平台預覽卡、底部「儲存草稿」/「加入排程」按鈕)。
- **Components**:
  - AI 語氣 chip:專業/親切/活潑/簡短,點擊即時改寫 textarea 內容(規則見下方狀態管理)。
  - textarea:min-height 160px、radius 12px、border `#E4E1F5`,右下角顯示字數。
  - 平台 chip:含 20px 平台色 badge + 文字,選中態 `#F1EDFF` 底 / `#6C5CE7` 字。
  - 平台預覽卡:每個已選平台各一張,顯示字數 / 字數上限,超字數時字數顏色變 `#E74C3C`。

### 4. Library(罐頭訊息庫)
- **Purpose**: 管理常用文案範本,可分類搜尋、套用到草稿、複製、新增。
- **Layout**: 左側 180px 分類清單(全部/節慶祝賀/業配產品促銷/粉絲互動/常見問答/感謝訊息),右側搜尋框 + 2 欄卡片網格(grid, gap 14px)。
- **Components**: 範本卡含分類 pill、標題(14px/700)、內文(12.5px/#8B87A8)、「套用到草稿」主按鈕 + 「複製」次按鈕。新增範本走 modal(標題輸入 + 內容 textarea)。

### 5. Schedule(排程管理)
- **Purpose**: 週曆檢視 + 選定日排程清單 + 全部排程總表,可新增/刪除。
- **Layout**: 7 欄週曆格(grid, gap 8px),選中日高亮 `#6C5CE7`,有排程日顯示小圓點。下方「選定日排程」卡與「所有排程(依日期排序)」卡。
- **Components**: 排程列同 Dashboard 排程項樣式;新增排程走 modal(標題、日期、時間、平台單選)。

### Modals(共用互動層)
- 罐頭訊息插入 modal、新增範本 modal、加入排程 modal(日期/時間 + 顯示目標平台文字)、手動新增排程 modal。所有 modal:遮罩 `rgba(31,35,51,0.45)`,卡片白底 radius 18px padding 24px,置中顯示。
- Toast:右下角固定,`#1F2333` 底白字,radius 10px,2.2 秒自動消失,進場動畫 `translateY(12px)→0` + fade,0.2s ease。

## Interactions & Behavior
- 側邊導覽 5 個分頁(Dashboard/Inbox/Draft/Library/Schedule),點擊切換 `activeTab`,active 態文字 `#6C5CE7` + 底色 `#F1EDFF`。
- Gmail 列表「轉為草稿」→ 寫入 draftText(郵件摘要 + AI 產生提示文字)、記錄來源郵件 id、跳轉 Draft 分頁。
- Draft 頁 AI 語氣 chip:純前端規則示範(非真實 AI),生產環境應接後端 AI 改寫 API。
- 平台 chip 為多選(toggle),對應顯示/隱藏該平台的預覽卡與字數上限檢查。
- 「加入排程」→ 開 modal 選日期時間 → 確認後依已選平台各建立一筆排程,寫回 Schedule 分頁對應日期並自動跳轉。
- Library 套用範本 → 附加到目前 draftText 尾端(用兩個換行分隔),若尚無草稿目標則視為空白草稿開始。
- Schedule 週曆點日期切換 `selectedDay`,下方清單即時篩選;刪除排程即時移除該筆。
- 所有 modal 皆有遮罩點擊外部/取消按鈕關閉(目前原型僅按鈕可關閉,建議實作加上點擊遮罩關閉)。

### 動畫
- Toast 進場:`opacity 0→1`、`translateY(12px)→0`,0.2s ease。
- 其餘為即時狀態切換,無轉場動畫。

## State Management
建議的核心狀態(對應原型 state):
- `activeTab`: 'dashboard' | 'inbox' | 'draft' | 'library' | 'schedule'
- `emails[]`: Gmail 郵件列表(id, sender, subject, snippet, fullBody, date, tag, suitable)—實作時應改為呼叫 Gmail API 取得
- `templates[]`: 罐頭訊息範本(id, category, title, text)
- `scheduleItems[]`: 排程項目(id, date, time, platform, title, status)
- `selectedMailId`: 目前草稿來源郵件 id,或 'blank'
- `draftText`: 目前編輯中的草稿文字
- `draftPlatforms`: { fb, ig, threads, line } 布林值多選
- `inboxSearch` / `inboxFilter`、`librarySearch` / `libraryCategory`、`selectedDay`:各頁篩選狀態
- 各 modal 的開關狀態(showTemplatePicker、showNewTemplateModal、showScheduleModal、showNewScheduleModal)與其暫存輸入值

### 資料串接需求(下一階段)
- Gmail API 串接(OAuth、讀取收件匣、篩選/標籤邏輯,目前「AI 建議可發文」為假資料標記,需替換為真實分類模型或規則)
- 罐頭訊息庫需接後端儲存(目前僅前端 state,重新整理會消失)
- 排程需接各社群平台發文 API(Facebook/IG/Threads/LINE)或至少接內部排程資料庫 + 提醒機制
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
- 錯誤/超字數:`#E74C3C`
- 平台色:Facebook `#1877F2`、Instagram `#C13584`、Threads `#101010`、LINE `#06C755`

### Typography
- 字體:`Noto Sans TC`(中文)+ `Poppins`(數字/英文標題),sans-serif fallback
- 主標題:20–22px / 900
- 卡片標題:14–15px / 700
- 內文:12.5–13.5px / 400–600
- 輔助文字/meta:11–12px / 500–700

### Spacing / Radius
- 卡片 radius:14–18px;chip/按鈕 radius:8–10px;圓形頭像:50%
- 卡片間距 gap:14–20px;內部 padding:14–24px
- 陰影統一:`0 2px 10px rgba(108,92,231,0.06)`(卡片);modal 遮罩 `rgba(31,35,51,0.45)`

## Assets
無外部圖片素材,全部為 emoji 圖示(🏠📥✍️🗂️📅✨📢💌等)與純色平台字母 badge。生產實作建議改用正式 icon set(如 Lucide/Feather)與各平台官方 badge/logo(需遵守平台品牌規範)。

## Files
- `罐頭訊息APP.dc.html` — 完整互動原型(單檔,含 Dashboard/Inbox/Draft/Library/Schedule 五頁 + 4 個 modal + toast),可直接在瀏覽器開啟操作。
- `screenshots/01-dashboard.png` — 首頁總覽
- `screenshots/02-inbox.png` — Gmail 收件匣
- `screenshots/03-draft.png` — 草稿撰寫(已選郵件來源)
- `screenshots/04-library.png` — 罐頭訊息庫
- `screenshots/05-schedule.png` — 排程管理
