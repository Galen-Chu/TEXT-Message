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
- **Note**: 頁面標題已改為「Gmail 郵件匣」(原「Gmail 收件匣」),實作時請統一沿用此名稱(Draft 頁空狀態按鈕亦已統一為「前往郵件匣挑選」)。實作補充:已連線時支援「載入更多」分頁(Gmail pageToken)與視窗重回前景靜默刷新(60 秒冷卻)。

### 3. 社群媒體(Social,新增頁面)
- **Purpose**: 呈現各社群平台過去已發佈貼文的歷史記錄,作為草稿撰寫時的內容參考來源。
- **Layout**: 頂部平台篩選 chip(全部 + Facebook/Instagram/Threads/LINE),下方白底卡片列表。
- **Components**: 每列含 34×34px 平台色塊圖示、標題、日期時間、內容摘要(單行截斷)、綠色「✓ 已發佈」狀態文字(`#06C755`)。
- **資料需求**: 為唯讀歷史記錄,正式環境應接各平台發文 API 或內部發文紀錄資料庫,欄位對應:platform、title、content、date、time。
- **實作補充(2026-09-02)**:「標記已發佈」產生的真實記錄寫入 `publishedHistory`(隨其他使用者內容持久化);有真實記錄時本頁完全取代示範資料(同 Gmail 連線的分流哲學),「(示範資料)」提示僅在無真實記錄時顯示。

### 4. 排程管理(Schedule)
- **Purpose**: 週曆檢視 + 選定日排程清單 + 全部排程總表,可新增/刪除。
- **Layout**: 7 欄週曆格,選中日高亮 `#6C5CE7`,有排程日顯示小圓點。下方「選定日排程」卡與「所有排程(依日期排序)」卡。
- **Components**: 排程列同 Dashboard 排程項樣式;新增排程走 modal(標題、日期、時間、平台單選)。
- **實作補充(2026-09-02)**:狀態新增 `published`(標記已發佈)與推導的「逾期」(scheduled 且過排定時間,不落地儲存,每分鐘重算);新增/編輯共用一個 modal(含選填貼文全文 `content`);每筆排程提供「複製 / 前往發佈 / 標記已發佈 / 編輯 / 刪除」——「前往發佈」在 Threads 以 intent 預填文字,FB/IG/LINE 先複製到剪貼簿再開平台頁;Dashboard 與本頁頂部均有逾期提示橫幅(點擊跳至最早逾期日/排程頁)。

### 5. 草稿撰寫(Draft)
- **Purpose**: 核心編輯頁——來源參考(郵件或社群歷史貼文)+ 文字編輯 + AI 語氣輔助 + 文管庫插入 + 社群媒體挑選 + 多平台預覽與字數檢查。
- **Layout**: 空狀態時置中提示卡,提供三個入口:「前往郵件匣挑選」「從社群媒體挑選」「空白草稿開始撰寫」。有目標時三段式:左側 280px 原始郵件參考卡(僅來源為 Gmail 時顯示)+ 右側主欄(工具列含「📋 從文管庫插入」與「📣 從社群媒體挑選」兩個按鈕、AI 語氣 chip 列、textarea 編輯框、平台勾選 chip、逐平台預覽卡、底部「捨棄草稿」/「儲存草稿」/「加入排程」按鈕)。草稿內容、平台選擇與來源自動持久化於 localStorage(重新整理不消失),「捨棄草稿」清空回到空狀態。
- **社群媒體串接邏輯**: 點擊「從社群媒體挑選」開啟 modal,列出 `socialHistory` 全部貼文供選擇;點擊任一則會將該貼文內容附加到目前 `draftText` 尾端(若尚無草稿目標則視為空白草稿開始),並關閉 modal、顯示 toast「已套用社群媒體歷史貼文」。此功能在空狀態卡片與編輯區工具列都提供入口,行為一致。
- **Components**: AI 語氣 chip(專業/親切/活潑/簡短)+ 自訂指令輸入框(Enter 或「套用」送出);textarea(min-height 160px,右下角字數);平台 chip(多選,含 20px 色塊 + 文字);逐平台預覽卡(顯示字數 / 上限,超字數變 `#E74C3C`)。
- **實作補充(2026-09-02,階段二)**:平台新增 **YouTube**(`yt`,色 `#FF0000`,說明上限 5000 字);勾選後出現「🎬 YouTube 上傳」卡片——瀏覽器端 Google OAuth(僅 `youtube.upload` 範圍,token 僅存記憶體),選影片檔後以草稿首行為標題、全文為說明(依 UTF-8 bytes 截斷)上傳;「立即公開」成功即寫入發文歷史,「預約發佈」以 YouTube 原生 `publishAt` 排程(零後端)並建立排程項目。未設定 Client ID 的建置不出現此卡片。

