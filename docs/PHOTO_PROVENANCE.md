# 照片拍攝來源與歸組準則

目前交付：`lib/photo-provenance.ts` 純判斷函式及回歸測試；新增照片的上傳入口已分開檔案／裝置資訊與拍攝資訊。歸組函式尚未接上編輯介面；沒有批次修改任何原照片。

新增照片 POST 把裝置位置記為 `uploadCoordinates`、檔案修改時間記為 `fileModifiedAt`。服務端使用固定版本 exifr 7.1.3 從實際檔案讀 EXIF，不接受表單自稱 verified。取得來源後保存 `captureMetadata`；有 UTC offset 才填 `takenAt`，只有本地時間則保留 `localTakenAt`。有原始 GPS 才填拍攝 coordinates。缺資料維持 null／unknown，不阻擋圖片上傳，createdAt 仍保存入庫時間。

原始 HEIC／小 JPEG 直接上傳時可立即擷取；Canvas 縮圖缺少 EXIF 時維持未知，後續原檔 POST 從未轉換的原始 bytes 補入並保存中繼資料，原檔與顯示圖路徑都保留。解析限制 1.5 秒，失敗仍正常保存圖片。解析器只在服務端動態載入，不增加手機頁面 EXIF 套件負擔。verified 只代表已由檔案讀出，不保證相機時鐘或 GPS 一定正確。

Capture 不再用裝置 GPS／file.lastModified 宣告整個 Moment 的事件地點／時間；上傳 session allocation 保留。影片分塊入口仍未改，本階段來源修正涵蓋照片。`provenanceFromMomentPhoto` 只使用已解析 captureMetadata，忽略舊的無來源座標／時間；在獨立確認國家或時區前仍回待確認。

官方依據：[exifr 文件](https://github.com/MikeKovarik/exifr) 說明 JPEG／HEIC 與關閉日期自動轉型的選項。已知限制：[官方 issue 138](https://github.com/MikeKovarik/exifr/issues/138) 回報部分 iOS 18 HEIC 容器格式解析問題；本實作不猜補，遇到這類檔案留未知並保留原檔。兩個官方範例檔的來源列在 tests/fixtures/exif/README.md。

## 資料分工

- `capture`：從原始檔取得的 EXIF 拍攝時間及 GPS。國家與地點標籤只能由這份 GPS 解析；函式本身不呼叫地理服務。
- `upload`：上傳時間及當下裝置位置。只作為入庫紀錄，不參與拍攝日期／地點判斷。
- `manualTripId`：人已明確確認這張照片屬於哪趟旅行。上傳頁當前選中的旅程不等於人工確認。
- `neighboringTripId`：相鄰照片的線索，只供後續人工參考，不能獨立確認歸屬。
- 原始檔、原始 EXIF 及入庫時間不可覆寫。人工更正應另外記錄更正者、時間及依據，再重新計算歸組。

## 判斷結果

`decidePhotoGroup(photo, trip)` 不修改輸入，回傳：

- `suggested`：拍攝日期在旅程範圍內，拍攝 GPS 的國家吻合；可提出旅程／日期／地點分組建議，仍不是人工確認。
- `confirmed`：已有明確人工確認，且不存在已知的國家或日期衝突。缺少 EXIF 的掃描照片可經人工指定旅程，但日期／地點仍保持未知。
- `review`：缺少可信拍攝資料、國家衝突、超出行程日期或人工指定不同旅程。`tripId` 為 null，不能自動塞入游記。

時間帶有 Z／UTC offset 時，轉為旅程時區的日曆日期比較（含起迄日）。沒有 offset 的 EXIF 本地時間只在已確認拍攝時區與旅程時區相同時採用；不同或未知時區留待確認，不假設手機目前時區。跨國旅程可列多個 countryCodes；跨時區分組宜用各段已確認時間／地點作候選。

此函式不從經緯度自行推斷國家、不依照片視覺猜地名、不用上傳地點補 EXIF，也不使用檔案修改時間替代拍摄時間。沒有具體 placeId 時保留 null，不能捏造景點群組。

## 現行接入位置與已發現問題

1. `lib/prepare-photo.ts` 保留 original 與 display；現在原檔 POST 在服務端直接抽取原始 bytes 的 EXIF，無須先信任手機提供的中繼資料。Canvas 的顯示版缺資料時不推測原始資訊。
2. `app/family/capture/page.tsx:763` 仍以 file.lastModified 提供時間及分配上傳 Moment；`:790` 傳目前 coordinatesRef。現在 `lib/capture-upload.ts` 送照片時已將這兩項改名為 fileModifiedAt、uploadLatitude／uploadLongitude；沒有更動 session allocation。
3. `app/api/moments/photos/route.ts` 使用 `photoUploadMetadata` 隔離舊欄位，再由 `readOriginalCaptureMetadata` 提供可信來源。旧版客戶端的 takenAt／latitude／longitude 仍可接收，但只能保存為未經驗證的檔案／上傳資訊。
4. 老資料已可能把上傳時間／位置寫成拍攝資料。不能因舊欄位存在就宣告為 EXIF；需讀取仍保留的原檔，或明確人工核對，再產生獨立來源記錄。
5. Root 後續接入時應先讀取原檔、保留 provenance 記錄，再把此函式用於候選旅程。每趟旅行的標準地點 ID、國家和日期必須來自已核實旅程資料；未核實 Plan 不可替代實際旅程。

## 已驗證範圍

歸組測試涵蓋日本旧照在家補傳、法國照片混入日本、缺少 EXIF、鄰近照片不足以確認、跨午夜時區、人工確認／衝突、非法日期與缺少 GPS。實際官方 JPEG／HEIC fixtures 驗證 GPS、原始日期、offset 與原檔不變；儲存測試驗證原檔晚到後的補充與讀回，以及晚到的未知縮圖不得降級已確認來源。尚未部署或執行家庭手機實際驗收；也沒有修改老照片的錯誤中繼資料。
