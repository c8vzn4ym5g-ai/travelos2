# TravelOS — 跨帳號／跨智能體續開發入口

更新：2026-10-27（UTC+08:00）。本文件優先於舊 HANDOFF 中本輪涉及的工作台 → Write 接通狀態；其他產品決策不變。

## 2026-10-27 原站發布進行中

以下較早Next16候選已被取代：97e7d3e建置／部署成功，但本地區原站驗證回500，故未通過接受。Recovery workflow40442451501將已知可用Worker1e68e797-803d-436b-b2c6-1e344e68086a恢復100%流量，家庭入口重新200。沒有成功新增測試資料。

目前改用原15系列最新維護版15.5.28，保留原webpack/OpenNext執行路徑。OpenNext的日曆支援期限檢查僅對精確15.5.28啟用其官方opt-in旗標；其他版本仍保留原門檻。這是短期原執行環境延續，不代表15系列恢復長期支援。正式TypeScript設定與頁面流程回復原版本。原deploy workflow將恢復，移除臨時回復作業。

Owner已明確授權合併、部署原站與最小線上接通驗證。PR #138已合併為fc75ee7。首次Cloudflare workflow40440981228：Next建置成功，OpenNext因15.x超出其內建兩年支援期限而停止，Deploy未執行，正式資料未變。

必要發布相容性修正：Next.js16.4.3（npm官方registry核對）、沿用webpack打包與既有OpenNext，移除Next16不再接受的eslint設定，接受Next產生的TypeScript配置更新。沒有停用支援檢查、沒有改頁面流程或資料儲存。Next16本機正式建置成功，接通聚焦28/28通過；正在對照舊主線測試結果，發布與真站證據將補在本節。

## 唯一接續版本

- Repository: https://github.com/c8vzn4ym5g-ai/travelos2
- 本輪分支：`codex/travelos-material-handoff`。從 main `320500ce52826c807d31eef9a082bf21f7f0806e` 建立。
- 以遠端分支最新提交為本輪修正基準；勿從 OneDrive 舊工作目錄、Japan Workspace 或 Value Prototype 覆蓋。
- 正式站：https://travelos2.chao-jason.workers.dev；家庭入口 `/family`。
- 本輪為已實作、隔離測試通過的候選；沒有合併 main，沒有部署本輪修正。
- 修正與交接已同步遠端分支，實作 checkpoint `1cad412`；後續文件更新不改應用程式。

## 本輪改動與驗收邊界

只補兩處：工作台每筆素材加入攜帶原 moment ID 的 Write 入口；Write 按現有單篇 API `{trip}` 接收保存結果，更新同一篇及其伺服器版本。保留素材整理、照片轉入、草稿與既有編輯流程。

最小鏈路：Capture 建立素材記錄 → 素材附加 → 重設記憶快取後 Bench API 讀回 → 指定批次 Write → 原有 transferWritingToTrip → 真正 PUT route → 重設連線快取 → 真正 GET route 模擬另一部筆電重開。

儲存邊界使用測試內 Map，禁止未預期的外部請求；沒有上傳真實／測試資料到正式 Drive。本項不包含相機／二進位檔上傳、真手機 Safari、跨帳號登入或正式端到端操作驗收。

原件引用、目標作品 ID、正文、保存版本與 private 狀態均有斷言；另一篇作品及來源批次不變。重複保存、409 保存失敗、找錯批次、原圖保留與本機草稿恢復由同批聚焦檢查覆蓋。

## 異地最短重現

不需要本機 Windows 路徑或舊對話。Node 22（支援 experimental-strip-types；本次執行為 Node 24.19.0），pnpm 10 為 CI 設定；本機 pnpm 11.25.0 可依鎖檔安裝。

```sh
git clone --branch codex/travelos-material-handoff https://github.com/c8vzn4ym5g-ai/travelos2.git
cd travelos2
git rev-parse HEAD
pnpm install --frozen-lockfile --ignore-scripts
node --experimental-strip-types --import ./tests/register-at.mjs --test tests/capture-work-handoff.test.mts tests/write-handoff.test.mts tests/write-moment-load.test.mts tests/write-moment-target.test.mts tests/write-photo-transfer.test.mts tests/write-trip-load.test.mts tests/selected-trip-save.test.mts tests/editor-local-draft.test.mts
```

`--ignore-scripts` 足供上述聚焦測試，未據此宣稱完整打包環境已驗收。不要把正式 .env、.dev.vars、登入狀態、家庭照片或 private vault 放進交接。測試需 Node 執行能力；只能聊天或只能讀取連結的帳號不能被視為已具開發環境。

## 證據與未完成項

- 上述命令本輪結果：28 passed / 0 failed / 0 skipped。
- 先重現舊保存回應格式造成讀取 undefined trips，以及缺失 Bench 入口；修正後回歸通過。
- 變更來源 ESLint：0 errors / 2 既有 warnings（Write 未用 type、既有 effect dependency）。git diff --check 通過。
- 全專案 TypeScript 檢查未通過：未修改的 note-workspace.tsx、visual-journal-editor.tsx、note-article.ts 有 5 個診斷；本輪未擴大修理。不能宣稱整體 build 或全站驗收通過。
- 本輪正式 `/family` HTTP 200，頁面有編輯版標記；瀏覽器公開首頁實際顯示 13 篇旅程。工作台瀏覽器後續觀測逾時，因此沒有新工作台畫面／手機端到端完成證據。
- main 320500c 歷史 Cloudflare workflow 35488143165 中 Deploy step success；不是本輪修正的部署證據。

## 帳號與共同開發邊界

程式保存在 GitHub，正式服務由 Cloudflare／遠端倉庫提供，不靠本機 dev server；不同 ChatGPT 帳號或其他智能體可在有 Git／Node 工具的環境拉取公開程式並重跑隔離測試。並未實際登入第二個帳號，不能宣稱它的寫入／部署權限已驗證。

目前原有倉庫連線預設值在 source 中，開發副本不是自動隔離的資料沙箱。直接啟動 App 可能讀寫原家庭倉庫。優先跑上述隔離測試；不要讓新帳號用正式資料作實驗，不要把現有存取設計誤稱為各帳號權限已分開。

共同修改需要各自分支與 GitHub 寫入／PR 權限；同一檔案／資料範圍一次一位 writer，由整合者接回成果。不要直接同步整個舊目錄。正式資料操作與部署另須該服務權限及任務授權；不傳遞密鑰。

重要：main push 會觸發 `.github/workflows/cloudflare-deploy.yml`，不要把本輪分支合併主線當作純文件同步。GitHub secrets 保留在原服務，不需抄到另一個聊天帳號；已授權的維護者可透過既有 CI 發布。

## 下一步

由接手者先跑上述 28 項命令，再在隔離資料／經授權的環境實測：手機工作台選一批 → 選作品 → 保存 → 另一瀏覽器開同篇編輯，檢查照片、正文及保存版本一致、窄版無橫向溢出。沒有這個畫面證據前，不稱本輪正式手機鏈路已驗收。

本輪不新增功能、重做已完成介面、改登入、改公開狀態、修改家庭資料或安排定時監控。
