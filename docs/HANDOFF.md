## 2026-09-14 最新交付：bebe675（取代先前版本紀錄）

原站已發布 bebe675419303ec4172d678ca53d5142ae8f0e68，GitHub workflow34799603104 success。所有公開遊記使用與VisualJournalEditor相同的JournalReader，芬蘭不再走特殊版面或覆蓋已儲存文稿。既有芬蘭短片保留。無照片段落可直接開啟選圖。
相關QC：public-reader-route3/3（包括芬蘭儲存內容與公開共用版面、缺頁處理），reader-films2/2，public-trip8/8（單篇直接Drive、公開快照、私有與錯誤路徑）通過。未跑完整套件。
原站瀏覽器：芬蘭?id=trip_lapland_2020顯示原封面、4段故事與編輯入口；九州無照片段落開啟選圖並取消成功，未保存或發布真實內容修改。無id芬蘭首次開啟曾讀取失敗；九州也曾失敗後重新進入成功。部署及功能可见不等於讀取全面穩定。尚未實測Owner iPhone原圖示；密碼與完整驗證維持Owner延後指令。不得宣稱整個App已完整驗收。
## 2026-09-14 原入口已更新（本節優先於以下舊紀錄）

Production: https://travelos2.chao-jason.workers.dev
Deployed commit: ac5784b285b19ce65d4cc3b271cb94d138b92532; branch codex/fixed-entry-release, origin/main. Source preview branch is superseded for further edits.
GitHub workflow34798542708 completed success including deployment. Cloudflare version36687997-ae4b-4190-b4d2-7082e4ac810b.
Owner explicitly authorized original production update; passwords and full verification remain deferred. Packaging skips lint/type validation under TRAVELOS_PACKAGE_ONLY, builds standalone once and reuses it for Cloudflare. First packaging failure lacked standalone output; fixed in ace9f61. Production editor op=item timed out20sec; changed selected editor to existing direct Drive file read,35sec total budget. No whole-library read on selection. editor-review-fixes focused2/2 passed including draft/public preservation and wrong-record rejection.
Actual original-site browser: Kyushu editor loaded14visiblechapters and Chikuan cover; reader-effect displays decoded cover and title; switching back restores direct edit. Same trip public URL loaded14chapters and edit link. No real trip writes during QC. iPhone home-icon reopen not observed here; no full verification. Earlier broad-test numbers below are historical, not this release verification. Lapland legacy template exception remains.
# TravelOS Handoff

## 2026-09-14 Desktop and phone candidate — local review

Current candidate: http://localhost:3228/review (development server, session 63561). Canonical source remains this checkout. Uncommitted; not pushed or deployed. Official release has not changed. This section supersedes earlier readiness claims only for the local candidate.

Delivered: responsive photographic home/library with search and country filters; home reads only the public index; selected-card links carry the trip ID and read a single existing warehouse item. No full-library fallback. General reader has desktop chapter rail, phone navigation, on-demand map/album/film, and return-to-library behavior. Existing Lapland special reader remains. Desktop editor has live preview driven by the active edit state; phone retains direct editing. Family entry uses responsive layout. Review wrapper switches desktop/phone and entry pages.

Focused QC only: tests/public-trip.test.mts 8 passed after transport change, including selected-only retrieval and private/slug guards. Visible local checks: home real cards, Higashiyama phone chapter navigation/back, Ginkaku desktop read, desktop editor title-to-preview update and restoration, phone editor layout, review phone/desktop switch. Fresh editor showed original title and all saved; no cloud save or publish performed. No full suite, production build, deployment, physical-phone or weak-network acceptance. Local selected retrieval does not establish that the deployed cold-read issue is resolved.

Owner gate: full verification is prohibited until Owner freezes the intended version and explicitly orders full verification. Continue necessary change-scoped QC only. No heartbeats or polling. Usage reference: user screenshot97% remaining; one completion read92% remaining, an account-wide difference of5 percentage points, not precise per-task attribution.


## 2026-09-13 Story-first reading experience

General public readers now lead with film (or cover photo), then summary and photo-led stories. Chapter navigation is expandable; map and itinerary references mount only after the reader opens them. Optional recorded expenses are separate. Mobile duplicate sidebar contents and dashboard-style overview/chips are removed. Existing original trip records and Lapland special mobile cut remain preserved.

Higashiyama adds the reviewed authentic-photo 25-second 720x1280 H264/AAC film and poster as static assets, with download and verified CC0 music credit. Existing promo routes and retry/native playback behavior remain intact. No original travel data mutations.

Local gate: 413 passed, 1 skipped, 0 failed; TypeScript, changed-source lint and production build passed. Chrome 375px visible width: no horizontal overflow, video duration25 and actual playing time advanced, chapter3 anchor reached its photo/story, map absent until opened and removed on close, album displayed all six photos. Deployment acceptance pending. Physical iPhone/network and subjective musical fit remain unverified.

Live acceptance caught a remaining reader defect in release7171a91: a cold detail GET took40,856ms and returned only the loading shell. This invalidates the preceding reading-ready interpretation. Detail page and metadata still called readContent for every trip. Follow-up replaces both with shared cached readPublicTripBySlug: durable public index then selected file only, publishedSnapshot guard, total8-second read budget; storage failures stay errors rather than empty/not-found. Focused11/11 passed; a new process read real Higashiyama3stories/6photos in4,127ms. No originaldata mutation. Follow-up release gate in progress.

## 2026-09-13 Public library cold-load regression

Owner's iPhone screenshot shows /trips Total 0/Public 0 and indefinite Loading journeys. Warm live reads still returned eleven cards; they do not refute this cold-region failure. Existing public hub cache was memory/region-local, with cold full-trip fanout exceeding the six-second HTML budget.

Public pages now use readPublicHubState to distinguish a verified empty library from an unavailable read. Recovery performs two bounded refresh attempts and exposes a native GET reload button; it stops claiming ongoing loading after 20 seconds. Both home and library use this state.

The new private durable travelos__public_hub.json contains public card fields and up to five photo references, never journals or unpublished draft bodies. Apps Script initializes it only through an explicit count-guarded operation. Trip saves update the projection under the trip lock, using publishedSnapshot; private trips are removed. Draft edits that do not change the public projection do not rewrite the index. Fallback saves/failed projection acknowledgements repair by rereading the saved trip ID, preserve durable save success and return a warning if repair fails. Ordinary cold public reads fetch one projection instead of all trip files; legacy fallback and last-good regional cache remain available.

Local gate: 409 passed, 1 skipped, 0 failed; TypeScript passed, changed-source lint zero errors/one existing unused-helper warning; production build passed. Regression coverage includes actual empty-page render, bounded retry rerenders, valid zero library, cold one-index read, published-versus-draft projection, unpublication removal, and durable-save warning/one repair. Apps Script v8 deployment, one-time initialization, application release and real browser acceptance pending at this checkpoint. No passwords/payments or original travel records changed.

Final acceptance supersedes the preceding pending status: Apps Script v8 deployed on the same endpoint; guarded initialization read 21 raw records (20 editor records plus one existing private held draft), generated 11 public cards/16,569 bytes. All 21 source modifiedTimes unchanged. Independent new-process readPublicHubState: ready=true, 11 cards, 1,886ms; direct projection read: 1,581ms. Application cf78955db09a5de447133b2d26044fe5398293c3 deployed successfully through workflow 34739455719, including both builds and actual Wrangler deploy. Chrome narrow viewport rendered all 11 cards, opened Higashiyama with three story chapters and six photos, then returned to /trips; screenshot shows Total11/Public11, no horizontal overflow (375px client/scroll widths). Independent deployed /trips GET200, 11 article elements, 977ms, no old loading message. Physical Owner iPhone/network remains unverified; other isolates retain existing 120-second cache freshness. No original trip edits. No local server or active test process remains.

## 2026-09-13 Owner regression: catalog-first editor

Owner reproduced family → editor taking 30–60 seconds and showing no itinerary. Root reproduced at 61 seconds: “目前沒有行程” alongside “目前無法打開旅行內容”. This supersedes the previous core-ready judgment for cold editor entry. A later successful API read does not refute that failure.

Owner explicitly requested a directory first and only the chosen trip loaded. Editor now GETs /api/trips/catalog (five header fields only), displays catalog cards, and issues GET /api/trips/content?id=... only on selection or explicit requested-trip deep link. Returning to the directory retains loaded drafts without refetching all trips. Catalog failures and single-trip failures have explicit retry states; errors never render as an empty library. Selected reads have an eight-second total budget. Full-library content API remains for existing other workflows; it is no longer the editor entry path.

Catalog is derived private metadata in travelos__editor_catalog.json. Apps Script merges single-row updates under its existing lock and rejects older timestamps. Source trip originals remain authoritative. A saved trip retains its success ACK/version even if catalog update fails, with a warning and one bounded repair attempt. No password, payment, or access change.

