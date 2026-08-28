import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";
import {
  forLaplandPublicPage,
  isLaplandStayJournal,
  isLaplandPeerLandmarkName,
  isLaplandStorefrontSlug,
  laplandPublicStops,
  storefrontMetaDescription,
  LAPLAND_HOOK_EN,
  LAPLAND_HOOK_ZH,
  LAPLAND_STOREFRONT_EN,
  LAPLAND_STOREFRONT_KICKER,
  LAPLAND_STOREFRONT_TITLE,
  LAPLAND_STOREFRONT_ZH,
  LAPLAND_VISUAL_PATH,
  storefrontCopyLooksInvented,
} from "../lib/lapland-storefront-copy.ts";
import { seedTripDetails, LAPLAND_WINTER_VILLAGE_CAPTION } from "../lib/trips.ts";
import { LAPLAND_TRIP_SLUG } from "../lib/travelpayouts.ts";

const root = resolve(import.meta.dirname, "..");

test("Lapland storefront glance is independent cash-path copy under the map, after the public cut", async () => {
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
  assert.match(page, /<LaplandStorefrontGlance/);
  assert.match(page, /data-storefront-glance|LaplandStorefrontGlance/);
  assert.match(glance, /data-storefront-glance=""/);
  assert.match(glance, /id="why-go"/);
  assert.match(glance, /LAPLAND_STOREFRONT_KICKER/);
  assert.match(glance, /LAPLAND_STOREFRONT_TITLE/);
  assert.match(glance, /LAPLAND_STOREFRONT_ZH/);
  assert.match(glance, /LAPLAND_STOREFRONT_EN/);
  assert.doesNotMatch(glance, /widgetId|emrldtp|BookingBand|Unlock editor|Edit trip/);

  const hero = page.slice(page.indexOf("travel-hero"), page.indexOf("Trip memory"));
  assert.ok(hero.indexOf("<h1") < hero.indexOf("LaplandPublicCut"), "title then public cut");
  assert.ok(hero.indexOf("LaplandPublicCut") < hero.indexOf("LaplandCutStill"), "one still follows the public cut");
  assert.ok(hero.indexOf("LaplandCutStill") < hero.indexOf("LaplandMoreCut"), "extras sit behind the more tap");
  assert.ok(hero.indexOf("LaplandMoreCut") < hero.indexOf("<JourneyMap"), "frozen poster sits behind the tap");
  assert.ok(hero.indexOf("LaplandPublicCut") < hero.indexOf("LaplandStorefrontGlance"), "video sits before the why-go essay");
  assert.ok(hero.indexOf("LaplandPublicCut") < hero.indexOf("LaplandVisualPath"), "video sits before the visual path");
  assert.ok(hero.indexOf("<JourneyMap") < hero.indexOf("LaplandStorefrontGlance"), "glance sits under the map");
  assert.ok(hero.indexOf("LaplandStorefrontGlance") < hero.indexOf("LaplandVisualPath"), "visual path sits under why-go");
  assert.ok(hero.indexOf("LaplandVisualPath") < hero.indexOf("JournalCostChip"), "visual path is before the cost chip");
  assert.ok(hero.indexOf("LaplandStorefrontGlance") < hero.indexOf("featurePhotos"), "glance is before the photo strip");
  assert.ok(hero.indexOf("<h1") < hero.indexOf("<JourneyMap"), "map still follows the title");
  assert.doesNotMatch(hero, /BookingBand/);
  assert.ok(page.indexOf("Trip memory") < page.indexOf("<BookingBand"), "booking stays with go-there");

  assert.doesNotMatch(familyHome, /LaplandStorefrontGlance|lapland-storefront-copy|LaplandPublicCut|LaplandCutStill|LaplandMoreCut/);
  assert.doesNotMatch(capture, /LaplandStorefrontGlance|lapland-storefront-copy|data-storefront-glance|LaplandPublicCut|data-lapland-more|data-lapland-cut-still/);
  const copy = await readFile(resolve(root, "lib/lapland-storefront-copy.ts"), "utf8");
  assert.match(seed, /聖誕窗 \/ Christmas window/);
  assert.match(seed, /北極圈 \/ Arctic Circle/);
  assert.match(seed, /人已經在雪裡/);
  assert.match(copy, /Finnair，是離開，不是抵達/);
  assert.doesNotMatch(seed, /雪天使|snow-angel|離開羅瓦涅米 \/ Leaving Rovaniemi|Moomin/);
  assert.equal(LAPLAND_WINTER_VILLAGE_CAPTION, "記憶裡的聖誕卡 / A Christmas card from memory");
  assert.match(seed, /LAPLAND_WINTER_VILLAGE_CAPTION/);
  assert.doesNotMatch(seed, /北極圈上的冬日小鎮，然後是城市/);
  assert.doesNotMatch(seed, /A winter town on the Arctic Circle, then a city/);
});