### 6. 文管庫(Library,原「罐頭訊息庫」重構)
- **Purpose**: 管理兩類可套用草稿的內容,以分頁(segmented tab)切分職責:
  - **訊息管理**:通用文字片段,適合直接套用(節慶祝賀、業配/產品促銷、粉絲互動、常見問答、感謝訊息)。
  - **文案管理**:完整社群貼文草稿範本,依內容企劃分類(日常分享、新品/業配、活動宣傳、品牌故事)。
- **Layout**: 頁首標題「文管庫」+「+ 新增內容」按鈕。標題下方為兩個分頁按鈕(訊息管理 / 文案管理),切換後下方分別呈現各自的左側分類清單(180px)+ 右側搜尋框 + 2 欄卡片網格。
- **新增內容邏輯**: 「+ 新增內容」開啟同一個 modal(標題「新增內容」),依目前所在分頁決定寫入「訊息管理」或「文案管理」的資料集,並使用該分頁當前選取的分類作為新項目分類。
- **編輯/刪除邏輯**: 每張內容卡提供「編輯」(開啟同一個 modal,預填標題與內容,儲存僅更新標題/內容、分類維持原值)與「刪除」(即時移除,toast 回覆)按鈕,與既有「套用到草稿」「複製」並列。
- **草稿插入邏輯**: 草稿頁「從文管庫插入」modal 會合併「訊息管理」與「文案管理」兩個資料集一併列出供選擇,不分頁籤。
- **Components**: 分頁按鈕(選中態 `#6C5CE7` 底白字);分類清單項(選中態 `#F1EDFF` 底 / `#6C5CE7` 字);內容卡片(分類 pill + 標題 + 內文 + 「套用到草稿」主按鈕 + 「複製」次按鈕)。
- **實作補充(2026-09-02,文管庫深化第一、二期)**:含 `{{變數}}` 的範本在套用/複製(與草稿頁插入)前先開填值 modal(即時預覽、留空保留原樣、可略過用原文);卡片顯示使用統計(「已用 N 次 · 最近 M/D」)並提供「最常用/最近使用」排序;社群媒體頁每筆記錄可「存為範本」寫入文案管理(選分類)。第二期平台變體:範本可存各平台專屬版本(編輯 modal 平台版本區),套用/插入時依草稿勾選平台組出 `[平台名 版]` 與 `[通用版]` 段落,複製可選版本;卡片以「含平台版本」pill 標示。

### Modals(共用互動層)
- **文管庫插入 modal**(標題「插入文管庫內容」):合併訊息管理+文案管理內容供草稿頁選用。
- **社群媒體挑選 modal**(標題「從社群媒體挑選」):列出全部歷史貼文,點擊即套用到草稿。
- **新增內容 modal**(標題「新增內容」):標題輸入 + 內容 textarea,依文管庫當前分頁寫入對應資料集。
- **加入排程 modal** / **手動新增排程 modal**:日期/時間輸入,顯示目標平台文字。
- 所有 modal:遮罩 `rgba(31,35,51,0.45)`,卡片白底 radius 18px padding 24px,置中顯示;支援 Esc 關閉、focus trap(`role="dialog"`),關閉時焦點還原給開啟者。
- **Toast**:右下角固定,`#1F2333` 底白字,radius 10px,2.2 秒自動消失,進場動畫 `translateY(12px)→0` + fade,0.2s ease。

