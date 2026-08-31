# CLAUDE.md

文管庫(Galen-Chu/TEXT-Message)— 社群媒體每日發文工具。React 18 + TypeScript(strict)+ Vite 5,**純前端、無後端**,部署於 GitHub Pages(<https://galen-chu.github.io/TEXT-Message/>,push `main` 自動部署)。

## 常用指令

```bash
npm run dev        # 開發伺服器(localhost:5173)
npm run build      # tsc -b 型別檢查 + vite build
npm test           # 單元測試(vitest,src/**/*.test.ts)
npm run test:e2e   # Playwright E2E(serve dist;跑之前先 npm run build)
```

## 架構

- `src/hooks/useAppStore.ts` — 核心 store(單一 hook,元件以 props 接 `store`)
- `src/hooks/useGmail.ts` — Gmail 連線狀態機(`disabled|disconnected|connecting|connected|error`)
- `src/services/gmail/` — Gmail 模組:`gis`(OAuth token model)/`gmailApi`(REST)/`mime`(中文 MIME 解析)/`classify`(規則式分類)/`mapToEmail`/`config`/`errors`;皆純邏輯、DOM-free(node 環境可測)
- `src/services/gemini/rewrite.ts` — AI 文案(BYOK):語氣改寫/郵件摘要/自訂指令三個入口共用模型降級迴圈;prompt 組裝/回應解析/狀態碼對應為純函式;key 存 localStorage `text-message:gemini-key`(獨立於內容資料的 `text-message:v2`)
- `src/components/` — 六頁面 + Sidebar / Modal / PlatformBadge
- `src/data/mockData.ts` — 示範模式假資料(日期相對今天回推,不會過期)
- `src/constants.ts` — 平台定義、分類、語氣規則、`GMAIL_ERROR_COPY`(UI 字串集中於此)
- `vite.config.ts` 的 `base: '/TEXT-Message/'` 為 Pages 子路徑所需,勿移除

## 重要行為(修改時勿破壞)

- `emails` 由 useAppStore 推導:**以 `gmail.status` 判斷、不是長度**——連線後空收件匣不得退回示範資料
- localStorage 持久化僅限 templates / copyTemplates / scheduleItems / 草稿(draftText、draftPlatforms、draftSourceId;key `text-message:v2`);**emails 與 access token 絕不落地**(token 僅存記憶體,中斷連線即向 Google revoke)
- 未設定 `VITE_GMAIL_CLIENT_ID` 的建置=純示範模式(不出現連接按鈕),且**建置不得失敗**——PR CI 常態驗證此路徑
- 語氣改寫分流:`useAppStore.applyTone` 有 Gemini key → 真實 API(失敗時草稿不動、僅 toast);無 key → 規則示範(`TONE_REWRITES`)。郵件摘要(`convertToDraft`)與自訂指令(`applyCustomInstruction`)同為 BYOK 分流:前者無 key 退回節錄文案,後者無 key 僅提示不動作。**任何路徑都不得影響建置/CI**
- 分類器為規則式關鍵字(非 AI);「活動通知」一律不建議可發文(與示範資料行為一致)

## Gmail 串接設定

- 本機:`.env.local` 填 `VITE_GMAIL_CLIENT_ID`(範本見 `.env.example`)
- 正式:GitHub secret `GMAIL_CLIENT_ID` → `deploy.yml` 寫入 `.env.production`(缺 secret=示範模式部署,不失敗)
- 完整手冊(維護者/驗收測試者/自架者):`docs/SETUP.md`;設計規格:`docs/HANDOFF.md`

## CI/CD

- PR:`.github/workflows/ci.yml`(vitest → build → Playwright)
- main push:`deploy.yml`(test → build → E2E → Pages 部署;**E2E 是部署閘門**)
- E2E 跑在 `npm run preview`(含 base 路徑);CI 環境為示範模式建置,不觸碰 Google 網路

## 開發待辦與優化清單(2026-08-31 依程式碼實況盤點)

已上線:Gmail 唯讀收件匣(2026-08-18)、Gemini BYOK 語氣改寫(2026-08-28,`services/gemini/rewrite.ts`)。以下各項動手時仍受「重要行為」紅線約束。

### 待開發功能(依優先序;草稿持久化與範本編輯/刪除已於 2026-08-31 完成)

1. **排程狀態流轉與逾期提示** — 自建排程恆為 `scheduled`,無編輯、「已發佈/逾期」標記;逾期提示可純前端實作(載入時比對日期時間)
2. **社群平台發文歷史 API** — Social 頁仍為 mock:`socialHistory` 無 setter、每筆硬編「✓ 已發佈」(`Social.tsx`)。見架構決策點
3. **排程後端與提醒** — 見架構決策點;純前端替代方案為 Web Push + Service Worker

### 既有功能可優化(2026-08-31 完成第一輪)

本輪已完成:郵件→草稿真實 AI 摘要(`summarizeWithGemini`;無 key 時退回誠實的節錄文案)、Gmail「載入更多」分頁與視窗重回前景靜默刷新(`useGmail.loadMore`、60 秒冷卻)、草稿頁自訂指令輸入(`rewriteWithInstruction`,僅有 key 路徑)、規則示範語氣超過平台上限時明確提示、Modal Esc 關閉/focus trap/`role="dialog"`、toast `role="status"`、✕ 按鈕 aria-label、深色模式(`prefers-color-scheme` 覆寫 CSS 變數)、ID 改 `crypto.randomUUID`。

第二輪(同日)已完成:草稿持久化(`draftText`/`draftPlatforms`/`draftSourceId` 併入 `text-message:v2` 自動保存,`discardDraft` 捨棄)、文管庫範本編輯/刪除(`updateTemplate`/`deleteTemplate`,單一 modal 兼新增/編輯)、hooks 測試(`@testing-library/react` + jsdom,`useAppStore.test.ts`/`useGmail.test.ts`,全專案 73 測)。

仍待辦:

- 相依套件升級:2026-08-31 評估過,可用更新全為跨大版本(React 19、Vite 8、TS 7、Vitest 4),semver 範圍內無小版可升;建議另立技術債 sprint 一次處理並完整驗證,需同步 `package-lock.json`

### 架構決策點(與維護者確認後再動工,勿自行擴大範圍)

- 社群平台 API(FB/IG/Threads/X/LINE)多需後端與平台審核,與「純前端、無後端」定位衝突;無後端替代為「一鍵複製 + 各平台深連結」的發佈輔助
- 排程實際自動發佈同理需後端;純前端唯一的提醒手段是 Web Push + Service Worker

## 慣例

- 語言:zh-Hant;UI 字串集中放 `constants.ts`,不散落元件
- 新增純邏輯一律配 vitest 單元測試;hooks 測試以 `// @vitest-environment jsdom` 單檔切環境(@testing-library/react),不動全域 node 環境;E2E 維持 smoke 等級,不做完整流程自動化
- 版本與依賴異動需同步 `package-lock.json`(部署用 `npm ci`)
