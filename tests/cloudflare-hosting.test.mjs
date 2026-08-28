import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";

const root = resolve(import.meta.dirname, "..");

async function readSource(path) {
  return readFile(resolve(root, path), "utf8");
}

test("Cloudflare OpenNext path exists and does not replace Vercel next build", async () => {
  const pkg = JSON.parse(await readSource("package.json"));
  assert.equal(pkg.scripts.build, "next build");
  assert.match(pkg.scripts["cf:build"], /opennextjs-cloudflare build/);
  assert.match(pkg.scripts["cf:preview"], /opennextjs-cloudflare preview/);
  assert.match(pkg.scripts["cf:deploy"], /opennextjs-cloudflare deploy/);
  assert.equal(typeof pkg.dependencies["@opennextjs/cloudflare"], "string");
  assert.equal(typeof pkg.devDependencies.wrangler, "string");

  const nextConfig = await readSource("next.config.ts");
  assert.doesNotMatch(nextConfig, /output:\s*['"]export['"]/);
  assert.match(nextConfig, /initOpenNextCloudflareForDev/);
  assert.match(nextConfig, /process\.env\.VERCEL/);
  assert.match(nextConfig, /NODE_ENV === "development"/);

  const wrangler = await readSource("wrangler.jsonc");
  assert.match(wrangler, /"nodejs_compat"/);
  assert.match(wrangler, /"global_fetch_strictly_public"/);
  assert.match(wrangler, /\.open-next\/worker\.js/);
  assert.match(wrangler, /\.open-next\/assets/);
  assert.doesNotMatch(wrangler, /BLOB_READ_WRITE_TOKEN/);
  assert.doesNotMatch(wrangler, /TRAVELOS_REQUIRE_FAMILY_PIN/);

  const openNext = await readSource("open-next.config.ts");
  assert.match(openNext, /defineCloudflareConfig/);
  assert.doesNotMatch(openNext, /r2IncrementalCache/);

  const workflow = await readSource(".github/workflows/cloudflare-deploy.yml");
  assert.match(workflow, /CLOUDFLARE_API_TOKEN/);
  assert.match(workflow, /CLOUDFLARE_ACCOUNT_ID/);
  assert.match(workflow, /pnpm run cf:build/);
  assert.match(workflow, /opennextjs-cloudflare deploy/);
  assert.doesNotMatch(workflow, /pnpm exec wrangler deploy/);
  assert.match(workflow, /scripts\/verify-cloudflare-creds\.mjs/);
  assert.match(workflow, /pnpm run build/);

  const docs = await readSource("docs/cloudflare-hosting.md");
  assert.match(docs, /32 hexadecimal/);
  assert.match(docs, /31c5f4dccc8eabb03968996576e8e1c4/);
  assert.doesNotMatch(docs, /31c5f4dccc8eabb039689996576e8e1c4/);
});

test("storefront canonical origin is Cloudflare workers.dev; Vercel remains a cold spare", async () => {
  const site = await readSource("lib/site-url.ts");
  assert.match(site, /export const PUBLIC_SITE_ORIGIN = "https:\/\/travelos2\.chao-jason\.workers\.dev"/);
  assert.match(site, /export const VERCEL_SPARE_ORIGIN = "https:\/\/travelos2-63r3\.vercel\.app"/);

  const storefrontFiles = [
    "app/layout.tsx",
    "app/sitemap.ts",
    "app/robots.ts",
    "app/trips/[slug]/page.tsx",
    "app/coffee/[slug]/page.tsx",
    "components/share-actions.tsx",
  ];

  for (const path of storefrontFiles) {
    const source = await readSource(path);
    assert.match(source, /PUBLIC_SITE_ORIGIN|publicSiteUrl/);
    assert.doesNotMatch(source, /travelos2-63r3\.vercel\.app/);
  }

  const pkg = JSON.parse(await readSource("package.json"));
  assert.equal(pkg.scripts.build, "next build");

  const wrangler = await readSource("wrangler.jsonc");
  assert.match(wrangler, /"workers_dev": true/);
  assert.doesNotMatch(wrangler, /"routes"/);

  const nextConfig = await readSource("next.config.ts");
  assert.match(nextConfig, /process\.env\.VERCEL/);
  assert.doesNotMatch(nextConfig, /output:\s*['"]export['"]/);

  const docs = await readSource("docs/cloudflare-hosting.md");
  assert.match(docs, /travelos2\.chao-jason\.workers\.dev/);
  assert.match(docs, /cold spare/);
  assert.match(docs, /NTY3NzUw\.js\?t=567750/);
  assert.match(docs, /NTUwMzEz\.js\?t=550313/);
});

test("Drive warehouse credentials stay server-only for the Cloudflare path", async () => {
  const drive = await readSource("lib/drive-warehouse.ts");
  assert.match(drive, /TRAVELOS_DRIVE_WAREHOUSE_URL/);
  assert.match(drive, /TRAVELOS_DRIVE_WAREHOUSE_TOKEN/);
  assert.match(drive, /process\.env\[name\]/);
  assert.doesNotMatch(drive, /NEXT_PUBLIC_/);
  assert.match(drive, /getDriveWarehouseUrl/);
  assert.match(drive, /getDriveWarehouseToken/);

  const nextConfig = await readSource("next.config.ts");
  assert.doesNotMatch(nextConfig, /TRAVELOS_DRIVE_WAREHOUSE_/);
});