Local verification: 403 passed, 1 skipped, 0 failed; TypeScript and production build passed. Tests cover catalog-only requests, exact single-trip selection, timeout, mismatched content rejection, same-lock catalog merge and durable-save ACK preservation. Release code 954a4eaa378f0d3a139120d7ee2eaad89ee86638 deployed through workflow 34729541006; Next/OpenNext and actual Cloudflare deploy passed. Live directory/selection/back acceptance subsequently passed as recorded below.



Live readback: catalog20rows/3006bytes, sequential reads2525/1489/1624ms; chosen Kyushu1514ms,17entries/80photos. Browser directory contained zero images/textareas, choosing Kyushu displayed body plus19places/7routelegs. Temporary unsaved title survived directory return/reopen (observed392ms); original title restored without cloud save. Independent fresh tab showed original title and all saved, no recovered test draft. Apps ScriptVersion7 uses sameendpoint; exactcatalog source initialization verified against20currenttrips, zero originaltrip edits. User's main Chrome page was subsequently on Bangkok, so root stopped interacting with it and used a separate cleanup tab, then closed only that tab. No user originals or passwords/payments changed. This handoff-only commit does not change deployed application code; skip redundant deployment.

## 2026-09-13 Final core-flow acceptance (supersedes earlier pending stages)

Deployed application code: 21e041bd9a6bb1519186247571682ef62bfbc2e3; workflow 34727360769 successfully built Next/OpenNext and deployed Cloudflare. Full suite: 390 passed, 1 skipped, 0 failed; TypeScript passed. Actual Chrome Capture HEIC → focused Bench → Write → private trip → editor → preview succeeded. Photo loaded at naturalWidth 1600; entryDate and rendered label both preserve 2019-10-20. Native return to family works. All eleven public reader routes returned 200. Actual narrow reader layout/album controls passed; physical iPhone, weak network and full musical audition remain unverified.

Test cleanup completed in durable Drive: all 11 synthetic moments and the one private acceptance trip removed, 212 test files recoverably trashed, zero permanent deletes; 130 retained moment rows preserved. The Worker still held one deleted test moment in its in-memory overlay. This documentation-only release refreshes the Worker; verify /api/moments after deployment excludes moment_1789256270193_cx4hjy. Do not write a cached test row back.

Fresh live-cloud Obsidian import after test-trip removal: 20 trips, 5 new revisions, 15 unchanged, zero conflicts. Existing private vault projects/travel-os/generated; immutable one-way on-demand mirror, not a notebook dependency for capture/editing. No synthetic trip imported. User-authored notes preserved.

Core flow is ready for family trial after final cache readback. This does not assert exhaustive editorial/music/physical-device acceptance. Old local and Vercel spare versions retained because unique originals/unsynchronized changes make blanket deletion unsafe. Owner authorized DB changes, commit, push and deployment; passwords and payments excluded. No background monitors or local servers remain.


## 2026-09-13 Deployed acceptance and final integration

Owner explicitly authorized database changes, commit, push and deploy. cffa70f deployed successfully through workflow 34723893156. Actual Worker acceptance: three sequential batches of 40 x 311406-byte JPEGs plus synthetic audio completed in 143017 / 152642 / 170886 ms; audio 8897 / 20168 / 14742 ms. Independent Drive shard reads confirmed 40 photos and audio in each. HEIC 1764955 bytes: 10936 ms; video 8946351 bytes: 8697 ms, both read back. This is bounded fixture performance, not a real phone/weak-network claim.

Live private save/readback/stale-update conflict and browser preview-return-save passed. Browser found Write relied on the full catalog and could misreport an unavailable catalog as empty: final integration fetches an explicit batch directly and reports catalog failures truthfully. Family back links use native navigation after an observed stalled client transition. Film version selection and exclusive video/music playback are integrated. Final source gate: 380 passed, 1 skipped, 0 failed; production build passed. Follow deployment with exact-batch Write-to-private-trip verification.

Editorial 16-field patch applied and verified across four existing public trips with private backups. Apps Script version 6 adds locked, allowlisted test cleanup; version 5 remains rollback. Synthetic cleanup and fresh Obsidian import remain integration steps. Old local originals remain preserved; music mood and actual handset acceptance must not be claimed from structural checks.


## 2026-09-13 Family editing and capture acceptance candidate

Canonical target remains the existing Cloudflare Worker. This candidate separates direct password-free family editing from published read-only snapshots; draft saves no longer update the public story. The family-only manifest is served explicitly at `/family/manifest.webmanifest`.

Reader media is progressively expanded, mobile film controls remain usable, and working previews return to the same unsaved draft. Single-trip refresh and session snapshots avoid repeated whole-library navigation loads. Plan entries are excluded from published reader projections. Original photo capture metadata is separate from upload metadata; unknown capture times remain unknown. Write transfers actual photo references into the selected trip and flags strong location mismatches without guessing countries.

Capture now waits for durable photo/original metadata before reporting success. Original uploads share a bounded queue; audio requests have deadlines. Per-photo/original writes no longer rewrite the full Drive catalog: the batch is finalized through the moment update, while partial batches recover through the saved moment ID. Drive catalog patches and indexing jobs coalesce. The existing Apps Script remote shared lock remains; real Worker throughput is a required post-deploy acceptance, not established by local tests.

Validation before this candidate: 360 passed, 1 skipped, 0 failed; TypeScript and production build passed; lint 0 errors (existing warnings retained). Local real-Drive small-photo baseline 3–4 seconds, small audio 23–35 seconds. A 40-photo local run exposed catalog contention; a later run encountered a Google connection timeout. Neither is a passing performance acceptance. Complete three repeated mixed-media batches on the Worker and independent Drive readback before marking wife-ready.

Obsidian mirror is immutable, private, one-way and on demand. Existing vault snapshot import succeeded; fresh live import follows final data verification. Editorial audit candidates have not yet been applied. Legacy local/spare versions contain unique originals and dirty work, so no whole-root deletion is safe. All synthetic acceptance records are isolated and must be cleaned by their exact recorded IDs, never by deleting family originals.

Rollback reference before this release: a7e732ad75582a93de6eec63acf28f77169f7717. Status: implemented and locally tested, awaiting deployment and real-environment acceptance.

## 2026-09-10 R2 10042 must not block Worker deploy

Live `r2_buckets` + `ensure-r2-media-bucket.mjs` exit 1 on API **10042**
blocked Cloudflare Workers after PR #112, so 遊記編輯 picker labels never
shipped. Binding is commented again. 10042 is a warning; Worker deploy
continues. Trip shelves stay on Drive. After Owner enables R2 and creates
`travelos-media`, uncomment `r2_buckets` and re-run the workflow.

## 2026-09-10 R2 travelos-media binding

Worker helper: `lib/r2-media.ts`. Probe: `PUT /api/media?probe=1` then
`GET /api/media?key=probe/ok.txt`. Public r2.dev is optional.

## 2026-09-10 Home 500: null startDate after Drive parse spread

## 2026-09-10 Home 500: null startDate after Drive parse spread

Live `GET /api/trips/content` was 200, but `GET /` stayed 500.
Crew shelves (`trip_finland_lakes`, `trip_tokyo_crew`, …) store
`startDate: null`. Home sorts every trip with
`second.startDate.localeCompare(...)` before filtering public ones.

`parseDriveTripRecord` already coerced dates to `""`, then `...trip`
wrote the nulls back. Coerced fields now win. Storefront/admin sorts
use `compareTripsByStartDateDesc`. Kyushu locked journals unchanged.

Live origin: https://travelos2.chao-jason.workers.dev
`Vercel – travelos2` is the cold spare; CF Workers is the live door.

## 2026-09-10 Restore family trip shelves on live CF

Root cause of live `GET/PUT /api/trips/content` empty HTTP 500 (and `/` 500):
after a batch of trip PUTs, several `travelos__trip__*.json` files were stored
through Apps Script `op=item`, which wraps JSON as `{ moment, updatedAt }`.
`readDriveTrips` treated that as a `TripDetail`, so `title` was missing and
`stripSeriesFromTitle(undefined)` threw. Home SSR calls the same `readContent`.
Not a mega `content.json` / Vercel Blob crash — CF has no Blob token.

Fixes on this ship:

- Unwrap `{ moment }` / `{ trip }` wrappers; skip files without `trip_*` ids.
- Honor PUT titles (繁體). Stop forcing maple locked titles.
- Apps Script `GET op=trips` + `POST op=trip` (raw JSON). Paste the in-repo
  script into the existing `/exec` web app. Until then Drive API fallback
  plus isolate token cache still works.
- PUT writes one trip file and returns merged content (no second full warehouse read).
- Optional R2 `travelos-media` is documented only; do not uncomment the
  wrangler binding until the bucket exists (it would block CF deploy).

Kyushu locked journals in Drive are unchanged:
`大分 奧日田 梅響 溫泉酒店` and `小國町附近：竹庵的驚人份量`.

