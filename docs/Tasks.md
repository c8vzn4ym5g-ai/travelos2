# TravelOS Codex Tasks

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
- Added a responsive app-shell regression test. The full test suite passes
  7/7, followed by TypeScript, ESLint, and the Next.js production build.

Remaining:

- Publish the verified slice to `travelos2-63r3`.
- Repeat the 390x844 and 1440x900 production measurements and confirm the live
  manifest no longer declares portrait-only orientation.
- Continue the responsive audit through Trips, Coffee, Family editors, and
  photo-upload flows, then complete real iPhone installation/edit acceptance.

## TASK-014: Add a sustainable Travelpayouts monetization layer

Status: in_progress

Current verified result:

- Travelpayouts Drive now loads once from the application root instead of only
  on an empty page.
- `/drive` accurately explains the Plan & Book product area and includes an
  affiliate disclosure.
- Removed the incorrect claim that Drive is a car-rental widget and removed the
  non-functional widget placeholder.
- Focused tests passed 2/2; navigation, TypeScript, ESLint, and production build
  passed in a clean validation copy.
- GitHub/Vercel production deployment is active at commit
  `c36b2b28ccaab2111ab8e60ab1bef2a1f5da8ac8`.
- Live `/drive` and public Lapland checks confirm exactly one Drive loader and
  script, a visible disclosure, and no fake widget container.

Remaining:

- Read the result of Travelpayouts `Check setup`; the check was opened, but the
  Windows browser-control channel timed out before the result could be read.
- Add official program-generated flight and stay/activity tools with stable
  placement SubIDs; do not guess widget code or expose API credentials.

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
