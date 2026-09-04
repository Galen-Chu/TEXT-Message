# 平台代發後端部署手冊(text-message-worker)

階段三後端(Cloudflare Workers + KV,2026-09-02 定案的主形態)。本冊供**維護者與自架者**把 `worker/` 部署到自己的 Cloudflare 帳號;不想用後端的人**完全不需要讀這份**——未設定後端時前端仍是完整的半自動模式(一鍵複製 + 平台深連結)。

## 0. 職責與資料邊界(紅線)

後端只做四件事:**OAuth 代管、token 加密保存、代發文、排程 cron**。

- 只接收**排程貼文內容**(文字、預定時間)與平台 token(AES-GCM 加密後存 KV、可隨時 revoke)
- **絕不接收** emails、Gemini API key 或其他前端資料
- 排程佇列存在 KV(`queue:<installId>:<itemId>`),token 存 `token:threads:<installId>`(加密、90 天 TTL)

## 1. 前置需求

1. **Cloudflare 帳號**(免費方案即足夠:每分鐘 cron + 10 萬請求/日 + KV 1000 寫/日)
2. **Meta 開發者帳號與 App**:建立 App → 加入 Threads 產品 → 取得 Threads API 的 client id/secret
   - App 在開發模式時**只有 App 的測試者/管理者帳號**能完成授權(自用足夠)
   - 要開放給其他使用者需通過 Meta App Review(`threads_basic` + `threads_content_publish`)
3. **注意 redirect_uri 限制**:Threads OAuth 對 callback 的 host 有額外規範,且須在 Meta App 後台登錄完整的 redirect URI(`https://<你的-worker-domain>/auth/threads/callback`)。host 若不被接受,Meta 會在 App 設定階段提示——遇到時以後台可接受的方案調整(worker 網址可自訂路由)。

## 2. 部署步驟

```bash
# 1) 安裝 wrangler 並登入(瀏覽器授權)
npx wrangler login

# 2) 建立 KV namespace,記下回傳的 id
npx wrangler kv namespace create QUEUE

# 3) 編輯 worker/wrangler.toml:
#    - 把 QUEUE 的 id 換成上一步的值
#    - FRONTEND_URL 指向你的前端完整網址(含路徑)

# 4) 設定三個 secrets
npx wrangler secret put THREADS_CLIENT_ID        # Meta App 的 client id
npx wrangler secret put THREADS_CLIENT_SECRET    # Meta App 的 client secret
npx wrangler secret put TOKEN_ENCRYPTION_KEY     # 32 bytes hex:openssl rand -hex 32

# 5) 部署(在 worker/ 目錄下)
cd worker && npx wrangler deploy
```

部署後 `npx wrangler secret list` 應列出三個 secrets;`curl https://<worker-domain>/health` 應回 `{"ok":true,"threadsConfigured":true}`。

## 3. 本機開發與驗收

```bash
cd worker && npx wrangler dev      # http://localhost:8787
```

- `wrangler dev` 使用本機模擬的 KV(secrets 會提示輸入或用 `.dev.vars` 檔,該檔**勿提交**)
- 純邏輯測試跑在主專案 `npm test`(已涵蓋:加解密、state 簽章、OAuth 請求組裝、container 發佈流程、佇列到期/退避)
- 端到端驗收:瀏覽器開 `http://localhost:8787/auth/threads/start?install=<自訂8-64字英數>` → 完成 Meta 授權 → 回前端網址帶 `threads=connected` → `curl -X POST .../api/threads/publish -d '{"installId":"...","text":"測試"}'`(注意 CORS:非瀏覽器 curl 不帶 Origin 會放行,便於驗收)

## 4. API 一覽