test("storefront wording names place, season, and feel without invented proof", () => {
  assert.equal(LAPLAND_STOREFRONT_KICKER, "為何去 / Why go");
  assert.equal(LAPLAND_STOREFRONT_TITLE, "北極圈是一條可以走過去的線 / A line you can walk across");
  assert.match(LAPLAND_STOREFRONT_ZH, /你要去的不是極夜/);
  assert.match(LAPLAND_STOREFRONT_ZH, /十二月/);
  assert.match(LAPLAND_STOREFRONT_ZH, /聖誕老人村|主郵局|聖誕箱/);
  assert.match(LAPLAND_STOREFRONT_ZH, /北極圈/);
  assert.match(LAPLAND_STOREFRONT_ZH, /往南，城市解凍/);
  assert.match(LAPLAND_STOREFRONT_EN, /You are not going for polar night/);
  assert.match(LAPLAND_STOREFRONT_EN, /December/);
  assert.match(LAPLAND_STOREFRONT_EN, /Santa Claus|Main Post Office|Christmas box/);
  assert.match(LAPLAND_STOREFRONT_EN, /Arctic Circle/);
  assert.match(LAPLAND_STOREFRONT_EN, /the city thaws/);
  assert.match(LAPLAND_STOREFRONT_ZH, /白晝還在，只是只剩兩三小時|只剩兩三小時/);
  assert.match(LAPLAND_STOREFRONT_EN, /two or three hours/);
  assert.match(LAPLAND_STOREFRONT_ZH, /走過去，就是北極圈/);
  assert.match(LAPLAND_STOREFRONT_EN, /Walk across/);
  assert.match(LAPLAND_STOREFRONT_ZH, /港口還在/);
  assert.match(LAPLAND_STOREFRONT_EN, /harbour still there/);
  assert.match(LAPLAND_HOOK_ZH, /赫爾辛基/);
  assert.match(LAPLAND_HOOK_EN, /Helsinki/);
  assert.doesNotMatch(LAPLAND_STOREFRONT_ZH, /一月/);
  assert.doesNotMatch(LAPLAND_STOREFRONT_EN, /January/);

  const copy = `${LAPLAND_STOREFRONT_KICKER} ${LAPLAND_STOREFRONT_TITLE} ${LAPLAND_STOREFRONT_ZH} ${LAPLAND_STOREFRONT_EN}`;
  assert.equal(storefrontCopyLooksInvented(copy), false);
  assert.doesNotMatch(copy, /記憶裡的聖誕卡/);
  assert.doesNotMatch(copy, /A Christmas card from memory/);
  assert.doesNotMatch(copy, /1 月 18 日抵羅瓦涅米/);
  assert.doesNotMatch(copy, /We reached Rovaniemi on 18 January/);
  assert.doesNotMatch(copy, /2020 年 1 月/);
  assert.doesNotMatch(copy, /January 2020/);
  assert.doesNotMatch(copy, /記錄聖誕老人村/);
  assert.doesNotMatch(copy, /€4,280|HK\$6,600|widgetId/);
  assert.doesNotMatch(copy, /2019/);
  assert.doesNotMatch(copy, /12 月 11/);
  assert.doesNotMatch(copy, /11 December/);
});

