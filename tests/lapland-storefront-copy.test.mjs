import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";
import {
  LAPLAND_STOREFRONT_EN,
  LAPLAND_STOREFRONT_KICKER,
  LAPLAND_STOREFRONT_TITLE,
  LAPLAND_STOREFRONT_ZH,
  isLaplandStorefrontSlug,
  storefrontCopyLooksInvented,
} from "../lib/lapland-storefront-copy.ts";
import { LAPLAND_WINTER_VILLAGE_CAPTION } from "../lib/trips.ts";
import { LAPLAND_TRIP_SLUG } from "../lib/travelpayouts.ts";

const root = resolve(import.meta.dirname, "..");

test("Lapland storefront glance is independent cash-path copy under the map", async () => {
  const [page, glance, seed, familyHome, capture] = await Promise.all([
    readFile(resolve(root, "app/trips/[slug]/page.tsx"), "utf8"),
    readFile(resolve(root, "components/lapland-storefront-glance.tsx"), "utf8"),
    readFile(resolve(root, "lib/trips.ts"), "utf8"),
    readFile(resolve(root, "app/family/page.tsx"), "utf8"),
    readFile(resolve(root, "app/family/capture/page.tsx"), "utf8"),
  ]);

  assert.equal(isLaplandStorefrontSlug(LAPLAND_TRIP_SLUG), true);
  assert.equal(isLaplandStorefrontSlug("bangkok-table-notes"), false);
  assert.match(page, /<JourneyMap/);
  assert.match(page, /isLaplandStorefrontSlug\(trip\.slug\) \? <LaplandStorefrontGlance/);
  assert.match(page, /data-storefront-glance|LaplandStorefrontGlance/);
  assert.match(glance, /data-storefront-glance=""/);
  assert.match(glance, /LAPLAND_STOREFRONT_KICKER/);
  assert.match(glance, /LAPLAND_STOREFRONT_TITLE/);
  assert.match(glance, /LAPLAND_STOREFRONT_ZH/);
  assert.match(glance, /LAPLAND_STOREFRONT_EN/);
  assert.doesNotMatch(glance, /widgetId|emrldtp|BookingBand|Unlock editor|Edit trip/);

  const hero = page.slice(page.indexOf("travel-hero"), page.indexOf("Trip memory"));
  assert.ok(hero.indexOf("<JourneyMap") < hero.indexOf("LaplandStorefrontGlance"), "glance sits under the map");
  assert.ok(hero.indexOf("LaplandStorefrontGlance") < hero.indexOf("JournalCostChip"), "glance is before the cost chip");
  assert.ok(hero.indexOf("LaplandStorefrontGlance") < hero.indexOf("featurePhotos"), "glance is before the photo strip");
  assert.ok(hero.indexOf("<h1") < hero.indexOf("<JourneyMap"), "map still follows the title");

  assert.doesNotMatch(familyHome, /LaplandStorefrontGlance|lapland-storefront-copy/);
  assert.doesNotMatch(capture, /LaplandStorefrontGlance|lapland-storefront-copy|data-storefront-glance/);
  assert.match(seed, /抵達北極圈 \/ Arrival at the Arctic Circle/);
  assert.match(seed, /入夜後燈光亮起：木屋、雪徑與櫥窗/);
  assert.match(seed, /1 月 22 日晚，雪地上的一簇火/);
  assert.equal(LAPLAND_WINTER_VILLAGE_CAPTION, "記憶裡的聖誕卡 / A Christmas card from memory");
  assert.match(seed, /LAPLAND_WINTER_VILLAGE_CAPTION/);
  assert.doesNotMatch(seed, /北極圈上的冬日小鎮/);
  assert.doesNotMatch(seed, /A winter town on the Arctic Circle/);
});

test("storefront wording names place, season, and feel without invented proof", () => {
  assert.equal(LAPLAND_STOREFRONT_KICKER, "為何去 / Why go");
  assert.equal(LAPLAND_STOREFRONT_TITLE, "北極圈上的冬日小鎮 / A winter town on the Arctic Circle");
  assert.match(LAPLAND_STOREFRONT_ZH, /芬蘭拉普蘭/);
  assert.match(LAPLAND_STOREFRONT_ZH, /羅瓦涅米/);
  assert.match(LAPLAND_STOREFRONT_ZH, /一月/);
  assert.match(LAPLAND_STOREFRONT_ZH, /聖誕老人村/);
  assert.match(LAPLAND_STOREFRONT_ZH, /北極圈/);
  assert.match(LAPLAND_STOREFRONT_ZH, /香港/);
  assert.match(LAPLAND_STOREFRONT_ZH, /赫爾辛基/);
  assert.match(LAPLAND_STOREFRONT_EN, /Finnish Lapland/);
  assert.match(LAPLAND_STOREFRONT_EN, /Rovaniemi/);
  assert.match(LAPLAND_STOREFRONT_EN, /January/);
  assert.match(LAPLAND_STOREFRONT_EN, /Santa Claus Village/);
  assert.match(LAPLAND_STOREFRONT_EN, /Arctic Circle/);
  assert.match(LAPLAND_STOREFRONT_EN, /Hong Kong/);
  assert.match(LAPLAND_STOREFRONT_EN, /Helsinki/);
  assert.match(LAPLAND_STOREFRONT_ZH, /白天安靜，入夜亮燈/);
  assert.match(LAPLAND_STOREFRONT_EN, /quiet by day, lit after dark/);

  const copy = `${LAPLAND_STOREFRONT_KICKER} ${LAPLAND_STOREFRONT_TITLE} ${LAPLAND_STOREFRONT_ZH} ${LAPLAND_STOREFRONT_EN}`;
  assert.equal(storefrontCopyLooksInvented(copy), false);
  assert.doesNotMatch(copy, /記憶裡的聖誕卡/);
  assert.doesNotMatch(copy, /A Christmas card from memory/);
  assert.doesNotMatch(copy, /1 月 18 日抵羅瓦涅米/);
  assert.doesNotMatch(copy, /We reached Rovaniemi on 18 January/);
  assert.doesNotMatch(copy, /記錄聖誕老人村/);
  assert.doesNotMatch(copy, /€4,280|HK\$6,600|widgetId/);
  assert.doesNotMatch(copy, /Arrival above the Arctic Circle|restrained purity|warmth is not an abstract word/);
});

test("family workshop pages stay free of storefront glance and booking widgets", async () => {
  const familyFiles = [
    "app/family/page.tsx",
    "app/family/family-unlock-panel.tsx",
    "app/family/capture/page.tsx",
    "app/trips/write/page.tsx",
    "app/trips/admin/page.tsx",
    "app/trips/new/page.tsx",
  ];
  const pages = await Promise.all(familyFiles.map((path) => readFile(resolve(root, path), "utf8")));

  for (const html of pages) {
    assert.doesNotMatch(html, /LaplandStorefrontGlance/);
    assert.doesNotMatch(html, /data-storefront-glance/);
    assert.doesNotMatch(html, /lapland-storefront-copy/);
    assert.doesNotMatch(html, /BookingBand/);
    assert.doesNotMatch(html, /emrldtp\.cc/);
  }
});
