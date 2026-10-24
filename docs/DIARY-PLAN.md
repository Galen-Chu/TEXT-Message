# 日記功能規劃(DIARY-PLAN)

> 2026-10-24 維護者指示:規劃「寫日記」功能,側欄頁籤置於**編發器與定排程之間**;同日定名「寫日記 Diary」並指示開工。
>
> **拍板記錄(2026-10-24)**:頁籤名=「寫日記 Diary」(帶空格,沿「文管 Dashboard」慣例);D1–D5 依本文建議採用;D2 雲端備份納入但**實作排後續批**(P1 先純本機);P1 不放示範假條目——避免 mock 混入真實個人資料,空狀態改為引導文案;刪除加確認 Modal(日記是不可再生的長文內容,偏離文庫範本直接刪的慣例)。
>
> **同日追加(維護者指示)**:確認**年月日已有**(日期選擇器,`YYYY-MM-DD` 含西元年);**心情補上**——選填 8 選項 chips(`DIARY_MOODS`)、條目卡顯示 pill、納入搜尋;**內容長度限 100–500 字**(不足 100 不得儲存、`maxLength` 500、即時字數顯示)。

## 背景與定位

管線 P2(PIPELINE-PLAN D2)的日誌素材,目前取自維護者每天早上手寫的 Google Doc:補糧時 Drive 唯讀匯出 → `services/gemini/journal.ts` 解析 → Gemini 逐條生成。既有摩擦:

1. 寫日記要另外開 Google Docs,與發文工作流分離;
2. Drive token 僅記憶體(紅線),每次開站補糧前都要重連一次 Drive;
3. 「日誌原文絕不落地」紅線下,素材只存在 Google 雲端,本機無副本。

本功能把「寫」搬進文管庫:新增第八頁籤「寫日記 Diary」,置於編發器與定排程之間(維護者指示);icon=Uniconsign 科學「日誌本」(品牌優化 v4 已在 `BrandIcons.tsx` 檔頭註記保留,實作時新增 `IconDiary`,幾何逐字取自 `icons/symbols/science/diary.svg`,同 v4 產生器紀律)。

定位:日記是**私密的第一方內容**——寫作介面 + 管線素材源,零後端。

## 導覽變更(拍板後實作)

- `NAV_ITEMS` 順序:文管 Dashboard / 郵件匣 Gmail / 自媒體 Social / 雲端列 Drive / 編發器 Text / **寫日記 Diary** / 定排程 Task / 文庫 Library(第 6 位)。
- `types.ts` 的 `Tab` 增 `'diary'`;新頁面元件 `Diary.tsx`;UI 字串入 `constants.ts`(`DIARY_COPY`)。
- E2E「側邊欄七個分頁」斷言隨之改八,並新增日記 CRUD 持久化測試;**不放示範假條目**(拍板記錄見上)。

## 紅線(不因本功能改變)

- **零後端**:日記純前端,絕不進 worker/KV。
- **不進 `family:*`**:家族契約鍵只有排程摘要與交接佇列,日記屬私密資料,明確排除。
- **Gemini 僅生成當下**:沿用 `generateJournalPost` 既有隱私規則(不照抄原文、不提來源、用完即棄)。
- **「日誌原文絕不落地」的適用對象是 Drive 匯出物**;本機日記是使用者主動在 app 內寫下的第一方內容,落地 localStorage 即功能本身——與 emails「絕不落地」性質不同(後者是第三方信件)。此重新界定連同 D3 一併拍板。

## 決策點(待拍板)

- **D1 儲存鍵**:獨立鍵 `text-message:diary:v1`(建議)vs 併入 `text-message:v2`。獨立鍵=日記 schema 演進不動主 store 遷移、備份範圍好切(D2);併入=少一個鍵,但主 store 持久化 effect 會因高頻寫日記而頻繁序列化整包 v2。
- **D2 雲端備份範圍(2026-10-24 實作,隨 P1 同批)**:日記納入文庫雲端備份(方案 A)——`payload.ts` 新增**選用**欄位 `diary`(schema 維持 v1),備份/自動同步/還原全走既有零知識管線;自動同步觸發集合加 `diaryEntries`(寫日記也會 30 秒 debounce 備份)。**舊備份無此欄=還原時不動本機日記**(原規劃寫「=空日記」,修正理由:日記是不可再生內容,舊快照不得清掉現存日記);還原確認 Modal 誠實標示日記篇數或「不含日記」。512KB blob 上限對純文字日記很寬裕。
- **D3 管線來源整合(二期主體)**:`topUpPipeline` 的 journal-ai 分流增「本機日記」來源。建議來源 chips 改「範本/日記」,日記=本機條目直接讀(**免 Drive 重連**,消除摩擦②);Drive 日誌路徑保留為後援。`usedJournalDates` 兩來源共用同一份日期戳記,避免重複取材。
- **D4 條目 schema(一期;2026-10-24 追加 mood)**:`{ id, date: 'YYYY-MM-DD', title?, body, mood?, createdAt, updatedAt }`;日期=管線取材單位(與現行 D6 對齊),同日多筆生成時合併(沿用 `parseJournal` 慣例)。心情=選填 8 選項(`DIARY_MOODS`,同日追加——原「一期不加」由維護者指示翻案);內容長度 100–500 字屬 UI 層驗證,儲存層只驗結構;圖片不加。
- **D5 匯入既有 Google Doc(三期候選)**:一次貼入/匯入,解析沿用 `journal.ts` 的 D5 文字慣例(整行只有日期=新條目),把既有日誌無痛搬家。

## 分期

- **P1(2026-10-24 完成)**:撰寫/編輯/刪除(確認 Modal)+ 列表新→舊 + 搜尋;獨立儲存鍵 `text-message:diary:v1`(`services/diary/storage.ts`,storage 可注入測試);store 走獨立持久化 effect(quota 提示與主 effect 共用一次性 ref);E2E 八分頁+日記 CRUD。同日追加:心情(選填 8 選項,條目 pill+納入搜尋)與內容長度 100–500 字(下限門檻+`maxLength`+即時字數)。
- **P2**:管線來源=本機日記(D3);「從今日日記生成貼文」直通編發器(候選)。
- **P3(候選)**:Google Doc 匯入(D5)、條目內 AI 潤稿。
