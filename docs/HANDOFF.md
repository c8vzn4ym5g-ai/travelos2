# TravelOS Handoff

## 2026-08-28 Family 本子 visual and trip companion

- Family workshop routes (`/family`, `/family/capture`, `/family/bench`) sit
  inside `data-surface="family"` with 家庭本子 tokens. Public Lapland / `/trips`
  keep magazine Georgia and teal theme-color `#0f766e`. Family theme-color is
  `#FFF4EC`.
- `/family/trip` is a private companion: sticky days 1–8 from 2026-08-30
  Taipei. Confirmed STARLUX JX316/JX317, Nissan 26082202410 / SERENA,
  界 由布院, うめひびき (group stay), フリューゲル久住, Solaria arrival
  TF53AEFAC2A33 (8/30–8/31, breakfast included), and Solaria return
  T032CA29B451B (9/3–9/5). Day 7 tonight stay blank. Capture dump is
  unchanged.

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
