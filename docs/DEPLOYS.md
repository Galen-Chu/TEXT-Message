# Worker 部署紀錄(text-message-worker)

> **慣例(2026-10-08 起)**:每次 `wrangler deploy` 後在本檔**加一列**(日期/內容/當時 commit/備註)。
> Cloudflare 後台的 Deployments 分頁本就有完整版本史(`npx wrangler deployments list` 可查),本檔是人工摘要——回顧不需登入後台,也是開發日誌的一部分。
> 釐清:**「用完即刪」刪的是 API token(憑證),不影響任何部署紀錄**——版本史永遠都在。token 慣例另見 `BACKEND.md` §2.1(2026-10-01 FB token、2026-10-05 CF token 兩次貼入對話的實意外洩後,Roll 重發已是標準動作)。

| # | 日期 | 內容 | 對應 commit(約) | 備註 |
| --- | --- | --- | --- | --- |
| 1 | 2026-09-04 | Threads 初版(OAuth 代管+代發+佇列 cron) | —(worker 骨架) | 首次端到端實測,挖出 5 個 OAuth/發佈 bug |
| 2 | 2026-09-07 | 誤刪復原:重部署+3 secrets 重設(`TOKEN_ENCRYPTION_KEY` 換新) | — | 事故:誤刪 worker 本體(教訓:刪資源前核對名稱) |
| 3 | 2026-09-07 | Threads 5 bug 修復(端點/參數名/數字 id/2^53 精度) | — | 與 #2 同日,1–2 次 |
| 4 | 2026-09-08 | cron 改每小時整點(KV list 免費額度約束) | — | `wrangler.toml` crons 變更,部署才生效 |
| 5 | 2026-10-02 | FB 粉專串接(OAuth 組態+系統模式+`/api/facebook/diag`) | `366c072` | 當日排查 #100/#200 期間 1–2 次 |
| 6 | 2026-10-05 | 文庫雲端備份(`/api/library/save|load`) | `33f7bc6` | 部署後探針驗證 `invalid_code_id` 回應 |
| 7 | 2026-10-08 | LinkedIn 串接(`/auth/linkedin/*`、`/api/linkedin/status|publish`、schedule platform=linkedin) | `711b17c` | secrets:`LINKEDIN_CLIENT_ID`/`LINKEDIN_CLIENT_SECRET`;`/health` 回 `linkedinConfigured:true` |
| 8 | 2026-10-08 | LinkedIn scope 修正(openid+profile+w_member_social——openid 須搭配其他 OIDC scope) | `3cc473f` | 二次 Bummer 後修正,重部署即連接成功、發文驗收通過 |
