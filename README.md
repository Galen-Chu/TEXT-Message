# 文管庫

個人自媒體經營者用的每日社群發文工具。核心流程:**Gmail 內容 / 文管庫常用內容 / 過去社群貼文 → 貼文草稿 → 跨平台排程**。

🔗 **線上 Demo**:<https://galen-chu.github.io/TEXT-Message/>

依設計交接規格書(見 [`docs/HANDOFF.md`](docs/HANDOFF.md))以 **React 18 + TypeScript + Vite** 重新實作,高保真還原設計原型。

## 開發

```bash
npm install
npm run dev      # 開發伺服器
npm run build    # 型別檢查 + 產出 dist/
npm run preview  # 預覽建置結果
npm test         # 單元測試(vitest)
npm run test:e2e # E2E smoke(Playwright,serve dist;需先 npm run build)
```

本機要連真實 Gmail:依 [`docs/SETUP.md`](docs/SETUP.md) §5,複製 `.env.example` 為 `.env.local` 並填入 `VITE_GMAIL_CLIENT_ID`。

## 部署(GitHub Pages 自動部署)

push 到 `main` 即觸發 `.github/workflows/deploy.yml`:安裝依賴 → 單元測試 → 型別檢查 + 建置 → E2E smoke → 發佈到 GitHub Pages(`https://galen-chu.github.io/TEXT-Message/`)。PR 另有 CI 檢查(`.github/workflows/ci.yml`)。

首次啟用需到 repo **Settings → Pages → Source** 選擇「**GitHub Actions**」。

若 repo secret `GMAIL_CLIENT_ID` 已設定,建置時會注入,正式站即可連接真實 Gmail(設定教學見 [`docs/SETUP.md`](docs/SETUP.md) §6);未設定則部署為**純示範模式**(不出現連接按鈕),建置不會失敗。

> 隱私說明:本專案目前**沒有後端**,資料處理都在瀏覽器內完成。Gmail 功能採瀏覽器端 Google OAuth(**唯讀**範圍):access token 僅存記憶體、中斷連線即撤銷,郵件解析與分類都在使用者瀏覽器內完成,不會上傳任何伺服器;AI 功能採 BYOK——Gemini API key 僅存各自瀏覽器,由瀏覽器直接呼叫 Google。未連線時的郵件與社群發文歷史仍為示範假資料(`src/data/mockData.ts`);自行新增的範本、排程、已發佈記錄與未完成草稿存於**各自瀏覽器的 localStorage**(重新整理不消失,清除瀏覽器資料即重置)。詳見 [`docs/SETUP.md`](docs/SETUP.md) §9。
>
> 架構方向(2026-09 決議):**前端為主、後端輔助(可選)**——規劃中的後端僅作平台串接輔助(OAuth 代管/代發文/排程 cron),僅接收排程貼文內容與平台 token(加密保存、可隨時 revoke);emails 與 AI key 永不上傳。未設定後端時為完整半自動模式(一鍵複製 + 平台深連結),見下方「發展路線」。

## 功能一覽(依側邊欄導覽順序)

| 頁面 | 說明 |
| --- | --- |
| 首頁總覽 | 本週統計卡、近期排程、來自 Gmail 的靈感,一鍵轉草稿;發文趨勢精簡版(近 30 天平台計數與連續天數,累積 5 筆真實記錄後出現) |
| Gmail 郵件匣 | **連接真實 Gmail(瀏覽器端唯讀 OAuth)**:近 7 天郵件、搜尋 / 標籤篩選(規則式分類)、建議可發文標示、轉為草稿、載入更多與前景自動刷新;未連線時為示範模式 |
| 社群媒體 | 各平台已發佈貼文歷史,平台篩選,可作為草稿內容來源;在排程頁「標記已發佈」後即為真實記錄(無記錄時為示範資料);單筆記錄可「存為範本」進文管庫;**發文趨勢**(近 30/90 天平台計數、時段分佈、連續天數——僅計真實記錄) |
| 排程管理 | 週曆檢視、排程新增 / 編輯 / 刪除;狀態流轉(草稿 / 已確認 / 逾期 / 已發佈)與逾期提示;發佈輔助:一鍵複製 + 開啟平台(Threads 可預填文字) |
| 草稿撰寫 | 來源參考(郵件 / 社群歷史)、AI 語氣改寫與自訂指令、AI 郵件摘要、**AI 產生平台版本**(依勾選平台生成各版,可編輯後附加或存為範本)與**建議標籤**、文管庫插入(含 `{{變數}}` 填值)、社群媒體挑選、多平台預覽與字數上限檢查;**YouTube 影片/Shorts 直接上傳**(草稿作為標題與說明,支援原生預約發佈);草稿自動保存於瀏覽器,可捨棄重來 |
| 文管庫 | 兩分頁:**訊息管理**(通用文字片段)與**文案管理**(完整貼文範本),分類 / 搜尋 / 排序(最常用 / 最近使用)/ 套用 / 複製(含變數填值)/ 新增 / 編輯 / 刪除;卡片顯示使用統計;**平台變體**:同一範本可存各平台專屬版本,套用時依勾選平台自動帶入 |

