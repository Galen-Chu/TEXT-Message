# CLAUDE.md

TEXT-Message(原文管庫;repo Galen-Chu/TEXT-Message)— 社群媒體每日發文工具。React 18 + TypeScript(strict)+ Vite 5,**前端為主、後端輔助(可選)**——目前程式碼仍為純前端、無後端,部署於 GitHub Pages(<https://galen-chu.github.io/TEXT-Message/>,push `main` 自動部署);規劃中的後端僅作平台串接輔助(OAuth 代管/代發文/排程 cron),未設定後端時產品為完整半自動模式。

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
- `src/services/backend/` + `src/hooks/useThreadsProxy.ts` — 階段三前端串接:`config`(`VITE_API_BASE`,未設=disabled)/`client`(URL 組裝純函式+fetch 可注入,錯誤統一 BackendErrorCode)/`installId`(瀏覽器安裝識別碼,worker 以它對應保管 token);hook 管狀態機、OAuth 回跳偵測(`?threads=`)與雲端佇列
- `src/services/drive/` + `src/hooks/useDrive.ts` — 雲端列 Drive(`docs/DRIVE-PLAN.md`):`config`(`VITE_DRIVE_CLIENT_ID`,缺時 fallback `VITE_GMAIL_CLIENT_ID`;未設=disabled)/`gis`(沿用 gmail GIS 載入,獨立 token client,僅 `drive.readonly`)/`driveApi`(files 搜尋+Docs 純文字匯出,fetch 可注入,純邏輯可測)/`errors`;hook 鏡像 useYoutube 連線狀態機(token 僅 useRef、401 靜默續約)
- `src/services/gemini/rewrite.ts` — AI 文案(BYOK):語氣改寫/郵件摘要/自訂指令三個入口共用模型降級迴圈;prompt 組裝/回應解析/狀態碼對應為純函式;key 存 localStorage `text-message:gemini-key`(獨立於內容資料的 `text-message:v2`)
- `src/components/` — 七頁面 + Sidebar / Modal / PlatformBadge;頁籤命名 v3(2026-09-04 IA 重整 `docs/IA-PLAN.md` D1;2026-09-07 晚「編輯器 Text」更名「編發器 Text」D12;2026-09-08 新增第七頁籤「雲端列 Drive」`docs/DRIVE-PLAN.md`):**文管 Dashboard / 郵件匣 Gmail / 自媒體 Social / 雲端列 Drive / 編發器 Text(原「草稿撰寫」)/ 定排程 Task / 文庫 Library(舊稱「文管庫」)**;內部識別字(Tab key、資料集名)未隨之改名
- `src/data/mockData.ts` — 示範模式假資料(日期相對今天回推,不會過期)
- `src/constants.ts` — 平台定義、分類、語氣規則、`GMAIL_ERROR_COPY`(UI 字串集中於此)
- `vite.config.ts` 的 `base: '/TEXT-Message/'` 為 Pages 子路徑所需,勿移除

## 重要行為(修改時勿破壞)

- `emails` 由 useAppStore 推導:**以 `gmail.status` 判斷、不是長度**——連線後空收件匣不得退回示範資料
- localStorage 持久化僅限 templates / copyTemplates / scheduleItems / publishedHistory(標記已發佈的真實記錄)/ 草稿(draftText、draftPlatforms、draftSourceId;key `text-message:v2`);**emails、Drive 文檔內容與 access token 絕不落地**(token 僅存記憶體,中斷連線即向 Google revoke)
- 未設定 `VITE_GMAIL_CLIENT_ID` 的建置=純示範模式(不出現連接按鈕;雲端列 Drive 同規,`VITE_DRIVE_CLIENT_ID` 缺時 fallback 之),且**建置不得失敗**——PR CI 常態驗證此路徑
- YouTube 上傳(階段二)同規:Client ID 沿用 `VITE_YOUTUBE_CLIENT_ID`(缺時 fallback `VITE_GMAIL_CLIENT_ID`),未設定的建置不出現上傳區、建置不得失敗;token 僅存記憶體、中斷即 revoke。未過 Google API 稽核的專案上傳一律鎖私人(UI 已誠實標示);排程用 YouTube 原生 `publishAt`(private+publishAt),**零後端、不經任何第三方**
- 後端資料邊界(階段 3 後端上線後適用):後端僅接收**排程貼文內容**與平台 token(加密保存、可隨時 revoke);**emails 與 AI key 永遠只留在使用者瀏覽器**,不落地也不上傳。未設定後端端點(`VITE_API_BASE`,正式站由 secret `BACKEND_API_BASE` 注入)的建置=完整半自動模式(一鍵複製+平台深連結),建置不得失敗——前端串接 UI(`useThreadsProxy`、編發器 Threads 發佈卡、排程頁雲端佇列)僅在 `BACKEND_ENABLED` 時出現
- 語氣改寫分流:`useAppStore.applyTone` 有 Gemini key → 真實 API(失敗時草稿不動、僅 toast);無 key → 規則示範(`TONE_REWRITES`)。郵件摘要(`convertToDraft`)與自訂指令(`applyCustomInstruction`)同為 BYOK 分流:前者無 key 退回節錄文案,後者無 key 僅提示不動作。**任何路徑都不得影響建置/CI**
- 分類器為規則式關鍵字(非 AI);「活動通知」一律不建議可發文(與示範資料行為一致)
- **郵件功能定位(2026-09-03 決議,紅線)**:Gmail 永遠維持 `gmail.readonly`——**不申請 `gmail.modify`、不自動貼 Gmail 標籤、不做信箱管理**;app 內分類永遠是「建議層」。例行郵件(電子報/帳單)的自動歸檔交給 Gmail 原生篩選器——app 僅提供唯讀輔助:真實 Gmail 標籤作為收件匣第二篩選維度(`listUserLabels`)+「自動分類」深連結以預填 `from:` 搜尋開啟 Gmail(`services/gmail/filterLink.ts`),使用者自行建立篩選器(伺服器端 24/7 生效)

## Gmail 串接設定

- 本機:`.env.local` 填 `VITE_GMAIL_CLIENT_ID`(範本見 `.env.example`)
- 正式:GitHub secret `GMAIL_CLIENT_ID` → `deploy.yml` 寫入 `.env.production`(缺 secret=示範模式部署,不失敗)
- 完整手冊(維護者/驗收測試者/自架者):`docs/SETUP.md`;設計規格:`docs/HANDOFF.md`

## CI/CD

- PR:`.github/workflows/ci.yml`(vitest → build → Playwright)
- main push:`deploy.yml`(test → build → E2E → Pages 部署;**E2E 是部署閘門**)
- E2E 跑在 `npm run preview`(含 base 路徑);CI 環境為示範模式建置,不觸碰 Google 網路

## 開發待辦與優化清單(2026-09-07 IA 重整收尾歸檔;2026-09-02 社群管理清單見下)

**階段現況(2026-09-07 IA 重整收尾歸檔)**:**IA 重整 Phase 1–5 已於 2026-09-07 一日全數完成**(`docs/IA-PLAN.md`;Phase 5 二期方案待維護者拍板,見 `docs/NOTIFY-PLAN.md`);**階段 3(平台代發)已閉環**——worker 部署上線、OAuth 與立即代發端到端驗收通過、正式站 `BACKEND_API_BASE` 已注入(2026-09-07)。**2026-09-07 晚追加 UX 優化批(D12)**:套用編發器/發佈用語/頁籤更名編發器/草稿管理預設範本/OAuth 授權分頁 popup 自動返回。**2026-09-08 上午:回歸測試驗收**(逐項檢查表見 `docs/NOTIFY-PLAN.md` §5,已對齊新命名)。
**2026-09-08 晚:雲端列 Drive 一、二期同日完成**(AI 風格參照+存為範本,`docs/DRIVE-PLAN.md` D1–D7)、UX 優化二批 D13、worker cron 改每小時整點(KV list 額度約束)、全 repo U+FFFD 壞字元清查完畢。歷史階段狀況(2026-09-02 收尾歸檔):階段 0/1/2 完成、文管庫深化四期完成;階段 4(Web Push)未開工;IG/X 代發為後續增量。
**2026-09-09:Drive 首次真實串接+搜尋 q 語法 bug 修復、全站配色 WCAG AA 修正、技術債評估定案。**維護者另建 Cloud 專案與獨立 OAuth client 啟用 Drive API(本機 `.env.local` 已設 `VITE_DRIVE_CLIENT_ID`;正式站待 GitHub secret+`deploy.yml` 注入,`.env.example` 已補說明);首次真打 Drive API 揭漏 `buildListQuery` mimeType 子句語法錯誤(400 invalid q),已修+測試斷言補完整請求形狀(09-04 串接紀律重演案例)。配色:深色模式 `color-scheme` 缺失致輸入框白底白字(對比 1.19:1)等多項未達 AA,全數修正;brand/accent 分離「文字色調/填充 fill」雙 token(深色模式文字自動轉亮);btn-accent 白字→深棕字;輸入框補 focus 視覺;稽核腳本 `scripts/contrast-audit.mjs`(PlatformBadge 平台識別色除外,識別優先)。技術債遷移順序定案:**React 19 → Vite 8+Vitest 4+plugin-react v6 綁同一步**(Vitest 4 要求 Vite ≥6,唯一硬耦合)**→ TS 7**(`tsc -b` 已支援;`moduleResolution: bundler` 無虞)。**2026-09-10:正式站 Drive 上線+雲端服務全集中組織原專案,收尾歸檔。**①正式站 Drive 注入:GitHub secret `DRIVE_CLIENT_ID`+`deploy.yml` 段(commit `164b000`),部署後以 bundle 探測驗證;②Drive 用戶端遷移:09-09 曾另建無組織 Cloud 專案,09-10 維護者定案集中組織管理——原專案(組織內,project number `46187911042`)另建獨立 client,`.env.local`+secret 更新、workflow_dispatch 重跑部署、bundle 驗證舊 client 零殘留,正式站 §12 驗收+App 實測通過;③Gemini key 集中:組織原專案啟用 Generative Language API(**Library 搜尋對 org 專案會隱藏這支 API,直連 `console.cloud.google.com/apis/library/generativelanguage.googleapis.com?project=<id>` 可啟用**)+建 key 測通——最終拓撲:Gmail/YouTube/Drive OAuth 與 Gemini key 全在組織原專案;④文件:SETUP.md 最前段 Cloudflare token 前置與 §12、BACKEND.md §2.1(token 取得/用完即刪紀律)/§2.2(KV id 佔位符慣例);⑤新知:Google API key 新格式 `AQ.` 開頭(勿憑 `AIza…` 前綴斷言有效與否)。待辦(維護者):舊 Cloud 專案 shutdown(`375105144768`,**與原專案同名,認 project number**)、Cloudflare token 儀表板刪除、Google API 稽核申請。**09-11 接續:FB 粉專發佈串接**(粉專建立中;工程側:單步 Pages API `POST /{page-id}/feed`、worker `threads/` 模組鏡像、FB 原生排程參數,動手前依串接紀律先查當下官方文件)。

已上線:Gmail 唯讀收件匣(2026-08-18)、Gemini BYOK 語氣改寫(2026-08-28,`services/gemini/rewrite.ts`)。以下各項動手時仍受「重要行為」紅線約束。

### 待開發功能(2026-09-02 收尾歸檔;接續開發由此挑選)

1. ~~**文管庫功能深化**~~(**四期全部完成,2026-09-02**) — 第一期:範本變數填值(`utils/variables.ts`)、Social 頁「存為範本」、使用統計與排序。第二期:平台變體(`platformVariants` + `utils/variants.ts`)。第三期:發文趨勢(`utils/trends.ts` + `TrendsPanel`;僅計 `publishedHistory` 真實記錄、門檻 5 筆)。第四期:Gemini 產出輔助(`services/gemini/variants.ts`——`generateContent` 沿用 rewrite.ts 降級迴圈):「✨ 產生平台版本」(可編輯面板→附加到草稿 `[平台名 版]` 格式/存為範本)與「#️⃣ 建議標籤」(chips 點擊加入);無 key 依 D5 顯示按鈕但點擊僅提示。D1–D6 決議記錄見 `docs/LIBRARY-PLAN.md` §6。**遠期未做(F8):few-shot 範本生成、Gemini grounding 趨勢靈感(需先驗證 key 方案計費/可用性)**
2. ~~**階段 3 前端串接**~~(2026-09-03 完成;**2026-09-04 worker 已部署、OAuth 端到端驗證通過**) — `services/backend`(config/client/installId)+ `useThreadsProxy`(狀態機、OAuth 回跳偵測、雲端佇列);草稿頁 Threads 代發卡(連線/立即發佈/排程發佈→雲端佇列+本地排程;2026-09-07 晚「代發」用語全面改「發佈」、頁籤更名編發器,D12)、排程頁雲端佇列卡(狀態/取消);worker `/api/threads/status`;`deploy.yml` 選用注入 `BACKEND_API_BASE`。首次實測挖出 5 個 worker OAuth/發佈 bug(端點/參數名/數字 id 型別/user_id 超 2^53 精度失真,已修+補測試),偵錯紀錄與可複用方法見 `docs/BACKEND.md` §6。**立即代發已於 2026-09-07 端到端驗收成功(發文 id 18027614201902484);正式站 `BACKEND_API_BASE` 已於 2026-09-07 設定並上線;之後 IG(需商業帳號)→ X(量計費)。待辦提醒:送出 Google API 稽核申請——稽核前 YouTube 上傳一律鎖私人
3. **IA 重整(2026-09-04 啟動;2026-09-07 Phase 1–5 全數到位)** — 決策記錄與分期見 `docs/IA-PLAN.md`。Phase 1 六頁籤命名 v3 與品牌 TEXT-Message;Phase 2 三大類文檔模型(文庫草稿管理分頁);Phase 3 Gemini 依文檔類型分流;Phase 4 排程類別維度;Phase 5 一期=Gmail 互動通知分類(`classify` 平台通知網域/片語+自媒體「最新互動」卡,唯讀零紅線)。**二期以上(Threads 輪詢等)需維護者拍板,評估見 `docs/NOTIFY-PLAN.md`(含總驗收檢查表)**
4. **雲端列 Drive（2026-09-08 提案並同日完成一、二期）** — 新頁籤（第七）：串接 Google Drive（**唯讀** `drive.readonly`，GIS 模式，token 僅記憶體）；一期=搜尋/瀏覽 Docs 與純文字檔、純文字預覽、引用到編發器；二期=**Gemini 風格參照**（標記至多 3 篇樣本，語氣改寫/自訂指令/平台版本生成模仿行文；僅中繼資料落地，生成時即時匯出每篇截 800 字）+**存為範本**寫入文庫三大類；未設定或未連線顯示示範文檔。決策 D1–D7 見 `docs/DRIVE-PLAN.md`
5. **階段 4(可選)— Web Push + Service Worker 提醒**

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
- **串接類開發紀律(2026-09-04/09-07 實測教訓)**:動手寫任何平台 API 串接前,先查**當下**官方文件,端點、HTTP method、參數名、回應值型別逐一對照後再寫碼(不信記憶,文件 URL 註解在 config 常數旁);單元測試須斷言**完整請求形狀**(URL、method、每個欄位名);Meta 系 API 的 id/user_id 可能是 JSON number 且**超過 JS 安全整數**——必須從原始回應文字抽取,`JSON.parse`+`String()` 會失真。方法與案例見 `docs/BACKEND.md` §6
- 新增純邏輯一律配 vitest 單元測試;hooks 測試以 `// @vitest-environment jsdom` 單檔切環境(@testing-library/react),不動全域 node 環境;E2E 維持 smoke 等級,不做完整流程自動化
- 版本與依賴異動需同步 `package-lock.json`(部署用 `npm ci`)
