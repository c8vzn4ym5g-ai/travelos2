import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";

const root = resolve(import.meta.dirname, "..");

async function readSource(path) {
  return readFile(resolve(root, path), "utf8");
}

test("family workshop wraps a family surface and does not restyle public Lapland", async () => {
  const [layout, familyCss, rootLayout, manifest, familyHome, capture, bench, trip, talk, lapland, home, globals] = await Promise.all([
    readSource("app/family/layout.tsx"),
    readSource("app/family/family.css"),
    readSource("app/layout.tsx"),
    readSource("app/manifest.ts"),
    readSource("app/family/page.tsx"),
    readSource("app/family/capture/page.tsx"),
    readSource("app/family/bench/page.tsx"),
    readSource("app/family/trip/page.tsx"),
    readSource("app/family/talk/page.tsx"),
    readSource("app/trips/[slug]/page.tsx"),
    readSource("app/page.tsx"),
    readSource("app/globals.css"),
  ]);

  assert.match(layout, /data-surface="family"/);
  assert.match(layout, /family-workshop/);
  assert.match(layout, /M_PLUS_Rounded_1c/);
  assert.match(layout, /Nunito/);
  assert.match(layout, /Caveat/);
  assert.match(layout, /themeColor: "#F0F6E4"/);
  assert.match(familyCss, /--fam-paper: #f0f6e4/);
  assert.match(familyCss, /--fam-blush: #6eaa5a/);
  assert.match(familyCss, /--fam-honey: #f0b429/);
  assert.doesNotMatch(familyCss, /--fam-paper: #fff4ec/);
  assert.doesNotMatch(familyCss, /--fam-blush: #f57c93/);
  assert.doesNotMatch(layout, /themeColor: "#FFF4EC"/);
  assert.match(rootLayout, /themeColor: "#0f766e"/);
  assert.match(manifest, /theme_color: "#0f766e"/);
  assert.doesNotMatch(familyHome, /travel-display/);
  assert.doesNotMatch(capture, /travel-display/);
  assert.doesNotMatch(bench, /travel-display/);
  assert.doesNotMatch(trip, /travel-display/);
  assert.doesNotMatch(talk, /travel-display/);
  assert.match(talk, /我說中文/);
  assert.match(home, /travel-display/);
  assert.match(globals, /\.travel-display \{/);
  assert.match(globals, /font-family: Georgia/);
  assert.doesNotMatch(lapland, /data-surface="family"/);
  assert.doesNotMatch(lapland, /family-workshop/);
  assert.doesNotMatch(familyHome, /bg-emerald-800/);
  assert.match(capture, /startBackgroundPhotoUpload\(photo\)/);
  assert.doesNotMatch(capture, /createWorkQueue/);
  assert.match(capture, /剛拍的會出現在這裡。/);
  assert.doesNotMatch(capture, /fam-empty-take/);
  assert.doesNotMatch(familyCss, /fam-empty-take/);
  assert.match(familyHome, />行程</);
  assert.match(familyHome, /href="\/family\/trip"/);
  assert.match(familyHome, />說說</);
  assert.match(familyHome, /href="\/family\/talk"/);
  assert.match(familyCss, /\.fam-back:active/);
  assert.match(trip, />總表</);
  assert.match(trip, />表1</);
  assert.match(capture, /FamilyBackLink/);
  assert.match(bench, /FamilyBackLink/);
  assert.match(trip, /FamilyBackLink/);
});
