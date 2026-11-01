# 日記功能規劃(DIARY-PLAN)

> 2026-10-24 維護者指示:規劃「寫日記」功能,側欄頁籤置於**編發器與定排程之間**;同日定名「寫日記 Diary」並指示開工。
>
> **拍板記錄(2026-10-24)**:頁籤名=「寫日記 Diary」(帶空格,沿「文管 Dashboard」慣例);D1–D5 依本文建議採用;D2 雲端備份納入但**實作排後續批**(P1 先純本機);P1 不放示範假條目——避免 mock 混入真實個人資料,空狀態改為引導文案;刪除加確認 Modal(日記是不可再生的長文內容,偏離文庫範本直接刪的慣例)。
>
> **同日追加(維護者指示)**:確認**年月日已有**(日期選擇器,`YYYY-MM-DD` 含西元年);**心情補上**——選填 8 選項 chips(`DIARY_MOODS`)、條目卡顯示 pill、納入搜尋;**內容長度限 100–500 字**(不足 100 不得儲存、`maxLength` 500、即時字數顯示)。
>
> **2026-10-30 匯出討論(收尾歸檔)**:維護者開始實機使用前完成機制確認(儲存=獨立鍵本機;備份=方案 A 單一最新快照;查閱=列表+搜尋,統計分析暫無);定案**應開發匯出**、落點=**Obsidian vault 專屬架構**(D6/D7)——方向定案,實作批細節拍板,排程見分期 P4。

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
- **D3 管線來源整合(二期主體;2026-10-24 串接評估定案——可行性高,機件九成已在)**:兩條路徑——
  - **A. 管線第三源「本機日記」(主,接 Threads 每日排程)**:`autoPipeline.source` 增 `'diary-ai'`,`topUpPipeline` 增 diary 分流:本機條目先**依日期分組合併**成 `{ date, title?, body }`(**與 `parseJournal` 產出同構**——同日多筆 append 沿用 D5 合併慣例)→ 直接餵既有 `pickJournalEntries`(**D6 選料零改動**:跳過 `usedJournalDates`、新→舊、取不滿就少排、全用過停止)→ `generateJournalPost` 生成(**mood 可注入 prompt 作語氣提示**,選用)→ 既有 `POST /api/schedule`(platform=threads)→ 每小時 cron 代發。**免 Drive 重連**(消除摩擦②——Drive token 僅記憶體的紅線必然結果),素材即時可得且已隨 D2 雲端備份跨裝置;Drive 日誌路徑保留為後援,`usedJournalDates` 兩來源共用同一份日期戳記防重複取材。來源 chips=「文庫範本輪替 / Drive 日誌 + AI 生成 / 本機日記 + AI 生成」。
  - **B. 條目卡「✨ 生成貼文」(輔)**:單筆日記 → `generateJournalPost` → 帶入編發器草稿,人審後經 PublishCard **任平台**發佈/排程(不限 Threads)。
  - **明確不做**:日記原文**逐字排程/發佈**(私密內容直上社群=隱私事故——一律經 AI 改寫,且保留既有兩道人審窗口:預排從明天起算、Dashboard「明天要發什麼」);不做背景自動取材(沿用管線「按下補糧才動」節奏)。**紅線零修訂**:日記不進 worker(進佇列的只有生成後的貼文成品)、Gemini 僅生成當下、worker 零改動。
