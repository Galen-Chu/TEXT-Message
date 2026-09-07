# IA 重整規劃(資訊架構:頁籤命名、三大類文檔、生成與通知)

2026-09-04 維護者決議啟動。背景:原第六頁籤「文管庫」與產品名稱混淆(專案別名長期為文管庫,現回歸產品名 TEXT-Message),且文庫的內容分類、排程的對應維度需要一套一致的底層架構。本文件為決策記錄與分期路線;格式沿用 `docs/LIBRARY-PLAN.md`。

## 1. 決策記錄

- **D1(六頁籤命名與順序定案,雙語命名)**:文管 Dashboard(原首頁總覽)、郵件匣 Gmail(原 Gmail 郵件匣)、自媒體 Social(原社群媒體)、編輯器 Text(原草稿撰寫)、定排程 Task(原排程管理)、文庫 Library(原文管庫)。順序 v3 = 上列順序——**編輯器與定排程對調**(v2 為排程在前);側邊欄品牌字串由「文管庫」改為「TEXT-Message」。「文管 / 文庫」一字之差以英文後綴區隔(維護者拍板);「劃排程」定案為「定排程」。
- **D2(保留草稿編輯器為獨立頁面)**:否決同日稍早「草稿併入 Gmail 郵件匣」的提案——編輯器的入口不止郵件(社群歷史挑選、文庫插入、YouTube 上傳、Threads 代發),且需要空白草稿路徑;併入會讓郵件匣頁過重、非郵件入口無家可歸。「編輯器 Text」對齊產品名 TEXT-Message,是內容生產的心臟。
- **D3(底層文檔架構三大類)**:草稿管理(常用郵件編輯內容與歷史)、文案管理(常用發文內容與歷史)、訊息管理(常用留言內容與歷史)。與現況對映:訊息 ≈ 現有 `templates`(原罐頭訊息)、文案 ≈ 現有 `copyTemplates` + `publishedHistory`、草稿 = **新實體**(現況僅單一活草稿 `draftText`,升級為多筆可管理草稿集合)。localStorage 需向下相容遷移;紅線不變(emails 永不落地,遷移僅涉使用者內容)。
- **D4(編輯器依三大類文檔處理)**:編輯器除了空白草稿,亦依文檔類型(草稿/文案/訊息)提供對應處理——類型影響平台關聯、存檔歸位(存入文庫的對應分類)與後續排程歸屬。
- **D5(Gemini 生成依類型分流)**:prompt 依文檔類型調整以符合文章生成需求(草稿=信件語氣/精簡、文案=貼文/標籤/長文、訊息=回覆留言語氣);實作落點 `services/gemini`(rewrite.ts / variants.ts 的 prompt 組裝已是純函式)。BYOK 紅線與「無 key 顯示按鈕但點擊僅提示」的降級路徑不變。
- **D6(Social 互動通知——先評估後動工)**:評估串接發文分享留言的通知功能,連動互動式發文與留言。平台現實(2026-09-04 查證):Threads 可輪詢回覆/互動數據但**無 webhook 推送**(即時性=分鐘級),且「worker 代讀互動資料」屬後端職責擴張,需另案修訂資料邊界紅線措辭;IG 留言 webhook 需商業帳號;X 為付費層;YouTube 通知有 push 但留言 API 配額重。**候選一期(零平台審核、零紅線風險):以既有 Gmail 唯讀連線 + `classify` 模組分類各平台的互動通知信**,作為互動功能的第一步。
- **D7(Dashboard 移除「從 Gmail 建立草稿」按鈕)**:減少重複入口(郵件匣本身即有轉草稿流程);「來自 Gmail 的靈感」卡片與單信轉草稿保留;未來內部串接有需要再規劃。
- **D8(Phase 2 細部設計,2026-09-07)**:三大類文檔以 `DocKind = 'draft' | 'copy' | 'message'` 落地。新增 `DraftDoc { id, kind, title, text, platforms, sourceId, updatedAt }` 集合(`drafts[]`)與 `activeDraftId`,持久化於既有 `text-message:v2`(**加值欄位、不動舊欄位**——單一編輯緩衝 `draftText/draftPlatforms/draftSourceId` 照舊驅動編輯器,UI 零改動風險)。遷移:首次載入無 `drafts` 但有 `draftText` 時自動轉入一筆 `kind='draft'` 文檔(不清舊欄位)。文庫三分頁:訊息管理=`templates`、文案管理=`copyTemplates`、**草稿管理=`drafts`**(無分類,依 `updatedAt` 排序;操作:開啟至編輯器/複製/刪除)。編輯器 D4 v1:工具列「存為草稿」把目前緩衝存入草稿管理(標題取內容前綴);`'copy'/'message'` 兩類的編輯器內編輯流程與 Gemini 分流留待 Phase 3。
- **D9(Phase 3 細部設計,2026-09-07)**:Gemini 依文檔類型分流。編輯緩衝新增 `draftKind` 狀態(持久化,預設 `'copy'`——編輯器主產出仍是貼文),編輯器提供「文檔類型」chip 列(草稿/文案/訊息)。`rewrite.ts` 的 `buildRewritePrompt`/`buildInstructionPrompt` 增 `kind` 參數(預設 `'copy'` 維持現行行為):persona 與文體依類型——draft=電子報/資訊長文(分段條理)、copy=社群貼文(現行)、message=粉絲留言/私訊回覆(對話口吻 1–3 句)。`applyTone`/`applyCustomInstruction` 傳入 `draftKind`;`convertToDraft`/`startBlankDraft`/`discardDraft` 設回 `'copy'`(郵件→貼文仍為核心流程);`openDraftDoc` 載入文檔 kind;`saveDraft` 以 `draftKind` 寫入文檔。平台版本生成與標籤建議本質為貼文向,不隨 kind 變化(prompt 不動)。BYOK 紅線與無 key 降級路徑不變。
- **D10(Phase 4 細部設計,2026-09-07)**:排程對應三大類。`ScheduleItem` 增 **可選** `docKind?: DocKind`(舊資料無此欄位;顯示與篩選統一以 `docKind ?? 'copy'` 處理——既有排程實務上皆為貼文,不強制遷移)。建立路徑:`confirmSchedule`(編輯器「加入排程」)帶入當前 `draftKind`;`addManualSchedule` 增第 6 參數 `docKind`(預設 `'copy'`),Threads 排程代發路徑傳入 `draftKind`;`updateScheduleItem` 的 patch 允許 `docKind`。定排程頁:類別篩選 chips(全部/草稿/文案/訊息,本機狀態)套用於「選定日排程」與「所有排程」兩卡;排程列顯示類別徽章;新增/編輯 modal 增類型選擇(預設文案)。Dashboard 近期排程暫不加徽章(v1 範圍)。
- **D11(Phase 5 執行,2026-09-07)**:互動通知一期=**Gmail 通知信分類**(零平台審核、零紅線風險)——EmailTag 增「互動通知」(平台官方網域 `PLATFORM_NOTIFY_DOMAINS` 強訊號+具體互動片語,不用「留言」單詞),一律不建議可發文;郵件匣篩選 chip+自媒體頁「📬 最新互動」卡(最近 5 封,真實信件可深連結 Gmail 搜尋,回覆一律回平台 App)。二期以上(Threads 輪詢/IG webhook/X/YouTube)評估與紅線修訂案見 `docs/NOTIFY-PLAN.md`,**需維護者拍板才動工**。

