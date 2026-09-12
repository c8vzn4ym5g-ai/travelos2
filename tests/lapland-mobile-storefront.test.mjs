import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";
import { isLaplandPhoneUserAgent, LAPLAND_MOBILE_MAX_WIDTH_PX } from "../lib/lapland-mobile.ts";

const root = resolve(import.meta.dirname, "..");

async function readSource(relativePath) {
  return readFile(resolve(root, relativePath), "utf8");
}

test("phone UA is iPhone/Android phones, not iPad or desktop", () => {
  assert.equal(isLaplandPhoneUserAgent("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1"), true);
  assert.equal(isLaplandPhoneUserAgent("Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36"), true);
  assert.equal(isLaplandPhoneUserAgent("Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1"), false);
  assert.equal(isLaplandPhoneUserAgent("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"), false);
  assert.equal(LAPLAND_MOBILE_MAX_WIDTH_PX, 639);
});

test("same Lapland URL keeps notebook layout in source and switches to a dedicated mobile film cut", async () => {
  const [page, gate, mobile, cut, notebook] = await Promise.all([
    readSource("app/trips/[slug]/page.tsx"),
    readSource("components/lapland-storefront-gate.tsx"),
    readSource("components/lapland-mobile-storefront.tsx"),
    readSource("components/lapland-public-cut.tsx"),
    readSource("app/trips/[slug]/page.tsx"),
  ]);

  assert.match(page, /LaplandStorefrontGate/);
  assert.match(page, /isLaplandPhoneUserAgent/);
  assert.match(gate, /data-lapland-mobile-storefront|LaplandMobileStorefront/);
  assert.match(gate, /max-width: \$\{LAPLAND_MOBILE_MAX_WIDTH_PX\}px/);
  assert.match(mobile, /StorefrontHomeLink/);
  assert.match(mobile, /data-lapland-mobile-storefront=""/);
  assert.match(mobile, /data-lapland-mobile-hero=""/);
  assert.doesNotMatch(mobile, /data-lapland-mobile-still|LaplandVisualPath/, "phone does not repeat the hero or eagerly dump the full visual-path album");
  assert.match(mobile, /bottom-\[72px\]/, "title and date leave a native video control lane");
  assert.match(mobile, /<LaplandPublicCut bleed phoneFold/);
  assert.match(mobile, /line-clamp-2/);
  assert.match(mobile, /text-lg font-semibold/);
  assert.match(mobile, /data-lapland-mobile-album=""/);
  assert.match(mobile, /<LaplandMoreCut>/);
  assert.ok(mobile.indexOf("data-lapland-mobile-hero") < mobile.indexOf('aria-label="旅程故事"'), "film leads directly into the story");
  assert.match(mobile, /<ReaderAlbum photos=\{albumPhotos\}/, "all original media remain available in the optional album");
  assert.ok(mobile.indexOf("data-lapland-mobile-album") < mobile.indexOf("<LaplandMoreCut>"), "album sits before more");
  assert.ok(mobile.indexOf("<LaplandMoreCut>") < mobile.indexOf("Trip memory"), "overview sits behind more");
  assert.ok(mobile.indexOf('aria-label="旅程故事"') < mobile.indexOf("data-lapland-mobile-album"), "complete interleaved story precedes optional album");
  assert.ok(mobile.indexOf("<LaplandMoreCut>") < mobile.indexOf("<LaplandStorefrontGlance"), "why-go essay sits behind more");
  assert.doesNotMatch(mobile, /Coordinates|Journal entries|Saved places/);
  assert.match(cut, /bleed = false/);
  assert.match(cut, /phoneFold = false/);
  assert.match(cut, /h-\[70vh\]/);
  assert.match(cut, /data-lapland-cut-bleed=\{bleed \? "" : undefined\}/);
  assert.match(cut, /object-cover/);
  assert.doesNotMatch(cut, /controls=\{false\}/);
  assert.match(cut, /^\s+controls\s*$/m, "both phone and desktop retain native pause and seek controls");
  assert.doesNotMatch(cut, /absolute inset-0 z-10/, "sound cue cannot intercept taps across the whole video");
  assert.match(page, /<LaplandPublicCut \/>/);
  assert.doesNotMatch(page, /phoneFold/);

  const hero = notebook.slice(notebook.indexOf("travel-hero"), notebook.indexOf("Trip memory"));
  assert.ok(hero.indexOf("<h1") < hero.indexOf("LaplandPublicCut"), "notebook title then public cut stays frozen");
  assert.ok(hero.indexOf("LaplandPublicCut") < hero.indexOf("LaplandCutStill"), "notebook still follows the public cut");
  assert.ok(hero.indexOf("LaplandCutStill") < hero.indexOf("LaplandMoreCut"), "notebook extras stay behind more");
  assert.match(hero, /text-4xl font-semibold leading-tight sm:text-6xl/);
});
