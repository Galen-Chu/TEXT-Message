# Gmail 串接設定與驗收測試手冊(SETUP)

本文件說明如何設定「文管庫」的 Gmail API 串接,以及驗收測試者如何使用。全程不需要任何伺服器——本專案是純前端應用,Gmail 授權與郵件讀取都在你的瀏覽器內完成。

## 0. 這份文件給誰看

| 你的角色 | 請看 |
|---|---|
| **驗收測試者**(被邀請測試 Gmail 功能) | 直接看 [§7](#7-驗收測試者操作流程) |
| **網站維護者**(repo 擁有者,負責 Google Cloud 與 GitHub 設定) | §1–§6 |
| **自架/Fork 者**(想在自己環境跑一套) | §1–§4 + §8 |

## 1. 運作原理(1 分鐘版)

- 本 App 為純前端(React + Vite),**沒有後端**;使用 Google Identity Services 的 **token model**,在瀏覽器直接向 Google 取得 OAuth access token
- 授權範圍只有 **`gmail.readonly`(唯讀)**:App 只能「讀」信,不能寄信、刪信或修改任何資料
- access token **只存在瀏覽器記憶體**(約 1 小時有效,過期自動靜默續約),**不寫入 localStorage、不傳給任何第三方**;中斷連線時立即向 Google 撤銷
- 未連接 Gmail 時,App 以「示範模式」呈現假資料;建置時若完全沒設定 Client ID,則連連接按鈕都不會出現

## 2. 建立 Google Cloud 專案並啟用 Gmail API(維護者)

1. 開啟 <https://console.cloud.google.com>,右上角建立新專案(例如 `text-message`)
2. 左側選單 → **APIs & Services → Library**,搜尋 **Gmail API** → **Enable**
3. 注意:**Gmail API 必須啟用在「同一個專案」上**,否則之後呼叫會收到 403 錯誤

## 3. 設定 OAuth 同意畫面(Testing 模式)

1. **APIs & Services → OAuth consent screen** → User Type 選 **External** → 建立
2. App 資訊:應用名稱填「文管庫」、填使用者支援 Email
3. **Scopes**:新增 `https://www.googleapis.com/auth/gmail.readonly`
   - 這是「受限範圍(restricted scope)」:應用若正式公開需通過 Google 驗證(甚至資安評估);**維持測試模式 + 列測試使用者即可免驗證使用,這正是本專案的驗收機制**
4. **Test users**:把每一位驗收測試者的 Gmail 地址加進來(測試模式上限 100 人;只有清單內的人能完成授權)
5. **Publishing status 維持 `Testing`**,請不要切到 Production——未驗證應用貿然上線,使用者會被封鎖存取

> 測試使用者第一次授權時會看到「**未驗證的應用程式**」警告,這是測試模式的預期行為:點「進階」→「前往 文管庫(不安全)」即可繼續(見 §7 截圖步驟)。

## 4. 建立 OAuth 用戶端 ID(Web application)

1. **APIs & Services → Credentials → Create Credentials → OAuth client ID** → 應用類型選 **Web application**
2. **Authorized JavaScript origins** 加入以下兩筆:
   - `https://galen-chu.github.io`
   - `http://localhost:5173`(本機開發用)
3. ⚠️ **頭號設定錯誤:origin 只能填「scheme + host」,不可以帶路徑**。請填 `https://galen-chu.github.io`,**不要**填 `https://galen-chu.github.io/TEXT-Message/`(Google 會拒絕或導致 `invalid_client`)
4. token model 不需要設定 Redirect URI
5. 建立後複製用戶端 ID(長得像 `1234-abc.apps.googleusercontent.com`)

## 5. 本機開發

```bash
cp .env.example .env.local
# 編輯 .env.local,填入:VITE_GMAIL_CLIENT_ID=你的用戶端ID
npm install
npm run dev        # http://localhost:5173
```

打開 App →「Gmail 郵件匣」,應看到「**連接 Gmail 帳號**」按鈕即設定成功。

排解:按鈕沒出現=env 沒載入(改完 `.env.local` 要重啟 dev server);`idpiframe_init_failed`/origin 錯誤=§4 的 origins 沒設對。

## 6. 正式部署設定(維護者)

1. GitHub repo → **Settings → Secrets and variables → Actions** → New repository secret
   - Name:`GMAIL_CLIENT_ID`
   - Secret:貼上用戶端 ID
2. push 到 `main` 即觸發部署;workflow 會把 secret 寫入 `.env.production` 再建置
3. 部署完成後打開 <https://galen-chu.github.io/TEXT-Message/>,「Gmail 郵件匣」出現連接按鈕即成功
4. **若沒設這個 secret,部署仍會成功,但建置為「純示範模式」**(無連接按鈕)——這是設計行為,不是故障;PR 的 CI 檢查也是用這個模式跑

## 7. 驗收測試者操作流程

前提:請維護者把你的 Gmail 加入 §3 的測試使用者清單(只需一次)。

1. 打開 <https://galen-chu.github.io/TEXT-Message/>
2. 左側導覽點「**Gmail 郵件匣**」→ 右上「**連接 Gmail 帳號**」
3. Google 登入視窗:選你的帳號
4. 出現「未驗證的應用程式」警告(預期):點左下「**進階**」→「**前往 文管庫(不安全)**」
5. 勾選範圍(Gmail 唯讀)→「**繼續**」完成授權
6. 回到 App:標題顯示「已串接帳號:你的信箱」,清單列出你近 7 天的郵件

**驗收檢查清單**

- [ ] 連接後顯示自己的 Email 與近 7 天真實郵件(最多 20 封)
- [ ] 郵件有中文主旨/寄件者時正確顯示(非亂碼)
- [ ] 每封郵件有分類標籤(電子報/合作邀約/讀者來信/活動通知;規則式分類,非 AI,偶有誤判屬已知限制)
- [ ] 搜尋與標籤篩選正常
- [ ] 「轉為草稿」→ 跳到草稿頁,來源郵件全文可見
- [ ] 「重新整理」重新載入郵件;放置逾 1 小時後操作會自動靜默續約,不需重新登入
- [ ] 「中斷連線」→ 回到示範模式;再次連接不需重複授權(除非 Google 工作階段過期)
- [ ] 全程瀏覽器重新整理後不殘留任何 Gmail 資料(token 僅在記憶體)

## 8. 自架 / Fork 路徑

1. Fork 本 repo
2. 依 §2–§4 建立自己的 Google Cloud 專案與 OAuth Client(origins 換成 `https://<你的帳號>.github.io` 與 `http://localhost:5173`)
3. 你的 repo 設定 secret `GMAIL_CLIENT_ID`
4. 修改 `vite.config.ts` 的 `base` 為 `/<你的repo名>/`
5. Settings → Pages → Source 選 **GitHub Actions**
6. 注意:你的版本要驗收,測試者要加在**你的**同意畫面測試使用者清單

## 9. 隱私與授權範圍聲明

- 授權僅 `gmail.readonly`:不會寄信、刪信、貼標籤或變更任何帳號設定
- 郵件內容只在你的瀏覽器處理(解析、分類),不會送到 Google 以外的任何伺服器——本專案沒有後端
- 分類標籤與「建議可發文」為本機關鍵字規則(非 AI),判斷都在瀏覽器內完成
- 應用維持 Google OAuth **Testing** 模式:這是免驗證使用受限範圍的合法路徑,代價是 100 位測試使用者上限與測試者會看到未驗證警告;若未來要正式公開,需依 Google 政策完成驗證(可能含獨立資安評估),詳見 Google 官方文件
- YouTube 上傳(§11)授權僅 `youtube.upload`(上傳影片與設定說明,不含讀取頻道數據);影片檔由瀏覽器直傳 Google,不經任何第三方

## 10. 疑難排解

| 症狀 | 原因 | 處理 |
|---|---|---|
| 連接按鈕按了沒反應/跳「允許彈出視窗」 | 瀏覽器封鎖彈窗 | 允許 `galen-chu.github.io` 的彈出視窗後重試 |
| 授權頁顯示 403 access_denied | 你的 Email 不在測試使用者清單 | 請維護者於 §3 步驟 4 加入 |
| `invalid_client` / origin 相關錯誤 | OAuth origins 設錯(常見:帶了 `/TEXT-Message/` 路徑) | 依 §4 修正 origins |
| 授權成功但清單空白 | 近 7 天收件匣沒有信 | 點「重新整理」確認;或先寄幾封信給自己 |
| 操作一段時間後跳「授權已過期」 | Google 工作階段結束,靜默續約失敗 | 點「重新連接」重新授權(通常一鍵完成) |
| Google 登入服務載入失敗 | 網路/代理擋了 `accounts.google.com` | 換網路或確認可存取 Google |
| 正式站沒有連接按鈕 | repo 未設 `GMAIL_CLIENT_ID` secret | 依 §6 設定;此為設計上的示範模式 |

## 11. YouTube 影片/Shorts 上傳(選用,2026-09 新增)

階段二功能:在草稿頁勾選 YouTube 平台後,可直接以草稿內容作為影片標題與說明,從瀏覽器上傳影片(Shorts 亦同),支援「立即公開」與「預約發佈」(YouTube 原生排程,到點自動轉公開——零後端)。

### 設定步驟

1. 在 §2 的同一個 Google Cloud 專案中,另啟用 **YouTube Data API v3**(APIs & Services → Library → 搜尋 YouTube Data API v3 → Enable)
2. OAuth 用戶端沿用 §4 建立的那個即可(`VITE_YOUTUBE_CLIENT_ID` 留空 = 沿用 `VITE_GMAIL_CLIENT_ID`);要獨立用戶端時才另建並填入 `VITE_YOUTUBE_CLIENT_ID`
3. 同意畫面(§3)的測試使用者清單同樣適用:受權帳號必須在清單內
4. 正式部署:預設部署流程只注入 `GMAIL_CLIENT_ID`,YouTube 會沿用;需要獨立用戶端時請比照 `deploy.yml` 再加一組 secret

### 重要注意事項

- **未完成 Google API 稽核的專案,所有 API 上傳的影片會被 YouTube 鎖定為私人**(2020-07-28 後建立的專案一律適用)。上傳成功後可到 YouTube Studio 手動改為公開;要讓「立即公開」真正直接公開、且開放給測試使用者以外的帳號,需完成 [YouTube API 稽核表單](https://support.google.com/youtube/contact/yt_api_form)(免費,約數週)
- 授權範圍僅 `youtube.upload`(最小權限);access token 僅存記憶體,中斷連線即向 Google 撤銷,與 Gmail 一致
- 每日上傳配額:預設 10,000 units/日,一次上傳約 1,600 units(≈ 每日 6 支);超額時會出現明確的配額錯誤提示
- 純示範模式建置(未設 Client ID)完全不會出現 YouTube 上傳區,建置與 CI 不受影響

### 驗收測試

1. 草稿頁:勾選「YouTube」平台 → 出現「🎬 YouTube 上傳」卡片
2. 點「連接 YouTube 帳號」→ 同意授權(測試模式會出現未驗證警告,同 §7 的繼續方式)
3. 選一支短影片檔 → 選「立即公開」→ 上傳 → 進度條跑完後出現成功 toast,且社群媒體頁頂端多一筆 YouTube 真實記錄
4. 再試「預約發佈」:選未來時間 → 上傳後排程頁多一筆 YouTube 排程(YouTube 會在排定時間自動公開,屆時手動「標記已發佈」即可)
5. 到 YouTube Studio 確認影片存在;若顯示「私人(鎖定)」屬上述稽核前預期行為