## Interactions & Behavior
- 側邊導覽 6 個分頁,依上列順序排列,點擊切換 `activeTab`,active 態文字 `#6C5CE7` + 底色 `#F1EDFF`。
- Gmail 列表「轉為草稿」→ 先以郵件節錄立即寫入 draftText 並跳轉 Draft 分頁;已設定 Gemini key 時再以真實 AI 摘要取代(使用者已手動編輯則不覆蓋,失敗僅 toast),無 key 時維持節錄文案。
- 社群媒體歷史貼文「套用」→ 附加內容到 draftText、跳轉 Draft 分頁(從草稿頁內觸發時停留在原頁)。
- Draft 頁 AI 功能(BYOK,已上線):有 Gemini key → 語氣改寫 / 郵件摘要 / 自訂指令皆為真實 API(字數上限取所選平台最嚴格者);無 key → 語氣改寫為規則示範(超過平台上限時明確提示)、自訂指令僅提示不動作。
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
- `templates[]`: 訊息管理內容(id, category, title, text, appliedCount?, lastAppliedAt?)
- `copyTemplates[]`: 文案管理內容(同上)— 分類集與 templates 不同
- `socialHistory[]`: 社群媒體發文歷史(id, platform, title, content, date, time)— 「標記已發佈」的真實記錄(`publishedHistory`,持久化)優先,無記錄時為示範資料
- `scheduleItems[]`: 排程項目(id, date, time, platform, title, content?, status: draft|scheduled|published;「逾期」為依時間推導的顯示狀態,不儲存)
- `selectedMailId`: 目前草稿來源郵件 id、'blank' 或 null(三者皆隨草稿持久化)
- `draftText` / `draftPlatforms`(隨內容變動自動寫入 localStorage,與範本/排程同 key)
- `libraryMainTab`: 'message' | 'copy'(文管庫目前分頁)
- `libraryCategory` / `librarySearch`(訊息管理篩選)、`copyCategory` / `copySearch`(文案管理篩選)
- `socialFilter`(社群媒體平台篩選)
- `inboxSearch` / `inboxFilter`、`selectedDay`
- 各 modal 開關與暫存輸入值(showTemplatePicker、showSocialPicker、showNewTemplateModal、showScheduleModal、showNewScheduleModal)

### 資料串接需求(下一階段)
- ~~Gmail API 串接~~(已上線:瀏覽器端唯讀 OAuth + 本機規則分類;見 `docs/SETUP.md`)
- ~~AI 語氣改寫需接真實 LLM API~~(已上線:Gemini BYOK,含語氣改寫/郵件摘要/自訂指令;無 key 退回規則示範)
- 文管庫(訊息管理 + 文案管理)後端儲存:目前以瀏覽器 localStorage 暫存(排程亦同,重新整理不消失,無跨裝置同步);跨裝置同步屬未定案的遠期項,非現階段後端的職責
- 社群媒體發文歷史:近期為純前端「手動標記已發佈寫入 `socialHistory`」;讀取各平台 API 屬後端輔助階段(Facebook/IG/Threads;LINE 個人動態無 API)
- 排程:狀態流轉/逾期提示/發佈輔助為純前端近期工作;全自動發佈屬後端輔助階段——IG/Threads 無原生排程參數需自建 cron,YouTube 與 Facebook 粉專支援原生預約發佈

## 架構決策記錄(2026-09-02,維護者決議)