> 介面支援窄視窗:720px 以下側邊欄自動收合為圖示列,統計卡與主要卡片區塊改為單欄排版。亦支援深色模式(依系統 `prefers-color-scheme` 自動切換)。

### v2 相對 v1 的主要變更

- 原「罐頭訊息庫」重構為「**文管庫**」,拆分為訊息管理 + 文案管理兩個分頁(各自獨立的分類與搜尋)
- 新增「**社群媒體**」發文歷史頁,草稿撰寫可直接從歷史貼文挑選內容
- 側邊欄導覽順序調整為:首頁總覽 → Gmail 郵件匣 → 社群媒體 → 排程管理 → 草稿撰寫 → 文管庫
- 「Gmail 收件匣」更名為「Gmail 郵件匣」

## 專案結構

```
src/
  components/     # 六個頁面 + Sidebar、Modal、PlatformBadge、共用元件
  hooks/          # useAppStore:核心應用狀態與操作
  data/           # 示範用假資料(mock)
  utils/          # 日期 / 字數工具
  constants.ts    # 平台定義、篩選分類、語氣改寫規則
  types.ts        # 共用型別
```

## v2 範圍與已知限制(規格書「資料串接需求」)

- **Gmail API 已串接**(瀏覽器端唯讀 OAuth,設定與驗收見 [`docs/SETUP.md`](docs/SETUP.md));分類標籤與「建議可發文」為**本機關鍵字規則**,非 AI,誤判屬已知限制,接 LLM 為後續階段
- **AI 文案功能已上線(BYOK)**:於「AI 設定」輸入自己的 Gemini API key(僅存各自瀏覽器)後,語氣改寫、郵件摘要與自訂指令走真實 Gemini;未設 key 時語氣改寫為規則示範
- **社群媒體發文歷史**:「標記已發佈」的真實記錄已上線(存於各自瀏覽器);直接讀取各平台 API 屬後端輔助階段(Facebook / IG / Threads;LINE 個人動態無 API)
- **文管庫後端儲存**(訊息管理 + 文案管理):目前以瀏覽器 localStorage 暫存(排程亦同),無跨裝置同步
- **排程**:狀態流轉、逾期提示與發佈輔助(一鍵複製 + 平台深連結)已上線(純前端半自動);全自動發佈屬後端輔助階段——IG/Threads 無原生排程參數需後端 cron,YouTube 與 Facebook 粉專支援原生預約發佈
- **YouTube 上傳已上線**(瀏覽器端 OAuth,僅 `youtube.upload` 範圍,設定見 [`docs/SETUP.md`](docs/SETUP.md) §11):未完成 Google API 稽核的專案,上傳影片會被鎖定為私人(可至 YouTube Studio 手動公開);YouTube 社群貼文(純文字)無公開 API

## 發展路線(2026-09-02 收尾歸檔後現況)

**前端為主、後端輔助(可選)**。已完成:排程管理與發佈輔助(階段一)、**YouTube 影片/Shorts 上傳**(階段二,瀏覽器端 Google OAuth、零後端)、**文管庫功能深化四期**(範本填值、平台變體、發文趨勢、AI 平台版本與標籤建議——[`docs/LIBRARY-PLAN.md`](docs/LIBRARY-PLAN.md));平台代發後端骨架(階段三第一增量——`worker/` 與部署手冊 [`docs/BACKEND.md`](docs/BACKEND.md),**暫停開發、恢復時從前端串接開始**)。接續開發候選:階段三前端串接(Threads 代發 UI)、階段四 Web Push 提醒、遠期 F8。各階段細節與後端形態比較見 [`docs/HANDOFF.md`](docs/HANDOFF.md) 架構決策記錄。

## 設計參考

- `docs/SETUP.md` — Gmail 串接設定與驗收測試手冊(維護者 / 驗收測試者 / 自架者)
- `docs/HANDOFF.md` — 設計交接規格書 v2(畫面、互動、design tokens)
- `docs/prototype.html` — 高保真互動原型(參考用,非正式程式碼)

## 授權

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
