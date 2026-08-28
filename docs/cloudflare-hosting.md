# Cloudflare Workers hosting (parallel to Vercel)

TravelOS stays a Next.js App Router app with API routes. Static `output: 'export'` is not used. The existing Vercel GitHub integration is **untouched and remains live** until Owner/GM cut over.

This repo now has a second deploy path: `@opennextjs/cloudflare` → Cloudflare Workers.

## Scripts

- `pnpm run build` — normal `next build` (what Vercel uses). Do not replace this.
- `pnpm run cf:build` — `next build` + OpenNext Worker bundle (`.open-next/`).
- `pnpm run cf:preview` — OpenNext build, then local Workers runtime via Wrangler.
- `pnpm run cf:deploy` — OpenNext build, then deploy with Wrangler.

Local preview: copy `.dev.vars` (already has `NEXTJS_ENV=development`). Do not put warehouse tokens in `NEXT_PUBLIC_*`.

## GitHub secrets (required for the Cloudflare workflow)

Set these on the GitHub repo (`Settings → Secrets and variables → Actions`). Do not put them in the Vercel dashboard.

| Secret | Used for |
| --- | --- |
| `CLOUDFLARE_API_TOKEN` | Wrangler deploy. Create an API token with **Workers Scripts Edit** (Account). |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare account id (Workers overview). |

The workflow is `.github/workflows/cloudflare-deploy.yml`. It runs on push to `main` and on `workflow_dispatch`. It always runs `next build` and `cf:build`. It deploys only when both secrets are present.

Do **not** set `BLOB_READ_WRITE_TOKEN` on the Cloudflare path. Capture already uses the Drive Apps Script warehouse, not Vercel Blob.

## Drive warehouse on Cloudflare

`lib/drive-warehouse.ts` is server-only. The Apps Script URL and token are **not** `NEXT_PUBLIC_*`.

Runtime lookup (Cloudflare Worker, after deploy):

1. `process.env.TRAVELOS_DRIVE_WAREHOUSE_URL`
2. `process.env.TRAVELOS_DRIVE_WAREHOUSE_TOKEN`

If those are unset, the existing server-only hardcoded receiver is used. That is enough for a first CF deploy without extra secrets.

To override without a code change, set **Wrangler secrets** (runtime, not GitHub Actions build env):

```bash
pnpm exec wrangler secret put TRAVELOS_DRIVE_WAREHOUSE_URL
pnpm exec wrangler secret put TRAVELOS_DRIVE_WAREHOUSE_TOKEN
```

Wrangler vars/secrets show up on `process.env` because `wrangler.jsonc` uses `compatibility_date` ≥ `2025-04-01` and `nodejs_compat`.

Family PIN stays off unless `TRAVELOS_REQUIRE_FAMILY_PIN=1` is set. Do not set that on Cloudflare until Owner asks.

## Public Lapland assets

Files under `public/travelos/` are copied into the Worker assets bundle. They keep working at `/travelos/...` (same URLs as Vercel). `public/_headers` caches `/_next/static/*` and `/travelos/*`.

## Compatibility flags (blockers to know)

`wrangler.jsonc` enables:

- `nodejs_compat` — `Buffer`, `process.env`, and other Node APIs used by Drive (`Buffer.from` base64) and API routes (`runtime = "nodejs"`).
- `global_fetch_strictly_public` — server `fetch()` to the Drive Apps Script URL.

No R2 incremental cache is configured, so ISR cache is in-memory per isolate. Capture persistence is Drive, not CF cache.

Trip/coffee **admin photo upload** routes still import `@vercel/blob`. Without `BLOB_READ_WRITE_TOKEN` they are not the Capture path; public Lapland reads seed + `/public/travelos/`. Those Blob admin routes are leftover from Vercel and are not required for family Capture on Workers.

## Cutover

Vercel production stays live. Cloudflare is additive. After a successful Workers deploy (and Owner check of `/family/capture`, `/family/bench`, and the Lapland trip), DNS can move. Do not delete Vercel config in this change.
