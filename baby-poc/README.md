# Baby storybook fictional-data prototype

Base: `origin/main` fetched 2026-10-27, commit `854a050cb1ad53acbbc295d9ec53c1aba9d8369a`.
Branch: `codex/baby-storybook-poc`.

Hosted fictional-data trial: https://travelos-baby-poc.chao-jason.workers.dev

For local work, set `BABY_AI_ORIGIN=https://travelos-baby-poc.chao-jason.workers.dev`, then run `node baby-poc/run.mjs` (or `pnpm baby:poc`) from the repository root and open `http://127.0.0.1:3347`.

This is a standalone fictional-data POC within the independent TravelOS worktree. It does not start Next, import the production stores, read `.env`, or contact the original site. Scratch records and PDFs live only in `baby-poc/scratch/`. The supervisor registers a local process lease and stops after 30 minutes.

Scope: recording/audio upload → actual speech transcription → capture → bench selection → actual AI story drafts → review/adopt/edit → persisted book → reopen → four-page book. Traditional Chinese and English share the same flow. Cloudflare Workers AI runs Whisper large-v3-turbo for audio and Llama 3.3 70B fp8-fast for stories. OpenCC converts Chinese characters deterministically; parents still review names and words. Synthetic sample narration is labelled as such and is not a child's voice. Demonstration images are original vector illustrations of a fictional family.

Existing pure `createJournal` and `transferWritingToTrip` functions are used for the story/photo projection, via the existing TypeScript alias loader. The new interface is a disposable POC rather than a modification to the existing Capture UI.

The hosted trial runs as the separate `travelos-baby-poc` Worker with its own fictional warehouse. It does not use the TravelOS production warehouse or deployment. Hosted books use the browser's Print / save as PDF action. Local binary PDF output uses installed Playwright and Chromium; `BABY_PLAYWRIGHT_MODULE` and `BABY_CHROMIUM` may override their paths.

Verification begins only after the complete feature flow is implemented. Exact evidence and remaining limitations are recorded in `HANDOFF.md`; previous source-layout-only acceptance does not prove the AI/audio features.
