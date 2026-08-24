# TravelOS Handoff

## 2026-08-24 Found-set writing on /trips/write

- A day and/or place filter is a temporary writing set. Photos on Write come
  from the visible warehouse moments together, the same way a Capture job
  already points at several moments. No new durable job type. No new Trip.
- The writing area stays blank until a person types. Filter labels stay in the
  Found set banner, not in the textarea. No travel log, meal log, or diary
  prose is produced.
- Originals stay in the warehouse. Capture remains the front door and is not
  blocked by this retrieval path. Family PIN session only.
- PR #2 stays held. Continue on PR #3
  (`cursor/moment-warehouse-capture-abda`). Do not merge. Do not
  production-deploy from this handoff.

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
  Continue on PR #3 (`cursor/moment-warehouse-capture-abda`). Do not merge.
  Do not production-deploy from this handoff.

## 2026-08-24 JDB Capture and TravelMoment warehouse

- Owner path confirmed: Capture is the family phone front door; TravelOS
  warehouses originals as reusable assets; sit-and-write is human text only.
- Canonical warehouse: Vercel Blob path `travelos/moments.json`. Portable JSON.
  Obsidian is not a runtime dependency. No Prisma, no vector DB, no production
  deploy in this slice.
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
- Exact next action: family iPhone Capture acceptance against a Blob-backed
  preview, then decide whether to keep PR #2 closed. Do not deploy production
  from this handoff.

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
