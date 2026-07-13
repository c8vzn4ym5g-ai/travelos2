# TravelOS Codex Tasks

## Status Legend

- `pending`: not started
- `in_progress`: currently being worked on
- `done`: completed and verified
- `blocked`: cannot continue without outside input

## TASK-001: Verify Project Scaffold

Status: blocked

Result:

- Project files and docs were inspected on 2026-07-13.
- `package.json` includes `dev`, `build`, `start`, `lint`, and `typecheck`.
- `app/layout.tsx`, `app/page.tsx`, and `app/globals.css` are present.
- Tailwind is wired through `app/globals.css` and `postcss.config.mjs`.
- Docs exist for PRD, architecture, database, API, UI, coding rules, prompts,
  acceptance, and task workflow.
- Automated validation is blocked in the current sandbox because Node cannot
  read executable files inside the existing `node_modules/.pnpm` directory
  (`EPERM: operation not permitted`). A clean verification install was also
  blocked because network access to the npm registry returned `EACCES`.

Next unblock step:

- Rebuild dependencies in a normal local shell with network access, then run
  `pnpm run typecheck`, `pnpm run lint`, and `pnpm run build`.

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

Status: pending

Goal: Add TypeScript domain types for Trip, JournalEntry, Photo, Place, and Cost.

## TASK-003: Build Trip List Screen

Status: pending

Goal: Add a trip list route that displays trips by date, country, city, and summary.

## TASK-004: Build Trip Detail Screen

Status: pending

Goal: Add a trip detail route with overview, journal, places, costs, and album sections.

## TASK-005: Add Trip Creation Draft Flow

Status: pending

Goal: Add a draft trip form UI without persistence.

## TASK-006: Prepare Prisma Schema Draft

Status: pending

Goal: Introduce a Prisma schema draft aligned with `docs/Database.md`.

## TASK-007: Add Map Placeholder Route

Status: pending

Goal: Add a world map route with a provider-neutral placeholder and trip pins from seed data.

## TASK-008: Add Timeline Route

Status: pending

Goal: Show trips grouped by year and month.

## TASK-009: Add Cost Summary UI

Status: pending

Goal: Display trip cost totals by category and currency.

## TASK-010: Add AI Assistant Placeholder

Status: pending

Goal: Add the AI assistant screen as a non-connected interface that explains what data will be searchable.
