# TravelOS Codex Tasks

## TASK-035: Family Kyushu talk translator

Status: done

Goal: Live `/family/talk` on travelos2 for a 4-person Kyushu trip.
iPhone Safari only. Two huge Chinese modes, pale green-apple paper,
PWA, framed back button. Web Speech then Workers AI Whisper + spoken
zh↔ja translation. Do not touch Capture dump, `/family/trip`, Lapland,
Vercel, or `/family` page.tsx.

Result:

- `/family/talk` plus `/api/family/talk/transcribe` and `/translate`.
- Talk-owned CSS, apple-touch-icon, and talk manifest.
- Cloudflare Workers AI binding on travelos2. No new secrets.

## TASK-034: Family 行程 door, framed back, fill 總表 / 表1

Status: done

Goal: Owner on the phone could not find the itinerary (chip did not look
tappable) or go back (ghost text). Put 總表 on top of `/family/trip`,
then write eight day-detail blocks now (hotel + meals + known 建議).
Sticky 1–8 must jump to that detail. Green-apple wash. Do not restyle
Lapland. Do not classify Capture dumps. Do not wait for a map. Do not
copy a failed Kyushu plate or draw a substitute.

Result:

- 入口 has a framed 行程 / 福岡・大分 pill next to Capture / Write.
- Back is a framed pill with :active flash on Capture, 工作台, trip, and
  family home.
- `/family/trip` is 總表 then 表1 day writeups (`trip-day-1`–`8`).
  Recs include address and phone. Tap 3 shows 梅響 / 小鹿田 / 和くら.

## TASK-033: Family booklet wash is pale green-apple

Status: done

Goal: Live Capture still read peach/pink (少女). Owner wants a pale
young apple / washed granny-smith booklet wash — youthful, not neon,
not hospital mint, not dark green. Keep preview-not-shutter. Do not
restyle public Lapland.

Result:

- `data-surface=family` paper is `#f0f6e4` with a light apple hero
  wash. Capture pills use young leaf, not hot pink. Empty middle
  card is still 預覽 / Preview / 剛拍的會出現在這裡, no camera
  glyph, not wired to 拍照. Dump and voice chips unchanged.

## TASK-032: Empty Capture card is preview, not a shutter

Status: done

Goal: Sana tapped the camera drawing in the empty middle card, nothing
happened, and she quit. That card is the record/preview of photos after
they land, not a second shutter. The 拍照 pill is the only
take-photo control. Remove the camera glyph. Empty copy means preview.

Result:

- Empty middle card has no camera drawing and is not wired to 拍照.
  Short booklet copy: 預覽 / Preview / 剛拍的會出現在這裡。 After
  photos exist, the same slot shows the dump. Pills stay the only
  capture doors. Dump line and Lapland unchanged.

## TASK-031: Capture voice editable line + 粵/国/EN

Status: done

Goal: Family tester could not fix ASR proper nouns (西方 → 西川) and
Cantonese came back as garbage because `recognition.lang` was hardcoded
`zh-TW`. Photo dump stays one pick / 40 / parallel POSTs. Public Lapland
untouched. Family workshop only.

Result:

- After speech-to-text the recognized line is a textarea on Capture and
  on 工作台 / the moment card. The corrected text is what Save stores,
  and later edits persist through `PUT /api/moments` (`updateMoment`).
- Tiny chips `粵 / 国 / EN` sit next to the mic. Last choice is kept in
  `localStorage`. Default `国` (`zh-TW`). `粵` probes `zh-HK` then
  `yue-Hant-HK`; `EN` is `en-US`. No auto-detect fake. No settings page.
- Sits on the existing `data-surface=family` 本子. Dump and Lapland unchanged.

## TASK-030: Family 本子 visual + trip companion

Status: done

Goal: Wrap `/family`, `/family/capture`, and `/family/bench` in a family-only
`data-surface="family"` 本子 visual (pale green-apple paper, rounded type,
leaf/honey wash). Add `/family/trip` companion for the 8-day 2026-08-30 Taipei window,
filled only from confirmed emails. Do not restyle public `/trips` or change
Capture dump (40 parallel POSTs, no `createWorkQueue`).

## TASK-029: Family 工作台 Drive photo thumbs

Status: done

