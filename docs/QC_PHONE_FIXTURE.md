# 實機 QC 腳本（Owner／手機操作；自動化代理不要代跑）

站：https://travelos2.chao-jason.workers.dev 。目前無 PIN／無登入（Worker 無 secret；家庭入口免 PIN，見 DEV_STATUS 下一步 1）。**操作會寫入正式 Drive**，請用下列標記的測試資料，測完照「清理」處理。

測試標記：標題或筆記一律含 `QC-20261027`。

## A. Bench → Write → 保存 → 另一瀏覽器重開

可直接用 Codex 已建好的驗收資料（不用新建）：
- moment：`moment_acceptance_1793070366415`
- private 測試作品：`trip_f77683d2-2178-465c-a684-d2b55b48d023`（標題「【接通測試・非家庭遊記】2026-10-27」）

步驟（手機 Safari）：
1. 開 `/family/bench`，找到該批（或在 URL 後直接開 `/trips/write?moment=moment_acceptance_1793070366415`）。
2. 按「選擇作品，接著整理這批素材」→ Write 選「既有作品」→ 選上面的【接通測試】作品。
3. 在正文末尾加一行：`QC-20261027 手機寫入 <時:分>` → 按「儲存並轉成遊記」→ 看到成功回饋。
4. 另一個瀏覽器（筆電 Chrome，或手機無痕分頁）開 `/trips/admin`，選同一篇；或開 `/trips/write?moment=moment_acceptance_1793070366415` 按「打開這篇遊記編輯」。
5. 驗收：正文含剛寫的 `QC-20261027` 那行、素材 1 張仍在、private 不在公開庫（`/trips` 不出現；`/api/categories/trips` 仍 total=13）。
6. 筆電端再改一個字儲存，回手機重新整理同篇，確認讀到。

## B. Capture 7 張 dump（驗 #146 秒級確認）

1. 手機開 `/family/capture`。
2. 一次選 7 張照片（建議用相簿裡真實 iPhone 原圖，每張約 2–4MB；備用：箱子上 `/workspace/qc-fixtures/phone-20261027/QC-2026-10-27-1of7.jpg … 7of7.jpg`，7 張 3024×4032、各 ~0.9MB，要傳到手機需 AirDrop／雲端，由 Owner 授權後再傳）。
3. 備註欄填 `QC-20261027 7張`，按送出，**計時**：
   - 畫面顯示「已收到」確認應在**數秒內**（舊問題：分鐘級卡住）。
   - 不要關頁面，等背景上傳；弱網可切飛航 5 秒再恢復，確認會續傳不重複。
4. 開 `/family/bench`：該批應出現 7 張縮圖、沒有重複（以檔名 `QC-2026-10-27-NofM` 數）。
5. 記錄：確認出現秒數、全部入倉分鐘數、是否有 503／失敗字樣；失敗時截圖＋時間（UTC+8）。

## 清理

不要手動改整份 `moments.json`／倉庫索引。測試 moment 保留作證據即可（private、不公開）；若要移除，請由 GM 用 app 內刪除流程處理。

## PIN／密碼在哪

目前沒有。Worker secrets 為空；`lib/family-pin.ts` 永遠放行。若 Owner 決定加 PIN：secret 名稱預定 `TRAVELOS_FAMILY_PIN`（Cloudflare Worker secret；本機 `.dev.vars`；腳本端 `TRAVELOS_ADMIN_PIN`），不進 repo、不進聊天。
