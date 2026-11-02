# 貼便條功能規劃(POST-PLAN)

> 2026-11-01 維護者指示:開發一個小功能「貼便條 Post」——儲存一些小筆記、好的文章、靈感紀錄,「可以放在雲端列 Drive 之下」;同時把「編發器 Text」更名「編發器 Draft」比較適切。此批之後接續:日記匯出(DIARY-PLAN D6/D7)→ Threads 自動發文排程串接(日記 P2 / PIPELINE 第三源 `diary-ai`)。
>
> **拍板記錄(2026-11-01,開工前兩問)**:
>
> - **位置(D4)**=**新頁籤,排在雲端列 Drive 之後**(非 Drive 頁內的一張卡)。理由:便條是**第一方內容**(自己寫下/貼上的),Drive 頁是**第三方唯讀資料來源**(token 僅記憶體、內容絕不落地);兩者資料邊界相反,擠在同一頁會讓「哪些東西會留在這台機器」變模糊。維護者「放在 Drive 之下」採**側欄順序**解讀。
> - **備份範圍(D2)**=**納入文庫雲端備份**(獨立鍵 + payload 選用欄位),與日記同規。

## 背景與定位

既有三類文檔(草稿/文案/訊息)都以「要發出去的東西」為前提:文庫範本有分類、有平台變體、有使用統計。但日常會遇到一批**還不打算發、也可能永遠不發**的東西——看到的好文章連結、半句靈感、臨時筆記。塞進文庫範本會污染範本庫(使用統計與輪替選料會把它們當發文素材),寫進日記則與「當天的生活紀錄」語意不符。

便條因此是第四類:**低摩擦收集桶**。寫入成本要低(一個分類 chip + 內容即可存)、取用要快(搜尋 + 分類/標籤篩選 + 一鍵套用到編發器),不參與任何自動化選料(**不進管線輪替、不進文庫使用統計**)。

定位:**第一方內容、零後端、純前端落地**,與日記同一類資料邊界。

## 導覽變更

- `NAV_ITEMS` 順序(九頁籤):文管 Dashboard / 郵件匣 Gmail / 自媒體 Social / 雲端列 Drive / **貼便條 Post** / 編發器 Draft / 寫日記 Diary / 定排程 Task / 文庫 Library。
- `types.ts` 的 `Tab` 增 `'post'`;新頁面元件 `Post.tsx`;UI 字串入 `constants.ts`(`NOTES_COPY` / `NOTE_KIND_OPTIONS` / `NOTE_BODY_MAX` / `NOTES_PAGE_SIZE`)。
- icon=`IconNote`,幾何**逐字取自 Uniconsign `icons/symbols/science/sticky-note.svg`**(維護者指出該符號已存在;`order.json` 的 science 序列裡就排在 `diary`/`ledger` 旁,`codepoints.json` 也有),僅 fill 改 `currentColor`——同 `IconDiary` 紀律。**教訓**:本 repo 沒有 `icons/`,但設計系統在**本機** `~/Github-Projects/Uniconsign` 有 checkout;「這個 repo 裡找不到」不等於「沒有」,新增導覽符號前先去那個 checkout 的 `icons/order.json` 查一遍,不要自己手繪。
- **更名**:「編發器 Text」→「編發器 Draft」(維護者指示)。**只改顯示字串**,內部 Tab key 仍為 `'draft'`——更名後標籤與內部識別字反而一致了(2026-09-04 IA 重整留下的「內部識別字不隨之改名」債,這一項順手清掉)。E2E 的頁籤斷言與 `gotoTab` 同步改。

## 紅線(不因本功能改變)

- **零後端**:便條純前端,絕不進 worker/KV(雲端備份走方案 A 的密文 blob,對 worker 不透明——**worker 零改動、無部署、`DEPLOYS.md` 不記列**)。
- **不進 `family:*`**:家族契約鍵只有排程摘要與交接佇列;便條屬私密收集桶,明確排除。媒管庫若日後想要類似功能,自己建自己的鍵。
- **URL 欄位只存文字**:記下的連結是使用者貼進來的字串,app **不抓取、不預覽、不展開**該網址(抓取=把第三方內容拉進落地範圍,且會向外部站台洩漏瀏覽行為)。卡片上的「開啟連結 ↗」是純 `<a target="_blank" rel="noopener noreferrer">`。
- **不參與自動化**:便條不進管線選料(`pickRotated` / `pickJournalEntries`)、不計入文庫使用統計與發文趨勢。要發就經人手「套用到編發器」。

## 決策點(2026-11-01 拍板)

