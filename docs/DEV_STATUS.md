# TravelOS — DEV_STATUS（接續開發入口，2026-10-27 11:45 +08:00 更新）

最短的「現況＋怎麼接」。與 `docs/TRAVELOS_CONTINUE.md`（Codex 的 Capture→Write 接通與最小真站驗證）並用；`HANDOFF.md` 為歷史紀錄。

## 唯一真相

- Repo：https://github.com/c8vzn4ym5g-ai/travelos2 ，主線 `main`。
- 正式站（只在 Cloudflare Workers）：https://travelos2.chao-jason.workers.dev ，家庭入口 `/family`。不用 Vercel。
- **main == live**：Worker version `53cb1942-4938-46cd-b184-4a9c0152c9bc`（2026-10-27 03:36Z），由 main `293f016` 建置部署（= Codex 的 `1069156` + PR #145 測試跳過 + PR #146 Capture 顯示確認修正）。之後的 docs 提交一律 `[skip ci]`，應用碼不變。
- 框架：**Next 15.5.28 + OpenNext Cloudflare 1.20.4**。OpenNext 的兩年支援期限對 Next 15 已過，`scripts/package-app.mjs` 只對「精確 15.5.28」加 `--dangerouslyUseUnsupportedNextVersion`（`tests/package-runtime.test.mjs` 保護）。**不要**再試 Next 16.4.x：PR #141 部署後 Worker 啟動 1101／全站 500（`@opennextjs/cloudflare@1.20.4` 的 `loadManifest(preview-props.json)`；1.20.13 本機可跑，但 Codex 選擇回原框架並以 #143 發布，故 1.20.13 未採用）。若日後升 Next 16，請升 `@opennextjs/cloudflare` ≥1.20.13，並在**部署前**跑 `build` + `cf:build` + `wrangler dev --local` 各頁 curl。

## 今日事件摘要（2026-10-27）

1. 事前線上跑 03b71fd（Capture 顯示確認修正）的部署 `a4ca592e`；main 因 OpenNext 拒絕 Next 15.5.24 而 CF 建置失敗，main ≠ live。
2. 11:05 main 升 Next 16.4.3 → 部署成功但 1101／500；11:07 用 Cloudflare deployments API 回滾。
3. 11:08 Codex 加「recovery（只回滾）」workflow 回到 `1e68e797`；11:12 PR #143 回原框架 Next 15.5.28 並還原正常 build+deploy workflow，Worker `81cedc0f`。
4. 11:36 PR #146 把 Capture 顯示確認修正（原 PR #137 的 03b71fd）重新套到當前 main 並部署 → `53cb1942`。#145 把 45 個過時失敗測試改為帶理由的 skip。
5. 關閉 PR #139、#140（已被 #143 取代）；#141（Next 16）、#142（取代為 #144）、#144（本 PR，現為純文件）。

## 架構

- Next.js App Router（TypeScript、Tailwind 4），pnpm 10，Node 22。
- `@opennextjs/cloudflare` → Worker `travelos2`（`wrangler.jsonc`、`.open-next/worker.js`；bindings：`AI`、`ASSETS`、`WORKER_SELF_REFERENCE`；**Worker 沒有任何 secret**）。R2 `travelos-media` binding 仍註解。
- 資料倉庫：Google Drive 資料夾 `1Sk2TqgpF6NxoNYdUKO4h8t84UA7KxChN`，經 Apps Script（`lib/drive-warehouse.ts`，URL／token 可由 `TRAVELOS_DRIVE_WAREHOUSE_URL/_TOKEN` 覆寫；不要把 token 寫進文件）。檔案以**檔名**查找，不寫死 id。
- 路由：`/`、`/trips`、`/trips/[slug]`、`/trips/admin`、`/trips/write`、`/food`、`/coffee`、`/family`（`/family/bench` 工作台、`/family/capture`）、`/api/trips/{catalog,content,media,photos}`、`/api/notes/{catalog,item,photos}`、`/api/coffee/*`、`/api/moments*`、`/api/stats`。
- 公開首頁／旅程庫只讀 `travelos__public_hub.json` 投影；private 旅程不進公開。

## 部署與回滾

- push 到 `main` → `.github/workflows/cloudflare-deploy.yml`：install → `pnpm run build` → `pnpm run cf:build` → `opennextjs-cloudflare deploy`。secrets：`CLOUDFLARE_API_TOKEN`、`CLOUDFLARE_ACCOUNT_ID`。純文件／純測試提交加 `[skip ci]`。
- 部署前本機驗證：`pnpm run build && pnpm run cf:build && pnpm exec wrangler dev --local`，curl 各頁 200。
- 回滾：`POST /accounts/{id}/workers/scripts/travelos2/deployments`（percentage 策略，指定 version_id 100%）；列歷史同路徑 GET。已知版本：`53cb1942`（現行，main 293f016）、`81cedc0f`（1069156，無 Capture 修正）、`1e68e797`（2026-09-20）、`a4ca592e`（舊 03b71fd 版）。
- 只有一位 writer 同時動部署／workflow；整合者（GM）合併。

