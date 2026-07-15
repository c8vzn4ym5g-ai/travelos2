# TravelOS Codex Tasks

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
