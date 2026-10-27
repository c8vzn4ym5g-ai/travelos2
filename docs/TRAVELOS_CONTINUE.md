# TravelOS 跨帳號／跨智能體續開發交接

更新：2026-10-27 11:17 +08:00。本文件取代本輪所有「候選／未部署」狀態。

## 目前正式結果

- Canonical repository：https://github.com/c8vzn4ym5g-ai/travelos2 ，main。
- 已部署應用提交：1069156b36b1ba7c31595e6ae11314f7cb37024f。
- Cloudflare workflow40442829841／job121986963393：Next建置、OpenNext建置與實際Deploy均success。
- Worker version：81cedc0f-59cb-4536-94bd-80386f2a8b6c。
- 狀態：implemented、tested、synchronized、deployed、最小真站流程verified。未聲稱完整App／實體iPhone驗收。
- 後續純交接文件提交使用[skip ci]，應用原始碼不變，不重複部署。
- PR138是兩個接通修正；PR141的Next16候選已被PR143取代，不可拿來重新發布。

## 手機及筆電入口

- 手機家庭入口：https://travelos2.chao-jason.workers.dev/family
- 收素材：/family/capture → 檢查入倉：/family/bench
- 工作台選一批「選擇作品，接著整理這批素材」→ Write選既有作品 → 儲存並轉成遊記。
- 筆電從同站 /trips/admin 選同一篇續編，或在Write按「打開這篇遊記編輯」。
- 原有每張照片的選旅程入口仍保留；本輪補的是統一批次入口，沒有重做既有照片轉入流程。

## 本輪最小真站驗證

只使用一筆明確標示的私人合成測試作品與一批合成素材，沒有修改／發布既有家庭作品，沒有刪除原件。

1. 真站API建立素材記錄，上傳一張640×400合成JPEG；雲端入倉成功。
2. 390×844瀏覽器視窗開啟該批工作台，圖片解碼640px、批次入口可見，無水平溢出。
3. 實際點批次入口，Write只開該moment；選唯一私人測試作品、填字、按保存，畫面出現成功回饋。
4. 另開獨立編輯頁讀回同一篇：1張素材、1段正文。修改正文，再按儲存工作稿，畫面確認已保存。
5. 無cookie的獨立HTTP讀回同一作品與moment：ID、來源引用、正文精確標記、private、1照片／1故事皆一致，來源note仍保留。
6. 1280×800桌面視窗圖片正常解碼、clientWidth與scrollWidth同為1265，無水平溢出。
7. 家庭頁、雙manifest與雙512px圖示均HTTP200；manifest為standalone且分別指向公開版／family。

實體iPhone相機／Safari背景切換／弱網、第二ChatGPT帳號實際登入未在本輪驗證。Owner之前多次手機使用成功是另有的真機證據，不與本輪模擬視窗混稱。

## 唯一驗證資料及保留狀態

- moment：moment_acceptance_1793070366415
- private trip：trip_f77683d2-2178-465c-a684-d2b55b48d023
- 標題：【接通測試・非家庭遊記】2026-10-27
- 正文精確標記：TRAVELOS_CONNECTION_OK_20261027: phone -> warehouse -> bench -> selected work -> laptop continuation.
- 該私人測試記錄與合成圖片保留作重開證據，未公開，不是家庭內容。不要重複建立新測試資料，也不要直接改整個倉庫索引來清理。
- 最後獨立讀回：2026-10-27T03:16:52.740Z；作品updatedAt：2026-10-27T03:16:15.304Z。

## 異地接手

不需要原Windows路徑、原聊天記憶或原電腦在線。具Git／Node執行環境的其他帳號或智能體可從main取得同一套程式與測試。

```sh
git clone https://github.com/c8vzn4ym5g-ai/travelos2.git
cd travelos2
git rev-parse HEAD
pnpm install --frozen-lockfile --ignore-scripts
node --experimental-strip-types --import ./tests/register-at.mjs --test tests/package-runtime.test.mjs tests/capture-work-handoff.test.mts tests/write-handoff.test.mts tests/write-moment-load.test.mts tests/write-moment-target.test.mts tests/write-photo-transfer.test.mts tests/write-trip-load.test.mts tests/selected-trip-save.test.mts tests/editor-local-draft.test.mts
```

CI使用Node22／pnpm10，本輪本機Node24.19.0／pnpm11.25.0。上述聚焦命令30/30通過。ignore-scripts足供此命令，不代表所有native打包流程均已準備。

不同帳號不會自動繼承GitHub寫入、家庭資料或部署權限。各自分支、同範圍一位writer，整合者合併；不要互相覆蓋整個舊目錄。原GitHub secrets留在原服務，不複製到聊天。

原碼含既有家庭倉庫預設連線，直接啟動App不是隔離沙箱；先跑fixture，真實資料操作與部署必須有任務授權。不要以可clone誤稱各帳號的權限隔離已完成。

## 發布相容性與既有缺口

最終保留原Next15／webpack／OpenNext路徑，維護版精確鎖15.5.28。OpenNext的兩年日曆支援期限已過，官方支援期限opt-in僅對精確15.5.28生效，其他版本不放寬。這是短期延續原執行環境，不代表恢復長期支援；後續框架遷移須獨立驗證。

Next16候選建置部署成功，但本地區HTTP500；recovery40442451501已恢復原Worker，再由PR143完成原框架發布。不能把先前500歸因為已證實的Next16根因：回復期間另一地區的單次tail為ok，原因仍未充分確定。

曾做完整回歸對照：舊main320500c／Next15為422pass、45fail、1skip；Next16候選426pass、相同45fail、1skip，無新增失敗名稱。這不是全套通過；本輪沒有擴大修理舊測試。最終原框架版本以30項聚焦檢查、CI雙建置及真站流程作接受證據。既有全專案TypeScript5個診斷亦未宣稱修復。

## 接手後下一步

先從main跑30項命令，沿用本輪已保存的真站證據。需要擴充時另定最小範圍；不要重做已完成入口、從OneDrive舊副本覆蓋，或未授權新增登入／公開內容／背景監控。若要再次發布，必須核對實際Cloudflare Deploy步驟與真站結果，不能只看Vercel備援狀態。