### 決議
1. 專案定位由「純前端、無後端」調整為「**前端為主、後端輔助(可選)**」。後端為漸進式、可退回的輔助角色:只負責 OAuth 代管、平台代發文(解決 CORS)、排程 cron;未設定後端時產品為完整半自動模式(一鍵複製 + 平台深連結),純前端 CI 路徑不變、建置不得失敗。
2. 後端資料邊界(紅線):後端僅接收**排程貼文內容**與平台 token(加密保存、可隨時 revoke);**emails 與 AI key 永遠只留在使用者瀏覽器**,不落地也不上傳。
3. 真實串接以 **YouTube 先行**(影片/Shorts + 文字說明;沿用 `services/gmail/gis` 模式加 `youtube.upload` scope,零後端)。注意:未過 Google API 稽核的專案,API 上傳影片一律鎖私人(2020-07-28 後建立的專案適用);YouTube 社群貼文(純文字)無公開 API;排程可用原生 `publishAt`(privacyStatus private + publishAt),免 cron。影音編輯等產品整合另案評估。
4. ~~後端形態:評估中~~(2026-09-02 定案:**Cloudflare Workers + KV 為主形態,GitHub Actions cron 混合為輔助變體**,於文件提供自架者作「零基建個人自用」選項。比較表見下方)。
5. **2026-09-02 收尾歸檔**:社群串接開發暫停(維護者時間因素)——階段 0/1/2 完成、階段 3 暫停於第一增量(`worker/` 骨架歸檔保留)、階段 4 未開工;**文管庫功能深化提前為現行工作流**,規劃設計見 `docs/LIBRARY-PLAN.md`。

### 發展階段(2026-09-02 收尾歸檔:0/1/2 完成,3 暫停於第一增量,4 未開工)
1. ~~**階段 1(純前端)**~~(2026-09-02 完成):排程狀態流轉(`published` 為儲存狀態、`overdue` 依時間推導不落地)+ 逾期提示(Dashboard/Schedule 橫幅)+ 排程編輯(新增/編輯共用 modal,含選填貼文全文);發佈輔助(一鍵複製 + 平台深連結——Threads intent 可預填文字,FB/IG/LINE 先複製再開平台頁);手動標記已發佈寫入 `publishedHistory`(Social 頁隨之真實化)
2. ~~**階段 2(零後端)**:YouTube 影片/Shorts 上傳(GIS + `youtube.upload`;排程用原生 publishAt)~~(2026-09-02 完成;**Google API 稽核申請待送出**——稽核前上傳一律鎖私人,見 SETUP.md §11)
3. **階段 3(後端輔助)**(**暫停中,骨架歸檔**):平台代發,順序 Threads(免費、審核較輕)→ IG(需商業帳號+綁粉專)→ X(量計費約 $0.015/則);cron 僅為無原生排程的平台存在;LINE 永遠手動。第一增量已完成並歸檔:`worker/` 骨架(Threads OAuth 代管、AES-GCM token 保存、立即代發、排程佇列 + 每分鐘 cron、部署手冊 `docs/BACKEND.md`);**恢復時從前端串接(`VITE_API_BASE` + 代發 UI)開始**
4. **階段 4(可選)**:Web Push + Service Worker 提醒

### 後端形態比較(2026-09-02 查證;待定案)

實際需求盤點:Meta/X 的 OAuth code exchange(confidential client,需公開 HTTPS callback)、token 加密保管與刷新、代發文(解決 CORS)、排程 cron(IG/Threads 無原生排程)、極小資料儲存(排程佇列);單人或極小規模使用、自架友善、零或極低成本、維運越少越好。

