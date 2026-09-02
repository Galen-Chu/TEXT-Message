# CLAUDE.md

文管庫(Galen-Chu/TEXT-Message)— 社群媒體每日發文工具。React 18 + TypeScript(strict)+ Vite 5,**前端為主、後端輔助(可選)**——目前程式碼仍為純前端、無後端,部署於 GitHub Pages(<https://galen-chu.github.io/TEXT-Message/>,push `main` 自動部署);規劃中的後端僅作平台串接輔助(OAuth 代管/代發文/排程 cron),未設定後端時產品為完整半自動模式。

## 常用指令

```bash
npm run dev        # 開發伺服器(localhost:5173)
npm run build      # tsc -b + worker 型別檢查 + vite build
npm test           # 單元測試(vitest,src/** 與 worker/src/** 的 *.test.ts)
npm run test:e2e   # Playwright E2E(serve dist;跑之前先 npm run build)
```

## 架構

- `src/hooks/useAppStore.ts` — 核心 store(單一 hook,元件以 props 接 `store`)
- `src/hooks/useGmail.ts` — Gmail 連線狀態機(`disabled|disconnected|connecting|connected|error`)
- `src/services/gmail/` — Gmail 模組:`gis`(OAuth token model)/`gmailApi`(REST)/`mime`(中文 MIME 解析)/`classify`(規則式分類)/`mapToEmail`/`config`/`errors`;皆純邏輯、DOM-free(node 環境可測)
- `src/services/youtube/` — YouTube 上傳模組(階段二):`gis`(沿用 gmail 的 GIS script 載入、獨立 token client,僅 `youtube.upload` scope)/`uploadApi`(resumable 兩步上傳,XHR 進度)/`video`(metadata 組裝與發佈計畫,UTF-8 bytes 上限,純邏輯)/`config`/`errors`;`src/hooks/useYoutube.ts` 為連線狀態機(鏡像 useGmail)
- `worker/` — 平台代發後端(階段三,Cloudflare Workers + KV,零額外依賴):`src/index.ts`(路由 + 每分鐘 cron)/`threads/`(OAuth 交換/刷新 + container 發佈,可注入 fetcher 測試)/`store/`(AES-GCM 加密 + KV 存取)/`queue/`(到期/退避純邏輯);部署手冊 `docs/BACKEND.md`;worker 有獨立 tsconfig,`npm run build` 會一併型別檢查
- `src/services/gemini/rewrite.ts` — AI 文案(BYOK):語氣改寫/郵件摘要/自訂指令三個入口共用模型降級迴圈;prompt 組裝/回應解析/狀態碼對應為純函式;key 存 localStorage `text-message:gemini-key`(獨立於內容資料的 `text-message:v2`)
- `src/components/` — 六頁面 + Sidebar / Modal / PlatformBadge
- `src/data/mockData.ts` — 示範模式假資料(日期相對今天回推,不會過期)
- `src/constants.ts` — 平台定義、分類、語氣規則、`GMAIL_ERROR_COPY`(UI 字串集中於此)
- `vite.config.ts` 的 `base: '/TEXT-Message/'` 為 Pages 子路徑所需,勿移除

## 重要行為(修改時勿破壞)

- `emails` 由 useAppStore 推導:**以 `gmail.status` 判斷、不是長度**——連線後空收件匣不得退回示範資料
- localStorage 持久化僅限 templates / copyTemplates / scheduleItems / publishedHistory(標記已發佈的真實記錄)/ 草稿(draftText、draftPlatforms、draftSourceId;key `text-message:v2`);**emails 與 access token 絕不落地**(token 僅存記憶體,中斷連線即向 Google revoke)
- 未設定 `VITE_GMAIL_CLIENT_ID` 的建置=純示範模式(不出現連接按鈕),且**建置不得失敗**——PR CI 常態驗證此路徑
- YouTube 上傳(階段二)同規:Client ID 沿用 `VITE_YOUTUBE_CLIENT_ID`(缺時 fallback `VITE_GMAIL_CLIENT_ID`),未設定的建置不出現上傳區、建置不得失敗;token 僅存記憶體、中斷即 revoke。未過 Google API 稽核的專案上傳一律鎖私人(UI 已誠實標示);排程用 YouTube 原生 `publishAt`(private+publishAt),**零後端、不經任何第三方**
- 後端資料邊界(階段 3 後端上線後適用):後端僅接收**排程貼文內容**與平台 token(加密保存、可隨時 revoke);**emails 與 AI key 永遠只留在使用者瀏覽器**,不落地也不上傳。未設定後端端點(暫名 `VITE_API_BASE`)的建置=完整半自動模式(一鍵複製+平台深連結),建置不得失敗
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

## 開發待辦與優化清單(2026-09-02 社群管理開發收尾歸檔)

**階段現況(2026-09-02 收尾確立)**:階段 0(定位調整)／階段 1(排程管理與發佈輔助)／階段 2(YouTube 上傳)**完成**;階段 3(平台代發)**暫停於第一增量**——`worker/` 骨架(Threads OAuth 代管、加密 token、代發、排程 cron)已歸檔保留並完成測試與部署手冊(`docs/BACKEND.md`),前端串接與 IG/X 未開工;階段 4(Web Push)未開工。**恢復社群串接開發時,從「階段 3 前端串接」開始**。

已上線:Gmail 唯讀收件匣(2026-08-18)、Gemini BYOK 語氣改寫(2026-08-28,`services/gemini/rewrite.ts`)。以下各項動手時仍受「重要行為」紅線約束。

### 待開發功能(依現行優先序)

1. **文管庫功能深化(現行工作流;2026-09-02 決議自「階段 3/4 之後」提前)** — **第一至三期已完成(2026-09-02)**。第一期:範本變數填值(`utils/variables.ts`)、Social 頁「存為範本」、使用統計與排序。第二期:平台變體(`platformVariants` + `utils/variants.ts`,依勾選平台插入 `[平台名 版]`/`[通用版]` 段落,複製可選版本)。第三期:發文趨勢(`utils/trends.ts` 純函式 + `components/TrendsPanel.tsx`——Social 完整版 30/90 天切換+時段分佈+連續天數等、Dashboard 精簡版近 30 天計數;**僅計 `publishedHistory` 真實記錄,門檻 5 筆**,示範資料永不參與;長條單一色相、平台識別靠文字標籤——平台色填充經驗證器實測不符深淺色對比,不用)。D6 定案:Dashboard/Social 維持拆分,未來可加獨立趨勢觀察頁。決策點記錄見 `docs/LIBRARY-PLAN.md` §6。**待續:第四期 Gemini 平台適配變體生成/hashtag 建議(無 key 顯示但提示)**
2. **階段 3 前端串接(暫停中)** — `VITE_API_BASE` + Threads 代發 UI + 排程同步 worker 佇列;恢復時機由維護者決定(Threads App 審核與 worker 部署見 `docs/BACKEND.md`)。待辦提醒:送出 Google API 稽核申請(表單制)——稽核前 YouTube 上傳一律鎖私人
3. **階段 4(可選)— Web Push + Service Worker 提醒**

### 既有功能可優化(2026-08-31 完成第一輪)

本輪已完成:郵件→草稿真實 AI 摘要(`summarizeWithGemini`;無 key 時退回誠實的節錄文案)、Gmail「載入更多」分頁與視窗重回前景靜默刷新(`useGmail.loadMore`、60 秒冷卻)、草稿頁自訂指令輸入(`rewriteWithInstruction`,僅有 key 路徑)、規則示範語氣超過平台上限時明確提示、Modal Esc 關閉/focus trap/`role="dialog"`、toast `role="status"`、✕ 按鈕 aria-label、深色模式(`prefers-color-scheme` 覆寫 CSS 變數)、ID 改 `crypto.randomUUID`。

第二輪(同日)已完成:草稿持久化(`draftText`/`draftPlatforms`/`draftSourceId` 併入 `text-message:v2` 自動保存,`discardDraft` 捨棄)、文管庫範本編輯/刪除(`updateTemplate`/`deleteTemplate`,單一 modal 兼新增/編輯)、hooks 測試(`@testing-library/react` + jsdom,`useAppStore.test.ts`/`useGmail.test.ts`,全專案 73 測)。

仍待辦:

- 相依套件升級:2026-08-31 評估過,可用更新全為跨大版本(React 19、Vite 8、TS 7、Vitest 4),semver 範圍內無小版可升;建議另立技術債 sprint 一次處理並完整驗證,需同步 `package-lock.json`

### 架構決策點(2026-09-02 維護者決議;同日收尾歸檔)

- 大方向定案:**前端為主、後端輔助(可選)**——後端漸進式、可退回;未設定後端=完整半自動模式,純前端 CI 路徑不變
- 真實串接以 **YouTube 先行**(影片/Shorts 搭配文字說明;沿用 GIS、零後端);影音編輯等產品整合另案評估,勿自行擴大範圍
- **後端形態定案:Cloudflare Workers + KV 為主,GitHub Actions cron 混合為輔助變體**(比較記錄見 `docs/HANDOFF.md` 決策記錄)
- **2026-09-02 收尾決議:社群串接開發暫停**(時間因素)——`worker/` 骨架歸檔保留(含測試與 `docs/BACKEND.md` 部署手冊),恢復開發時從前端串接開始;**文管庫功能深化提前為現行工作流**(規劃見 `docs/LIBRARY-PLAN.md`)
- LINE 個人動態無公開發文 API,永遠維持手動/深連結輔助

## 慣例

- 語言:zh-Hant;UI 字串集中放 `constants.ts`,不散落元件
- 新增純邏輯一律配 vitest 單元測試;hooks 測試以 `// @vitest-environment jsdom` 單檔切環境(@testing-library/react),不動全域 node 環境;E2E 維持 smoke 等級,不做完整流程自動化
- 版本與依賴異動需同步 `package-lock.json`(部署用 `npm ci`)