Goal: `/family/bench` showed Capture filenames but every still was a
broken-image icon. `GET /api/moments/photos` 404'd `Photo not found`
for Drive-backed `moment_photo_drive_*` ids even though the JPEGs were
in the warehouse folder. Do not re-dump. Do not put Drive on `/family`
public. PIN stays off.

Result:

- Photo GET hydrates from Drive `op=list` like the moments listing, then
  resolves rebuilt Drive photo ids. Index upload ids no longer 404 the
  bench `img` src.
- Bench grid uses `variant=thumb` (Apps Script thumbnail or EXIF thumb).
  Full JPEG remains the default play URL for Write.

## TASK-028: Capture Drive photo index under-count

Status: done

Goal: Owner dump photos landed in the Drive warehouse folder
(`travelos__moments__photos__*`) but GET `/api/moments` / 工作台
under-counted them. Parallel photo POSTs last-write-wins truncated
`moments.json` / item JSON. Do not re-dump. Do not touch Vercel Blob.
PIN stays off. Drive stays off `/family` public.

Result:

- Moment overlay / unique-by-id now unions `photos[]` instead of
  replacing the whole array.
- Drive file names are the authority: `scanWarehouseFiles` + rebuild
  restores display JPEGs (and attaches `original-*` files). GET
  `/api/moments` hydrates when the receiver list is cheap; POST
  `/api/moments/rebuild` or `pnpm run rebuild:moments-drive` rewrites
  the index and item JSON.
- Apps Script source `scripts/drive-warehouse-apps-script.js` adds
  `op=list`, LockService, and merge-on-write so concurrent dumps cannot
  drop siblings once that receiver version is deployed.

## TASK-027: Capture dumps use the Drive warehouse receiver

Status: done

Goal: Live Capture `POST /api/moments` 503'd because the Vercel Blob
store is suspended. Family moments must read and write through the
Drive warehouse receiver. Do not unsuspend Blob. Public Lapland stays
on Blob list+seed. Family PIN stays off.

Result:

- Server-only `lib/drive-warehouse.ts` talks to the Drive warehouse
  receiver (`getIndex`, `putIndex`, `putItem`, `putBinary`, `getBinary`).
- Capture photo/audio binaries use `drive:<fileId>` keys. Item files
  plus the Drive index are the source of truth. Dead Blob no longer
  503s Capture. Parallel photo POST (cap 40) is unchanged.
- New family moments are not written to Blob even if a Blob token is
  still configured.


## TASK-026: Family home is 入口 → 工作台 → 編輯

Status: done

Goal: Sana saw 工作台 twice on `/family` (stuffed next to Capture,
and again as its own card). Owner locked a three-step family home.

Result:

- `/family` is 入口 (Capture + Write together), then one 工作台
  door to `/family/bench`, then 編輯 (旅行遊記 and 咖啡記憶).
- 工作台 appears once on family home. Capture after Save may still
  say 去工作台看看. Bench still has a single intro sentence.
- No Coffee/Travel filing, no public Lapland edits, 工作台 stays
  the raw pile.

## TASK-025: Bench audio that plays, transcript in background, no hang

Status: done

Goal: Live 工作台 showed the newest Aug 27 dump as a broken native
audio bar (錯誤 / --:--) with 這筆還沒有照片, duplicated the
intro sentence, and Capture → 工作台 could spin without finishing.

Result:

- `/family/bench` keeps a single intro sentence. Session and
  GET `/api/moments` time out; already-loaded cards stay visible.
- Unplayable audio is a quiet 這段聲音還不能播 line, never a native
  錯誤 control. iPhone fmp4 labeled `.webm` is sniffed and played
  via an object URL when the browser can play it.
- Original audio stays on the moment. Voice-to-text fills the
  existing `transcript` field in the background after dump (and
  when Bench loads a dump that still needs it). Capture and Bench
  do not wait on it.
- No filing into Coffee/Travel, no public Lapland edits, 工作台
  name unchanged.



Status: done

Goal: Give Sana a family-private 工作台 / Bench so Capture dumps are
visible after Save as Moment. Coffee is shops/map; Capture currently
clears the form. The warehouse already exists.

Result:

- `/family/bench` lists GET `/api/moments` newest first, with photos,
  optional one-liner, month/day, and original audio. Same family session
  as Capture. Empty state links back to `/family/capture`.