Same door: `/family` → 編輯 → 旅行遊記 → `/trips/admin`.
Live origin: https://travelos2.chao-jason.workers.dev

## 2026-09-09 Maple titles are place-only 繁體; series is separate

Live CF was still slow after concurrency=3: full GET `/api/moments` ~70s
(122 moments / ~1353 photos), and a 38-photo round took ~27 min because
each photo's afterResponse `addPhotoToMoment` did `getIndex` +
`hydrateDriveMoments` (`op=list` over the whole folder) + `putIndex` of
`moments.json`. Apps Script LockService then serialized those writes, so
binary POSTs queued behind catalog RMW.

Now:

- Photo flush reads/writes **one item shard** (`GET/POST op=item`). It
  does not GET `moments.json` and does not `op=list` / hydrate.
- Drive index sync is a **patch PUT** (one moment, no prior GET). Apps
  Script merge-on-write keeps the rest of the catalog.
- Full GET `/api/moments` no longer hydrates from a Drive file list.
  Use `/api/moments/rebuild` or `?hydrate=1` when you need a file scan.
- GET `/api/moments?id=` is shard-first.

Paste `scripts/drive-warehouse-apps-script.js` into the existing web app
(same `/exec` URL) so `GET op=item&name=` is live. Until then the Worker
falls back to Drive API by filename. No Capture-entry dedupe. Caps stay
40/round and POST concurrency 3. Sole live door:
`https://travelos2.chao-jason.workers.dev`.

## 2026-09-09 Capture caps concurrent POSTs; photo hang is not 28s

`/family/capture` still lets Owner pick up to 40 in one round (no album
re-pick). Display POSTs go through `createWorkQueue(3)`. Queued wait is
`上傳中`, not `還沒進倉` (failed only). Photo hang uses
`capturePhotoHangMs(roundSize)` (150s, or 210s when the round is larger
than 3). Videos keep the size-based `captureUploadWatchdogMs`. No Capture
dedupe. Dock count stays visible for n>0.

## 2026-09-09 Capture dock count stays on while the round is open

`fam-dock-count` is always in the Capture DOM. Hide only with
`[data-capture-dock-n="0"]` — never `open ? dock : null` (that minifies
to a bang-IIFE that looks inverted). Count text stays
`已選 N · 上傳中 · 已收到`. Sticky on `/family/capture` while thumbnails
are on screen. Apple album `N 個項目` is not ours.

## 2026-09-09 Maple titles are place-only 繁體; series is separate

Owner lock. Journal TITLE is the place/trip only. Never prepend
`爱慕虚荣团` / `愛慕虛榮團`. That brand lives in `series` (繁體
`愛慕虛榮團`) for a later 專題. `prepareMapleJournal` and `writeDriveTrip` convert titles to 繁體 and drop a
`爱慕虚荣团 ·` prefix / Day N / 候選. They do **not** overwrite the PUT title.
Owner shelves: `嵐山翠嵐` and `愛慕虛榮團：四個人怎麼一起把京都玩開心` round-trip.

Day17 / Day18 stay on startDate/endDate only. Never in the reader title.
`候選` is GM-only (Kiyomizu west-gate guess). Never in the reader title.

All family/reader-facing Chinese on trips is Taiwan 繁體 (OpenCC s2tw
characters). Keep 朱色 / 朱紅; keep 亞得里亞. Do not run phrase-layer
s2twp (that turns 朱色→硃色, 性價比→價效比, 局部→區域性).
`prepareReaderChinese` runs on every editor trip; maple titles follow the PUT
body after 繁體 conversion. Drive writes trash older same-name JSON duplicates.

Drive reads reattach leftover seed journals Owner still edits
(北海道 / 曼谷 / 巴黎冬日 / 倫敦 / Lapland). PUT writes that one trip file and
returns merged editor content (no second full warehouse read).

Kyushu `trip_kyushu_family_2026` dates lock to 2026-08-30 → 2026-09-06.
Stay spine: Solaria TF53AEFAC2A33, 界 KYIBNF266359, 梅響
202608240003264.01, Flügel 1252, Solaria T032CA29B451B, KMJ return.
Owner 梅響 journal body is never rewritten.

Same door: `/family` → 編輯 → 旅行遊記 → `/trips/admin`.

## 2026-09-09 Phone 遊記編輯 was the Vercel seed list

Owner reinstalled the iPhone app and the picker showed only:

1. 北海道秋日札記
2. 曼谷餐桌筆記
3. 巴黎冬日博物館散步
4. 倫敦轉乘週末
5. 北極圈上的十二月

That list is `seedTripDetails` (Vercel spare `source: seed`). Live CF
`GET /api/trips/content` is `source: drive` and already has the maple
journals. There is no service worker. Family PWA `start_url` /
`id` / `scope` are absolute
`https://travelos2.chao-jason.workers.dev/family`. Spare `*.vercel.app`
308s to that origin. Drive reads keep the public Lapland seed if it is
not a warehouse file, and drop leftover private demo seeds
(北海道 / 曼谷 / 巴黎冬日 / 倫敦).

Same door: `/family` → 編輯 → 旅行遊記 → `/trips/admin`. After this
ships, that dropdown on CF Drive is:

1. 九州家庭慢遊：福岡、小國町與阿蘇
2. 巴黎盛夏：從傘街走進羅浮宮
3. 爱慕虚荣团 · 东山朱色／清水候选（Day18）
4. 爱慕虚荣团 · 银阁寺线（Day17）
5. 爱慕虚荣团 · 岚山翠嵐：温泉饭店里的枫叶禁区
6. 爱慕虚荣团 · 团主题：四个人怎么一起把京都玩开心
7. 鹽水蜂炮：走進火光與煙霧
8. 北極圈上的十二月 / December on the Arctic Circle
9. 蘇格蘭冬日：愛丁堡與威士忌酒鄉
10. 從巴黎走向萊茵河
11. 亞得里亞海兩日：克羅埃西亞到威尼斯

Held out: 东福寺 candidate, mega `trip_kyoto_maple`. Public `/trips`
stays Lapland only.

## 2026-09-09 Capture dock: shown photo = received

Owner UX lock. A clear thumbnail means the dump landed. Do not teach
preview vs warehouse. `/family/capture` on iPhone Safari:

- Uploading: spinner tile, not a clear still.
- Received: clear photo. Sticky count `已收到 n / total`.
- Failed: quiet refresh icon on a muted tile (same circular refresh in the
  sticky dock). Tap retries the held File. Never re-open Apple album for
  the same round. Never a nice image plus 上傳失敗. Visible UI is icon-only;
  aria-label is 再送.
- Choosing photos is the 收货点. Uploads auto-finalize the Moment.
  Leave mid-upload keeps/resumes the round. 「寫下一句」 is optional.
- Live after merge: https://travelos2.chao-jason.workers.dev/family/capture
  then 工作台 https://travelos2.chao-jason.workers.dev/family/bench

## 2026-09-09 「TravelOS 手機可編輯版」

Owner named this ship. Live primary is Cloudflare
`https://travelos2.chao-jason.workers.dev`. Do not wait on Vercel.
The six `travelos__trip__*.json` drafts are already in the live Drive
store (`GET /api/trips/content` → `source: drive`). Public `/trips`
only lists Lapland because those drafts are `visibility: private` —
do not publish them. Coffee drafts are not in the warehouse.

### Phone URLs (after merge to `main` / CF auto-deploy)

Open in iPhone Safari / Home Screen from
`https://travelos2.chao-jason.workers.dev` only. Vercel spare
(`travelos2-63r3.vercel.app`) is seed-only and is redirected to CF.
PWA `start_url` is absolute workers.dev `/family`.

Phone 遊記編輯 door: `/family` → 編輯 → 旅行遊記 → `/trips/admin` picker.

- Family door: https://travelos2.chao-jason.workers.dev/family
- Editor (all drafts): https://travelos2.chao-jason.workers.dev/trips/admin
- 九州: https://travelos2.chao-jason.workers.dev/trips/admin?trip=trip_kyushu_family_2026
- 蘇格蘭: https://travelos2.chao-jason.workers.dev/trips/admin?trip=trip_scotland_edinburgh_2019
- 鹽水蜂炮: https://travelos2.chao-jason.workers.dev/trips/admin?trip=trip_tainan-yanshui-fireworks_2020
- 巴黎→萊茵: https://travelos2.chao-jason.workers.dev/trips/admin?trip=trip_paris-rhine_2013
- 羅浮宮: https://travelos2.chao-jason.workers.dev/trips/admin?trip=trip_paris-louvre_2023
- 克羅埃西亞→威尼斯: https://travelos2.chao-jason.workers.dev/trips/admin?trip=trip_croatia-venice_2011
- 爱慕虚荣团 · 岚山翠嵐: https://travelos2.chao-jason.workers.dev/trips/admin?trip=trip_kyoto_maple_arashiyama
- 爱慕虚荣团 · 银阁寺线: https://travelos2.chao-jason.workers.dev/trips/admin?trip=trip_kyoto_maple_ginkaku
- 爱慕虚荣团 · 东山朱色: https://travelos2.chao-jason.workers.dev/trips/admin?trip=trip_kyoto_maple_higashiyama
- 爱慕虚荣团 · 团主题: https://travelos2.chao-jason.workers.dev/trips/admin?trip=trip_kyoto_maple_crew_notes
- Write / 轉成遊記: https://travelos2.chao-jason.workers.dev/trips/write

