# TravelOS — DEV_STATUS（接續開發入口，2026-10-27）

本文件是目前最短的「現況＋怎麼接」。與 `docs/TRAVELOS_CONTINUE.md`（Capture→Write 素材接通說明）並用；舊 `HANDOFF.md` 為歷史紀錄。

## 唯一真相

- Repo：https://github.com/c8vzn4ym5g-ai/travelos2 ，主線 `main`。
- 正式站（只在 Cloudflare Workers）：https://travelos2.chao-jason.workers.dev ，家庭入口 `/family`。不用 Vercel（README 的 Vercel cold spare 不再使用）。
- 2026-10-27 對齊：main = 原 main fc75ee7（含 PR #138 素材→Write 接通）＋ Capture 顯示確認修正（PR #137，03b71fd，此前一直只存在線上部署，未進 main）＋ OpenNext Next15 旗標修正（c9373d9 的內容，解決 main 部署失敗）。

## 架構（一句話版）

- Next.js 15.5.24 App Router（TypeScript、Tailwind 4），pnpm 10，Node 22。
- 部署：`@opennextjs/cloudflare` → Cloudflare Worker `travelos2`（`wrangler.jsonc`，`.open-next/worker.js`，Workers AI binding `AI`，自參考 service `WORKER_SELF_REFERENCE`）。R2 `travelos-media` binding 保持註解，等 Owner 開通。
- 資料倉庫：Google Drive 資料夾 `1Sk2TqgpF6NxoNYdUKO4h8t84UA7KxChN`，經 Apps Script（`lib/drive-warehouse.ts`；URL／token 可由 `TRAVELOS_DRIVE_WAREHOUSE_URL/_TOKEN` 覆寫，不要把 token 貼進文件）。檔案以**檔名**查找，不寫死單檔 id。
- 主要路由：`/`、`/trips`、`/trips/[slug]`、`/trips/admin`（編輯）、`/trips/write`、`/food`、`/coffee`、`/family`（含 `/family/bench` 工作台、Capture）、`/api/trips/{catalog,content,media,photos}`、`/api/notes/{catalog,item,photos}`、`/api/coffee/*`、`/api/moments*`、`/api/stats`。
- 公開首頁／旅程庫只讀 `travelos__public_hub.json` 投影，再讀單篇；private 旅程不進公開。

## 部署

- 標準：push 到 `main` 觸發 `.github/workflows/cloudflare-deploy.yml`（install → `pnpm run build` → `pnpm run cf:build` → `opennextjs-cloudflare deploy`）。需 GitHub secrets `CLOUDFLARE_API_TOKEN`、`CLOUDFLARE_ACCOUNT_ID`。
- 手動：同 workflow 的 `workflow_dispatch`（可選任何分支，**會把該分支部署到正式站**，慎用）；或本機 `pnpm run cf:deploy`。
- 注意：OpenNext 已拒絕超過兩年支援期的 Next 15，所以 `cf:build`／`cf:deploy`／`scripts/package-app.mjs` 帶 `--dangerouslyUseUnsupportedNextVersion`。長期解法是升 Next 16。
- 查現況：`GET /accounts/{id}/workers/scripts/travelos2/deployments`（Cloudflare API），或 `gh run list -R c8vzn4ym5g-ai/travelos2`。

## Drive 正式檔（資料夾 1Sk2TqgpF6NxoNYdUKO4h8t84UA7KxChN；id 為 2026-10-27 查證值，覆寫存檔會保持檔名但 id 可能變）

| 檔名 | Drive id | 狀態（2026-10-27） |
|---|---|---|
| `travelos__editor_catalog.json` | 1hUBDQrPfvIj1rbS9WInAcSMo0nuwuJlD | 23 趟，與線上 `/api/trips/catalog` 完全一致（id＋updatedAt） |
| `travelos__food.json` | 1jtDfyYK_WB_9Jh9-S7vtnAMsC4oTpv9J | 8 篇，updatedAt 2026-10-02T14:14:48Z，與線上一致 |
| `travelos__coffee.json` | 1mRgL8PBPjppS97dlDNBXKcMrpFkpBrGL | 4 篇（公開顯示 3），updatedAt 2026-09-18T05:50:00Z，與線上一致 |
| `moments.json` | 1ThTTsMSYmStw1ft_pGJwh95gIfLVXGvF | Capture 索引（2026-10-04） |
| `travelos-public-stats-v1.json` | 1NcHWNm1yuNEA211IEu3DW6Fv6_8joJfN | 站內 UV/PV 統計 |
| `travelos__trip__*.json`、`travelos__public_hub.json` | 依檔名查找 | 公開旅程庫＝13 篇 |

## 驗收基準（2026-10-27 同步時）

- 線上 `/`、`/trips`、`/food`、`/coffee`、`/family`、`/family/bench` 皆 200；`/api/categories/trips` total=13；`/api/notes/catalog?category=food` 8 篇。
- `pnpm test`（Node 22）：434 pass / 45 fail / 1 skip。45 項在同步前的 main 也一樣失敗（過時的原始碼字串斷言，如舊 PIN／Lapland／首頁文案），不是本輪造成。
- `pnpm run cf:build` 通過。

## 已知問題／下一步（依優先序）

1. **手機驗收證據**：依 `TRAVELOS_CONTINUE.md`，真手機 Safari 走一次「工作台選一批 → Write → 保存 → 另一瀏覽器重開同篇」並留畫面證據；Capture 真機 7 張 dump 秒級確認（PR #137 test plan 未勾項）。
2. **權限**：`/api/trips/content` 的 `GET` 目前在未帶 PIN 時回 200 且含完整內容（admin PIN 現為關閉／空值狀態；Owner 曾指示密碼延後）。上線對外前要決定 PIN／家庭登入，避免 private 旅程外洩。
3. **清理 45 項過時測試**：逐項更新或刪除與現行設計相悖的字串斷言，讓 `pnpm test` 回到全綠，再把它加進 CI。
4. **TypeScript**：`tsc --noEmit` 有 5 個既有診斷（`note-workspace.tsx`、`visual-journal-editor.tsx`、`note-article.ts`）。
5. **Next 15 → 16**：拿掉 `--dangerouslyUseUnsupportedNextVersion`。
6. **PR 整理**：#139、#140 與已合入的旗標修正重複，可關閉；#137 已被本次整合取代，可關閉；#2、#8、#44、#52、#73、#86、#87 為舊的未合併分支，需 Owner 決定。不要刪分支、不要 force-push。
7. R2 `travelos-media` 開通後再解開 `wrangler.jsonc` 註解；README 的 Vercel 字樣需改成 Cloudflare 唯一。

## 硬規則

已手機測通的流程不重做；只部署 Cloudflare；不用 Vercel；不改寫 GitHub 歷史、不刪分支；本機開發副本預設會讀寫正式家庭 Drive，實驗用隔離測試，不要拿正式資料試。
