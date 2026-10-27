# TravelOS — DEV_STATUS（接續開發入口，2026-10-27）

本文件是目前最短的「現況＋怎麼接」。與 `docs/TRAVELOS_CONTINUE.md`（Capture→Write 素材接通說明）並用；舊 `HANDOFF.md` 為歷史紀錄。

## 唯一真相

- Repo：https://github.com/c8vzn4ym5g-ai/travelos2 ，主線 `main`。
- 正式站（只在 Cloudflare Workers）：https://travelos2.chao-jason.workers.dev ，家庭入口 `/family`。不用 Vercel（README 的 Vercel cold spare 不再使用）。
- **2026-10-27 11:00–11:10 部署事件（務必先讀）**
  1. 事前：線上跑的是分支 `cursor/capture-index-hang-on-main`（03b71fd，Capture 顯示確認修正，PR #137）的部署（Cloudflare 版本 a4ca592e，2026-09-22）；main（fc75ee7）本身從 PR #138 起 CF 建置就失敗（OpenNext 拒絕 Next 15.5.24），所以 main ≠ 線上。
  2. 11:05 main 升 Next 16.4.3（PR #141）後部署成功，但 Worker 啟動即 1101／全站 500。原因（本機 wrangler dev 重現）：`@opennextjs/cloudflare@1.20.4` 不支援 Next 16.4（`Unexpected loadManifest(/.next/server/preview-props.json)`）。升到 `@opennextjs/cloudflare@1.20.13` 後本機 `/`、`/trips`、`/food`、`/coffee`、`/family`、`/family/bench`、`/trips/write` 皆 200，公開庫 13、目錄 23、美食 8、咖啡 4，與 Drive 一致。
  3. 11:07 已用 Cloudflare API 回滾到 a4ca592e（站回 200）；11:08 main 又加了「Cloudflare recovery」workflow（0bed5aa），把線上回滾到 1e68e797（2026-09-20，main 320500c 的版本：**沒有** Capture 顯示確認修正、也沒有 PR #138 的工作台→Write 入口）。**目前線上 = 1e68e797，main 的 workflow 每次 push 只會回滾，不會建置部署。**
  4. 修復 PR（見「下一步 1」）：還原正常 deploy workflow ＋ opennext 1.20.13 ＋ 併入 Capture 修正。本機 `pnpm run build`、`cf:build`、`wrangler dev` 驗證通過；合併即部署。

## 架構（一句話版）

- Next.js 16.4.3 App Router（webpack 打包，TypeScript、Tailwind 4），pnpm 10，Node 22。
- 部署：`@opennextjs/cloudflare` → Cloudflare Worker `travelos2`（`wrangler.jsonc`，`.open-next/worker.js`，Workers AI binding `AI`，自參考 service `WORKER_SELF_REFERENCE`）。R2 `travelos-media` binding 保持註解，等 Owner 開通。
- 資料倉庫：Google Drive 資料夾 `1Sk2TqgpF6NxoNYdUKO4h8t84UA7KxChN`，經 Apps Script（`lib/drive-warehouse.ts`；URL／token 可由 `TRAVELOS_DRIVE_WAREHOUSE_URL/_TOKEN` 覆寫，不要把 token 貼進文件）。檔案以**檔名**查找，不寫死單檔 id。
- 主要路由：`/`、`/trips`、`/trips/[slug]`、`/trips/admin`（編輯）、`/trips/write`、`/food`、`/coffee`、`/family`（含 `/family/bench` 工作台、Capture）、`/api/trips/{catalog,content,media,photos}`、`/api/notes/{catalog,item,photos}`、`/api/coffee/*`、`/api/moments*`、`/api/stats`。
- 公開首頁／旅程庫只讀 `travelos__public_hub.json` 投影，再讀單篇；private 旅程不進公開。

## 部署

- 標準（修復 PR 合併後的狀態）：push 到 `main` 觸發 `.github/workflows/cloudflare-deploy.yml`（install → `pnpm run build` → `pnpm run cf:build` → `opennextjs-cloudflare deploy`）。需 GitHub secrets `CLOUDFLARE_API_TOKEN`、`CLOUDFLARE_ACCOUNT_ID`。
- 部署前本機驗證：`pnpm run build && pnpm run cf:build && pnpm exec wrangler dev --local`，curl 各頁確認 200（Next／OpenNext 升版後務必做，這次 1101 就是沒做這步）。
- 回滾：`POST /accounts/{id}/workers/scripts/travelos2/deployments`（strategy percentage、指定 version_id 100%）或 `wrangler rollback <version-id> --name travelos2`；列歷史用同路徑 GET。已知版本：a4ca592e＝03b71fd 版（含 Capture 修正，事件前線上）；1e68e797＝2026-09-20 main 320500c 版。
- `workflow_dispatch` 可部署任何分支到正式站，慎用。