`/family` 編輯 → 旅行遊記 opens the same `/trips/admin` picker the six
journeys already use. 爱慕虚荣团 is a **series**, not one mega trip:
Kyoto maple stays as place journals (岚山翠嵐 / 银阁 / 东山 / 团主题).
The unconfirmed 东福寺 candidate is held out of the editor. Search
`爱慕虚荣团` can collect the line later; with no search each journal
is a normal independent trip. Public `/trips` still only lists Lapland.

Phone edits autosave to `localStorage` (`travelos-trip-draft:` /
`travelos-write-draft:`), flushed on debounce, interval, blur,
`visibilitychange`, and `pagehide`. Coming back restores the draft
and shows 「有未保存草稿 · 已幫你找回」. Explicit 儲存 still writes
the live Drive store. 放棄草稿 drops the local stash.

Until this PR is on `main`, live CF already has the six JSONs (PIN
currently off), but the family list, admin session restore, and
轉成遊記 labels are this branch (PR 91).

### Second: public Lapland mobile film-cut

Same promote URL, does not replace the editable ship:

https://travelos2.chao-jason.workers.dev/trips/finland-lapland-winter-journal

Phone UA or viewport &lt; 640px: dedicated film-cut. Compact title overlay
on the video (no tall soft-panel above it). Still, visual beats, and Photo
memories follow immediately. Overview Trip memory and Journal sit behind
更多. iPad and desktop keep the frozen notebook layout. Do not squash the notebook page.

## 2026-09-03 Capture 15s video is chunked, not one Worker body

- Owner dumped a mixed album: one JPEG landed, one 15s-class video card
  showed empty green + `上傳失敗。`. Warehouse folder had 245 files and
  zero videos. PR 76 was not enough: Workers Free cannot
  `formData()` + `arrayBuffer()` + `Buffer.from` a 20–80MB HEVC clip.
- Videos now init a Drive resumable session, then PUT 256KiB raw chunks
  with `Content-Range` through `/api/moments/photos/video`. The phone
  never posts one multipart `.mov` to `/api/moments/photos`. Photos keep
  the 40 parallel JPEG FormData POSTs.
- Capture cards call `URL.createObjectURL(file)` immediately for videos
  so HEVC is not an empty green square. Fallback copy stays `上傳失敗。`.
- Opaque session is HMAC of the Drive Location URL with the warehouse
  token. `ScriptApp.getOAuthToken()` stays on Apps Script; it is not
  sent to the browser. Do not ask Owner to re-paste Apps Script or
  re-dump.

## 2026-09-03 Capture 15s iPhone video

- Owner: 15s `IMG_1504.MOV` on Capture is a normal dump. The old 28MB
  client gate (`換一段短一點的`) is gone. Ceiling is the Worker/Drive
  ~100MB body, documented in code, not as a length lecture.
- Videos go Worker → Drive resumable (`putVideoBinary`). Photos keep
  the JPEG Apps Script JSON+base64 line. Same album picker, same 40
  parallel POSTs, play in place on 工作台.
- Family card fallback is `上傳失敗。` (Chinese), not
  "Photo upload failed."
- Paste `scripts/drive-warehouse-apps-script.js` into the existing
  warehouse Apps Script and deploy a new web-app version (same `/exec`
  URL) so `op=drive-access` can mint `ScriptApp.getOAuthToken()` for
  resumable PUTs. Without that paste, tiny clips still ride JSON+base64;
  a 15s iPhone .mov needs the mint. Do not ask Owner to re-dump as porter.

## 2026-08-31 說說 pill on family 入口

- `/family` 入口 keeps the framed 行程 pill and adds 說說 next to it,
  same `fam-press fam-pill` language, linking to `/family/talk`.
- Talk itself is already live on travelos2 after PR #70.

## 2026-08-29 Family Kyushu talk translator

- New private door `/family/talk` on travelos2. iPhone Safari. Two huge
  modes: 我說中文 and 對方說日文. Pale green-apple paper, cute 本子,
  framed back button with press-in. PWA under `/family/talk`.
- Recognition: Web Speech with explicit lang, then MediaRecorder +
  Workers AI Whisper. Translation: spoken LLM then m2m100. No OpenAI
  key. Capture dump, `/family/trip`, Lapland, Vercel untouched.

## 2026-08-29 Family 行程 door, framed back, 總表 then 表1

- `/family` 入口 now has a framed 行程 pill (福岡・大分) next to Capture /
  Write. The old header chip did not look tappable. 旅行遊記 still goes
  to public `/trips`.
- Inner family pages (Capture, 工作台, trip) use a framed back pill with
  press flash, linking to `/family`. Home back is 首頁.
- `/family/trip` is **總表** (week rows) then **表1** — eight real day
  writeups (`trip-day-1` … `trip-day-8`). Sticky 1–8 + 總表 rows
  `jumpToDay` scroll the matching detail under the sticky strip. Day 3
  is 梅響 / 小鹿田 / 和くら with 地址+電話. No 8-day map until GM
  sends a PASSED file + sha256. Do not copy the failed plate or draw a
  substitute. Dinners are 建議自訂 except
  西川 已訂 and 佐藤酒造 已發申請. 8/30 sleep only. 9/5 night empty.
  Public Lapland untouched. Dump unchanged.

## 2026-08-29 Family booklet wash is pale green-apple

- Owner: 粉紅色太少女了. Family Capture (and the shared
  `data-surface=family` 本子 wash) is a washed granny-smith / young
  apple paper (`#F0F6E4`), not peach, neon, hospital mint, or dark
  green. Hot-pink pills softened to young leaf so they sit on the
  apple wash. Public Lapland / 店面 untouched.
- Empty middle card stays preview, not a shutter: 預覽 / Preview /
  剛拍的會出現在這裡。 No camera glyph. 拍照 pill is the only
  take-photo control. Dump and voice chips unchanged.

## 2026-08-29 Empty Capture card is preview, not a shutter

- The middle empty card is where she looks at what just landed. A camera
  drawing there made Sana tap it, get nothing, and quit. Glyph is gone.
  Copy is 預覽 / Preview / 剛拍的會出現在這裡。 Not wired to 拍照.
  The 拍照 pill stays the only take-photo control. Dump unchanged.

## 2026-08-29 Capture voice: edit the line, pick 粵/国/EN

- ASR proper nouns stay wrong unless she can tap the recognized line.
  Capture and 工作台 now use the same editable spoken line. Corrected
  text is stored through the existing moment PUT (`updateMoment` /
  `updateMomentTranscript`). No extra save wizard. No tags. No classify.
- Browser Web Speech cannot auto-detect like iPhone dictation. Chips
  `粵 / 国 / EN` sit next to the mic. Last chip is in localStorage.
  Default `国` (`zh-TW`). `粵` sends `zh-HK` if the engine keeps it,
  else `yue-Hant-HK`. `EN` is `en-US`. Do not set `lang=""`.
- Photo dump is unchanged (one pick, 40, parallel POSTs). Public Lapland
  is untouched. Family workshop only (`data-surface=family` 本子).

## 2026-08-28 Family 本子 visual and trip companion

- Family workshop routes (`/family`, `/family/capture`, `/family/bench`) sit
  inside `data-surface="family"` with 家庭本子 tokens. Public Lapland / `/trips`
  keep magazine Georgia and teal theme-color `#0f766e`. Family theme-color is
  `#F0F6E4` (pale green-apple).
- `/family/trip` is a private companion matching the passed day-1 / week
  mocks: sticky days 1–8 from 2026-08-30 Taipei, one long scroll.
  Confirmed STARLUX JX316/JX317, Nissan 26082202410 / Serena photo + KMJ
  map bytes, 星野 界・由布院, 奧日田溫泉 梅響 / うめひびき (group stay),
  Flügel 久住, Solaria arrival TF53AEFAC2A33, and Solaria return
  T032CA29B451B. Meals are 早餐 / 晚餐 ticks, not 有/沒. 9/5 is 還沒訂.
  No station shuttles. Capture dump is unchanged.

## 2026-08-28 Family 工作台 Drive photo thumbs 404

- GET `/api/moments` hydrates `photos[]` from Drive files (`moment_photo_drive_*`
  ids). Photo GET used `getMomentById` on the raw index / first duplicate,
  whose `photos[]` still had Capture upload ids, so bench `img` src 404'd
  `Photo not found` while filenames listed fine.