| 選項 | cron 精度(免費層) | OAuth callback | 內容/token 隱私 | 成本 | 維運 | 短評 |
| --- | --- | --- | --- | --- | --- | --- |
| **Cloudflare Workers + KV** | ✔ 每分鐘;免費 3 cron triggers/worker | ✔ 原生路由,公開 HTTPS | 私有;KV 自管加密 | 免費額度充裕(10 萬請求/日、KV 1000 寫/日,cron 呼叫不計入請求額度) | wrangler 部署,可併入現有 GitHub Actions pipeline | 最貼合需求 |
| Vercel Functions | ✘ Hobby 免費版 cron 限**每日一次**;分/時級需 Pro $20/月 | ✔ | 私有 | 免費版排程能力被閹割 | 前端在 GH Pages,需另開專案並處理並存 | 核心需求(排程)免費版不滿足 |
| GitHub Actions cron 混合 | △ best-effort:常見延遲 20–60 分鐘,極端可達小時級,可能整批跳過;60 天倉庫無活動自動停用 | ✘ callback 流程彆扭(需手動貼 code 走 workflow_dispatch) | **公開 repo 排程內容全可見**;私有 repo 佔 Actions 額度 | 免費 | 零基建,與現有 CI 同處 | 個人自用可行,產品級不足 |
| Supabase 等 BaaS | △ 需自排(pg_cron/外部觸發) | ✔ | 私有 | 免費版閒置一週暫停 | 多一整套平台/schema 要顧 | 能力過剩,超出輔助定位 |
| 自架 VPS | ✔ | ✔ | 私有 | 每月固定費用 | 需持續維運 | 違背輔助定位 |

**定案(2026-09-02)**:Cloudflare Workers + KV 為**主形態**——需求全覆蓋、免費層足夠、TS 原生可與前端共用型別、自架故事乾淨(fork → wrangler deploy → 設 3 個 secret);GitHub Actions cron 混合為**輔助變體**,於文件提供「零基建個人自用」選項。Vercel(免費層無分鐘級 cron)、Supabase(能力過剩)、自架 VPS(維運負擔)不採用。

## 文管庫(文案管理)功能評估(2026-09-02;**排程更新:社群管理開發已於同日收尾歸檔,本工作流提前為現行優先——完整規劃設計見 `docs/LIBRARY-PLAN.md`,本區保留為評估原始記錄**)

**現況**:Template 為 `{category, title, text}` 平面結構;發文記錄已真實化(`publishedHistory`);AI 已有語氣改寫/郵件摘要/自訂指令(Gemini BYOK)。

**缺口與機會(依純前端可行性排序)**:

1. 發文記錄縱深:記錄與來源範本無連結(無法追溯)、無各平台變體軌跡、無範本使用統計 → 可加 `sourceTemplateId`、`appliedCount` 等欄位向後相容演進
2. 範本形式:`{{變數}}` 佔位符是非正式慣例(無填值流程)、無平台變體欄位、單一分類維度、無媒體連結 → 正式化 placeholder 填值 + `platformVariants` + tags 為主要升級方向
3. 發文趨勢:目前僅「本月已發佈」單一數字;`publishedHistory` 已含平台/日期/時間,可純前端做頻率/時段/平台組合分析——**僅在有真實記錄時顯示**(示範資料不可用於趨勢);平台成效(觸及/互動)屬後端階段
4. Gemini 產出潛能(全 BYOK):平台適配變體生成(一份草稿→多平台版本)、以自身歷史貼文 few-shot 生成同風格新文案、hashtag/關鍵字建議、Gemini grounding(`google_search` 工具)查即時趨勢產靈感——均沿用 `services/gemini/rewrite.ts` 分流模式,不影響建置/CI

**建議節奏**(2026-09-02 決議:於階段 3/4 之後啟動):placeholder 填值與「以發文記錄建立範本」先做(小而確定)→ 平台變體 + 使用統計 → 趨勢分析 → AI 變體生成與 hashtag;成效趨勢與雲端同步綁在後端階段。

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
- 深色模式:系統 `prefers-color-scheme: dark` 時僅覆寫語意變數(背景/卡片/邊框/文字/pill 底),品牌紫與平台色維持不變;元件一律使用 CSS 變數,不出現寫死色碼

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
