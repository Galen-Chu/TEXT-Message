# 罐頭訊息小幫手(社群媒體每日發文助手 v1)

個人自媒體經營者用的每日社群發文工具。核心流程:**Gmail 靈感 → 貼文草稿 → 跨平台排程**,搭配可重複使用的「罐頭訊息」範本庫。

依設計交接規格書(見 [`docs/HANDOFF.md`](docs/HANDOFF.md))以 **React 18 + TypeScript + Vite** 重新實作,高保真還原設計原型。

## 開發

```bash
npm install
npm run dev      # 開發伺服器
npm run build    # 型別檢查 + 產出 dist/
npm run preview  # 預覽建置結果
```

## 功能一覽

| 頁面 | 說明 |
| --- | --- |
| 首頁總覽 | 本週統計卡、近期排程、來自 Gmail 的靈感,一鍵轉草稿 |
| Gmail 收件匣 | 搜尋 / 標籤篩選、AI 建議可發文標示、轉為草稿 |
| 草稿撰寫 | 原始郵件參考、AI 語氣改寫(專業/親切/活潑/簡短)、罐頭訊息插入、多平台預覽與字數上限檢查 |
| 罐頭訊息庫 | 分類 / 搜尋範本,套用到草稿、複製、新增範本 |
| 排程管理 | 週曆檢視、選定日排程、所有排程總表,新增 / 刪除排程 |

## 專案結構

```
src/
  components/     # 五個頁面 + Sidebar、Modal、PlatformBadge、共用元件
  hooks/          # useAppStore:核心應用狀態與操作
  data/           # 示範用假資料(mock)
  utils/          # 日期 / 字數工具
  constants.ts    # 平台定義、篩選分類、語氣改寫規則
  types.ts        # 共用型別
```

## v1 範圍與已知限制(規格書「資料串接需求」)

目前全部資料為前端 mock,重新整理即重置。下一階段需串接:

- **Gmail API**(OAuth、收件匣讀取):目前郵件與「AI 建議可發文」標記為假資料
- **罐頭訊息庫後端儲存**:目前僅前端 state
- **社群平台發文 API**(Facebook / IG / Threads / LINE)或內部排程資料庫 + 提醒機制
- **AI 語氣改寫 LLM API**:目前為前端字串規則示範

## 設計參考

- `docs/HANDOFF.md` — 設計交接規格書(畫面、互動、design tokens)
- `docs/prototype.html` — 高保真互動原型(參考用,非正式程式碼)