- Fix: photo GET hydrates the same Drive file list, matches rebuilt Drive
  ids (and storageKey), and `/family/bench` loads `variant=thumb`. Thumbs
  prefer Apps Script `op=thumb` (Drive `getThumbnail`) or the JPEG's EXIF
  thumbnail so a card with 18 photos does not fetch 18 full 2–4MB files.
  Missing bytes are 503, not the same 404.
- Same warehouse folder. Drive stays off `/family` public. PIN stays off.
  Owner does not re-dump. Optional: paste `scripts/drive-warehouse-apps-script.js`
  again for `op=thumb`; Worker still returns a JPEG without that paste.

## 2026-08-28 Capture Drive photos under-counted in /api/moments

- Root cause: parallel Capture photo POSTs each rewrote `moments.json`
  / item JSON as a full `photos[]` snapshot. Cloudflare isolates do not
  share the in-process lock, so last-write-wins dropped siblings. Drive
  binaries (`travelos__moments__photos__*`) were already there.
- Fix: union photos when merging moment records. Rebuild the index from
  Drive photo files (display JPEGs; `original-*` stays original). GET
  `/api/moments` hydrates from `op=list` when the receiver supports it.
  One-shot: `POST /api/moments/rebuild` or `pnpm run rebuild:moments-drive`.
- Paste `scripts/drive-warehouse-apps-script.js` into the existing
  TravelOS Capture warehouse Apps Script and deploy a new web-app
  version (same `/exec` URL). That adds `op=list`, LockService, and
  merge-on-write. Do not put Drive on `/family` public. PIN stays off.
  Do not unsuspend Blob. Owner does not re-dump.

## 2026-08-28 Public origin is Cloudflare workers.dev; Vercel is cold spare

- Storefront canonicals (`metadataBase`, sitemap, robots, JSON-LD, share
  links) use `https://travelos2.chao-jason.workers.dev` from `lib/site-url.ts`
  (`SITE_URL` / `NEXT_PUBLIC_SITE_URL`, default CF; `*.vercel.app` ignored).
- Vercel `https://travelos2-63r3.vercel.app` remains deployed as cold spare.
  Do not delete the Vercel GitHub integration or `pnpm run build`.
- No custom domain / DNS change is required for this cut. `workers_dev` is
  the public hostname. Travelpayouts Drive on Cloudflare uses
  `https://emrldtp.cc/NTY3NzUw.js?t=567750` (source 567750). Vercel spare
  keeps source 550313. Drive warehouse stays Apps Script.

## 2026-08-27 Family home: 入口 → 工作台 → 編輯

- `/family` is three zones. 入口 holds Capture (`/family/capture`) and
  Write (`/trips/write`) together. 工作台 is one door to the raw pile
  `/family/bench`. 編輯 is 旅行遊記 and 咖啡記憶.
- 工作台 is not next to Capture. Capture success may still say
  去工作台看看; that is on Capture, not a second home door.

## 2026-08-27 Family workshop bench / 工作台

- Sana could Capture and Save as Moment, then open Coffee and see
  nothing. Coffee is shops/map. There was no family-facing raw pile.
- `/family/bench` is 工作台 / Bench: 剛收下的，還沒整理。旅行和咖啡都還沒進。
  Same `FAMILY_ADMIN_SESSION_KEY` as Capture. Loads GET `/api/moments`,
  newest first, actual stills, optional one-liner, month/day, original
  audio. Empty: 還沒有收下的。去 Capture 拍一張.
- Live warehouse already has dumps (including a two-photo moment from
  2026-08-27) but the index repeats ids; bench dedupes by id and prefers
  the copy with more photos. Not a second warehouse.
- Capture success keeps the existing copy and adds 去工作台看看.
- Do not call this 橱窗. Do not call it JDB Capture. Do not file into
  Coffee or Trips in this ticket.

## 2026-08-25 Lapland poster: left notes, blurbs, colorful Finland

- Owner rejected the beige Finland infographic (legend on the right, names
  only, pale Positron-like base). Benchmark is a printed itinerary: LEFT
  notes with a short line under each number, RIGHT a real regional map.
- Rebuild `scripts/generate-lapland-poster.mjs` as that architecture.
  Notes column uses `LAPLAND_POSTER_NOTES` (Santa Claus Village, Arctic
  Circle, red cabin, Helsinki Cathedral, South Harbour) with seasonal
  December / midwinter / Christmas-window language only. No 2019-12-11,
  no day-by-day dates. Map is OpenTopoMap (green terrain, blue water,
  roads) at Finland north–south scale (zoom 8). Pins stay on the map;
  HTML overlay percentages follow the same layout. Output:
  `public/travelos/maps/lapland-rovaniemi.png`.
- Do not touch Capture, family PIN, dump, PR #2, or Drive on family.
  Merge when travelos2-63r3 CI is green.

## 2026-08-25 Capture 404 after create: unique moment item files

- Live GM self-test after PR #10 (`get({ useCache: false })`) and PR #11
  (PIN off): `POST /api/moments` returned 200 with a moment id, but the
  immediate `POST /api/moments/photos` and `/audio` 404'd `Moment not
  found`. `GET /api/moments` also omitted the new id. About 30s later GET
  listed the moment (`photos: []`); photo/audio then 200'd.
- Root cause: `travelos/moments.json` is one public pathname overwritten on
  every write. Vercel Blob public overwrite is eventually consistent even
  with `get({ access: "public", useCache: false })`. Photo/audio hit another
  instance and read the pre-overwrite JSON.
- Fix: keep `travelos/moments.json` as the listing index, but stop using
  that overwrite as the existence check for Capture appends. On create, also
  `put` a unique item file `travelos/moments/items/{momentId}.json` with
  `addRandomSuffix: false`. Unique puts are readable immediately.
  `momentExists` / `addPhotoToMoment` / `setMomentAudio` / `setPhotoOriginal`
  read/write the item file first (source of truth for that moment's photos
  and audio), then update the index best-effort. Photo/audio binaries stay
  on unique paths. If the index is stale, appends still succeed because the
  item file exists. Same-instance last-write cache is a plus, not enough
  for multi-instance.
- Do not rely on waiting 60s or on `useCache: false` for overwrite of the
  same public key. Client retry-on-404 can remain as belt-and-suspenders
  but is not the real fix. Instant preview / background upload stay. PIN
  stays off unless `TRAVELOS_REQUIRE_FAMILY_PIN=1`.
- Do not merge. Do not touch PR #2, PR #8, Lapland poster, Drive, or the
  PIN flag.

## 2026-08-25 Development family PIN is off

- Development PIN is off. Capture, Write, and family APIs are open unless
  `TRAVELOS_REQUIRE_FAMILY_PIN=1`.
- Production puts `TRAVELOS_REQUIRE_FAMILY_PIN=1`. Keep `TRAVELOS_ADMIN_PIN`
  set; the flag just ignores it while off. No app rewrite to turn PIN back on.

## 2026-08-25 iPhone Capture 上傳失敗 (stale Blob CDN read)

- Confirmed from the live warehouse: the iPhone dump DID create a moment in
  `travelos/moments.json` (createdAt ~08:49 Taipei, GPS present, time from the
  photo lastModified). `photos: []` and `originalAudioUrl: null`. So
  `POST /api/moments` succeeded. Immediate `POST /api/moments/photos` and
  `/audio` then 404'd.
- Root cause: `readMoments()` used `list()` + `fetch(publicUrl?v=)`. The
  public Blob URL is CDN-cached (`cache-control max-age=2592000`). Overwrite
  of a public pathname can take up to ~60s to show through that CDN. `?v=`
  does not bust it. `addPhotoToMoment` / `momentExists` therefore did not see
  the moment just written.
- Primary fix: warehouse reads now use `@vercel/blob` `get(path, { access:
  "public", useCache: false })` so appends see the origin write immediately.
  Missing blob still creates an empty warehouse. If the blob exists but the
  consistent read fails, throw 503 — never return empty (that can wipe
  moments on the next write). `writeWarehouse` sets `cacheControlMaxAge: 60`.
  Photo/audio binaries stay public.
- Secondary hardenings: rejected `ensureMoment` is cleared so create can
  retry; 上傳失敗 shows the real error; HEIC convert failure still uploads
  the original File; photo/audio routes accept `Blob` with `size > 0`;
  photo/audio POST retries once on 404 after a consistent re-read.
- PIN still required. Instant object-URL preview stays. Originals stay
  fire-and-forget. No Drive/ads. 44px targets. Public Lapland untouched.
- Do not merge. Do not touch PR #2, PR #8, or the Lapland poster.

## 2026-08-24 Capture upload speed (display-first, background)

- Live owner test: photo/recording Save on `/family/capture` took 10+ seconds
  because Save sequentially converted HEIC, uploaded display AND original, then
  rewrote `travelos/moments.json` once per photo.
- Preview stays instant (object URL). Background upload starts as soon as a
  photo is added or recording stops. The Moment is created on the first asset,
  then photos/audio append. Retake/remove aborts or skips that upload.
- Critical path is a phone-sized display JPEG only (max edge 1600px, quality
  0.72). Original HEIC/file is fire-and-forget after display lands. Save waits
  only for in-flight display/audio, never for originals. If uploads already
  finished, Save is a small note/command PUT.
- Photo POSTs no longer rewrite the warehouse once per overlapping upload;
  appends are queued and applied in one JSON write. Indexing stays
  fire-and-forget. Family PIN session only. No TravelOS admin capture. No
  Drive/ads on this page.
- Do not merge. Do not touch PR #2, public booking PR #8, or the Lapland
  poster.

## 2026-08-24 Merge PR #3 to main for live Capture

- Owner instruction: merge GitHub PR #3 into `main` with a regular merge
  commit so family Capture works on the phone this week (Kyushu).
- This branch first merged current `main` (Lapland bilingual copy, quiet CC0
  music, regional itinerary poster). Warehouse Capture/Write/moments APIs
  stay. Live Lapland public work stays. PR #2 stays held. PR #8 untouched.
- Live door after deploy: `https://travelos2-63r3.vercel.app/family`, then
  Capture at `/family/capture` after PIN. `/trips/write` is sit-and-write.