test("family workshop pages stay free of storefront glance and booking widgets", async () => {
  const familyFiles = [
    "app/family/page.tsx",
    "app/family/family-unlock-panel.tsx",
    "app/family/capture/page.tsx",
    "app/family/bench/page.tsx",
    "app/family/trip/page.tsx",
    "app/trips/write/page.tsx",
    "app/trips/admin/page.tsx",
    "app/trips/new/page.tsx",
  ];
  const pages = await Promise.all(familyFiles.map((path) => readFile(resolve(root, path), "utf8")));

  for (const html of pages) {
    assert.doesNotMatch(html, /LaplandStorefrontGlance/);
    assert.doesNotMatch(html, /data-storefront-glance/);
    assert.doesNotMatch(html, /lapland-storefront-copy/);
    assert.doesNotMatch(html, /LaplandVisualPath/);
    assert.doesNotMatch(html, /data-visual-path/);
    assert.doesNotMatch(html, /LaplandPlaceKnowledge/);
    assert.doesNotMatch(html, /LaplandPublicCut/);
    assert.doesNotMatch(html, /data-lapland-public-cut/);
    assert.doesNotMatch(html, /LaplandCutStill/);
    assert.doesNotMatch(html, /data-lapland-cut-still/);
    assert.doesNotMatch(html, /LaplandMoreCut/);
    assert.doesNotMatch(html, /data-lapland-more/);
    assert.doesNotMatch(html, /BookingBand/);
    assert.doesNotMatch(html, /emrldtp\.cc/);
  }
});

test("public Lapland view strips exact dump dates from the page payload", () => {
  const lapland = seedTripDetails.find((trip) => trip.id === "trip_lapland_2020");
  assert.ok(lapland);
  const publicTrip = forLaplandPublicPage(lapland);
  const payload = JSON.stringify(publicTrip);

  assert.equal(publicTrip.startDate, "2019");
  assert.ok(publicTrip.photos.every((photo) => photo.takenAt === null));
  assert.ok(publicTrip.journalEntries.every((entry) => entry.entryDate === ""));
  assert.ok(publicTrip.costs.every((cost) => cost.paidAt === "2019"));
  assert.doesNotMatch(payload, /2019-12-1[0-5]/);
  assert.doesNotMatch(payload, /12\/11/);
});

test("public Lapland rail lists landmarks, not the village cabin as a peer stop", async () => {
  const lapland = seedTripDetails.find((trip) => trip.id === "trip_lapland_2020");
  assert.ok(lapland);
  const stops = laplandPublicStops(lapland.places);
  const names = stops.map((stop) => stop.name).join(" | ");
  const [page, travelpayouts] = await Promise.all([
    readFile(resolve(root, "app/trips/[slug]/page.tsx"), "utf8"),
    readFile(resolve(root, "lib/travelpayouts.ts"), "utf8"),
  ]);

  assert.equal(stops.length, 5);
  assert.match(names, /Santa Claus Village/);
  assert.match(names, /Arctic Circle/);
  assert.match(names, /Main Post Office/);
  assert.match(names, /Helsinki Cathedral/);
  assert.match(names, /South Harbour/);
  assert.doesNotMatch(names, /Red cabin|4 號紅木屋|Sled route|Airport|Unrated/i);
  assert.equal(
    stops.some((stop) => isLaplandPeerLandmarkName(stop.name)),
    true,
  );
  assert.equal(isLaplandStayJournal({ id: "journal_lapland_cabin", title: "4 號紅木屋 / Red cabin no. 4" }), true);
  assert.equal(isLaplandStayJournal({ id: "journal_lapland_arctic", title: "北極圈 / Arctic Circle" }), false);
  assert.ok(!lapland.places.some((place) => place.id === "place_lapland_cabin" || place.name === "Red cabin no. 4"));
  assert.ok(!lapland.places.some((place) => place.name === "Sled route"));
  assert.ok(lapland.places.some((place) => place.id === "place_lapland_rovaniemi"));
  assert.ok(lapland.journalEntries.some((entry) => entry.id === "journal_lapland_cabin"));
  assert.ok(lapland.journalEntries.some((entry) => entry.id === "journal_lapland_christmas_window"));
  assert.ok(!lapland.journalEntries.some((entry) => entry.id === "journal_lapland_leaving"));

  assert.match(page, /laplandPublicStops/);
  assert.match(page, /isLaplandStayJournal/);
  assert.match(page, /pageMoments/);
  assert.doesNotMatch(page, /Unrated/);
  assert.match(page, /getLaplandBooking\(\)/);
  assert.doesNotMatch(travelpayouts, /2027-01-18/);
  assert.doesNotMatch(travelpayouts, /2027-01-25/);
  assert.doesNotMatch(travelpayouts, /2019-12-11/);
});

