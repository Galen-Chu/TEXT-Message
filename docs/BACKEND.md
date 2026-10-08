# 平台代發後端部署手冊(text-message-worker)

階段三後端(Cloudflare Workers + KV,2026-09-02 定案的主形態)。本冊供**維護者與自架者**把 `worker/` 部署到自己的 Cloudflare 帳號;不想用後端的人**完全不需要讀這份**——未設定後端時前端仍是完整的半自動模式(一鍵複製 + 平台深連結)。

## 0. 職責與資料邊界(紅線)

後端只做四件事:**OAuth 代管、token 加密保存、代發文、排程 cron**。

- 只接收**排程貼文內容**(文字、預定時間)與平台 token(AES-GCM 加密後存 KV、可隨時 revoke)
- **絕不接收** emails、Gemini API key 或其他前端資料
- 排程佇列存在 KV(`queue:<installId>:<itemId>`),token 存 `token:threads:<installId>`(加密、90 天 TTL)

## 1. 前置需求

1. **Cloudflare 帳號**(免費方案即足夠:每兩分鐘 cron + 10 萬請求/日 + KV 1000 寫/日、**list 1000 次/日**——後者限制了 cron 頻率,見 §5)
2. **Meta 開發者帳號與 App**:建立 App → 加入 Threads 產品 → 取得 Threads API 的 client id/secret
   - App 在開發模式時**只有 App 的測試者/管理者帳號**能完成授權(自用足夠)
   - 要開放給其他使用者需通過 Meta App Review(`threads_basic` + `threads_content_publish`)
   - **FB 粉專串接(2026-09-30)用同一個 App**:另加入 Facebook Login 產品即可,詳見 §7
3. **注意 redirect_uri 限制**:Threads OAuth 對 callback 的 host 有額外規範,且須在 Meta App 後台登錄完整的 redirect URI(`https://<你的-worker-domain>/auth/threads/callback`)。host 若不被接受,Meta 會在 App 設定階段提示——遇到時以後台可接受的方案調整(worker 網址可自訂路由)。

## 2. 部署步驟

```bash
# 1) 安裝 wrangler 並登入(瀏覽器授權;本 repo 慣例改用 API token,見 §2.1)
npx wrangler login

# 2) 建立 KV namespace,記下回傳的 id
npx wrangler kv namespace create QUEUE

# 3) 編輯 worker/wrangler.toml:
#    - 把 QUEUE 的 id 換成上一步的值
#    - FRONTEND_URL 指向你的前端完整網址(含路徑)

# 4) 設定三個 secrets(啟用 FB 粉專串接另加兩個,見 §7)
npx wrangler secret put THREADS_CLIENT_ID        # Meta App 的 client id
npx wrangler secret put THREADS_CLIENT_SECRET    # Meta App 的 client secret
npx wrangler secret put TOKEN_ENCRYPTION_KEY     # 32 bytes hex:openssl rand -hex 32

# 5) 部署(在 worker/ 目錄下)
cd worker && npx wrangler deploy
# 6) 部署後在 docs/DEPLOYS.md 加一列紀錄(日期/內容/commit)——2026-10-08 起慣例
```

部署後 `npx wrangler secret list` 應列出三個 secrets;`curl https://<worker-domain>/health` 應回 `{"ok":true,"threadsConfigured":true}`。

### 2.1 Cloudflare API token:取得、使用、用完即刪(2026-09-10 回補)