| 方法 | 路徑 | 說明 |
| --- | --- | --- |
| GET | `/health` | 狀態檢查 |
| GET | `/auth/threads/start?install=<id>` | 302 至 Threads 授權頁(state 已簽章) |
| GET | `/auth/threads/callback` | 交換長效 token、加密存 KV、302 回前端 |
| GET | `/api/threads/status?install=<id>` | 是否已連線(僅回 true/false,不揭露 token) |
| POST | `/api/threads/publish` | 立即代發 `{installId, text}` |
| POST | `/api/schedule` | 加入排程 `{installId, text, publishAt(ms)}`(限未來 90 天內) |
| GET | `/api/queue?install=<id>` | 檢視該安裝的佇列 |
| POST | `/api/queue/cancel` | 取消未發佈項目 `{installId, itemId}` |
| cron | 每分鐘 | 發佈到期項目;失敗指數退避(60s→2m→4m,上限 3 次後標記 failed) |

## 與前端對接(2026-09-03 前端串接已完成)

- 前端設定:本機 `VITE_API_BASE`(如 `.env.local`);正式站 = repo secret **`BACKEND_API_BASE`**(deploy.yml 會寫入 `.env.production`;未設定=半自動模式建置,不失敗)
- 前端功能:草稿頁「🧵 Threads 代發」卡(連線/立即代發/排程代發)、排程頁「雲端佇列」卡(狀態/取消);installId 存前端 localStorage(`text-message:install-id`),對應 worker 保管 token 的 KV key

CORS:僅放行 `FRONTEND_URL` 的 origin。`installId` 為前端產生並持久化的識別碼(8–64 字英數、`-`、`_`)。

## 5. 已知限制(誠實清單)

- **Meta App 審核**:開發模式僅限測試者帳號;正式開放需 App Review(每個 `threads_*` scope 約 2–7 個工作天,首輪退件率不低)
- **KV 為最終一致性**:剛寫入的排程項目在其他邊緣節點可能要數秒才可見——對「分鐘級排程」無實害,但代表 cron 掃描與立即寫入之間有短暫窗口
- **cron 每分鐘觸發**:發佈時間精確度約 ±1 分鐘
- **單一平台(Threads)**:IG(需商業帳號)與 X(量計費)為後續增量;LINE 個人動態無 API,永不支援代發
- **真實代發尚未實測**:OAuth 已於 2026-09-04 全線驗證(見 §6);`/api/threads/publish` 會發出真實貼文,待維護者擇時以短測試文驗收

## 6. 首次端到端實測:偵錯紀錄與檢討(2026-09-04)

**結果**:OAuth 全線貫通(authorize → callback → 短效換發 → 長效交換 → 加密入 KV → `/api/threads/status` 回 `connected:true`)。過程挖出 4 個潛藏 bug(皆已修正並補測試)與多個平台端關卡。

### 6.1 挖出的 bug(共同根因:憑記憶寫 API 串接,未對照當下官方文件)

| # | bug | 修正 |
| --- | --- | --- |
| 1 | code 交換表單欄位寫 `clientSecret`(camelCase),Meta 要求 `client_secret` | 改 snake_case;測試逐一斷言欄位名 |
| 2 | 長效交換打 `/oauth/access_token`;正確端點是 **`/access_token`**(無 `/oauth`) | `config.ts` 增 `THREADS_EXCHANGE_URL` |
| 3 | 刷新打 code 交換端點;正確是獨立的 **`/refresh_access_token`**(GET,僅 `grant_type`+`access_token`) | `config.ts` 增 `THREADS_REFRESH_URL` |
| 4 | Meta 回 `user_id` 為 **JSON number**,寫入未轉字串,讀取端型別檢查靜默回 null | 寫入 `String()`;讀取容錯數字舊值(`store/kv.ts`) |

單元測試當時沒抓到的原因:注入 fetcher ���測試只斷言了部分欄位(`grant_type`/`code`),**「與真實 API 的契約」(端點 URL、完整欄位名、回應值型別)不在測試裡**。已補:完整欄位名斷言、端點 URL 斷言、數字 id 轉型測試(`oauth.test.ts`)與 KV 讀取容錯測試(`store/kv.test.ts`)。

### 6.2 為什麼這段流程難解(結構性原因)