- Capture keeps its success copy and adds 去工作台看看 (highlights the
  new moment when the id is known). Family home has 工作台 next to
  Capture / 旅行 / 咖啡. No tagging, no filing to Coffee or Trips, no
  Drive/booking on bench, Capture name unchanged, public Lapland
  unchanged.

## TASK-023: Public Lapland page chrome — stops and booking dates

Status: done

Goal: Stranger-eyes chrome on `/trips/finland-lapland-winter-journal`.
Do not present the village cabin as a peer public stop, hide CMS
"Unrated", and replace hardcoded 2027-01-18 booking dates with a live
December quote window. Frozen poster bytes stay untouched.

Result:

- Right rail Saved stops lists Santa Claus Village, Arctic Circle,
  Helsinki Cathedral, and South Harbour. Cabin lodging stays in the
  journal / visual path / photos, not the peer stop list. "On this page"
  skips the cabin journal. Rating badges omit "Unrated".
- BookingBand / Hotellook defaults use the next December 18–25 window
  (or a remaining December week if already in-season). No 2019 itinerary
  day, no leftover January 2027 week. Year stays in the collapsed cost
  footnote.
- Music pill docks in the Journey picture header while the poster is on
  screen, then floats bottom-left after scroll. Drive/booking stay off
  the poster. `/family` and PR #2 were not touched.


## TASK-022: Lapland poster — left notes, blurbs, colorful Finland map

Status: done

Goal: The public Lapland first picture must beat a printed itinerary
poster: left notes column, short blurb under each number, colorful
street-map Finland from Lapland to Helsinki.

Result:

- Raster poster `public/travelos/maps/lapland-rovaniemi.png` is a split
  itinerary picture. Left column is 一眼 / At a glance with a December ·
  midwinter title bar, Christmas-window and then-the-city phases, numbered
  stops 1–5, and a short bilingual blurb under each number. Right is an
  OpenTopoMap mosaic of Finland (zoom 8: green terrain, blue water, roads),
  route, numbered pins, and callouts. Overlay hit targets stay aligned
  with pins and notes.
- No 2019-12-11, no day-by-day calendar, no Kyushu dates. Capture, family
  PIN, dump, PR #2, and Drive on family were not touched.

## TASK-021: Public Lapland storefront glance under the map

Status: done

Goal: A stranger landing on the public Lapland journal can tell in about
one second where they went and why they might want to go, without relying
on photo captions.

Result:

- Independent bilingual cash-path copy (`為何去 / Why go`) sits under the
  JourneyMap on `/trips/finland-lapland-winter-journal-2020` only. It names
  Finnish Lapland, Rovaniemi, January, Santa Claus Village on the Arctic
  Circle, the HKG–HEL arrival, and the winter-town feel. No fake prices,
  reviews, or unsourced stats.
- Family journal bodies, photo captions, and the winter-village Christmas-card
  title stay as they are. Cost footnotes and live quotes stay on the chip /
  BookingBand. Map remains the first impression. Layout is unchanged.
- Capture, family PIN, PR #2, Drive-off-family, and dump upload were not
  touched. Drive and BookingBand stay on the public storefront only.

## TASK-020: Move Lapland cost notes behind the price chip

Status: done

Goal: First-time readers see the Lapland story, not a lecture about prices.

Result:

- Hero cost chip is a quiet `Cost` + €4,280. The 2020 journal record,
  August 2026 range, and “not today's quote, tap 出發 for live fares”
  sit in a collapsed `<details>` on the chip and on Tracked spend.
- `BookingBand` stays the action. Winter-village caption
  `記憶裡的聖誕卡 / A Christmas card from memory` is unchanged.
- JourneyMap, Capture, family, Drive, and PR #2 were not touched.

## TASK-019: Label Lapland 2020 journal costs and add an August 2026 reference

Status: done

Goal: Stop the public Lapland Cost chip and Tracked spend from looking like
today's price or a fake round number, without inventing a 2026 exact total.

Result:

- Shared public cost UI (`JournalCostHeroNote`, `JournalSpendPanel`) labels
  amounts as `{year} 遊記 / Journal` records. Line items keep the existing
  euro figures and add `2020 遊記記錄 / Journal record`.
- Lapland copy states the 2020 trip was recorded in the journal, about 2
  people and about one week. Numbers stay €4,280 / €1,560 / €1,720 (live
  Blob still supplies attraction €640).