## 2. 分期路線(每期獨立可驗收;CI 三關保持綠)

| 期 | 內容 | 主要落點 | 狀態 |
| --- | --- | --- | --- |
| Phase 1 | 六頁籤更名與順序 v3、側邊欄品牌改 TEXT-Message、`<title>` 更新、Dashboard 移除按鈕(D1/D7);UI 字串與 E2E/文件同步 | `Sidebar.tsx`、各頁 H1、`constants.ts`、`index.html`、`e2e/smoke.spec.ts`、README/HANDOFF/CLAUDE.md | ✅ 2026-09-04 完成 |
| Phase 2 | 三大類文檔模型(D3):草稿集合新實體 + localStorage 相容遷移;文庫三分頁;編輯器類型感知(D4);四期深化功能(變數/變體/統計/趨勢)搬遷驗證 | `useAppStore.ts`、`types.ts`、`Library.tsx`、`Draft.tsx` | ✅ 2026-09-07 完成(D8 v1 範圍:DraftDoc 集合+遷移、「儲存草稿」真實化、文庫草稿管理分頁;'copy'/'message' 的編輯器內編輯與 Gemini 分流屬 Phase 3) |
| Phase 3 | Gemini 依類型生成(D5) | `services/gemini/*`、`Draft.tsx`、`useAppStore.ts` | ✅ 2026-09-07 完成(D9:draftKind 狀態+文檔類型 chips、rewrite/instruction prompt 依類型分流;平台版本與標籤建議維持貼文向) |
| Phase 4 | 排程類別維度:`scheduleItems` 加類別欄位(舊資料給預設值)、定排程頁分組/篩選 | `useAppStore.ts`、`Schedule.tsx` | ✅ 2026-09-07 完成(D10:`docKind?` 可選欄位、建立三路徑帶入、篩選 chips+徽章+modal 選擇器) |
| Phase 5 | Social 互動通知:先出評估文件(含 D6 Gmail 通知分類一期方案與紅線修訂案),維護者拍板後動工 | 新評估文件 → `services/gmail/classify` 或 worker | ✅ 一期完成 2026-09-07(D11:Gmail 互動通知分類+自媒體最新互動卡;評估與二期方案見 `docs/NOTIFY-PLAN.md`,二期待拍板) |

## 3. 命名備忘

- Google OAuth 同意畫面的顯示名稱為 **Google Cloud 主控台的外部設定**,不在本 repo——若維護者將它改為 TEXT-Message,記得同步 `constants.ts` 的 `CONNECT_UNVERIFIED_HINT` 文案(現寫「前往 文管庫(不安全)」)。
- 程式內部識別字(`templates`、`copyTemplates`、Tab key 等)在 Phase 1 **不改名**——僅動使用者可見字串;內部命名配合 Phase 2 資料模型一併處理。
