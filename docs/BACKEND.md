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
| POST | `/api/threads/publish` | 立即代發 `{installId, text}` |
| POST | `/api/schedule` | 加入排程 `{installId, text, publishAt(ms)}`(限未來 90 天內) |
| GET | `/api/queue?install=<id>` | 檢視該安裝的佇列 |
| POST | `/api/queue/cancel` | 取消未發佈項目 `{installId, itemId}` |
| cron | 每分鐘 | 發佈到期項目;失敗指數退避(60s→2m→4m,上限 3 次後標記 failed) |

CORS:僅放行 `FRONTEND_URL` 的 origin。`installId` 為前端產生並持久化的識別碼(8–64 字英數、`-`、`_`)。

## 5. 已知限制(誠實清單)

- **Meta App 審核**:開發模式僅限測試者帳號;正式開放需 App Review(每個 `threads_*` scope 約 2–7 個工作天,首輪退件率不低)
- **KV 為最終一致性**:剛寫入的排程項目在其他邊緣節點可能要數秒才可見——對「分鐘級排程」無實害,但代表 cron 掃描與立即寫入之間有短暫窗口
- **cron 每分鐘觸發**:發佈時間精確度約 ±1 分鐘
- **單一平台(Threads)**:IG(需商業帳號)與 X(量計費)為後續增量;LINE 個人動態無 API,永不支援代發
- **前端尚未串接**(下一增量):`VITE_API_BASE` 與「Threads 代發」UI;目前 worker 可獨立以 curl 驗收
