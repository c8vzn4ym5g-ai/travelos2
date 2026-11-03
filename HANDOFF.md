# Daily mobile candidate — current truth

Updated 2026-11-04 Taipei. Sole writer: this task /root. Original author explicitly confirmed clean baseline and stopped writing. Do not modify original TravelOS or original POC.

## Identity
- Source local baseline: 7c5d6d8c344fe988c9f148e1ef108fac7d6e0ff0, codex/baby-storybook-poc.
- Recorded original POC deployed app: 6c3fdd567364ef8d24ffe5c14138c64bfbebaf70.
- This is a minimal independent candidate copy, not a full upstream checkout. It reuses baby-poc/ai.mjs and OpenCC directly; only daily/, those dependencies and operational files are synchronized. Legacy lib/tests and baseline POC copy remain untracked locally, never publish those legacy files or their embedded defaults.
- Current candidate branch: codex/baby-daily-mobile; Worker target: travelos-baby-daily-preview; version daily-mobile-0.1.0.
- Original successful baseline remains in its original location and original remote branch. Local earlier candidate commit f3e174e is preserved on codex/baby-daily-preview, not synchronized.
- Canonical product brief: https://docs.google.com/document/d/1j5-cdF5CIBRLDRRSF_9BKODYcVVfubBO/edit . This supersedes old three-story / NT$199 plans. 30-day trial; NT$399 and five members remain suggestions. No billing and no story-count quota.

## Implemented candidate scope
Private account/family/session, single-use seven-day invites, multi-member capture with duplicate request protection, text/photo/audio/short-video payloads, automatic audio transcription before diary generation, source-linked daily versions, manual edit conflicts, late-source pending draft, configured timezone/evening cron handler, comments/read state, manually assigned tasks/read/accepted/done, basic immutable story collection snapshots, browser print, family JSON export. Camera/file pickers and audio/video playback use browser-native controls. No production imports.
Test limits: 8MB per file, four files per capture, 12MB encoded request, 20MB encoded family capture cap; 30 generation attempts and 20 transcriptions per family/day. Storage split across sub-2MB SQLite rows transactionally; not R2. These test limits are not final commercial rights.

## Observed verification
- node --experimental-loader ./daily/test-loader.mjs --test daily/domain.test.mjs daily/http.test.mjs: 5 tests passed. HTTP suite uses Request/Response public interfaces, real in-memory Node SQLite and deterministic AI test adapter, not live Cloudflare runtime.
- Covers two isolated families, single-use invite, 2.8M-character media persistence below row limit, duplicate capture, simultaneous member contributions, stale edit conflict, late-source protection, voice auto-transcription adapter, empty-day/batch idempotency, timezone and trial expiry, CSRF/unauthenticated calls.
- Chrome 390px: created fictional family, text capture -> diary -> manual edit -> late text -> pending draft without overwrite -> one-diary story collection saved/opened.
- Chrome 1280px reload read back same manual text. Measured document widths 375 <=390 and 1265 <=1280 (no horizontal overflow on observed screens).
- Browser local AI is explicitly a deterministic adapter. New deployed live AI, cron execution, real iPhone/Android microphone and video codecs, cross-physical-device sync, and PDF output have NOT been verified.
- File picker upload was interrupted at browser approval; no browser media upload success claim. HTTP synthetic-media persistence was tested separately.

## Deployment block and exact continuation
Initial push including new workflow was rejected by GitHub: OAuth App lacks workflow scope. No remote candidate branch created by that push. Automatic safety review initially denied external publishing; after reading trusted human history requiring phone-accessible URL the same push was approved, then GitHub itself rejected workflow creation. No permission expansion or workaround used.
The safe continuation synchronizes CODE ONLY on codex/baby-daily-mobile. deployment-support/daily-mobile-preview.yml.txt is inert review material; it will NOT execute. An authorized repo maintainer must add its exact content as .github/workflows/daily-mobile-preview.yml ON THIS BRANCH, or personally repair the existing Git credential workflow permission. Never share tokens in chat. Existing repo Cloudflare secrets are referenced, never read.
After this gate: verify CI and deploy log, obtain actual HTTPS URL, then run live text/photo/audio/video, independent-session household isolation, scheduled generation, and device QC. Do not state deployed or phone verified before that.

## Deliberate gaps
No payment, push notifications, natural-language reminder extraction, member removal/editor permission controls, EXIF/event/person grouping, image/video semantic understanding, offline file retention, cloud TTS, public sharing, rich book layout or print fulfillment. Tasks are page-only; source materials remain within authenticated family. Basic book media refer to original immutable captures; text versions are snapshots.
Conductor is advisory-only; no deterministic controller exists. Local supervisor registers a lease and stops after 30 minutes. Stop owned process at handoff; restart with node daily/run-local.mjs only for bounded local QC.

## Final handoff gate
Candidate initial code-only commit 458016d was not synchronized. Its push to origin codex/baby-daily-mobile was stopped BEFORE execution by automatic approval review: user authorization did not specifically cover this GitHub synchronization/destination. No connector or alternative transport was used to bypass it. A verified human approval naming repo c8vzn4ym5g-ai/travelos2 and branch codex/baby-daily-mobile is needed before retrying this operation. Separately, enabling the prepared workflow still requires GitHub workflow permission; ordinary content push alone will not deploy.
The first workflow push had previously passed review on trusted user phone-URL evidence but then failed GitHub's workflow-scope check; these are two distinct blocks.
Local QC supervisor stopped at handoff; browser viewport restored. The shipped conductor wrapper supports only status, so check-final command is unsupported; advisory-only continuity is recorded here.

## Superseding synchronization result — 2026-11-04
Owner explicitly approved synchronization to c8vzn4ym5g-ai/travelos2, codex/baby-daily-mobile. git push succeeded for ec9c29e; remote branch and daily/wrangler.jsonc plus deployment-support/daily-mobile-preview.yml.txt were independently read back through GitHub connector. The prior automatic-review synchronization gate is now resolved/superseded, not active.
Remaining gate is GitHub workflow scope. Remote .github/workflows/daily-mobile-preview.yml returns 404. No new workflow-write operation was retried or alternate permission path used. Exact maintainer action: on codex/baby-daily-mobile copy deployment-support/daily-mobile-preview.yml.txt to .github/workflows/daily-mobile-preview.yml and commit through an authorized GitHub session. The existing repository Cloudflare secrets are referenced by the prepared file. Successful code synchronization is not deployment. No new HTTPS URL or new cloud/device verification yet.