- Dated August 2026 reference uses ranges (HKG–RVN about HK$6,600–9,000 pp;
  Classic Cottage about €250/night, ~€1,750/week) and paraphrased source
  notes. No URLs in the hero. `出發 / Go there` still jumps to BookingBand.
- Public page has no edit buttons. Capture, family PIN, Drive-off-family,
  and PR #2 were not touched. BookingBand stays.
- `winter-village.jpeg` (`photo_lapland_winter_village`) caption is now
  `記憶裡的聖誕卡 / A Christmas card from memory`. Blob schema 10 repairs that
  photo on the next public read so alt text and every caption display update.

## TASK-018: JDB Capture, TravelMoment warehouse, and sit-and-write

Status: in_progress

Current verified result:

- Added a TravelMoment warehouse at Vercel Blob `travelos/moments.json`.
  Capture appends no longer treat overwrite of that public index as the
  existence check. Each moment also has a unique item file
  `travelos/moments/items/{momentId}.json` (`addRandomSuffix: false`)
  that photo/audio attach immediately.
- Moment APIs create a moment, append photos, and store original audio
  without writing a new trip. PIN is off unless
  `TRAVELOS_REQUIRE_FAMILY_PIN=1`.
- `/family/capture` is named Capture, reuses the family session, keeps camera
  and library after each add, previews immediately, and supports retake/remove.
- Capture now starts display-JPEG upload in the background on add (and audio
  when recording stops). Save does not wait on original files or a per-photo
  sequential Blob JSON rewrite. Choose Photos dumps POST up to 40 files in
  parallel (no 3-at-a-time queue, no frame yield between copies). A second
  Choose Photos dump without Save clears the leftover on-screen round and
  starts a new moment; previous warehouse photos stay. Take Photo still
  appends onto the current unsaved round.
- `/trips/write` lists warehouse moments as assets and saves only the
  human-typed draft. No generated journal copy.
- A Capture note that is clearly a job becomes a warehouse job pointing at the
  relevant moments. `/trips/write?job=` opens those photos without generating
  a travel log or meal log.
- `/trips/write` can list and filter warehouse moments by Asia/Taipei day and
  by place. A day/place found set becomes the writing photos together. Saving
  that set stores a warehouse job with the human draft so it survives reload.
- Existing trip Blob APIs, live Lapland, coffee stay. Family PIN is now off
  unless `TRAVELOS_REQUIRE_FAMILY_PIN=1`.
- PR #2 remains held; warehouse Capture/Write/moments APIs merged to `main`
  from PR #3 without merging PR #2. Public booking PR #8 and the Lapland
  poster are untouched.

Remaining:

- Do not merge PR #2 or PR #8.
- Production can put `TRAVELOS_REQUIRE_FAMILY_PIN=1` later without rewriting
  the app. Real iPhone Capture acceptance on the live family door.


## TASK-017: Swap Lapland itinerary basemap to labeled Carto Voyager streets

Status: done

Current result:

- Keep the PR #6 itinerary chrome (arrival strip, numbered list, circular
  pins, winter route, sled side-leg, legend, scale, north, stop cards).
- Hero is one generated Rovaniemi poster PNG, not a live OSM/Carto tile
  collage. Generator stitches Carto Voyager tiles and draws the itinerary.
- Attribution is © OpenStreetMap contributors © CARTO. No Google Maps key,
  SDK, or Google tile URLs. Photos, costs, and quiet CC0 music unchanged.

## TASK-016: Rebuild Lapland JourneyMap as a regional itinerary

Status: done

Current result:

- Replaced the two equal-weight OSM tiles with one Rovaniemi / Finnish
  Lapland regional map as the hero. Hong Kong → Helsinki → Rovaniemi is a
  small arrival strip, not a second map.
- Numbered stop list uses existing journal dates and place names: arrival
  1/18, Santa Village 1/20, Arctic Circle, sled, campfire 1/22, cabin.
  Selecting a row or pin shows photo plus bilingual wording. 44px targets.
- Phone: list, then map, then selected card. Desktop: list beside map.
- Quiet CC0 winter bed, photos, and costs are unchanged. Do not merge.

## TASK-015: Complete the responsive mobile and desktop app shell

Status: in_progress

Current verified result:

- Audited the production home and Family Editing routes at 390x844 and
  1440x900. Neither viewport has horizontal overflow, and the desktop home
  retains its three-column session layout.
