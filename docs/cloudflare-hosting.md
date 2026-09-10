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
It must list folder files (`op=list`), return a single moment item
(`GET op=item&name=`), return Drive thumbnails (`op=thumb`),
merge `photos[]` under LockService on index/item writes, and keep binaries
named `travelos__moments__photos__*`. Index POST is merge-on-write: a patch
with only `{ moments: [oneMoment] }` (no `jobs`) updates that moment without
the Worker downloading `moments.json`. Deploy a new version of the existing
web app (do not change the `/exec` URL). Capture photo appends write the
item shard only; they must not `op=list` or GET the fat index. Bench still
serves a JPEG thumb from EXIF if `op=thumb` is not deployed yet. If GET
`op=item` is not deployed yet, the Worker falls back to Drive API by filename.

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

### R2 `travelos-media` (finished shorts)

Family trip shelves stay on Drive (`travelos__trip__*.json` in folder `1Sk2TqgpF6NxoNYdUKO4h8t84UA7KxChN`). GET/PUT `/api/trips/content` does not use R2.

`wrangler.jsonc` binds the bucket:

```jsonc
"r2_buckets": [
  { "binding": "TRAVELOS_MEDIA", "bucket_name": "travelos-media" }
]
```

CI runs `node scripts/ensure-r2-media-bucket.mjs` before Wrangler deploy. That script lists R2 and creates `travelos-media` when missing.

**Owner click if GitHub Action fails on R2 401/403** (token `travelos2-deploy` is Workers Scripts Edit only):

1. Cloudflare Dashboard → **R2 Object Storage** → **Create bucket**.
2. Name: `travelos-media` → **Create bucket**.
3. Optional: add **Account → Cloudflare R2 → Edit** on token `travelos2-deploy` so CI can create buckets later.
4. Optional public `r2.dev`: bucket → **Settings** → **Public access** → **Allow Access**. Not required. The Worker serves objects at `GET /api/media?key=`.

Server helper: `lib/r2-media.ts` (`putTravelosMediaObject` / `getTravelosMediaObject`). Public URL is the Worker URL, not a signed S3 URL:

`https://travelos2.chao-jason.workers.dev/api/media?key=probe%2Fok.txt`

Probe (tiny write + read, does not touch trip JSON):

```bash
curl -X PUT "https://travelos2.chao-jason.workers.dev/api/media?probe=1"
curl "https://travelos2.chao-jason.workers.dev/api/media?key=probe%2Fok.txt"
```

A missing bucket still fails OpenNext/Wrangler deploy. Do not comment the binding back out unless Owner wants to skip R2 entirely.

## Drive trip shelves (not Vercel Blob)

Live CF must **not** set `BLOB_READ_WRITE_TOKEN`. Trip JSON is per-file in the Drive warehouse.

After a batch of PUTs, Apps Script `op=item` wrapped some trip files as `{ moment: <trip>, updatedAt }`. The Worker now unwraps that shape. New writes use `POST op=trip` (raw JSON) when the pasted Apps Script is current, and otherwise Drive API media PATCH.

Paste `scripts/drive-warehouse-apps-script.js` into the existing web app (same `/exec` URL) so these trip ops are live:

- `GET op=trips` — search `travelos__trip__*.json`, unwrap `{moment}`, return `{ trips: [{ name, modifiedTime, trip }] }`
- `POST op=trip` — write raw trip JSON (`upsertNamed_`). Never `op=item` for trips.
- `GET op=item&name=` — still required for Capture shards

Until that paste, the Worker falls back to `op=drive-access` + Drive API. Access tokens are cached ~45 minutes on the isolate.

Maple journal titles follow the PUT body (Traditional Chinese). Do not force `嵐山翠嵐：溫泉飯店裡的楓葉禁區` or `京都四人怎麼一起玩開心`. Series `愛慕虛榮團` stays on `series`. Kyushu `trip_kyushu_family_2026` locked journals (`大分 奧日田 梅響 溫泉酒店`, `小國町附近：竹庵的驚人份量`) are not rewritten on read.

Family PIN stays off unless `TRAVELOS_REQUIRE_FAMILY_PIN=1` is set. Do not set that on Cloudflare until Owner asks.

Trip/coffee **admin photo upload** routes still import `@vercel/blob`. Without `BLOB_READ_WRITE_TOKEN` they are not the Capture path; public Lapland reads seed + `/public/travelos/`. Those Blob admin routes are leftover from Vercel and are not required for family Capture on Workers.

## Cutover

Primary public origin is `https://travelos2.chao-jason.workers.dev` (`wrangler.jsonc` `workers_dev: true`). Storefront `metadataBase`, sitemap, robots, JSON-LD, and share links use `lib/site-url.ts`: `SITE_URL` / `NEXT_PUBLIC_SITE_URL` if set to a non-`*.vercel.app` origin, otherwise Cloudflare workers.dev. Leftover Vercel dashboard `SITE_URL` values pointing at `*.vercel.app` are ignored so the spare cannot advertise itself.

Travelpayouts Drive is per-host. Cloudflare / workers.dev loads `https://emrldtp.cc/NTY3NzUw.js?t=567750`. Vercel spare (`*.vercel.app` or `VERCEL=1`) keeps `https://emrldtp.cc/NTUwMzEz.js?t=550313`. Override with server env `TRAVELOS_TRAVELPAYOUTS_DRIVE_SRC` (`567750` or `550313`). Not `NEXT_PUBLIC_*`. No Vercel dashboard change is required.

Vercel `https://travelos2-63r3.vercel.app` stays a cold spare. `pnpm run build` and the GitHub → Vercel integration are unchanged. Do not delete Vercel config. Do not set a Vercel dashboard env for the public origin.

No custom domain is configured in this repo (`wrangler.jsonc` has no `routes`). Cutting storefront primary does **not** require DNS. Attach a custom hostname later only if Owner wants an apex/subdomain in front of Workers.