## 驗收基準（2026-10-27，live）

- 皆 200：`/`、`/trips`、`/food`、`/coffee`、`/family`、`/family/bench`、`/family/capture`、`/trips/write`、`/api/moments?slim=1`、`/api/trips/catalog`。
- `/api/categories/trips` total = 13（公開庫）；`/api/trips/catalog` = 24（23 趟家庭旅程 ＋ Codex 的私人接通測試作品 `trip_f77683d2-2178-465c-a684-d2b55b48d023`）；美食 8；咖啡 4。
- `node --experimental-strip-types --import ./tests/register-at.mjs --test tests/*.test.*`（Node 22）：474 tests／428 pass／**0 fail**／46 skipped。

## 已知問題／下一步（依優先序）

1. **`/api/trips/content` 無權限控管（需 Owner 決定）**：`GET` 不帶 PIN 即回完整內容（含 private 旅程：23 趟中 10 private、6 shared）。`lib/family-pin.ts` 的 `isAdminPinValid` 永遠 true、`isFamilyPinRequired` 永遠 false；`lib/family-session.ts` 不送 PIN；Worker 無任何 PIN secret；Owner 2026-09-13 決定家庭入口免 PIN。要加 PIN 需先：(a) 設定 `TRAVELOS_FAMILY_PIN` Worker secret（Owner 提供，不進 repo），(b) 伺服器端 opt-in：未設 secret＝現況；已設＝匿名只回 public、`x-travelos-admin-pin` 才回全部，(c) 所有 callers 補送 PIN／session：`lib/editor-library-load.ts`、`lib/save-writing-trip.ts`、`lib/write-trip-load.ts`、`app/trips/admin/page.tsx`、`app/trips/new/page.tsx`、`app/family/desk/page.tsx`、`scripts/obsidian-sync.mts`（已支援 `TRAVELOS_ADMIN_PIN`）。三步須一起上，否則家庭編輯流程會壞。
2. **真機驗收**：見 `docs/QC_PHONE_FIXTURE.md`（Bench→Write→保存→另一瀏覽器重開；Capture 7 張）。Codex 已做 390×844 模擬視窗最小真站驗證，**實體 iPhone 尚未重驗**；7 張 dump 的 #146 修正尚無真機秒級數據。
3. **skip 的 45 個過時測試**（`grep -rn 'skip:' tests`）：優先重寫 `tests/public-hub.test.mts`、`tests/public-library-recovery.test.mjs`（公開庫／恢復行為）；其餘為舊 PIN 閘、Lapland 文案、首頁文案、已退役 family 首頁卡片、responsive shell 等標記斷言，可依現況重寫或刪除。
4. TypeScript：`tsc --noEmit` 有既有診斷（`note-workspace.tsx`、`visual-journal-editor.tsx`、`note-article.ts`）。
5. 舊未合併 PR（#2、#8、#44、#52、#73、#86、#87、#137 已由 #146 取代）需 Owner 決定；不要刪分支、不要 force-push。
6. R2 開通後解開 `wrangler.jsonc` 註解；README 的 Vercel 字樣改成 Cloudflare 唯一。

## Drive 正式檔（2026-10-27 查證；覆寫存檔檔名不變、id 可能變）

| 檔名 | Drive id | 狀態 |
|---|---|---|
| `travelos__editor_catalog.json` | 1hUBDQrPfvIj1rbS9WInAcSMo0nuwuJlD | 旅程目錄（現 24 含測試作品） |
| `travelos__food.json` | 1jtDfyYK_WB_9Jh9-S7vtnAMsC4oTpv9J | 8 篇 |
| `travelos__coffee.json` | 1mRgL8PBPjppS97dlDNBXKcMrpFkpBrGL | 4 篇（公開顯示 3） |
| `moments.json` | 1ThTTsMSYmStw1ft_pGJwh95gIfLVXGvF | Capture 索引 |
| `travelos-public-stats-v1.json` | 1NcHWNm1yuNEA211IEu3DW6Fv6_8joJfN | UV/PV |
| `travelos__trip__*.json`、`travelos__public_hub.json` | 依檔名 | 公開庫 13 篇 |

## 硬規則

已手機測通的流程不重做；只部署 Cloudflare、不用 Vercel；不改寫 GitHub 歷史、不刪分支；本機開發預設會讀寫**正式**家庭 Drive，實驗用隔離測試，不要拿正式資料試。