- Raised the small mobile home navigation, session actions, and Family
  Workspace back link to reliable 44px touch targets.
- Removed the portrait-only PWA restriction so the installed app can follow
  the device orientation on phones, tablets, and desktop displays.
- Audited Trips, Coffee, Plan & Book, and both locked family editors at
  390x844. All five routes avoid horizontal overflow.
- Raised undersized route navigation, card actions, editor navigation, and
  editor form controls to the same 44px mobile interaction baseline.
- Added a responsive app-shell regression test. The full test suite passes
  8/8, followed by TypeScript, ESLint, and the Next.js production build.

Remaining:

- Unlock both editors for authenticated layout/photo-upload verification, then
  complete real iPhone installation/edit acceptance.

Latest family-entry correction:

- Added the shared family PIN field directly to `/family`; after one successful
  check, Jason or Sana can enter either Travel or Coffee editing without first
  finding a second hidden login screen.
- Replaced the nearly black and dark-green family action boxes with light,
  bordered controls and dark text so labels remain clear on iPhone displays.
- Added regression coverage for the visible unlock form and light action
  treatment. Full tests pass 9/9, followed by TypeScript, ESLint, and the
  production build.
- Commit `421b23e` is deployed. Live `/family` verification confirms the
  password field, both direct editor buttons, and the lighter action treatment
  are visible at phone width.
- The authentication hierarchy is now enforced in code: `/family` is the only
  PIN entry, while direct unauthenticated visits to Travel or Coffee editing
  redirect upward. Department-level PIN forms were removed.

Production evidence:

- Commits `0487078`, `b946e09`, and `19f368c` are deployed through
  `travelos2-63r3`.
- Live Home and Family checks pass at 390x844 and 1440x900.
- Live Trips, Coffee, Plan & Book, Travel Admin, and Coffee Admin checks pass
  at 390x844 with no horizontal overflow and no visible interactive control
  smaller than 44x44.
- The same five routes pass the desktop audit at 1280x720 with no horizontal
  overflow; public content uses a stable 1152px region and locked editor
  screens use a focused 768px region.
- Live manifest returns HTTP 200, has no orientation lock, keeps
  `display=standalone`, starts at `/family`, and retains the Family shortcut.

## TASK-014: Add a sustainable Travelpayouts monetization layer

Status: done

Current verified result:

- PR #14 Drive isolation stays intact: `lib/travelpayouts-drive.ts` plus
  middleware `x-travelos-pathname`. Family, Capture, `/trips/write`, admin,
  and `/api` still do not load Drive. Script URL is unchanged:
  `https://emrldtp.cc/NTUwMzEz.js?t=550313`.
- Public Lapland journal and `/drive` now render a reusable `BookingBand`
  (`出發 / Go there`) with ordinary Aviasales, Hotellook, and Klook URLs.
  Default origin HKG, Lapland dest RVN/HEL, hotel city Rovaniemi.
- One bilingual affiliate line sits in the band footer. No yellow lecture
  card. No invented widget JS hashes. Draft PR #8 was not merged.
- Capture dump, moment warehouse, PIN, family home cards, and PR #2 are
  untouched.

Remaining:

- Confirm live `travelos2-63r3` after this slice merges: Lapland shows
  booking links; `/family` and `/family/capture` still have 0 `emrldtp.cc`.

## JDB-066: Add the installable Family Editing workspace

Status: in_progress

Current verified result:

- Added `/family` as a bilingual, mobile-first shared family workspace.
- Home now exposes one clear `家庭編輯` entry.
- Jason and Sana can browse Trips/Coffee, enter both durable admin editors, open JDB Sana,
  and follow the one-time Safari `加入主畫面` installation path.
- Added a `家庭編輯` PWA shortcut while preserving the existing TravelOS icon,
  manifest, routes, Bangkok, and Lapland.
- Navigation regression passed; TypeScript passed; ESLint passed; production
  build passed and generated `/family`.
- Rendered production HTML contains the Family Editing title, both editor routes, and the
  JDB Sana link.

Remaining:

- Synchronize this verified slice to canonical TravelOS.
- Publish the canonical source to the existing production target.
- Verify `/family` on the live URL and complete one real iPhone install/edit
  acceptance.
- Replace the shared admin PIN with separate Jason/Sana Passkeys inside one
  Family Workspace; use a shared Family Join Code only for enrollment/recovery.

