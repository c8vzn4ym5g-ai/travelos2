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
- `pnpm run typecheck`, `pnpm run lint`, and `pnpm run build` passed on
  2026-07-13.

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

- Added domain types in `lib/types.ts`.
- Validation passed with `pnpm run typecheck`, `pnpm run lint`, and
  `pnpm run build`.

## TASK-003: Build Trip List Screen

Status: done

Goal: Add a trip list route that displays trips by date, country, city, and summary.

Result:

- Added `/trips` backed by typed seed trip data.
- Validation passed with `pnpm run typecheck`, `pnpm run lint`, and
  `pnpm run build`.

## TASK-004: Build Trip Detail Screen

Status: done

Goal: Add a trip detail route with overview, journal, places, costs, and album sections.

Result:

- Added `/trips/[slug]` detail pages with overview, journal, places, costs,
  and album placeholder sections.
- Validation passed with `pnpm run typecheck`, `pnpm run lint`, and
  `pnpm run build`.

## TASK-005: Add Trip Creation Draft Flow

Status: done

Goal: Add a draft trip form UI without persistence.

Result:

- Added `/trips/new` draft form UI without persistence.
- Validation passed with `pnpm run typecheck`, `pnpm run lint`, and
  `pnpm run build`.

## TASK-006: Prepare Prisma Schema Draft

Status: done

Goal: Introduce a Prisma schema draft aligned with `docs/Database.md`.

Result:

- Added `prisma/schema.prisma` and `.env.example` with `DATABASE_URL`.
- Validation passed with `pnpm run typecheck`, `pnpm run lint`, and
  `pnpm run build`.

## TASK-007: Add Map Placeholder Route

Status: done

Goal: Add a world map route with a provider-neutral placeholder and trip pins from seed data.

Result:

- Added `/map` with a provider-neutral world map placeholder and trip pins from
  seed trip coordinates.
- Linked the map workspace from the home screen.
- Validation passed with `pnpm run typecheck`, `pnpm run lint`, and
  `pnpm run build`.

## TASK-008: Add Timeline Route

Status: done

Goal: Show trips grouped by year and month.

Result:

- Added `/timeline` with trips grouped by year and month.
- Linked the timeline from the home screen.
- Validation passed with `pnpm run typecheck`, `pnpm run lint`, and
  `pnpm run build`.

## TASK-009: Add Cost Summary UI

Status: done

Goal: Display trip cost totals by category and currency.

Result:

- Added `/costs` with currency totals, category totals, and a read-only cost
  ledger linked back to trip details.
- Linked the cost summary from the home screen.
- Validation passed with `pnpm run typecheck`, `pnpm run lint`, and
  `pnpm run build`.

## TASK-010: Add AI Assistant Placeholder

Status: done

Goal: Add the AI assistant screen as a non-connected interface that explains what data will be searchable.

Result:

- Added `/assistant` as a non-connected AI assistant placeholder.
- Documented future searchable memory fields and example questions without
  connecting an AI provider.
- Linked the assistant from the home screen.
- Validation passed with `pnpm run typecheck`, `pnpm run lint`, and
  `pnpm run build`.
