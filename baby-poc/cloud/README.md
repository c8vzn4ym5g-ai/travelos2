# Independent fictional Baby POC

This Worker is `travelos-baby-poc`. It does not use the original `travelos2` Worker, warehouse, service binding or deployment workflow.

The branch-only `.github/workflows/baby-poc-preview.yml` uses existing repository Cloudflare secrets without copying their values. It bundles this entry with Wrangler and uploads `baby-poc/web` as static assets; the original Next application is not built. Synthetic WAV files must exist in `baby-poc/web/assets` before publishing.

`FICTIONAL_WAREHOUSE` is a new namespace with the SQLite-backed `FictionalWarehouse` class. Each moment and compact book occupies a separate SQL row; child metadata has its own row. Book records keep source IDs and story text, not repeated photo/audio data or the duplicated trip projection. Reads hydrate their sources and rebuild the original pure-function projection. All warehouse mutations read and write synchronously after body parsing. AI runs outside the object, followed by a small source-specific draft update.

The preview uses one shared fictional family. It is for fictional material, not production family storage. The hosted PDF route opens the same four-page HTML with the browser's print/save-to-PDF dialog; it is not a hosted binary-PDF generator. Existing local PDF generation remains separate.

Routes match the local POC: state, demo/capture, story arrangement, book save/read, and book reading. `POST /api/transcribe` runs real speech-to-text. `POST /api/arrange-text` accepts `{moment,lang}` for local development to use the same model without reading or writing the hosted warehouse. `GET /api/capabilities` and `state.runtime === 'cloud'` let the UI label the print action accurately.

Official feasibility sources, checked 2026-10-27:

- [Durable Object pricing](https://developers.cloudflare.com/durable-objects/platform/pricing/): Workers Free supports SQLite-backed classes.
- [Durable Object limits](https://developers.cloudflare.com/durable-objects/platform/limits/): bound string/blob/row is up to 2 MB; SQL statement text is limited to 100 KB. Inserts here bind payload values instead of building them into SQL text. Large real recordings are outside this fictional POC scope.
- [Getting started](https://developers.cloudflare.com/durable-objects/get-started/): SQL-backed migrations use `new_sqlite_classes`.

Implementation is ready for integration; no build, AI request or deployment was run by this role during development.