`wrangler login` 的 `localhost:8976` 回呼在某些環境會被瀏覽器/安全軟體攔(§6.2 #4);本 repo 慣例是**全程以 API token 認證**,不依賴 `wrangler login`:

1. **取得**:<https://dash.cloudflare.com> → 右上角頭像 → **My Profile → API Tokens → Create Token** → 選範本 **Edit Cloudflare Workers**(涵蓋 Workers Scripts 與 KV 編輯權限,足夠 deploy、secret 與 KV 管理)→ 建立後**立刻複製(只顯示一次)**
2. **使用**:以環境變數傳入,所有 wrangler 指令比照,例:`CLOUDFLARE_API_TOKEN=<token> npx wrangler deploy`(務必在 `worker/` 目錄執行)
3. **用完即刪**:部署與日常維運不需要常駐 token——做完回同一頁面 **Roll** 或 **Delete**,下次部署再重建一枚
4. **紀律(2026-09 教訓)**:token 不寫進 repo、不貼進任何對話或文件、不存 shell 設定檔;一旦出現在任何非預期場所,即視同外洩,立即 Roll;跨設備傳遞走密碼管理器

> 前端手冊 `docs/SETUP.md` 開頭「前置:Cloudflare API token」為同流程簡版,供只需部署後端的人快速查閱。

### 2.2 KV namespace id:repo 佔位符、真實 id 僅本機(慣例)

`worker/wrangler.toml` 在 repo 中**保持佔位符 `REPLACE_WITH_YOUR_KV_NAMESPACE_ID`**;維護者的真實 namespace id 只存在**本機未提交的 wrangler.toml**,部署以本機檔案為準。因此 commit 時勿 `git add -A`,以指定檔案清單排除該檔。自架者以 §2 步驟 2 建立自己的 namespace 後,同樣只需改本機檔案——namespace id 非機密,此慣例是為了讓 repo 範本對自架者永遠是「待填」狀態。

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
| GET | `/auth/facebook/start?install=<id>` | 302 至 Facebook 授權頁(2026-09-30,見 §7) |
| GET | `/auth/facebook/callback` | 換長效 user token → `/me/accounts` 取首個粉專 page token、加密存 KV |
| GET | `/api/threads/status?install=<id>` | 是否已連線(僅回 true/false,不揭露 token) |
| GET | `/api/facebook/status?install=<id>` | 是否已連線 + 粉專名稱(不揭露 token) |
| GET | `/api/facebook/diag?install=<id>` | 系統工作人員模式限定:token 權限清單+粉專任務(維運排查用,見 §7.3) |
| POST | `/api/threads/publish` | 立即代發 `{installId, text}` |
| POST | `/api/facebook/publish` | FB 粉專立即發佈 `{installId, text}` |
| POST | `/api/schedule` | 加入排程 `{installId, text, publishAt(ms), platform?}`(`platform`:`threads`(預設)/`facebook`;限未來 90 天內) |
| GET | `/api/queue?install=<id>` | 檢視該安裝的佇列 |
| POST | `/api/library/save` | 文庫雲端備份:存瀏覽器加密之密文 `{codeId, data, iv, savedAt}`(方案 A,見 §9;worker 不解析內容) |
| POST | `/api/library/load` | 取回密文 blob `{codeId}` → `{v, data, iv, savedAt}` |
| POST | `/api/queue/cancel` | 取消未發佈項目 `{installId, itemId}` |
| cron | 每小時整點(`0 */1 * * *`,2026-09-08 維護者調整) | 發佈到期項目(整點批次);失敗指數退避(60s→2m→4m,上限 3 次後標記 failed)。**勿改回每分鐘**:KV 免費方案 list 上限 1,000 次/日,每分鐘掃描(1,440/日)會超額,隔夜排程將失敗;若需分鐘級精度改「佇列旗標鍵」設計 |

## 與前端對接(2026-09-03 前端串接已完成)

- 前端設定:本機 `VITE_API_BASE`(如 `.env.local`);正式站 = repo secret **`BACKEND_API_BASE`**(deploy.yml 會寫入 `.env.production`;未設定=半自動模式建置,不失敗)
- 前端功能:草稿頁「🧵 Threads 代發」卡(連線/立即代發/排程代發)、排程頁「雲端佇列」卡(狀態/取消);installId 存前端 localStorage(`text-message:install-id`),對應 worker 保管 token 的 KV key

CORS:僅放行 `FRONTEND_URL` 的 origin。`installId` 為前端產生並持久化的識別碼(8–64 字英數、`-`、`_`)。

## 5. 已知限制(誠實清單)

- **Meta App 審核**:開發模式僅限測試者帳號;正式開放需 App Review(每個 `threads_*` scope 約 2–7 個工作天,首輪退件率不低)
- **KV 為最終一致性**:剛寫入的排程項目在其他邊緣節點可能要數秒才可見——對「分鐘級排程」無實害,但代表 cron 掃描與立即寫入之間有短暫窗口
- **cron 每小時整點觸發(2026-09-08 維護者調整)**:排程發佈為整點批次,精確度約 ±60 分;頻率受 KV 免費方案 list 額度(1,000 次/日)約束,若未來需要分鐘級精度可改「佇列有項目時才 list」的旗標鍵設計
- **平台(Threads、FB 粉專)**:IG(需商業帳號)與 X(量計費)為後續增量;LINE 個人動態無 API,永不支援代發
- **真實代發已驗收(2026-09-07)**:立即代發 `/api/threads/publish` 端到端成功(見 §6.1 #5 user_id 精度修正);排程 cron 路徑由單元測試覆蓋,如需實測可排一筆 2 分鐘後的短測試文觀察佇列狀態流轉

## 6. 首次端到端實測:偵錯紀錄與檢討(2026-09-04)

**結果**:OAuth 全線貫通(authorize → callback → 短效換發 → 長效交換 → 加密入 KV → `/api/threads/status` 回 `connected:true`)。過程挖出 4 個潛藏 bug(皆已修正並補測試)與多個平台端關卡。

### 6.1 挖出的 bug(共同根因:憑記憶寫 API 串接,未對照當下官方文件)

| # | bug | 修正 |
| --- | --- | --- |
| 1 | code 交換表單欄位寫 `clientSecret`(camelCase),Meta 要求 `client_secret` | 改 snake_case;測試逐一斷言欄位名 |
| 2 | 長效交換打 `/oauth/access_token`;正確端點是 **`/access_token`**(無 `/oauth`) | `config.ts` 增 `THREADS_EXCHANGE_URL` |
| 3 | 刷新打 code 交換端點;正確是獨立的 **`/refresh_access_token`**(GET,僅 `grant_type`+`access_token`) | `config.ts` 增 `THREADS_REFRESH_URL` |
| 4 | Meta 回 `user_id` 為 **JSON number**,寫入未轉字串,讀取端型別檢查靜默回 null | 寫入 `String()`;讀取容錯數字舊值(`store/kv.ts`) |
| 5(2026-09-07)| `user_id` 數值**超過 JS 安全整數(2^53-1)**,`JSON.parse` 靜默進位失真(尾數差 2),發佈時 Meta 回「Object does not exist」——`String()` 補在 parse 之後救不回 | 從**原始回應文字**正則抽取完整位數字串(`oauth.ts` exchangeCode),勿經 JSON.parse |
| 6(2026-09-07)| 代發中文亂碼——**根因在驗收工具而非程式**:zh-TW Windows 上 Git Bash 把命令列中的中文參數傳給原生 curl.exe 時轉為 CP950 位元組,worker 忠實轉發壞位元組(先前「Meta 以 Latin-1 解碼表單」的推測**不成立**,已驗證乾淨輸入下管線正常) | 驗收含中文的請求一律 `curl -d @檔案`(UTF-8 檔案位元組原樣上線);發佈參數改走 URL 查詢字串保留為防禦性強化(Graph API 官方支援) |
| 7(2026-10-02)| FB 粉專 API 誤用**粉專網址**的數字 id(`profile.php?id=`,global id)→ `#100 The global id ... is not allowed for this call`。新版粉專網址 id ≠ API 用的粉專 id | API 用的 id 以商業後台「資產 → 粉絲專頁」為準;OAuth 模式由 `/me/accounts` 自動取得,天然免疫 |
| 8(2026-10-02)| FB 系統工作人員 token 發文全線 `#200`:token 帳面權限齊(`/me/permissions` 三項)、粉專任務齊(`MANAGE`/`CREATE_CONTENT`)、App 層級權限開通、token 重產——**仍拒**。此 App 世代(商家版導向、無標準版 Facebook Login、組態型錄被限縮)對系統用戶發文有無法關閉的閘門 | 定案改走 **OAuth 組態模式**(App 層級先開權限 → 組態勾三項 → `config_id` 授權,使用者實際同意)一次通關;排查方法:worker 診斷端點 `/api/facebook/diag`(權限/任務一覽)+ curl 直打端點看 `detail` 的 Meta 原始錯誤 |

單元測試當時沒抓到的原因:注入 fetcher 可測試只斷言了部分欄位(`grant_type`/`code`),**「與真實 API 的契約」(端點 URL、完整欄位名、回應值型別)不在測試裡**。已補:完整欄位名斷言、端點 URL 斷言、數字 id 轉型測試(`oauth.test.ts`)與 KV 讀取容錯測試(`store/kv.test.ts`)。

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
6. **含非 ASCII 的 curl 驗收一律用 `-d @檔案`**:zh-TW Windows 的 Git Bash 會把命令列中文參數轉為 CP950 再傳給 curl.exe(shell 內建指令如 printf 仍為 UTF-8,以其驗證會誤判)——亂碼先懷疑驗收工具,再懷疑程式。

### 6.4 下一次串接(IG/X)會遇到類似問題嗎?

會,且可以預測:

- **IG**:同一 Meta 生態——同樣的後台結構、App Review 流程(還需商業帳號);token 端點在 `graph.instagram.com`,有專屬 grant(`ig_exchange_token`)與自己的參數集。**§6.1 bug #2/#3 的端點混淆風險完全同型**。
- **X**:OAuth 2.0 PKCE + 付費層,體系不同但失敗模式同型:redirect URI 註冊、scope 審核、文件與實際 API 漂移。

**預防清單(串接任何平台 API 前)**:

1. 寫碼前先抓**當下**官方文件,端點、method、參數名逐一對照,不信記憶(文件 URL 可註解在 `config.ts` 常數旁)。
2. 單元測試斷言**完整請求形狀**:URL(含路徑)、method、每個欄位名與值。
3. Meta 系 API 的 id/user_id 可能是 JSON number,且**可能超過 JS 安全整數(2^53-1)**——`String()` 不夠,必須從原始回應文字抽取(見 §6.1 #5)。
4. e2e 前掛 `wrangler tail`;先用 bogus probe 驗憑證層。
5. 狀態端點優先做成可獨立驗證(本次 `/api/threads/status` 讓 KV 問題得以隔離)。

## 7. Facebook 粉專串接(2026-09-30 實作;2026-10-02 端到端驗收通過:OAuth 組態模式)

鏡像 Threads 模組(`worker/src/facebook/`),發佈目標為**粉絲專頁**(非個人檔案)。依 §6.4 預防清單實作:寫碼前已對照當下官方文件(URL 註解於 `worker/src/config.ts` 常數旁),單元測試斷言完整請求形狀,page id 與貼文 id 從原始回應文字抽取。

### 7.1 與 Threads 的差異(OAuth 模式;即現行採用的模式)

| | Threads | Facebook 粉專 |
| --- | --- | --- |
| OAuth 對話框 | `threads.net/oauth/authorize` | `www.facebook.com/<v>/dialog/oauth`(版本固定 v25.0) |
| 換 token | `graph.threads.net`,Threads 專屬 grant | `graph.facebook.com/<v>/oauth/access_token`:`code` 交換與 `grant_type=fb_exchange_token` 短換長共用端點 |
| 保管物 | user token(60 天,需刷新) | **page token**(`/me/accounts` 取得,每粉專一枚;不隨時間過期,**無刷新邏輯**,失效即重新授權) |
| 發佈 | 兩步 container | 單步 `POST /{page-id}/feed`(`message`) |
| KV key | `token:threads:<installId>`(90 天 TTL) | `token:facebook:<installId>`(無 TTL) |
| 授權帳號需求 | Threads 帳號 | 授權帳號需具粉專管理權(單粉專場景取 `/me/accounts` 第一個;多粉專選擇 UI 為後續增量) |

### 7.2 啟用檢查表:OAuth 組態模式(現行;2026-10-02 端到端驗收通過)

1. **Meta App 端**(與 Threads 同一個 App):
   - 「應用程式審核 → 權限與功能」:`pages_manage_posts`/`pages_read_engagement` 已可選(**2026-10-02 於此開通後,組態的權限型錄才出現這兩項**——此前僅四項商業權限,見 §6.1 #8);
   - 「商家專用 Facebook 登入 → 組態」:建立組態(用戶存取權杖),勾 `pages_show_list`、`pages_read_engagement`、`pages_manage_posts`,記下**組態 ID**;
   - 「商家專用 Facebook 登入 → 設定」:有效的 OAuth 重新導向 URI 已含 `https://<worker-domain>/auth/facebook/callback`。
2. **Worker secrets(三個;⚠ 勿設 `FACEBOOK_PAGE_TOKEN`/`FACEBOOK_PAGE_ID`——設了會切系統模式,此 App 不可用)**:
   ```bash
   cd worker
   npx wrangler secret put FACEBOOK_CLIENT_ID        # = App ID(同 THREADS_CLIENT_ID)
   npx wrangler secret put FACEBOOK_CLIENT_SECRET    # = App Secret(同 THREADS_CLIENT_SECRET)
   npx wrangler secret put FACEBOOK_LOGIN_CONFIG_ID  # 組態 ID
   ```
   (secrets 即時生效,免重新部署)
3. **驗收**:正式站 → 編發器勾 Facebook → 「連接 Facebook 粉專」→ 授權頁**實際列出三個 pages 權限**並同意 → 返回後「已連線 · 粉專『<名稱〉」」→ 立即發佈/排程發佈。token 為 per-install 加密保管於 KV(`token:facebook:<installId>`),重新授權即覆寫。

### 7.3 系統工作人員模式(2026-10-01 嘗試;此 App 驗證不可用,程式碼保留)

商業組合「系統工作人員」token 直接作為 secret 的單租戶模式(`FACEBOOK_PAGE_TOKEN`+`FACEBOOK_PAGE_ID`,兩 secret 齊備即啟用)。實測結論:**token 權限齊(`/me/permissions` 三項)、粉專任務齊(`MANAGE`/`CREATE_CONTENT`)、App 層級權限開通、token 重產——發文仍 `#200`**(完整排查記錄見 §6.1 #8):此 App 世代(商家版導向)對系統用戶發文存在無法關閉的閘門;若日後改用標準版 App 可重試。診斷專用端點 `/api/facebook/diag`(回報 token 權限清單與粉專任務)僅此模式可用。⚠ 紀律:系統工作人員 token 永不過期,貼進任何對話即視同外洩——撤銷重發,新 token 只進 `wrangler secret put`。

### 7.4 已知限制(誠實清單)

- 多粉專時固定取 `/me/accounts` 第一個;需要指定粉專時再做選擇 UI;
- page token 失效(改密碼/收回權限/組態異動)不自動修復——排程項目重試耗盡轉 `failed`,重新授權即覆寫;
- App 開發模式僅 App 角色帳號可授權(自用足夠);對外開放需 App Review;
- 商家版 App:標準版 Facebook Login 不可加;組態權限型錄隨 App 層級權限動態變化(§6.1 #8)。

## 8. 串接實錄:定案架構與問題總表(Threads + FB 粉專;2026-10-02 彙整)

> 一站式總覽,供日後 IG/X 等新平台串接前複習。細節:Threads 見 §6,FB 見 §7 與 §6.1 #7/#8。

### 8.1 定案架構(現行上線中)

| | Threads | Facebook 粉專 |
| --- | --- | --- |
| 授權方式 | OAuth(`threads.net/oauth/authorize`,scope=`threads_basic,threads_content_publish`) | **OAuth 組態模式**(`facebook.com/<v>/dialog/oauth` 帶 `config_id`,不帶 scope——商家版 App 權限綁在組態上) |
| 授權前提(App 後台) | Threads 產品 + redirect URI | 商家版 Facebook Login + redirect URI + **App 層級先開 pages 權限**(應用程式審核→權限與功能)→ 組態勾三項 |
| worker 保管 | 長效 user token(60 天,到期前 7 天自動刷新) | page token(`/me/accounts` 於 callback 取得;不隨時間過期,無刷新) |
| KV key | `token:threads:<installId>`(加密,90 天 TTL) | `token:facebook:<installId>`(加密,無 TTL) |
| 發佈端點 | 兩步 container(`POST /{user}/threads` → `threads_publish`) | 單步 `POST /{page-id}/feed`(message 走 URL 查詢字串,中文安全) |
| 排程 | 共用佇列 `/api/schedule`(`platform` 欄位)+ 每小時 cron 依平台分派,失敗指數退避 | 同左(`platform=facebook`) |
| worker secrets | `THREADS_CLIENT_ID`、`THREADS_CLIENT_SECRET` | `FACEBOOK_CLIENT_ID`、`FACEBOOK_CLIENT_SECRET`、`FACEBOOK_LOGIN_CONFIG_ID`(同 App 的 id/secret + 組態 ID) |
| 撤銷 | 前端重新授權即覆寫;或 Meta 後台移除 App 授權 | 同左;組態/權限異動後重新授權 |
| 版本 | Threads API v1.0 | Graph **v25.0**(刻意釘版,升級改 `worker/src/config.ts`) |

### 8.2 Threads 踩坑總表(2026-09-04/07;詳 §6.1 #1–#6、§6.2)

- **端點與參數**:code 交換欄位須 snake_case;長效交換/刷新是**獨立端點**(`/access_token`、`/refresh_access_token`,非 `/oauth/access_token`);
- **id 精度**:`user_id` 為 JSON number 且**超過 2^53**,`JSON.parse` 靜默失真——一律從原始回應文字正則抽取;
- **驗收工具編碼**:zh-TW Windows 的 Git Bash 把命令列中文轉 CP950 傳給 curl.exe——含 CJK 的請求一律 `-d @檔案`;
- **Meta 後台碎片化**:redirect URI 在「使用案例→存取 Threads API→設定」;OAuth 憑證用 Threads App ID/Secret(非 App ID);開發模式測試邀請要在 Threads 手機 App 接受;表單儲存卡住換無痕視窗。

### 8.3 Facebook 粉專踩坑全記錄(2026-09-30 ~ 10-02,依時序)

1. **此 App 無標準版 Facebook Login 可加**(新增產品頁僅 Webhooks/Threads Webhooks;Meta 對此 App 世代僅留商家版)→ 只能以商家版 Facebook Login 為載體。
2. **商家版的授權參數不同**:權限綁「組態」、dialog 吃 `config_id` 不吃 `scope`——若沿用 Threads 式 scope 流程,會**靜默拿到無粉專權限的 token**(連線看似成功、發佈才爆)。
3. **組態權限型錄會動態變化**:初期僅四項商業權限(business_management/pages_manage_metadata/pages_messaging/pages_show_list),**沒有 pages 發文權限**——須先至「應用程式審核→權限與功能」於 App 層級開通 `pages_manage_posts`/`pages_read_engagement`,組態選單才會出現這兩項。
4. **redirect URI 設定地雷**:設定頁頂端是「檢查工具」(只能驗證);真正輸入處在同頁下方的「有效的 OAuth 重新導向 URI」;URI 須逐字一致;表單儲存無反應→換無痕視窗。
5. **系統工作人員路線(嘗試後證明此 App 不可行)**:
   - 建立系統工作人員(新版介面名;舊稱系統用戶)需**指派 App 資產(角色:開發人員)**,否則產生權杖時「沒有可用權限」;
   - 粉專 API 不可用網址上的數字 id(`profile.php?id=` 的 global id,`#100`)——API id 以商業後台資產頁或 `/me/accounts` 為準(§6.1 #7);
   - token 權限、粉專任務、App 權限、重產 token **全部驗證通過仍 `#200`**(§6.1 #8)——此 App 世代對系統用戶發文存在無法關閉的閘門;診斷利器=worker `/api/facebook/diag`+curl 直打端點看 `detail`;
   - ⚠ 紀律:系統工作人員 token 永不過期,**貼進任何對話即視同外洩**——撤銷重發,新 token 只進 `wrangler secret put`。
6. **定案(2026-10-02 驗收通關)**:App 層級開權限 → 組態勾三項(pages_show_list/pages_read_engagement/pages_manage_posts)→ worker 以 `config_id` 走 OAuth → 使用者在授權頁**實際同意**權限 → page token 加密入 KV → 發文成功。教訓:**「帳面權限」≠「有效授權」,標準消費者授權流程(真人按同意)才是 Graph 的正門**。

### 8.4 新平台串接前複習清單(IG/X 適用,續 §6.4)

1. 先確認 App 的**產品與權限型錄**能支援目標 API(加不了產品=換 App,別硬繞);
2. 授權模式先定型:標準 scope / 組態 config_id / 系統用戶——**逐一實測最小樣本**,別信帳面;
3. 所有 id 從原始回應文字抽取;所有含 CJK 的請求以 URL 查詢字串或 `-d @檔案` 送;
4. 上線前備妥分層診斷:狀態端點、探針 curl、必要時診斷端點;
5. 不可過期的憑證(系統用戶 token 等)一律不進對話,只進 secret。

## 9. 文庫雲端備份(方案 A,2026-10-05)

**零知識設計**:備份內容由瀏覽器以「同步碼 → PBKDF2(150,000 次,固定鹽)→ AES-GCM」加密後上傳;worker 僅保管密文 blob,**不解析內容、不經手同步碼原文**——請求只帶 `codeId`(同步碼的 SHA-256 hex)作為 KV 鍵(`library:<codeId>`)。金鑰與解密能力只在使用者瀏覽器,**同步碼遺失即無法還原**(UI 已誠實標示);固定鹽為單人產品取捨,強度由同步碼本身承擔。

- 端點:`/api/library/save`、`/api/library/load`——**皆 POST**(codeId 不進 URL 日誌);blob 上限 512KB(資料+IV);
- 備份範圍:`text-message:v2` 全部使用者內容(範本/排程/發佈記錄/草稿/AI 偏好/Drive 樣本中繼資料);**emails 與 Gemini key 永不備份**(紅線);
- 衝突策略:一律 last-write-wins(備份覆蓋雲端、還原覆蓋本機——還原前有確認 Modal 顯示雲端備份時間);
- 部署:**無需新增 secrets**——既有 worker 部署即含此功能;前端備份卡僅在 `VITE_API_BASE` 已設時出現;
- 已知限制(誠實清單):知道 codeId 者可覆寫該 blob(無鑑別;單人自用可接受,codeId 由同步碼單向雜湊而來);無備份版本歷史(僅最新一版)。