test("Lapland public meta keeps Helsinki and 店面文案 paste fixes stay local", async () => {
  const lapland = seedTripDetails.find((trip) => trip.id === "trip_lapland_2020");
  assert.ok(lapland);
  const [page, seed, copy] = await Promise.all([
    readFile(resolve(root, "app/trips/[slug]/page.tsx"), "utf8"),
    readFile(resolve(root, "lib/trips.ts"), "utf8"),
    readFile(resolve(root, "lib/lapland-storefront-copy.ts"), "utf8"),
  ]);
  const publicText = `${seed}\n${copy}`;
  const cover = lapland.photos.find((photo) => photo.id === "photo_lapland_still_cover");
  const firstBeat = LAPLAND_VISUAL_PATH[0];
  const meta = storefrontMetaDescription(lapland.summary, lapland.slug);

  assert.match(page, /storefrontMetaDescription/);
  assert.match(page, /twitter:\s*\{/);
  assert.doesNotMatch(page, /trip\.summary\.slice\(0,\s*155\)/);
  assert.match(meta, /Helsinki/);
  assert.match(meta, /赫爾辛基/);
  assert.match(meta, /Then south, to Helsinki\./);
  assert.doesNotMatch(meta, /Then south, to$/);
  assert.equal(meta.endsWith("Helsinki."), true);
  assert.match(LAPLAND_HOOK_EN, /Helsinki/);
  assert.equal(meta.length > 155, true);

  assert.equal(firstBeat.zh, "紅柱 ARCTIC CIRCLE，後是尖頂 Santa Claus Office 與暮光聖誕燈。");
  assert.equal(firstBeat.en, "Red Arctic Circle pillars and the conical roof of Santa Claus Office.");
  assert.doesNotMatch(firstBeat.zh, /人已入鏡/);
  assert.doesNotMatch(firstBeat.en, /person is already in the frame/i);
  assert.match(firstBeat.en, /Santa Claus Office/);

  assert.ok(cover);
  assert.equal(cover.caption, "北極圈紅柱與聖誕老人村尖頂。 / Arctic Circle pillars and Santa Claus Office.");
  assert.match(cover.caption, /Santa Claus Office/);
  assert.doesNotMatch(cover.caption, /Santa Claus Village/);

  assert.doesNotMatch(publicText, /藍調/);
  assert.match(seed, /外面是藍時/);
  assert.match(copy, /外面是藍時/);
  assert.doesNotMatch(publicText, /聖誕老人公會堂/);
  assert.match(seed, /聖誕老人辦公室/);
  assert.match(copy, /聖誕老人辦公室/);
  assert.doesNotMatch(publicText, /Toffle 的杯托/);
  assert.match(seed, /Toffle 的杯子/);
  assert.doesNotMatch(publicText, /排子裡的窗/);
  assert.match(seed, /巷子裡的窗/);
});