## 2026-08-24 Persist found-set drafts in the warehouse

- Saving a day/place found set now writes a durable `TravelJob` into
  `travelos/moments.json`. `momentIds` are the visible warehouse moments.
  `command` is a short retrieval label (day/place) for the Jobs list and
  Found set banner. `draft` is the human-typed text.
- Reload reads that job by the same day/place label, so the writing
  survives refresh. The textarea is filled from `job.draft` only, never
  from the filter label, a travel log, or a meal log. No new Trip.
- Capture stays unblocked. Optional attach-to-existing-trip remains human
  text only. Family PIN session only. PR #2 stays held.

## 2026-08-24 Found-set writing on /trips/write

- A day and/or place filter is a temporary writing set. Photos on Write come
  from the visible warehouse moments together, the same way a Capture job
  already points at several moments. No new Trip.
- The writing area stays blank until a person types. Filter labels stay in the
  Found set banner, not in the textarea. No travel log, meal log, or diary
  prose is produced.
- Originals stay in the warehouse. Capture remains the front door and is not
  blocked by this retrieval path. Family PIN session only.
- PR #2 stays held.

## 2026-08-24 Find warehouse Moments by day and place

- TravelOS is the sit-and-write back door. Capture stays the phone front
  door. Originals stay reusable. Owner has not taught writing method, so
  this slice does not generate a travel log, meal log, or any diary prose.
- Warehouse Moments are findable on `/trips/write` by Asia/Taipei calendar
  day and by place. Day uses the moment time (photo `takenAt` / `createdAt`).
  Place uses stored labels when present, else a label derived from stored
  coordinates. `people` / `food` / `scenery` / `topics` may stay empty.
- Indexing is fire-and-forget after `POST /api/moments` and
  `POST /api/moments/photos`. Capture, photo upload, and the Capture UI do
  not wait on geocoding or the index pass. Job date windows now use
  Asia/Taipei calendar days.
- Canonical warehouse remains Vercel Blob `travelos/moments.json`. No Prisma,
  no vector DB, no Obsidian runtime. Existing trip APIs, Lapland, coffee, and
  family PIN stay unchanged.
- PR #2 (`cursor/family-moment-capture-f495`) stays held and untouched.

## 2026-08-24 JDB Capture and TravelMoment warehouse

- Owner path confirmed: Capture is the family phone front door; TravelOS
  warehouses originals as reusable assets; sit-and-write is human text only.
- Canonical warehouse: Vercel Blob path `travelos/moments.json`. Portable JSON.
  Obsidian is not a runtime dependency. No Prisma, no vector DB.
- PIN-gated APIs: `GET/POST/PUT /api/moments`, `POST /api/moments/photos`
  (append), `POST /api/moments/audio`. Existing `/api/trips/content` and
  `/api/trips/photos` are unchanged. Live Lapland, coffee, and family PIN stay.
- Capture (`/family/capture`) reuses the family session key
  `travelos-admin-pin`, has no PIN form, names the surface Capture, keeps
  camera + library after each add, shows an immediate preview, and supports
  retake/remove. Save creates a TravelMoment, never a new Trip.
- TravelOS `/trips/write` lists warehouse moments as assets, shows selected
  photos, and saves only the human-typed draft (optional PUT onto an existing
  trip journal). No generated story.
- Capture notes may be mood or a job. A job is stored in the same warehouse and
  points at the relevant moments. Opening `/trips/write?job=` shows those
  photos and keeps the command out of the writing area.
- PR #2 (`cursor/family-moment-capture-f495`) is still held. This slice
  reimplements HEIC/append/session ideas on `main` without merging that PR.

## 2026-08-24 Lapland itinerary raster poster

- Owner correction: do not use a live tiled map in the browser, and do not
  use Google Maps or any API key. The regional hero is one generated PNG
  poster, like a printed itinerary. If stops change, regenerate the image.
- Keep the HTML stop list, HK→HEL→RVN arrival strip, and photo/wording card.
  Overlay 44px hit targets on the poster pins so tap still selects a stop.
- Generator: `scripts/generate-lapland-poster.mjs` (`pnpm generate:lapland-poster`).
  It fetches Carto Voyager tiles
  (`https://basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png`),
  stitches one raster, and draws numbered pins, winter route, sled side-leg,
  legend, scale, north, and short labels. No grayscale/wash.
- Output: `public/travelos/maps/lapland-rovaniemi.png`. Attribution
  © OpenStreetMap contributors © CARTO. Photos, costs, and quiet CC0 music
  unchanged. Do not merge. Do not touch Capture, PR #2, or PR #3.

## 2026-08-24 Lapland itinerary streets basemap

- Owner: the regional itinerary still looked empty after PR #6 because the
  OSM tiles were grayscale, desaturated, and faded. Keep the itinerary
  chrome. Change the BASE MAP only. Do not merge. Do not production-deploy.
  Do not touch Capture, `/family/capture`, the moments warehouse, PR #2, or
  PR #3. Photos, costs, and the quiet CC0 music file are unchanged.
- No Google Maps key or SDK. Tiles are Carto Voyager (no-key labeled
  streets): `https://basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png`.
  Attribution: © OpenStreetMap contributors © CARTO.
- Tile `<img>` classes no longer use opacity, grayscale, saturate, or
  contrast filters. Overlay is at most ~8% warm so roads, parks, water,
  town names, and POI labels stay readable.
- Numbered circular pins, solid winter route, dotted sled side-leg, legend,
  scale bar, north, HK→HEL→RVN arrival strip, and tap list/pin → photo +
  bilingual wording stay. Frame remains Rovaniemi regional (~2 km scale).

## 2026-08-24 Lapland itinerary map (regional poster)

- Follow-up after the map/music slice. Owner liked the quiet CC0 winter bed;
  the two OSM tiles still read as widgets, not a designed itinerary. Do not
  merge. Do not production-deploy. Do not touch Capture, `/family/capture`,
  the moments warehouse, PR #2, or PR #3. Music file, photos, and costs are
  unchanged.
- `JourneyMap` is now a Kyushu-poster-style itinerary: a small
  Hong Kong → Helsinki → Rovaniemi arrival strip, a numbered stop list with
  journal dates, and ONE large Rovaniemi / Finnish Lapland regional map as
  the hero. The overview is not an equal-size second map.
- Regional frame: faded OSM terrain, numbered circular pins, solid winter
  route, dotted sled side-leg, legend, scale bar, and north. Stops are the
  existing named memories only: arrival 1/18, Santa Village 1/20, Arctic
  Circle, sled, campfire 1/22, cabin. No extra days or invented places.
- Phone: list, then regional map, then the selected photo/wording card.
  Desktop: list beside the map. 44px targets. No Writing guide chrome.
- Tests cover the large regional frame, unequal arrival locator, stop N
  wording, and no writer chrome. Keep `pnpm test`, typecheck, and lint green.

## 2026-08-24 Lapland map, music, and numbered stops

- Public Lapland follow-up after the copy slice. Do not merge. Do not
  production-deploy. Do not touch Capture, `/family/capture`, the moments
  warehouse, PR #2, or PR #3.
- Music: the default enabled Lapland bed is now one quiet winter atmospheric
  track, `public/travelos/music/first-light-particles.mp3` (Yoiyami, *First
  Light Particles*, CC0 1.0, OpenGameArt). Piano and ambient pads, no
  percussion, no Jingle Bells, no swing, no brass parade. Volume `0.18`.
  Novelty seed tracks stay in the record with `enabled: false`. The player
  subtitle shows `Yoiyami · First Light Particles · CC0` while the bed plays.
- Map: `JourneyMap` splits long-haul and local scales when a trip has both.
  Overview is Hong Kong → Helsinki → Rovaniemi at flight zoom. Detail is the
  Rovaniemi cluster (city, airport, Santa Claus Village, Arctic Circle, cabin,
  sled) at local zoom, using the existing OSM tile approach. Both frames fit a
  phone; the selected card sits below the maps.
