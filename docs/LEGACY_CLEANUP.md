# 舊版退役盤點（2026-09-13）

本輪只讀取已知 TravelOS 目錄、Git 狀態及目前版本的依賴，不刪除或移動任何檔案，不操作 Vercel。正式站以 `https://travelos2.chao-jason.workers.dev` 為準，目前整理工作樹是本次任務的 `work/travelos-current`。

## 可以退役的是舊入口，不是直接刪掉所有資料

| 候選 | 已確認狀態 | 處置結論 |
|---|---|---|
| `C:/Users/chao_/OneDrive/文件/Travel journal` | 外層 Git main 沒有任何 commit；app、lib、public、docs 等都是未追蹤。另有 `.travelos-workbench.json` 本機旅程資料、backups、outputs、artifacts。 | 可標示為舊本機工作區，但不可整包刪除；Git 無法還原其原始內容。 |
| 同目錄 `work/online-travelos` | HEAD `73e4304772928cd69a994b8c4425ac60c4ac8682`。9 個已追蹤修改、5 個未追蹤檔案。 | 舊工作樹可在保存差異後退出日常入口；不能用 reset/clean 或直接刪除處理。 |
| `https://travelos2-63r3.vercel.app` | 現行 README 與 hosting 文件仍列 cold spare；部署控制台、環境變數、Blob 資料與流量本輪未讀取。 | 使用者授權安全清理已記錄，但目前依賴證據不足以刪除遠端 project。先完成儲存依賴分離，再退役服務。 |
| 舊 `.next`、node_modules、`.pnpm-store` | 目錄存在；本輪未核對目前運行程序、連結目標或全部生成來源。 | 可重建候選，不等於已證明可刪。現階段沒有列出可立即執行的遞迴刪除。 |

## 原始照片與差異證據

舊本機 `public` 中 171 個 jpg/jpeg/png/mp4/mp3/m4a 檔案，與目前工作樹相同相對位置比對：11 個 SHA-256 相同、160 個在新版本該相對位置不存在、0 個同位置不同內容。160 個不代表在所有倉庫中唯一，但足以否決整包直接刪除；本輪沒有為製造信心而掃描整個個人媒體倉庫。

舊 `work/online-travelos` 的 14 個修改／新增檔案中，只有 `app/api/trips/photos/route.ts` 與目前檔案內容相同，其餘 13 個不同。不同不代表都應採用，但必須保留可供比較的來源：

- 旅行 content、media、journal-audio API
- family CSS／頁面、旅行 admin
- editable-store、types、drive-trips、promo-videos
- short-video-gallery
- HANDOFF、Tasks

舊 `artifacts` 另有 `family-poc`、`jdb-travelos-loop-v18c`、`jdb-travelos-release-a0392c5`。它們不能僅因名字含 POC／release 就判定為無用。舊 outputs 有 Grok 交接與材料清單，應保留。`.travelos-workbench.json` 包含與目前九州不同的舊日期、標題與內容，必須作為歷史來源，不可覆蓋正式雲端內容。

## Vercel 依賴仍有實際程式引用

現行 `lib/coffee-store.ts`、`lib/editable-store.ts`、`lib/moment-blob.ts`、`lib/moment-store.ts` 與 `app/api/coffee/photos/route.ts` 仍引用 `@vercel/blob`；部分路徑依 `BLOB_READ_WRITE_TOKEN`／`BLOB_STORE_ID` 切換。`lib/moment-transcript.ts` 仍有 Vercel OIDC gateway 分支。這些是程式依賴，不等於正式環境正在使用，但不能在未確認資料所在地前隨著舊 host 一起刪除。

`lib/site-url.ts` 明確把公開 canonical 指向 Cloudflare，忽略 Vercel origin；`lib/travelpayouts-drive.ts` 仍保留 Vercel 分支。舊 hosting 文件的「不要刪 Vercel」是先前 cold spare 方針；本次 Owner 已允許安全退役，該文字不是重新請求批准的理由，實際儲存與恢復依賴才是執行條件。

## 建議的可恢復退役順序

1. 正式版發布並完成手機上傳、編輯、保存及再次開啟驗證，確立唯一日常入口。
2. 對舊根目錄先製作包含未追蹤檔案、原始媒體、本機資料的可讀保留副本；列出清單並驗證保留副本。既有 OneDrive 目錄先原地標示 retired，不用搬動含有潛在外部連結的整棵目錄。
3. 保存舊 online-travelos 的完整差異與未追蹤檔案，13 個不同檔案逐項標示已取代／仍有獨有用途。不要以工作樹 commit 已保存來替代未提交內容備份。
4. 核對 Vercel project 的 Blob、轉錄依賴與使用中的連結；資料搬移另驗證成功後，先停用舊發布入口、保留恢復資料，再移除遠端 project。
5. 最後才清理已確認無程序使用、可重建且不含獨有資料的生成快取。每次刪除都必須核對實際絕對路徑在核准範圍內。

本輪結論：能明確停止把舊版當正式入口，但沒有證據支持現在整包刪除本機或 Vercel。這是具體資料差異所形成的保留條件，不是額外的 Owner 批准流程。
