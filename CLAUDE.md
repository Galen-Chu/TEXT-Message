# CLAUDE.md

文管庫(Galen-Chu/TEXT-message)— 社群媒體每日發文工具。React 18 + TypeScript(strict)+ Vite 5,**純前端、無後端**,部署於 GitHub Pages(<https://galen-chu.github.io/TEXT-message/>,push `main` 自動部署)。

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
- `src/components/` — 六頁面 + Sidebar / Modal / PlatformBadge
- `src/data/mockData.ts` — 示範模式假資料(日期相對今天回推,不會過期)
- `src/constants.ts` — 平台定義、分類、語氣規則、`GMAIL_ERROR_COPY`(UI 字串集中於此)
- `vite.config.ts` 的 `base: '/TEXT-message/'` 為 Pages 子路徑所需,勿移除

## 重要行為(修改時勿破壞)

- `emails` 由 useAppStore 推導:**以 `gmail.status` 判斷、不是長度**——連線後空收件匣不得退回示範資料
- localStorage 持久化僅限 templates / copyTemplates / scheduleItems(key `text-message:v2`);**emails 與 access token 絕不落地**(token 僅存記憶體,中斷連線即向 Google revoke)
- 未設定 `VITE_GMAIL_CLIENT_ID` 的建置=純示範模式(不出現連接按鈕),且**建置不得失敗**——PR CI 常態驗證此路徑
- 分類器為規則式關鍵字(非 AI);「活動通知」一律不建議可發文(與示範資料行為一致)

## Gmail 串接設定

- 本機:`.env.local` 填 `VITE_GMAIL_CLIENT_ID`(範本見 `.env.example`)
- 正式:GitHub secret `GMAIL_CLIENT_ID` → `deploy.yml` 寫入 `.env.production`(缺 secret=示範模式部署,不失敗)
- 完整手冊(維護者/驗收測試者/自架者):`docs/SETUP.md`;設計規格:`docs/HANDOFF.md`

## CI/CD

- PR:`.github/workflows/ci.yml`(vitest → build → Playwright)
- main push:`deploy.yml`(test → build → E2E → Pages 部署;**E2E 是部署閘門**)
- E2E 跑在 `npm run preview`(含 base 路徑);CI 環境為示範模式建置,不觸碰 Google 網路

## 開發待辦(仍為示範資料/前端規則)

社群平台發文歷史 API、排程後端與提醒、LLM 語氣改寫。

## 慣例

- 語言:zh-Hant;UI 字串集中放 `constants.ts`,不散落元件
- 新增純邏輯一律配 vitest 單元測試;E2E 維持 smoke 等級,不做完整流程自動化
- 版本與依賴異動需同步 `package-lock.json`(部署用 `npm ci`)