- **D4 條目 schema(一期;2026-10-24 追加 mood)**:`{ id, date: 'YYYY-MM-DD', title?, body, mood?, createdAt, updatedAt }`;日期=管線取材單位(與現行 D6 對齊),同日多筆生成時合併(沿用 `parseJournal` 慣例)。心情=選填 8 選項(`DIARY_MOODS`,同日追加——原「一期不加」由維護者指示翻案);內容長度 100–500 字屬 UI 層驗證,儲存層只驗結構;圖片不加。
- **D5 匯入既有 Google Doc(三期候選)**:一次貼入/匯入,解析沿用 `journal.ts` 的 D5 文字慣例(整行只有日期=新條目),把既有日誌無痛搬家。
- **D6 匯出功能(2026-10-30 討論定案方向,未開工)**:應開發——補現有儲存架構三個縫。①雲端備份為**單一最新快照、無版本歷程**(誤刪 30 秒後自動備份即覆蓋雲端副本;本機與雲端同時出事=日記消失),匯出檔是唯一「凍結於時間點、不被後續操作覆蓋」的保存形式;②**512KB blob 上限**(與文庫全部內容共用,每日一篇約 200–400 篇逼近)——匯出使「年度封存」工作流可行(年底匯出該年→自 app 刪除舊年份→localStorage 與 blob 同時減壓),**不換資料庫即撐長期**(維護者前提:無需雲端/本地資料庫);③資料自主權——日記是不可再生內容,使用者手上應有一份自己掌控的檔案。兩種出口互補:**活體副本**(D7 Obsidian:人讀、可搜尋、長期累積)與**冷備份**(月/年彙整檔下載,選配——vault 自有備份/同步時可降為次要)。
- **D7 Obsidian 匯出落點(2026-10-30 維護者提議;2026-11-01 開工前查實際 vault 後兩問拍板並完成一期)**:
  - **技術路徑**:File System Access API(`showDirectoryPicker` 挑 vault 資料夾→瀏覽器直接寫 `.md`);Chrome/Edge 支援,**Firefox/Safari 不支援目錄寫入→退回彙整 markdown 下載**;GitHub Pages HTTPS 滿足 secure context。**零後端、紅線零修訂**(資料不出機器,較雲端備份更保守)。
  - **落點拍板=併入 vault 既有的 life 條目 `daily/life/YYYY-MM-DD.md`**(否決原案的專屬 `Journal/` 資料夾)。**動工前查實際 vault(`~/Github-Projects/Obsidian_Journal`)才看到的事實**:vault 已有 `daily/work|life|dreams` 結構、`templates/life-daily.md` 範本、以及吃 `daily/life` 的 `scripts/review.py` 與 `weekly_digest.py`——獨立資料夾會讓匯出的日記**不被既有統計腳本看到**,等於在同一個 vault 裡養出第二套日記。新建檔案比照範本形狀(frontmatter `type/date/tags/mood/energy` + `# 🌱 Life · <date>` + 四個固定小節 + 尾段分隔線 + `*[[weekly-YYYY-Www]]*` 反向連結)。
  - **寫入方式拍板=標記區塊 splice**(`<!-- text-message:diary -->` … `<!-- /text-message:diary -->`),**原案「整檔覆蓋、以 app 為準」已否決**。否決理由是查 vault 自己的 `CLAUDE.md` 時撞上的硬規則:多 session 寫入紀律第一條「**只 append,不改寫**」,腳本只更新自己帶標記的區段、手寫內容視為唯讀(vault 的 digest 腳本就是這個作法,標記慣例直接沿用)。因此不再有「Obsidian 端手改會被覆蓋」的代價——app 只擁有自己標記之間那一段,其餘(含 frontmatter 與手寫小節)原封不動;冪等。
  - **心情與標籤**:mood 寫成**區塊內**的 `**心情**:<值>` 一行;frontmatter 的 `mood:` **只有 app 新建該檔時**才填,既有檔案的 frontmatter 一律不碰。**不自創標籤**(原案的 `journal/<心情>` 階層標籤已放棄)——vault 標籤慣例是收斂不發散、新標籤要先進清單,新建檔沿用範本的 `tags: [life]` 即可。
  - **增量**:匯出戳記 `date → 當時該天的最大 updatedAt`,只重寫「上次匯出後有變更」的天。戳記放**自己的鍵** `text-message:diary-export:v1`(`services/diary/exportStore.ts`)且**刻意不進雲端備份**——它回答的是「這台機器的那個資料夾收到哪一版了」,同步到別台只會讓另一台誤判已寫過而跳過該寫的天。遺失戳記不壞資料(splice 冪等,最壞只是多寫幾個檔)。
  - **在 app 刪掉的日記不會從 vault 移除**:匯出檔的意義就是 D6 ① 的「凍結於時間點、不被後續操作覆蓋」,刪除不同步過去(UI 已標示)。
  - **自動匯出的真實語意=半自動**:handle 只存記憶體(刻意不用 IndexedDB 保存),非安裝式網頁重啟後首次匯出需再挑一次資料夾。二期選配 session 內 debounce 與「本月尚未匯出」淡提示。
  - **與 D5 連動**:匯入器 round-trip 對象=**自己匯出的格式**;D5 的 Google Doc 純文字慣例不變,兩種格式並存。
  - **vault 安全邊界**:本模組從頭到尾只開 `daily/life/` 這一個子樹、只讀寫 `YYYY-MM-DD.md`;vault 的禁止事項(不動 `.obsidian/`、不刪 `archive/`、不改既有 `scripts/`)自然滿足。日記內容本來就不含 token/密碼(紅線:token 絕不落地),符合 vault「嚴禁把帳密寫進日誌」的規則。

## 分期

- **P1(2026-10-24 完成)**:撰寫/編輯/刪除(確認 Modal)+ 列表新→舊 + 搜尋;獨立儲存鍵 `text-message:diary:v1`(`services/diary/storage.ts`,storage 可注入測試);store 走獨立持久化 effect(quota 提示與主 effect 共用一次性 ref);E2E 八分頁+日記 CRUD。同日追加:心情(選填 8 選項,條目 pill+納入搜尋)與內容長度 100–500 字(下限門檻+`maxLength`+即時字數)。
- **P2**:管線來源=本機日記(D3 兩路徑:**A 管線 diary 分流先做**——分組合併純函式+測試、`topUpPipeline` 分流、管線卡 chips+文案+誠實標示;**B 條目卡生成貼文後做**——按鈕+store 動作)。各約一小批,worker 零改動。
- **P3(候選)**:Google Doc 匯入(D5)、條目內 AI 潤稿。
- **P4 匯出(D6/D7)——一期 2026-11-01 完成**:`vaultMarkdown.ts` 純邏輯(檔名/ISO 週標籤/區塊組裝/新建筆記/splice/增量判定/範圍界線/彙整檔)22 測、`exportStore.ts` 戳記獨立鍵 8 測、`vaultFs.ts` 檔案系統層(唯一碰 DOM 的一支,自備 `showDirectoryPicker` ambient 型別)、store `pickDiaryVault`/`exportDiaryToVault`(逐日獨立 try,**單天失敗不連坐**、只有寫成功的天記戳記)配 2 個 hook 測(假 handle 跑完整流程,已以 mutation 驗證守得住 splice 與增量)、日記頁匯出卡(範圍 chips/選資料夾/待寫天數/上次匯出/三條誠實標示)。worker 零改動。
  - **ISO 週標籤**特別對照 vault `scripts/journal.py` 的 `_iso_week`:**週編號年份不等於日曆年份**(2027-01-01 屬 2026-W53、2025-12-29 屬 2026-W01),不能用 `getFullYear()`;實作與 Python `isocalendar()` 逐日比對 762 天零差異。
  - **一期刻意不做**:session 內 debounce 自動匯出、「本月尚未匯出」提示、月/年彙整冷備份檔(Firefox/Safari 退路已順手提供單一彙整 markdown)、便條一併匯出(POST-PLAN P3 候選,markdown 組裝可共用這批純函式)。
