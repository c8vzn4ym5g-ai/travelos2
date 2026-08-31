# Cloudflare Workers hosting (parallel to Vercel)

TravelOS stays a Next.js App Router app with API routes. Static `output: 'export'` is not used. The existing Vercel GitHub integration is **untouched and remains live** until Owner/GM cut over.

This repo now has a second deploy path: `@opennextjs/cloudflare` → Cloudflare Workers.

## Scripts

- `pnpm run build` — normal `next build` (what Vercel uses). Do not replace this.
- `pnpm run cf:build` — `next build` + OpenNext Worker bundle (`.open-next/`).
- `pnpm run cf:preview` — OpenNext build, then local Workers runtime via Wrangler.
- `pnpm run cf:deploy` — OpenNext build, then `opennextjs-cloudflare deploy`.

Local preview: copy `.dev.vars` (already has `NEXTJS_ENV=development`). Do not put warehouse tokens in `NEXT_PUBLIC_*`.

## GitHub secrets (required for the Cloudflare workflow)

Set these on the GitHub repo (`Settings → Secrets and variables → Actions`). Do not put them in the Vercel dashboard. Do not put them in `wrangler.jsonc`.

| Secret | Used for |
| --- | --- |
| `CLOUDFLARE_API_TOKEN` | Wrangler / OpenNext deploy. Create an API token with **Workers Scripts Edit** (Account). The Owner token name is `travelos2-deploy`. |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare **Account ID** from Workers overview. Must be **exactly 32 hexadecimal characters**. |

Owner account id to confirm against (not a secret; still keep the GitHub secret as the runtime source): `31c5f4dccc8eabb03968996576e8e1c4`.

A 33-character value is a copy/paste typo. That produced Cloudflare API **7003** (`Could not route to /accounts/***/workers/services/travelos2`) on the first deploy and looked like a missing worker. It was not a `WORKER_SELF_REFERENCE` chicken-egg.

The workflow is `.github/workflows/cloudflare-deploy.yml`. It runs on push to `main` and on `workflow_dispatch`. After install it checks that both secrets are present. If they are, `node scripts/verify-cloudflare-creds.mjs` calls `/user/tokens/verify` and `/accounts/{id}/workers/scripts` and **fails fast** on a bad length/hex or API 7003 — before `next build` / `cf:build`. Those checks never print the token or account id. If secrets are missing, it still runs `next build` and `cf:build` and skips deploy. Deploy uses `opennextjs-cloudflare deploy` (not a second `cf:build`) only when both secrets are present and verified.

After correcting `CLOUDFLARE_ACCOUNT_ID`, **re-run** the Cloudflare Workers workflow (`workflow_dispatch` or push to `main`). The first successful deploy creates worker `travelos2`; it does not exist until then.

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

The receiver source of truth in-repo is `scripts/drive-warehouse-apps-script.js`.
It must list folder files (`op=list`), return Drive thumbnails (`op=thumb`),
merge `photos[]` under LockService on index/item writes, and keep binaries
named `travelos__moments__photos__*`. Deploy a new version of the existing
web app (do not change the `/exec` URL). Bench still serves a JPEG thumb
from EXIF if `op=thumb` is not deployed yet.

Wrangler vars/secrets show up on `process.env` because `wrangler.jsonc` uses `compatibility_date` ≥ `2025-04-01` and `nodejs_compat`.

Family PIN stays off unless `TRAVELOS_REQUIRE_FAMILY_PIN=1` is set. Do not set that on Cloudflare until Owner asks.

## Public Lapland assets

Files under `public/travelos/` are copied into the Worker assets bundle. They keep working at `/travelos/...` (same URLs as Vercel). `public/_headers` caches `/_next/static/*` and `/travelos/*`.

## Compatibility flags (blockers to know)

`wrangler.jsonc` enables:

- `nodejs_compat` — `Buffer`, `process.env`, and other Node APIs used by Drive (`Buffer.from` base64) and API routes (`runtime = "nodejs"`).
- `global_fetch_strictly_public` — server `fetch()` to the Drive Apps Script URL.
- `ai.binding = "AI"` — Workers AI for `/family/talk` Whisper + spoken
  zh↔ja translation. No extra secret. Do not send this path through
  OpenAI or Vercel AI Gateway.

No R2 incremental cache is configured, so ISR cache is in-memory per isolate. Capture persistence is Drive, not CF cache.

Trip/coffee **admin photo upload** routes still import `@vercel/blob`. Without `BLOB_READ_WRITE_TOKEN` they are not the Capture path; public Lapland reads seed + `/public/travelos/`. Those Blob admin routes are leftover from Vercel and are not required for family Capture on Workers.

## Cutover

Primary public origin is `https://travelos2.chao-jason.workers.dev` (`wrangler.jsonc` `workers_dev: true`). Storefront `metadataBase`, sitemap, robots, JSON-LD, and share links use `lib/site-url.ts`: `SITE_URL` / `NEXT_PUBLIC_SITE_URL` if set to a non-`*.vercel.app` origin, otherwise Cloudflare workers.dev. Leftover Vercel dashboard `SITE_URL` values pointing at `*.vercel.app` are ignored so the spare cannot advertise itself.

Travelpayouts Drive is per-host. Cloudflare / workers.dev loads `https://emrldtp.cc/NTY3NzUw.js?t=567750`. Vercel spare (`*.vercel.app` or `VERCEL=1`) keeps `https://emrldtp.cc/NTUwMzEz.js?t=550313`. Override with server env `TRAVELOS_TRAVELPAYOUTS_DRIVE_SRC` (`567750` or `550313`). Not `NEXT_PUBLIC_*`. No Vercel dashboard change is required.

Vercel `https://travelos2-63r3.vercel.app` stays a cold spare. `pnpm run build` and the GitHub → Vercel integration are unchanged. Do not delete Vercel config. Do not set a Vercel dashboard env for the public origin.

No custom domain is configured in this repo (`wrangler.jsonc` has no `routes`). Cutting storefront primary does **not** require DNS. Attach a custom hostname later only if Owner wants an apex/subdomain in front of Workers.