- Numbered 44px pin/buttons select a stop in place and show related photo plus
  wording (journal title/body, or place note + caption). No navigation away.
  Cabin and sled pins use approximate local coordinates near Rovaniemi so they
  can sit on the detail map; original photo files, dates, and costs are
  unchanged.
- Blob schema is `CONTENT_SCHEMA_VERSION = 9`. On the next content read after
  deploy, Lapland music tracks repair from seed (quiet bed on, novelty off).
  New cabin/sled places and local route segments merge in by id.

## 2026-08-24 Lapland public-copy slice

- Public Lapland trip copy is rewritten in a professional bilingual style:
  Traditional Chinese first, then English. Short, concrete sentences. Places,
  dates, and photo contents are named. No invented diary, no abstract
  philosophy.
- Seed source is `lib/trips.ts` (`trip_lapland_2020`, slug
  `finland-lapland-winter-journal-2020`). Photos, dates, costs, coordinates,
  places, route, and music IDs are unchanged. Totals are unchanged.
- Public layout `app/trips/[slug]/page.tsx` no longer shows writer/editor
  chrome: Visitor scan / Before you read, the "shaped for readers first"
  line, "Support text stays short", "Draft ready", and the Writing guide.
  Hero, photos, journal, map, album, places, costs, music, and share remain.
- Blob schema is `CONTENT_SCHEMA_VERSION = 8`. On the next content read after
  deploy, `shouldMigrateSeedTripCopy` / `shouldMigrateSeedItemCopy` replace
  saved Lapland title, summary, journal bodies, captions, and place notes
  from seed. Only `trip_lapland_2020`. Other trips are not wiped.
- This is a public-copy slice only. Do not merge. Do not production-deploy.
  Do not touch Capture, `/family/capture`, the moments warehouse, PR #2, or
  PR #3.
## 2026-07-25 Family entry login and contrast correction

- Confirmed the reported problem on the live `/family` route: it was only a
  directory, while the PIN input was hidden one level deeper in each editor.
- Added one shared family PIN field to `/family` with direct Travel and Coffee
  editor actions. A successful check stores the existing session credential and
  opens the selected durable editor.
- Replaced the nearly black and dark-green family action boxes with light
  bordered controls and dark text to prevent the appearance of obscured labels.
- Regression test, full tests 9/9, TypeScript, ESLint, and production build all
  pass.
- Commit `421b23e` is deployed. Live phone-width inspection confirms the PIN
  field, direct editor buttons, and light high-contrast action controls render
  clearly.
- The canonical OneDrive project was synchronized and all five touched file
  hashes match the verified working copy.
- Exact next action: complete authenticated editor and photo-upload acceptance.

## 2026-07-25 Single top-level authentication rule

- Product rule is now explicit in `docs/UI.md`: `/family` owns authentication;
  Travel and Coffee are departments below it and cannot show their own PIN
  form.
- Both editor routes now read the shared family session. Without it they
  redirect to `/family` and show only a brief light-background transition.
- Regression coverage fails if a department reintroduces a password input,
  PIN form, or stops redirecting upward.
- Large content surfaces remain light with dark text; dark colors are limited
  to small accents.
- The top-level family password field now includes a 48px
  `顯示密碼 / 隱藏密碼` control; regression coverage protects the toggle.

## 2026-07-25 Responsive mobile and desktop app shell

- Production audit at 390x844 and 1440x900 found no horizontal overflow and a
  stable desktop three-column layout.
- Corrected undersized mobile touch targets on the home navigation, session
  actions, and Family Workspace back link; these controls now have a 44px
  minimum height.
- Removed the manifest's portrait-only restriction so the installed PWA can
  follow phone, tablet, and desktop orientation.
- Added `tests/responsive-app-shell.test.mjs`.
- The second mobile audit covered Trips, Coffee, Plan & Book, and both locked
  editors at 390x844. All avoid horizontal overflow. Their small navigation,
  actions, inputs, and shared editor control styles now use the 44px baseline.
- Verification passed: full tests 8/8, TypeScript, ESLint, and production
  build.
- Commit `0487078` is live for the first slice. Live verification passed for
  Home and Family at 390x844 and 1440x900, and the deployed manifest returns
  HTTP 200 with no orientation lock, `display=standalone`, `start_url=/family`,
  and the Family shortcut intact.
- Exact next action: publish the second slice, repeat the five-route mobile
  measurements, then unlock both editors for authenticated photo-upload layout
  verification and real iPhone acceptance.
- Second-slice commits `b946e09` and `19f368c` are now live. Production
  measurements at 390x844 show no horizontal overflow and no visible
  interactive control below 44x44 on Trips, Coffee, Plan & Book, Travel Admin,
  or Coffee Admin.
- Desktop production checks at 1280x720 pass on the same five routes with no
  horizontal overflow. Public screens use the intended 1152px content width;
  locked editor screens stay focused at 768px.
- Exact next action is now authenticated editor/photo-upload responsive
  verification, followed by real iPhone install/edit acceptance.

## 2026-07-24 Travelpayouts sustainable monetization layer

- Corrected a product-model error: Travelpayouts Drive is an AI affiliate-link
  layer, not a car-rental search widget.
- Moved the existing public Drive script (`source=550313`) from the empty
  `/drive` page to the root application layout, where it loads once and can
  process relevant public travel content across TravelOS.
- Rebuilt `/drive` as an honest Plan & Book surface for flights, stays,
  activities, and local transport. It now includes a bilingual affiliate
  disclosure and no longer renders a fake empty widget container.
- Account inspection confirmed project `Travelos2-63r3`, Partner ID `750335`,
  and 29 available programs. Current useful programs include Aviasales for
  flights and category-specific options such as Klook, Tiqets, KKday,
  Localrent, Kiwitaxi, Airalo, and others. Klook flights are excluded from
  rewards, so Klook must not be used as the flight monetization path.
- Latest email `Klook: Hotel Promo Code Coming Soon` is an August 1–2 campaign
  advance notice, not a credential or integration code.
- Verification passed in a clean dependency copy: focused tests 2/2,
  navigation regression, TypeScript, ESLint, and Next.js production build.
- Production deployment completed through GitHub/Vercel. Commit
  `c36b2b28ccaab2111ab8e60ab1bef2a1f5da8ac8` is active in
  `Production – travelos2-63r3`.
- Live `/drive` renders the corrected Plan & Book page and disclosure. Browser
  assertions found exactly one Drive loader and one public Drive script, with
  no fake widget container. The same one-script invariant passed on the public
  Lapland travelogue.
- Travelpayouts `Check setup` was opened, but the Windows browser-control
  channel timed out before the result could be read. This is a technical
  verification blocker, not an Owner approval or credential blocker.
- Exact next action: read the Drive setup result when browser control recovers,
  then generate and integrate one official Aviasales flight search form and one
  official accommodation/activity tool with stable SubIDs.

## 2026-07-24 Public/private trip visibility

- Trip editors now present two clear Chinese choices: `公開：任何人都能閱讀`
  and `私人：只保留在家庭編輯`.
- New trip drafts default to `public`. Legacy `shared` records remain publicly
  readable for backward compatibility.
- The public home, Trips library, trip metadata, and trip detail route all use
  the same `isTripPublic` rule. Private trips no longer leak through public
  cards, photo strips, metadata, or a guessed direct slug.
- The admin editor still loads every trip, so a family member can switch a trip
  between public and private without deleting it.
- `/api/trips/content` now requires the admin PIN even for reads. The admin
  client sends the PIN after unlock, closing the prior data-leak path where a
  private trip could be hidden from pages but still returned by the JSON API.
- Verification passed: trip-visibility tests 3/3, navigation regression,
  TypeScript, ESLint, and Next.js production build.
- Production deployment completed through the existing
  `c8vzn4ym5g-ai/travelos2` -> `Production – travelos2-63r3` path. Latest
  compatibility commit `55e22e0868ba24aa2752f977371e0d337ce81b01`
  (Send PIN when loading family trip editor) is recorded as deployed.
- Real-target checks passed: unauthenticated `/api/trips/content` returns 401
  with `Invalid admin PIN`; public Lapland returns 200; private Hokkaido returns
  404 even when its slug is known.
- Exact next action: run one authenticated family edit that switches a chosen
  trip public -> private -> public and confirm the visitor result after each
  save.

## 2026-07-24 Family Editing workspace slice

- Added `/family`, a bilingual mobile workspace for Jason and Sana with Browse/Edit actions
  for Trips and Coffee, a direct JDB Sana entry, and the exact Safari
  `加入主畫面` installation path.
- TravelOS home exposes `家庭編輯`; the web manifest exposes the same route as
  an app shortcut.
- Verification passed: navigation regression, TypeScript, ESLint, Next
  production build, generated `/family`, and rendered HTML checks for both editor
  routes plus JDB Sana.
