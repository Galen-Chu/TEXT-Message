# 文管庫(社群媒體每日發文助手 v2)

個人自媒體經營者用的每日社群發文工具。核心流程:**Gmail 內容 / 文管庫常用內容 / 過去社群貼文 → 貼文草稿 → 跨平台排程**。

🔗 **線上 Demo**:<https://galen-chu.github.io/TEXT-message/>

依設計交接規格書(見 [`docs/HANDOFF.md`](docs/HANDOFF.md))以 **React 18 + TypeScript + Vite** 重新實作,高保真還原設計原型。

## 開發

```bash
npm install
npm run dev      # 開發伺服器
npm run build    # 型別檢查 + 產出 dist/
npm run preview  # 預覽建置結果
```

## 部署(GitHub Pages 自動部署)

push 到 `main` 即觸發 `.github/workflows/deploy.yml`:自動安裝依賴 → 型別檢查 + 建置 → 發佈到 GitHub Pages(`https://galen-chu.github.io/TEXT-message/`)。

首次啟用需到 repo **Settings → Pages → Source** 選擇「**GitHub Actions**」。

> 隱私說明:本專案目前**未串接任何真實 Gmail 或社群平台**。畫面上的帳號、郵件、
> 發文歷史均為寫死的示範假資料(`src/data/mockData.ts`),所有使用者看到相同內容;
> 自行新增的範本與排程會存於**各自瀏覽器的 localStorage**(重新整理不消失,清除瀏覽器資料即重置),
> 不會上傳任何伺服器,也不會存取或外洩任何人的資料。

## 功能一覽(依側邊欄導覽順序)

| 頁面 | 說明 |
| --- | --- |
| 首頁總覽 | 本週統計卡、近期排程、來自 Gmail 的靈感,一鍵轉草稿 |
| Gmail 郵件匣 | 搜尋 / 標籤篩選、AI 建議可發文標示、轉為草稿 |
| 社群媒體 | 各平台已發佈貼文歷史(唯讀),平台篩選,可作為草稿內容來源 |
| 排程管理 | 週曆檢視、選定日排程、所有排程總表,新增 / 刪除排程 |
| 草稿撰寫 | 來源參考(郵件 / 社群歷史)、AI 語氣改寫、文管庫插入、社群媒體挑選、多平台預覽與字數上限檢查 |
| 文管庫 | 兩分頁:**訊息管理**(通用文字片段)與**文案管理**(完整貼文範本),分類 / 搜尋 / 套用 / 複製 / 新增 |

> 介面支援窄視窗:720px 以下側邊欄自動收合為圖示列,統計卡與主要卡片區塊改為單欄排版。

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

目前全部資料為前端 mock,重新整理即重置。下一階段需串接:

- **Gmail API**(OAuth、郵件匣讀取):目前郵件與「AI 建議可發文」標記為假資料
- **文管庫後端儲存**(訊息管理 + 文案管理):目前以瀏覽器 localStorage 暫存(排程亦同),無跨裝置同步
- **社群媒體發文歷史**:需接各平台 API(Facebook / IG / Threads / LINE)讀取真實已發佈貼文
- **排程**:需接各平台發文 API 或內部排程資料庫 + 提醒機制
- **AI 語氣改寫**:需接真實 LLM API,目前為前端字串規則示範

## 設計參考

- `docs/HANDOFF.md` — 設計交接規格書 v2(畫面、互動、design tokens)
- `docs/prototype.html` — 高保真互動原型(參考用,非正式程式碼)

## 授權

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
