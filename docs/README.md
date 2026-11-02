# docs 導覽(2026-11-02 盤點)

> 狀態定義:**活躍**=內容持續更新,動工前先讀;**完結**=功能已全部上線,作為決策記錄留存(不再更新,查歷史決策用);**歷史**=早期或歸檔文件,僅供考古。
> 工程慣例(指令、紅線、CI)在根目錄 `CLAUDE.md`;UI/UX 慣例在 `UIUX.md`。

| 檔案 | 狀態 | 用途 |
| --- | --- | --- |
| [SETUP.md](SETUP.md) | 活躍 | 串接設定與驗收手冊(Gmail/Drive/YouTube;維護者/驗收測試者/自架者) |
| [BACKEND.md](BACKEND.md) | 活躍 | worker 部署與啟用手冊(平台代發、文庫備份 §9、Threads 互動 §10、串接實錄 §8) |
| [DEPLOYS.md](DEPLOYS.md) | 活躍 | worker 部署紀錄(每次 `wrangler deploy` 加一列) |
| [UIUX.md](UIUX.md) | 活躍 | UI/UX 與文案慣例手冊(命名紀律、文案、token/對比度、icon、元件) |
| [PIPELINE-PLAN.md](PIPELINE-PLAN.md) | 活躍 | 自動發文管線規劃(P1/P2 ✅;P3–P5 待做;日記第三源 `diary-ai` 待做) |
| [DIARY-PLAN.md](DIARY-PLAN.md) | 活躍 | 寫日記規劃(P1/D2/P4 一期 ✅;P2 管線串接、P3 匯入、P4 二期候選) |
| [POST-PLAN.md](POST-PLAN.md) | 活躍 | 貼便條規劃(P1 ✅;P2/P3 候選) |
| [HISTORY.md](HISTORY.md) | 歷史 | CLAUDE.md 開發時間軸歸檔段(2026-09-07 ~ 2026-10-03:IA 重整/FB 串接/D14);之後條目仍在 CLAUDE.md |
| [IA-PLAN.md](IA-PLAN.md) | 完結 | IA 重整五期決策(2026-09-07 全數完成) |
| [LIBRARY-PLAN.md](LIBRARY-PLAN.md) | 完結 | 文管庫功能深化四期決策(2026-09-02) |
| [DRIVE-PLAN.md](DRIVE-PLAN.md) | 完結 | 雲端列 Drive 一、二期決策(2026-09-08) |
| [NOTIFY-PLAN.md](NOTIFY-PLAN.md) | 完結 | 互動通知一、二期決策(2026-10-14 二期上線) |
| [HANDOFF.md](HANDOFF.md) | 歷史 | 2026-08 早期設計規格與交接文件(含後端形態比較記錄) |

> 維護規則:新計畫檔上線時在本表加一列;功能全數完結時把狀態改「完結」;CLAUDE.md 時間軸的階段性蒸餾(舊段移入 HISTORY.md)同時更新本表範圍註記。