- **D1 儲存鍵**=**獨立鍵 `text-message:notes:v1`**(`services/notes/storage.ts`,storage 可注入測試),配獨立持久化 effect。沿用日記 D1 的同一個理由:便條是高頻小寫入,併入 `text-message:v2` 會讓每貼一張便條就重新序列化整包主 store;schema 日後演進也不必動主 store 遷移。防禦式解析同規(`version !== 1` → `[]`;單筆壞只丟那筆、不連坐整批)。quota 提示與主 effect/日記 effect 共用同一個 `storageQuotaWarned` 一次性 ref(每 session 只提示一次)。
- **D2 雲端備份範圍**=**納入**。`payload.ts` 新增**選用**欄位 `notes`(schema 維持 v1,與 `diary` 同規)——舊備份無此欄照樣通過驗證,且**還原時不動本機便條**(不是「=空便條」:便條與日記一樣不可再生,舊快照不得清掉現存資料)。自動同步觸發集合加 `notes`(貼便條也會 30 秒 debounce 備份)。還原確認 Modal 誠實標示張數或「不含便條」(`noteCount: number | null`,文案由 `constants.test.ts` 5 測守門——含「0 筆 ≠ 不含」這個容易寫錯的分支)。
- **D3 條目 schema**=`{ id, kind, title, body, url?, tags[], createdAt, updatedAt }`,`kind: 'note' | 'article' | 'idea'`(📝 筆記 / 🔗 好文章 / 💡 靈感——正好對應維護者說的三種用途)。
  - `title` 可空(便條的常見形態是只有一句內容);列表卡在無標題時只顯示內容。
  - `tags` 自由字串陣列,輸入以逗號(半/全形)、頓號或空白分隔(`parseTagsInput`,去重且保留輸入順序);頁面顯示**出現次數最多的前 12 個**標籤 pill 當快速篩選(`collectTags`)。自由標籤而非固定分類:收集桶的分類方式會隨使用習慣長出來,預先定義一定不夠用。
  - `body` 上限 2000 字(`NOTE_BODY_MAX`)。**刻意不設下限**——與日記的 100 字門檻相反:日記的下限是為了「值得留下的一天」,便條的價值恰在「一句話也能收」。
  - **不加**:附件/圖片(媒體不進文管庫)、提醒時間(那是排程的事)、巢狀資料夾(標籤已夠)。
- **D4 位置**=新頁籤,排在雲端列 Drive 之後(理由見上方拍板記錄)。
- **D5 取用路徑**:①**套用到編發器**——內容附加到既有草稿尾端並跳頁(沿用 `insertDriveText` 慣例,`noteInsertText` 組「標題/內容/網址」三段,**刻意不含標籤與分類**:那是收納用的中繼資料,不該混進文案);②**複製內容**(`navigator.clipboard`,沿 Drive 頁 `copyPreviewText` 慣例);③編輯/刪除,**刪除加確認 Modal**(與日記同規:貼進來的靈感與連結同樣不可再生)。
- **D6 分頁**:列表 20 筆一頁 + 載入更多(`NOTES_PAGE_SIZE`);換關鍵字/篩選時縮回第一頁。與同批為日記補的分頁缺口同一個作法。

## 分期

- **P1(2026-11-01 完成,本批)**:三分類便條的新增/編輯/刪除(確認 Modal)+ 搜尋(標題/內容/網址/標籤)+ 分類 pills 與標籤 pills 篩選 + 分頁 + 套用到編發器/複製 + 獨立鍵落地 + 納入雲端備份(D2)+ 九頁籤導覽與「編發器 Draft」更名。`services/notes/storage.ts` 17 測、`payload.ts` 選用欄位 1 測、`useAppStore` 備份還原斷言補 `noteCount` 與覆蓋/不覆蓋、`constants.test.ts` 還原文案 5 測;E2E 新增「貼便條:新增、持久化、篩選、套用到編發器、刪除」。
- **P2(候選)**:從編發器/Drive/郵件反向「存成便條」(目前只有便條→編發器的單向路徑);Gemini「這張便條能寫成什麼」靈感展開(BYOK 分流,無 key 僅提示)。
- **P3(候選;2026-11-03 拍板落點,實作未開工)**:便條匯出 Obsidian。原提議落點 Obsidian_Library 經查證有隱私矛盾——該 vault 為 **MIT 公開授權、推上 GitHub** 的知識庫(其 CLAUDE.md 明載「只有可公開的個人資訊才能進來」,有 guard 擋機密),而便條是**私密收集桶**,直接匯入=把私人內容推上公開 repo。**維護者拍板(同日)**:**便條改匯入 private 的 Obsidian_Journal `notes/` 資料夾**(一張一檔);**生成貼文/發佈記錄**(本就公開的內容)另行走 **Obsidian_Library**,其內資料夾待討論(候選:`posts/` 頂層——需先對照 Library 自身的 LLM-compiler 架構慣例再定)。機件面無障礙:日記匯出的 `vaultFs`+markdown 組裝可直接沿用。另記:兩 vault 實際路徑在 `D:\Obsidian_Journal` 與 `D:\Obsidian_Library`(11-01 文件所記 `~/Github-Projects/` 已過時)。