1. **三方帳號、失敗都長得一樣**:Meta(授權/憑證)、Cloudflare(部署/secret/KV)、worker 程式碼——任何一站失敗,使用者端一律只看到 `?threads=error`,無從分層。
2. **錯誤被吞**:catch-all 只回 error、無 log,看不到 Meta 的真正拒絕理由。加上 `console.error` + `wrangler tail` 後,每個 bug 都是 log 一行就定位。
3. **Meta 後台知識碎片化**:redirect URI 在「使用案例 → 存取 Threads API → 設定」而非基本設定頁;兩組憑證(App ID/Secret 與 **Threads App ID/Secret**,OAuth 用後者)標籤易誤導;開發模式的測試邀請要在 **Threads 手機 App**(設定→帳號→網站權限→邀請)接受,不在開發者後台;表單儲存有已知 bug(換無痕視窗重試通常可解)。
4. **工具鏈陷阱**:`wrangler login` 的 `localhost:8976` 回呼可能被瀏覽器/安全軟體擋(API token 認證可完全繞過);`wrangler deploy` 在錯誤目錄執行會 silently 偵測成 Vite 前端專案而失敗(**务必在 `worker/` 下執行**);`wrangler kv key get` 預設讀本機模擬,**加 `--remote`** 才是線上資料;worker 讀 KV 有最終一致性(約 60 秒內)。

### 6.3 可複用的偵錯方法(本次實證有效,依序使用)

1. **假憑證探測(bogus probe)**——最快分層定位,不需要使用者重跑流程:
   ```bash
   curl -s -X POST https://graph.threads.net/oauth/access_token \
     -d client_id=<id> -d client_secret=<secret> -d grant_type=authorization_code \
     -d redirect_uri=<uri> -d code=BOGUS
   ```
   判讀:「Invalid verification code」=憑證與 redirect_uri 都正確,只差真 code;「Missing required field: X」=請求缺欄位;「Invalid client_id」=憑證組合錯。GET/POST 各測一次可分辨 HTTP method 限制。
2. **`wrangler tail` 邊測邊看**:`npx wrangler tail text-message-worker` 掛著,維護者跑一次流程,每個請求與 `console.error` 即時可見。
3. **暫時性 debugStage**:懷疑讀取路徑時,在端點暫時加階段回報(`no-payload`/`decrypt-failed`/`bad-shape`),同一請求內對照「手動讀」與「正式路徑」的差異;驗證後移除。
4. **`wrangler kv key get <key> --namespace-id <id> --remote`**:直接看線上 KV 原始內容,繞過 worker 讀取邏輯,分辨「沒寫入」vs「讀取/解密壞了」。
5. **catch 不留空白**:至少 `console.error`;開發期可把錯誤原因附在 redirect 查詢參數(如 `threads=error&reason=...`),上線前移除以免洩漏內部資訊。

### 6.4 下一次串接(IG/X)會遇到類似問題嗎?

會,且可以預測:

- **IG**:同一 Meta 生態——同樣的後台結構、App Review 流程(還需商業帳號);token 端點在 `graph.instagram.com`,有專屬 grant(`ig_exchange_token`)與自己的參數集。**§6.1 bug #2/#3 的端點混淆風險完全同型**。
- **X**:OAuth 2.0 PKCE + 付費層,體系不同但失敗模式同型:redirect URI 註冊、scope 審核、文件與實際 API 漂移。

**預防清單(串接任何平台 API 前)**:

1. 寫碼前先抓**當下**官方文件,端點、method、參數名逐一對照,不信記憶(文件 URL 可註解在 `config.ts` 常數旁)。
2. 單元測試斷言**完整請求形狀**:URL(含路徑)、method、每個欄位名與值。
3. Meta 系 API 的 id/user_id 可能是 JSON number,一律 `String()` 轉型。
4. e2e 前掛 `wrangler tail`;先用 bogus probe 驗憑證層。
5. 狀態端點優先做成可獨立驗證(本次 `/api/threads/status` 讓 KV 問題得以隔離)。