## JDB-046: Import the authoritative 73-photo batch into TravelOS

Status: done

Current verified result:

- The replacement JDB command `20260722110104868-e8606f91` was accepted and
  routed as JDB-046; its 73 photos are now the authoritative source set.
- Verified 73 non-empty files with 73 unique SHA-256 hashes.
- Added three typed TravelOS travelogues with eight journal entries and all 73
  photos: one complete nine-day Bangkok journey and two Tainan short journals.
- Preserved capture time, GPS, camera data, original filenames, bytes, and
  hashes; unknown venue names are explicitly left unclaimed instead of invented.
- Passed the integrity verifier, TypeScript, ESLint, production build, and HTTP
  200 smoke checks for all three generated routes.
- Synchronized to canonical TravelOS and verified against its clean production
  build and all three real target routes. See `docs/JDB-042.md`.

## Status Legend

- `pending`: not started
- `in_progress`: currently being worked on
- `done`: completed and verified
- `blocked`: cannot continue without outside input

## TASK-001: Verify Project Scaffold

Status: done

Result:

- Project files and docs were inspected on 2026-07-13.
- `package.json` includes `dev`, `build`, `start`, `lint`, and `typecheck`.
- `app/layout.tsx`, `app/page.tsx`, and `app/globals.css` are present.
- Tailwind is wired through `app/globals.css` and `postcss.config.mjs`.
- Docs exist for PRD, architecture, database, API, UI, coding rules, prompts,
  acceptance, and task workflow.
- The original generated `node_modules` folder produced `EPERM` errors when
  Node tried to read package executables, so validation was run from a clean
  project copy without generated dependency or build output.
- Dependencies were rebuilt with pnpm using a workspace-local package store.
- `pnpm run typecheck`, `pnpm run lint`, and `pnpm run build` all passed.
- `pnpm run dev --hostname 127.0.0.1 --port 3217` started successfully and
  reached the Next.js ready state.

Goal: Confirm the initial Next.js, TypeScript, and Tailwind scaffold is complete and ready for iterative development.

Scope:

- Inspect package scripts and framework configuration.
- Confirm `app/layout.tsx`, `app/page.tsx`, and `app/globals.css` are present.
- Confirm docs exist and point to the next workflow.
- Install dependencies if needed.
- Run typecheck, lint, and build if dependencies are available.
- Fix scaffold-level issues only.

Acceptance Criteria:

- The app starts locally with the documented scripts.
- TypeScript configuration is valid.
- Tailwind styles are wired into the app.
- `docs/Tasks.md` is updated with the result.

## TASK-002: Define Domain Types

Status: done

Goal: Add TypeScript domain types for Trip, JournalEntry, Photo, Place, and Cost.

Result:

- Added shared domain types in `lib/types.ts` for Trip, JournalEntry, Photo,
  Place, Cost, related enums, coordinates, money, list items, and trip details.
- Validation passed with `pnpm run typecheck` and `pnpm run lint`.

## TASK-003: Build Trip List Screen

Status: done

Goal: Add a trip list route that displays trips by date, country, city, and summary.

Result:

- Added typed local trip seed data in `lib/trips.ts`.
- Added `/trips` with trips ordered by start date and displayed with date,
  country, city, summary, rating, cost, and slug.
- Added a dashboard link to the trip list.
- Validation passed with `pnpm run typecheck`, `pnpm run lint`, and
  `pnpm run build`.

## TASK-004: Build Trip Detail Screen

Status: done

Goal: Add a trip detail route with overview, journal, places, costs, and album sections.

Result:

- Expanded typed local seed data to include trip details, journal entries,
  places, costs, photos, coordinates, and metadata.
- Added `/trips/[slug]` with overview, journal, places, costs, and album
  placeholder sections.
- Linked trip list records to their detail screens.
- Validation passed with `pnpm run typecheck`, `pnpm run lint`, and
  `pnpm run build`.

## TASK-005: Add Trip Creation Draft Flow

Status: done

Goal: Add a draft trip form UI without persistence.

Result:

- Added `/trips/new` as a non-persistent draft trip form for core trip data,
  first journal note, first saved place, and starting cost item.
- Added clear disabled save/publish controls to show persistence is not wired
  yet.
- Linked the draft flow from the dashboard and trip list.
- Validation passed with `pnpm run typecheck`, `pnpm run lint`, and
  `pnpm run build`.

