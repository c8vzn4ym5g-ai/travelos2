# Baby storybook fictional-data prototype

Base: `origin/main` fetched 2026-10-27, commit `854a050cb1ad53acbbc295d9ec53c1aba9d8369a`.
Branch: `codex/baby-storybook-poc`.

Run from repository root: `node baby-poc/run.mjs` (or `pnpm baby:poc`).
Open `http://127.0.0.1:3347`.

This is a standalone fictional-data POC within the independent TravelOS worktree. It does not start Next, import the production stores, read `.env`, or contact the original site. Scratch records and PDFs live only in `baby-poc/scratch/`. The supervisor registers a local process lease and stops after 30 minutes.

Scope: capture → bench selection → source-text story layout → editable book → persisted reopen → four-page PDF. Traditional Chinese and English share the same flow. Source text layout is not AI rewriting; artificial narration is labelled synthetic and is not a baby's voice or proof of transcription quality. Demonstration images are original vector illustrations of a fictional family.

Existing pure `createJournal` and `transferWritingToTrip` functions are used for the story/photo projection, via the existing TypeScript alias loader. The new interface is a disposable POC rather than a modification to the existing Capture UI.

PDF output uses locally installed Playwright and Chromium. `BABY_PLAYWRIGHT_MODULE` and `BABY_CHROMIUM` may override their paths. Runtime defaults match this task's bundled Windows environment. No online publication is included.

Verification begins only after the complete feature flow is implemented. Exact evidence and remaining limitations will be recorded in `HANDOFF.md` after acceptance.