- This is implemented and build-verified, not yet live-verified. Exact next
  action: sync to canonical TravelOS, publish to the existing production
  target, verify `/family`, then run one family iPhone install/edit acceptance.
- Shared future architecture is recorded in JDB
  `projects/sana-creative-hub`: one Family Workspace uses separate Jason/Sana
  Passkeys and a join-only Family Code; JDB Sana supplies protected identity/inbox,
  TravelOS supplies durable travel editing, and Book Studio supplies chapter
  reading/revision/version acceptance.

Updated: 2026-07-23

## Current outcome

The home page is the scalable product hub. It links to Trips, Coffee, and Drive. The Trips library now shows the owner's complete journey collection rather than hiding every `private` journey whenever a shared journey exists.

Verified owner paths:

- Home -> Trips -> Bangkok -> detail
- Home -> Trips -> Lapland -> detail
- Home -> Coffee -> Home
- Home -> Coffee -> Trips

## Verification evidence

- Navigation regression: passed.
- TypeScript with `--noEmit --incremental false`: passed.
- ESLint: passed with zero warnings after cleanup.
- Next.js production build: passed; Bangkok and Lapland detail routes were generated.
- Background production HTTP checks: all returned 200.
- Rendered HTML contained the Trips and Coffee home links, Bangkok and Lapland trip links, and readable Coffee navigation.

## Product rule

TravelOS is private-first. `visibility: private` controls external sharing; it does not remove an owner's content from the owner's library or home previews.

## Execution rule

Do normal development, tests, and builds in a Codex-writable working copy. After the full slice passes, synchronize once to the canonical OneDrive project. Do not ask the owner to approve internal source edits, task status changes, formatting fixes, or routine verification.

## Next product work

Continue the pending items in `docs/Tasks.md` by priority. Do not treat a zero count in another queue as proof that TravelOS is complete.
`nLatest local gate before authorization pause: 368 passed, 1 skipped, 0 failed; lint 0 errors/18 warnings; production build (including types) exit0. Added stable photo retry identities, HEIC thumbnail fallback, focused Bench single-moment read and bounded20-second AppsScript RPCs including body/redirect/queue release. Auto-review rejected git staging/commit because it requires explicit commit authorization; Owner question for commit/push/deploy is pending. HEAD remains a7e732a; nothing committed, pushed or deployed. Owned local servers stopped and temporary browser tabs closed; viewport reset. Real Worker acceptance, editorial field application, live vault refresh, music audition and exact synthetic-data cleanup remain pending. Private local mission record lists every known test ID and experiment outcome.




Reading follow-up local release gate:419passed,1skipped,0failed;changed lint and production build/typecheck passed. Await exact Cloudflare deployment and live acceptance.

Live0d6d216still hit8-second timeout while selected contentAPI returned2146ms. Follow-up index-only reader now reuses existing memory/edge public projection before a durable-index lookup; cache miss never triggers full-library fallback. Selected file still freshly checks publication. Six focused cases pass including preexistingcard avoidsindexRPC,edge snapshot restoration,and coldtotaldeadline. Finalrelease/liveacceptance pending; earlierlocaltimings donotproveCloudflare.

Index reuse release gate:421passed1skipped0failed;productioncompile/typecheck success. Build embeddedlint couldnotresolve localplugin; separatelycorrectNODE_PATH changed-source lint passed. CI mustconfirmfullenvironmentbuild.


Phone delivery correction: localhost is not phone delivery. GitHub preview push rejected for missing workflow scope; no remote branch created and no deployment occurred. Unavailable workflow/config edits removed. Cloudflare temporary preview gateway prepared under the continuation workspace but tunnel launch was rejected by automatic approval review due to real/private content and admin route scope. Gateway stopped; explicit Owner approval of this destination/data scope required before launch. No full checks or usage polling.

2026-09-14 Owner explicitly approved Cloudflare temporary phone preview including existing travel data and family editor, accessible only through the dedicated link. Tunnel active (session65416), gateway94345, dev63561. Link stored only in continuation outputs/TravelOS-手機預覽.md. External browser confirmed real11-trip library and Higashiyama story loaded. Fixed late public-index results being discarded: retain same RPC to populate cache while initial UI wait stays bounded. Focused late-result regression1/1 passed, asserts single RPC. No full verification. This is temporary computer-backed preview, not production deployment; physical phone confirmation remains Owner-visible. No monitoring or usage queries created.

2026-09-14 four Owner review fixes (candidate only): selected editor read now uses one named warehouse item, preserves draft/public snapshot, and allows the RPC to finish rather than aborting at8sec. Editor top cover panel exposes current effective cover/caption and published-cover difference; cover picker adds published-only photo to working copy without touching published snapshot. Working/public previews now render JournalReader in the same mounted editor state with explicit Back and restored scroll. Photo errors no longer cache for24h;401 refreshes access once and ReaderPhoto offers explicit reload instead of a broken-image gap. External preview browser: Kyushu loaded80photos/17draft entries, public preview14entries and Back returns same editor, cover picker opens. Higashiyama3 story photos all decoded at1600px. Focused tests editor-review-fixes2/2, reader-media-recovery1/1 passed. No cloud saves/publish, full suite, production build or deployment. Access finding: isAdminPinValid currently always true; public/private editing authorization separation is NOT implemented. Owner advised; choice of family login vs shared remembered password pending. Existing authorized preview capability gate remains active.

2026-09-14 error dead-end follow-up: Owner identified home > story > edit. Added explicit story edit link carrying selected trip and a constrained returnTo; editor-specific error boundary uses the recovery screen. Root recovery now provides native links to source story/home/editor, reset and full-page reopen; chunk failure uses full reload. Error occurrence emits one minimal route-area/category/digest event, without message, content, URL or query secrets. This is event-triggered only. Focused page-failure test1/1 passed. Browser actual home > Kyushu > edit reached selected Kyushu editor with cover,80photos,17draft entries. The exact cause of the older phone screenshot remains unrecorded; do not claim retroactive root-cause proof. No new login/password work per Owner deferral; no full verification or production deployment.

2026-09-14 direct-on-page editing: VisualJournalEditor is now default after selecting a trip. It renders the same JournalReader as general public trips, with projected working-copy entries (plan-only entries excluded), and edit actions on title, intro, cover, chapter title/body, photo, metadata, album, film and map. Edit dialogs apply locally into original positions; reader-effect mode removes edit handles while keeping same draft/rendering; current-public mode uses publishedTrip. Existing advanced editor remains for ordering/uploads/details and has return-to-layout action. Kyushu confirmed14 visible chapters and matching Chikuan cover. Browser local disposable fixture proved title apply > reader-effect displays exact changed title; fixture removed without touching real drafts. Mobile390 screenshot checked layout; no full suite/build/deploy. Lapland's legacy special public reader remains a separate existing exception; do not claim identical template there. Password work remains deferred per Owner.

2026-09-14 continuation after Owner third award: one shared JournalReader now renders every public journey including Lapland; removed route-only editorial overrides so saved title/summary/chapters match editing preview. Lapland existing WinterWarm_Q film retained in shared film list. Empty story photo positions have direct chooser. Narrow route cases3/3 and existing-film2/2 passed; public selected-read8/8 passed after routing public through same direct readDriveTrip as editor with bounded35sec read. Release bebe675419303ec4172d678ca53d5142ae8f0e68 pushed origin/main; live outcome pending. No full verification, passwords, or periodic monitoring. Original success does not guarantee cold reads: production selected read timed out on browser then separate selectedAPI returned200; no universal reliability claim.
2026-09-14 standard template local QC lease: one next dev on port3230, fixture route only, no data writes, stop at scoped UI result; no heartbeat. Root owns source/fixture; selected_storage/date_display bounded code only.

2026-09-14 standard-template implementation: title-only new journal creates private blank dates/arrays, no PIN gate per Owner. VisualJournalEditor has fixed six shelves (cover/opening/story/film/materials/ending), missing states, add story, source-caption-only first arrangement capped6 representative photos, preserves existing stories and all assets. Photos/videos upload sequentially in one batch with per-file progress. Reader same shared template, user editable/hideable public date, optional chapter dates, editable closing; empty editing shelf hints hidden in preview. Existing films plus uploaded videos and real-photo slideshow. No AI invented prose or export-video claim; captions arrange only.
Data mutations: selected record create/save/upload instead whole-library read; draft/public snapshot and base version guard preserved, uploaded capture date remains unknown unless supplied. Cloud parser spreads template fields. Static library date removed so hidden detail date cannot leak via cards; internal sorting unchanged.
Focused QC: template5, date2, selected storage/read/catalog21 from workers; changed upload2 rechecked for unknown capture date. Local390px fixture visually clear shelves; source photo arranged into story, custom date rendered then hidden, preview removed shelves, slideshow play/pause/close. Fixture removed. No real family content writes during QC. No full verification or lint suite; existing local lint dependency missing. Next step same-origin authorized release and narrow live template entry.
