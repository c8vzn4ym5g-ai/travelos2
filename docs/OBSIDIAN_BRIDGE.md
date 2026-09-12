# TravelOS 與 Obsidian 的分工

手機與 notebook 的網頁 App 是日常入口：旅行途中上傳照片、影片、語音、簡單改字、選照片及雲端儲存，都不能依賴家中 notebook 開機或 Obsidian 運行。夫妻使用不同裝置也必須讀寫同一份雲端旅程。

Obsidian 用於 notebook 上的長篇整理、跨旅行筆記與永久可讀的 Markdown。這不是手機功能的必要前置，也不是第二個可自動覆蓋雲端的資料庫。

## 本次實作邊界

`lib/obsidian-export.ts` 提供純函式 `exportTripToObsidian(trip, options?)`，回傳 `filename` 與 `markdown`。它不讀寫 vault、不連網、不修改旅程。下載入口由 App 整合處提供；完成下載不代表已建立自動同步。

- 檔名依穩定旅程 ID，不隨標題修改；匯出不加入當下時間，因此相同來源產生相同內容。
- 記錄來源更新時間、來源頁與原始可見性；鏡像預設私人，不代表公開發布。
- 原段落內容保持原樣。既有內容沒有明確分類時標為「尚未核對」，不因公開狀態、標題或推測就認定已發生。
- 編輯者確認後，可透過 `entryKinds` 明確分為 `plan`、`actual`、`public`。分類不會改寫原文，公開文稿分類也不會執行發布。
- 照片保留 ID 與拍攝時間，沒有日期就寫未知；不輸出 storageKey、簽名媒體網址或憑證，也不下載大檔。原文若含私人資訊仍會保留，因此本匯出只適用私人 vault，不是公開內容清理器。

## Vault 落點與更新規則

現有 vault 為 JDB-Runtime，TravelOS 專案在 `projects/travel-os`。按需匯入命令把鏡像放在 `projects/travel-os/generated/`，人工筆記可放 `projects/travel-os/notes/` 並連結本文。純匯出函式本身不寫入；匯入命令只新增生成目錄內容。

首次匯入只新增檔案。現有匯入器採不可覆寫版本：檔名包含穩定旅程 ID 與內容雜湊；相同內容不重寫，新內容另建版本。若同名生成檔被人工改過，回報衝突並保留手寫內容。每批有「匯入目錄」連結該批版本；以來源更新時間辨認版本，舊資料不會取代較新檔案。不刪除人工筆記，不整包覆蓋 vault，不建立雙向最後寫入者勝出的同步。

## Notebook 上按需匯入

在 TravelOS 專案資料夾執行：

```powershell
node --experimental-strip-types scripts/obsidian-sync.mts
```

若已有驗證過的雲端 JSON 備份，可執行 `node --experimental-strip-types scripts/obsidian-sync.mts --snapshot 路徑.json`。匯入目錄會明寫「已保存雲端快照（非即時）」與來源內容時間；不可把此模式報成最新雲端同步。

命令只讀取目前正式站 `/api/trips/content`。若雲端沒有可用內容、只回傳 seed、連線失敗或需要尚未提供的存取權限，停止匯入，不動原檔。若站台有 PIN，從 `TRAVELOS_ADMIN_PIN` 環境變數提供，不放進參數或筆記。預設是本機既有 JDB-Runtime vault，可用 `TRAVELOS_OBSIDIAN_PROJECT` 指定另一台 notebook 上同一專案的路徑。

生成資料夾先建立忽略全部內容的 `.gitignore`，私人正文不進 Git。此規則不代替 vault 本身的同步與分享設定；本命令不更改 Obsidian Sync、帳號或 vault 權限。它沒有常駐程序、排程或輪詢；notebook 關閉時，手機仍直接使用雲端 App。

Obsidian 裡的長篇修改先另存提案，再由 App 對照雲端最新版本採用。完整雙向編輯、離線合併與自動 vault 同步尚未實作，也不是手機正常運作的條件。

## 驗證

`tests/obsidian-export.test.mts` 驗證原文保留、計畫與實際分開、不誤認公開即已核對、不輸出媒體憑證、穩定檔名、不可跨資料夾、來源不被修改、重複匯入、人工修改保護與舊版本保留。手機下載與跨裝置雲端保存須由各自整合流程另驗證。