## Drive 正式檔（資料夾 1Sk2TqgpF6NxoNYdUKO4h8t84UA7KxChN；id 為 2026-10-27 查證值，覆寫存檔會保持檔名但 id 可能變）

| 檔名 | Drive id | 狀態（2026-10-27） |
|---|---|---|
| `travelos__editor_catalog.json` | 1hUBDQrPfvIj1rbS9WInAcSMo0nuwuJlD | 23 趟，與線上 `/api/trips/catalog` 完全一致（id＋updatedAt） |
| `travelos__food.json` | 1jtDfyYK_WB_9Jh9-S7vtnAMsC4oTpv9J | 8 篇，updatedAt 2026-10-02T14:14:48Z，與線上一致 |
| `travelos__coffee.json` | 1mRgL8PBPjppS97dlDNBXKcMrpFkpBrGL | 4 篇（公開顯示 3），updatedAt 2026-09-18T05:50:00Z，與線上一致 |
| `moments.json` | 1ThTTsMSYmStw1ft_pGJwh95gIfLVXGvF | Capture 索引（2026-10-04） |
| `travelos-public-stats-v1.json` | 1NcHWNm1yuNEA211IEu3DW6Fv6_8joJfN | 站內 UV/PV 統計 |
| `travelos__trip__*.json`、`travelos__public_hub.json` | 依檔名查找 | 公開旅程庫＝13 篇 |

## 驗收基準（修復 PR 分支，本機 wrangler dev，2026-10-27）

- `/`、`/trips`、`/food`、`/coffee`、`/family`、`/family/bench`、`/trips/write`、`/api/moments?slim=1` 皆 200；`/api/categories/trips` total=13；目錄 23；美食 8；咖啡 4（updatedAt 2026-09-18T05:50:00Z）。
- `pnpm test`（Node 22）：434 pass / 45 fail / 1 skip。45 項在 main 一樣失敗（過時的原始碼字串斷言，如舊 PIN／Lapland／首頁文案），修復 PR 沒有新增失敗。

## 已知問題／下一步（依優先序）

1. **合併修復 PR 並部署**：還原 workflow、`@opennextjs/cloudflare` 1.20.13、併入 Capture 修正（#137 的 03b71fd）。合併前確認沒有另一個 agent 同時在改 workflow／部署；合併後 curl 各頁＋核對 hub total=13，異常立刻回滾 a4ca592e 或 1e68e797。
2. **手機驗收證據**：依 `TRAVELOS_CONTINUE.md`，真手機 Safari 走「工作台選一批 → Write → 保存 → 另一瀏覽器重開同篇」；Capture 真機 7 張 dump 秒級確認（PR #137 test plan 未勾項）。PR #138 的素材→Write 入口從未上過正式站。
3. **權限**：`/api/trips/content` 的 `GET` 未帶 PIN 也回 200 且含完整內容（admin PIN 目前為關閉／空值；Owner 曾指示密碼延後）。對外前要決定 PIN／家庭登入，避免 private 旅程外洩。
4. **清理 45 項過時測試**，讓 `pnpm test` 全綠並加進 CI。
5. **TypeScript**：`tsc --noEmit` 有既有診斷（`note-workspace.tsx`、`visual-journal-editor.tsx`、`note-article.ts`）。
6. **PR 整理**：#139、#140（Next15 旗標）已過時可關；#142 已被修復 PR 取代；#2、#8、#44、#52、#73、#86、#87 為舊未合併分支，需 Owner 決定。不要刪分支、不要 force-push。
7. R2 `travelos-media` 開通後再解開 `wrangler.jsonc` 註解；README 的 Vercel 字樣改成 Cloudflare 唯一。

## 硬規則

已手機測通的流程不重做；只部署 Cloudflare；不用 Vercel；不改寫 GitHub 歷史、不刪分支；本機開發副本預設會讀寫正式家庭 Drive，實驗用隔離測試，不要拿正式資料試。