## TASK-006: Prepare Prisma Schema Draft

Status: done

Goal: Introduce a Prisma schema draft aligned with `docs/Database.md`.

Result:

- Added `prisma/schema.prisma` with PostgreSQL datasource, Prisma client
  generator, core TravelOS models, enums, relations, and indexes.
- Added a `DATABASE_URL` placeholder to `.env.example`.
- Kept the change schema-only; no Prisma client, migrations, or runtime
  database access were introduced yet.
- Validation passed with `pnpm run typecheck`, `pnpm run lint`, and
  `pnpm run build`.

## TASK-007: Add Map Placeholder Route

Status: pending

Goal: Add a world map route with a provider-neutral placeholder and trip pins from seed data.

## TASK-008: Add Timeline Route

Status: pending

Goal: Show trips grouped by year and month.

## TASK-009: Add Cost Summary UI

Status: pending

Goal: Display trip cost totals by category and currency.

## TASK-010: Add Coffee Map Parallel Session

Status: done

Goal: Add a Coffee Map workspace beside Travel Journal without creating a new Git or Vercel project.

Result:

- Updated the first page to show two visible sessions: Travel Journal and
  Coffee Map.
- Kept existing `/trips`, `/trips/new`, and `/trips/[slug]` routes intact.
- Added typed coffee records in `lib/types.ts` and seed data/helpers in
  `lib/coffee.ts`.
- Added `/coffee` for coffee shop notes, `/coffee/new` for quick capture,
  `/coffee/map` for a provider-neutral map placeholder, and `/coffee/[slug]`
  for coffee shop detail notes.
- Coffee records are separate from trip journals, with optional linked trip IDs
  for future cross-reference.

Acceptance Criteria:

- The homepage links clearly to Travel Journal and Coffee Map.
- Coffee Map supports address/link/comment/life-note/photo-slot concepts.
- Existing trip pages remain available under their current routes.
- Validation passes with typecheck, lint, and build.

## TASK-010: Add AI Assistant Placeholder

Status: pending

Goal: Add the AI assistant screen as a non-connected interface that explains what data will be searchable.

## TASK-011: Add Coffee Admin Editing

Status: done

Goal: Add Coffee admin tools similar to the Travel trip admin editor.

Result:

- Added `/coffee/admin` with guidelines for adding coffee shops, comments,
  life notes, tags, and photos.
- Added Coffee content persistence through Vercel Blob at
  `travelos/coffee.json`, using the same admin PIN pattern as Travel admin.
- Added `/api/coffee/content` for loading and saving Coffee records.
- Added `/api/coffee/photos` for uploading Coffee photos.
- Updated Coffee public pages and the homepage to read saved Coffee content.
- Kept Trip admin/storage and Travel photo/music files separate and unchanged.
## TASK-012: Restore Owner Journey Navigation

Status: done

Goal: Make the TravelOS home the scalable hub and ensure the owner can reach both Bangkok and Lapland through Trips.

Result:

- Kept Home as the hub for Trips, Coffee, and Drive.
- Corrected the private-first visibility behavior so private journeys remain visible to the owner.
- Added readable `Home / 首頁` and `Trips / 遊記` navigation to Coffee.
- Added a regression check for the Home, Coffee, Trips, Bangkok, and Lapland paths.
- Passed typecheck, lint, production build, and real HTTP route verification.

Acceptance Criteria:

- Home links to Trips and Coffee.
- Trips includes both Bangkok and Lapland.
- Both journey detail routes return HTTP 200.
- Coffee returns to Home and links to Trips without hard-coding a single journey.

## TASK-013: Add Public/Private Trip Control

Status: done

Goal: Let the family choose whether each trip is public or private without
removing it from the editor.

Result:

- New trips default to public.
- Trip admin exposes two Chinese choices: public or private.
- Public home/list/detail/metadata use one visibility rule.
- Private trips remain editable but are hidden from public lists, photo strips,
  metadata, and direct public slug access.
- Unauthenticated reads of `/api/trips/content` return 401; the unlocked admin
  editor supplies its PIN when loading all trips.
- Legacy shared trips remain public for backward compatibility.
- Trip visibility tests, navigation regression, typecheck, lint, and production
  build passed.
- Production verification passed: unauthenticated content API 401, public trip
  detail 200, and private trip detail 404.
