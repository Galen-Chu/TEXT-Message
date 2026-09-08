# 雲端列 Drive:設計與分期(2026-09-08 維護者提案並核准開工)

串接 Google Drive 的唯讀文檔庫:搜尋/瀏覽自己儲存的文章、引用到編發器,二期以行文風格參與 AI 生成。本文件為決策記錄;格式沿用 `docs/IA-PLAN.md`。

## 1. 決策記錄

- **D1(命名與位置,2026-09-08 維護者定案)**:頁籤「**雲端列 Drive**」,位置在**自媒體 Social 之後、編發器 Text 之前**(素材來源類聚:郵件匣/自媒體/雲端列 → 編發)。Tab key `drive`,成為第七頁籤。
- **D2(授權與紅線)**:沿用 GIS 模式(同 Gmail/YouTube):Client ID 用 `VITE_DRIVE_CLIENT_ID`(缺時 fallback `VITE_GMAIL_CLIENT_ID`,未設=該建置不出現連接按鈕、建置不得失敗——同 YouTube 慣例);scope 僅 **`drive.readonly`**;token 僅存記憶體、中斷連線即 revoke。**Drive 內容與 emails 同級:不落地、不上傳後端**;送 Gemini 的內容走使用者自己的 key(BYOK,同郵件摘要資料流)。
- **D3(一期範圍)**:連接 Drive → 依名稱搜尋 Docs(files.list,`q` 篩選 mimeType=Google Docs 或 text/plain、排除 trashed)→ 清單瀏覽(名稱/修改時間)→ 點選**匯出純文字預覽**(Google Docs 走 export 端點、純文字檔走 alt=media)→ **引用片段/全文到編發器**(附加到目前草稿,無草稿則視為空白開始——同社群挑選的互動模式)。PDF/試算表/圖片一期不做(誠實清單)。
- **D4(二期範圍,另案開工)**:①**寫作風格參照**——挑選數篇文章作風格樣本,併入 Gemini prompt(BYOK)使語氣改寫/平台版本貼近個人行文;②**存為範本**——引用時可直寫文庫三大類。二期動工前先驗證 prompt 長度與 token 成本。
- **D5(示範模式)**:未設定 Client ID 的建置(如 CI)顯示示範文檔清單+「(示範資料)」標示(同 Gmail 哲學:E2E 不觸 Google 網路)。
- **D6(二期:寫作風格參照,2026-09-08 維護者核准開工)**:Drive 頁可將文檔標記為「風格樣本」(預覽 modal 內 toggle,**上限 3 篇**以控制 prompt 長度);**持久化僅存中繼資料 `{id,name,mimeType}`**——文檔文字本身不落地(紅線),生成時即時自 Drive API 匯出,每篇截前 800 字元。編發器 AI 卡在有樣本時顯示「參照我的 Drive 風格(N 篇)」開關;`applyTone`/`applyCustomInstruction`/平台版本生成帶入樣本,prompt 增「行文風格樣本」區塊(指示:模仿語氣與節奏,內容仍以原始草稿為準)。生成時 Drive 未連線或樣本抓取失敗→toast 提示並以無風格生成,不阻斷。示範模式樣本文字用示範文檔內建文案,流程可完整體驗。
- **D7(二期:存為範本)**:預覽 modal「存為範本」→ 選三大類(草稿/文案/訊息)+標題(預設文檔名)——草稿類寫入文庫草稿管理(`DraftDoc`),文案/訊息類寫入 `copyTemplates`/`templates`(分類預設:文案=日常分享、訊息=粉絲互動,入庫後可改)。

## 2. 分期

| 期 | 內容 | 狀態 |
| --- | --- | --- |
| 一期 | 連接/搜尋/瀏覽/純文字預覽/引用到編發器(`services/drive`+`useDrive`+`Drive.tsx`+第七頁籤) | ✅ 2026-09-08 完成 |
| 二期 | Gemini 風格參照(D6)+存為範本(D7) | ✅ 2026-09-08 完成 |

## 3. 技術要點

- API:Drive v3 REST——`GET /drive/v3/files?q=…&fields=files(id,name,mimeType,modifiedTime)`;Docs 文字 `GET /files/{id}/export?mimeType=text/plain`;text/plain 檔 `GET /files/{id}?alt=media`。個人用量遠低於配額。
- 模組結構鏡像 `services/youtube`:`config`(Client ID/啟用判斷)/`gis`(沿用 gmail 的 GIS 載入與 token client)/`driveApi`(REST,純邏輯可測);hook `useDrive` 鏡像 `useYoutube` 連線狀態機。
