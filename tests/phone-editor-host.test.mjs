import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";

const root = resolve(import.meta.dirname, "..");

async function readSource(path) {
  return readFile(resolve(root, path), "utf8");
}

test("family PWA and editor stay on Cloudflare workers.dev, not Vercel seed", async () => {
  const [manifest, talk, middleware, layout, host, admin, store, contentApi, family] = await Promise.all([
    readSource("app/manifest.ts"),
    readSource("public/family/talk/manifest.webmanifest"),
    readSource("middleware.ts"),
    readSource("app/layout.tsx"),
    readSource("components/canonical-host.tsx"),
    readSource("app/trips/admin/page.tsx"),
    readSource("lib/editable-store.ts"),
    readSource("app/api/trips/content/route.ts"),
    readSource("app/family/page.tsx"),
  ]);

  assert.match(manifest, /start_url: `\$\{origin\}\/family`/);
  assert.match(manifest, /id: `\$\{origin\}\/`/);
  assert.match(manifest, /scope: `\$\{origin\}\/`/);
  assert.match(manifest, /DEFAULT_PUBLIC_SITE_ORIGIN/);
  assert.doesNotMatch(manifest, /start_url: "\/family"/);

  const talkManifest = JSON.parse(talk);
  assert.equal(talkManifest.start_url, "https://travelos2.chao-jason.workers.dev/family/talk");
  assert.equal(talkManifest.id, "https://travelos2.chao-jason.workers.dev/family/talk");
  assert.equal(talkManifest.scope, "https://travelos2.chao-jason.workers.dev/family/talk");

  assert.match(middleware, /isSpareVercelHost/);
  assert.match(middleware, /NextResponse\.redirect/);
  assert.match(middleware, /308/);

  assert.match(layout, /CanonicalHost/);
  assert.doesNotMatch(layout, /serviceWorker/);
  assert.match(host, /window\.location\.replace/);
  assert.match(host, /isSpareVercelHost/);
  assert.match(admin, /isSpareVercelHost\(window\.location\.host\)/);
  assert.match(admin, /canonicalSiteUrl/);
  assert.match(admin, /formatEditorTripPickerLabel\(trip\.title, trip\.startDate\)/);
  assert.doesNotMatch(admin, /\{trip\.title\}｜\{toDateInput\(trip\.startDate\)\}/);

  assert.match(store, /withMissingSeedTrips\(saved\)/);
  assert.doesNotMatch(store, /seedTripDetails\.filter\(trip => !savedIds\.has\(trip\.id\)\)/);
  assert.match(contentApi, /private, no-store, no-cache, must-revalidate/);
  assert.match(contentApi, /writeDriveTrip\(updatedTrip\)/);
  assert.doesNotMatch(contentApi, /content: fresh/);
  assert.match(family, /travelos2\.chao-jason\.workers\.dev/);
  assert.match(family, /editHref: "\/trips\/admin"/);
});
