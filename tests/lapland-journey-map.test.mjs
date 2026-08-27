import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, stat } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";
import {
  buildJourneyItinerary,
  buildPosterLayout,
  getStopCardContent,
  LAPLAND_GLANCE_HOTSPOTS,
  LAPLAND_GLANCE_LABELS,
  LAPLAND_PATH_HEADING,
  LAPLAND_POSTER,
  LAPLAND_POSTER_GENERATOR_FILE,
  LAPLAND_POSTER_HEIGHT,
  LAPLAND_POSTER_LEGEND_RATIO,
  LAPLAND_POSTER_NOTES,
  LAPLAND_POSTER_TITLE,
  LAPLAND_POSTER_WIDTH,
  STREET_BASEMAP,
} from "../lib/journey-map-model.ts";
import { seedTripDetails } from "../lib/trips.ts";

const root = resolve(import.meta.dirname, "..");
const lapland = seedTripDetails.find((trip) => trip.id === "trip_lapland_2020");
const hongKong = { latitude: 22.308, longitude: 113.9185 };

test("JourneyMap hero is the generated itinerary poster, not a live tile collage", async () => {
  const [source, model, page, pkg] = await Promise.all([
    readFile(resolve(root, "components/journey-map.tsx"), "utf8"),
    readFile(resolve(root, "lib/journey-map-model.ts"), "utf8"),
    readFile(resolve(root, "app/trips/[slug]/page.tsx"), "utf8"),
    readFile(resolve(root, "package.json"), "utf8"),
  ]);

  assert.match(source, /data-map-frame="regional"/);
  assert.match(source, /data-map-poster-image/);
  assert.match(source, /LAPLAND_POSTER\.src/);
  assert.match(model, /\/travelos\/maps\/lapland-helsinki-poster\.jpg/);
  assert.doesNotMatch(model, /src: "\/travelos\/maps\/lapland-rovaniemi\.png"/);
  assert.match(source, /data-arrival-locator/);
  assert.match(source, /data-longhaul-label/);
  assert.match(source, /data-glance-labels/);
  assert.match(source, /data-hero-map/);
  assert.match(source, /data-stop-list/);
  assert.match(source, /data-map-legend/);
  assert.match(source, /min-h-11 min-w-11/);
  assert.match(source, /data-map-pin=\{pin\.number\}/);
  assert.match(source, /data-stop-card/);
  assert.match(source, /data-stop-title/);
  assert.match(source, /data-stop-wording/);
  assert.match(source, /data-glance-hotspot=\{spot\.id\}/);
  assert.match(source, /LAPLAND_GLANCE_HOTSPOTS/);
  assert.match(source, /LAPLAND_PATH_HEADING/);
  assert.doesNotMatch(source, /data-travelpayouts-drive|TravelpayoutsDrive|widgetId/);
  assert.doesNotMatch(source, /getMapTiles/);
  assert.doesNotMatch(source, /data-map-tile/);
  assert.doesNotMatch(source, /tile\.openstreetmap\.org/);
  assert.doesNotMatch(source, /basemaps\.cartocdn\.com/);
  assert.doesNotMatch(source, /maps\.googleapis|mt\d\.google|@googlemaps/);
  assert.doesNotMatch(model, /tile\.openstreetmap\.org/);
  assert.doesNotMatch(model, /maps\.googleapis|mt\d\.google|@googlemaps/);
  assert.doesNotMatch(pkg, /@googlemaps/);
  const layout = source.slice(source.indexOf("export function JourneyMap"));
  assert.match(layout, /<RegionalMap[\s\S]*data-stop-card/);
  assert.match(source, /data-map-legend/);
  assert.match(layout, /laplandPoster \? null/);
  assert.doesNotMatch(source, /data-map-scale=\{slice\.scale\}/);
  assert.doesNotMatch(source, /data-map-frame="overview"/);
  assert.doesNotMatch(source, /Writing guide/);
  assert.doesNotMatch(source, /Visitor scan/);
  assert.doesNotMatch(page, /Writing guide/);
  assert.doesNotMatch(page, /Visitor scan/);
  assert.match(page, /<JourneyMap/);
  const hero = page.slice(page.indexOf("travel-hero"), page.indexOf("Trip memory"));
  assert.ok(hero.indexOf("<h1") < hero.indexOf("<JourneyMap"), "map must follow the title");
  assert.ok(hero.indexOf("LaplandPublicCut") < hero.indexOf("<JourneyMap"), "frozen poster sits after the public cut");
  assert.ok(hero.indexOf("LaplandMoreCut") < hero.indexOf("<JourneyMap"), "frozen poster sits behind the more tap");
  assert.ok(hero.indexOf("<JourneyMap") < hero.indexOf("LaplandStorefrontGlance"), "storefront glance sits under the map");
  assert.ok(hero.indexOf("<JourneyMap") < hero.indexOf("featurePhotos"), "map must sit above the photo strip");
  assert.ok(hero.indexOf("<JourneyMap") < hero.indexOf("JournalCostChip"), "map sits above the cost footnote");
  assert.match(hero, /<JournalCostChip/);
  assert.doesNotMatch(hero, /JournalCostHeroNote/);
  assert.match(hero, /coverPhoto\.caption/);
});

test("long-haul is a quiet label, not an equal-size second map", async () => {
  const source = await readFile(resolve(root, "components/journey-map.tsx"), "utf8");
  const locatorBlock = source.slice(source.indexOf("function QuietArrival"), source.indexOf("function RegionalMap"));
  const regionalBlock = source.slice(source.indexOf("function RegionalMap"), source.indexOf("export function JourneyMap"));

  assert.match(locatorBlock, /data-arrival-locator/);
  assert.match(locatorBlock, /data-longhaul-label/);
  assert.match(source, /LAPLAND_PATH_HEADING/);
  assert.match(source, /data-glance-labels/);
  assert.doesNotMatch(source, /How we arrived/);
  assert.doesNotMatch(locatorBlock, /tile\.openstreetmap\.org/);
  assert.doesNotMatch(locatorBlock, /basemaps\.cartocdn\.com/);
  assert.doesNotMatch(locatorBlock, /min-h-\[22rem\]/);
  assert.doesNotMatch(locatorBlock, /polyline|LineString|svg[\s\S]*Hong Kong/i);
  assert.match(regionalBlock, /data-map-frame="regional"/);
  assert.match(regionalBlock, /data-map-poster-image/);
  assert.match(regionalBlock, /LAPLAND_POSTER/);
  assert.match(regionalBlock, /max-h-\[90vh\]/);
  assert.match(regionalBlock, /w-auto/);
  assert.match(regionalBlock, /object-contain/);
  assert.match(regionalBlock, /width=\{LAPLAND_POSTER_WIDTH\}/);
  assert.match(regionalBlock, /height=\{LAPLAND_POSTER_HEIGHT\}/);
  assert.doesNotMatch(regionalBlock, /object-fill|object-cover/);
  assert.doesNotMatch(regionalBlock, /className="block h-auto w-full select-none"/);
  assert.match(source, /Journey picture/);
  assert.match(source, /At a glance/);
});

test("poster generator stitches OpenTopoMap tiles and the PNG is committed", async () => {
  const [generator, pkg, png] = await Promise.all([
    readFile(resolve(root, "scripts/generate-lapland-poster.mjs"), "utf8"),
    readFile(resolve(root, "package.json"), "utf8"),
    readFile(resolve(root, LAPLAND_POSTER_GENERATOR_FILE)),
  ]);
  const info = await stat(resolve(root, LAPLAND_POSTER_GENERATOR_FILE));

  assert.match(pkg, /generate:lapland-poster/);
  assert.match(generator, /lib\/journey-map-model\.ts/);
  assert.match(generator, /tile\.opentopomap\.org\/\{z\}\/\{x\}\/\{y\}\.png/);
  assert.match(generator, /getStreetTileUrl/);
  assert.match(generator, /buildPosterLayout/);
  assert.match(generator, /layout\.winterPath/);
  assert.match(generator, /layout\.longHaulLabel/);
  assert.match(generator, /layout\.legendItems/);
  assert.match(generator, /arcticCirclePosterPath/);
  assert.match(generator, /Santa Claus Village/);
  assert.match(generator, /HELSINKI/);
  assert.match(generator, /At a glance/);
  assert.match(generator, /drawNotesColumn/);
  assert.match(generator, /LAPLAND_POSTER_LEGEND_RATIO/);
  assert.match(generator, /聖誕季窗口/);
  assert.match(generator, /item\.blurb/);
  assert.doesNotMatch(generator, /2019-12-11/);
  assert.doesNotMatch(generator, /8\/23|Aug 23|8月23/);
  assert.doesNotMatch(generator, /scaleBar/);
  assert.doesNotMatch(generator, /fillText\("N"/);
  assert.doesNotMatch(generator, /Winter route/);
  assert.doesNotMatch(generator, /grayscale|desaturat|opacity-55|saturate-\[/);
  assert.doesNotMatch(generator, /positron|light_all|#f4eee3|basemaps\.cartocdn\.com/);
  assert.doesNotMatch(generator, /maps\.googleapis|mt\d\.google|@googlemaps|tile\.openstreetmap\.org/);
  assert.equal(STREET_BASEMAP.urlTemplate, "https://tile.opentopomap.org/{z}/{x}/{y}.png");
  assert.match(STREET_BASEMAP.attribution, /OpenStreetMap contributors/);
  assert.match(STREET_BASEMAP.attribution, /OpenTopoMap/);
  assert.equal(png[0], 0x89);
  assert.equal(png[1], 0x50);
  assert.equal(png[2], 0x4e);
  assert.equal(png[3], 0x47);
  assert.ok(info.size > 400_000, `poster too small to be a street raster (${info.size} bytes)`);
});

test("JourneyMap and poster have no scale, routing, or measure chrome", async () => {
  const [source, generator] = await Promise.all([
    readFile(resolve(root, "components/journey-map.tsx"), "utf8"),
    readFile(resolve(root, "scripts/generate-lapland-poster.mjs"), "utf8"),
  ]);

  assert.doesNotMatch(source, /scale bar|scaleBar|ruler|measure tool/i);
  assert.doesNotMatch(source, /data-map-frame="overview"/);
  assert.doesNotMatch(generator, /layout\.scaleBar|getScaleBar/);
  assert.doesNotMatch(generator, /fillText\("▲"/);
  assert.doesNotMatch(generator, /fillText\("N"/);
});

test("Lapland default music stays one quiet CC0 winter bed", async () => {
  const seed = await readFile(resolve(root, "lib/trips.ts"), "utf8");
  const player = await readFile(resolve(root, "components/journey-music-player.tsx"), "utf8");

  assert.match(seed, /audioUrl: "\/travelos\/music\/first-light-particles\.mp3"/);
  assert.match(seed, /credit: "Yoiyami · First Light Particles · CC0"/);
  assert.match(seed, /title: "Quiet winter bed"/);
  assert.match(seed, /volume: 0\.18/);
  assert.match(seed, /enabled: true/);
  assert.doesNotMatch(seed, /jingle-bells-music-box\.wav"/);
  assert.match(seed, /title: "Arctic Circle blue swing"[\s\S]*enabled: false/);
  assert.match(seed, /title: "Winter village brass parade"[\s\S]*enabled: false/);
  assert.match(player, /activeTrack\.credit/);
  assert.match(player, /data-journey-music-slot/);
  assert.match(player, /createPortal/);
  assert.match(player, /data-hero-map/);
  assert.match(player, /fixed bottom-4 left-4/);
  assert.doesNotMatch(player, /fixed right-4 top-4/);
  const map = await readFile(resolve(root, "components/journey-map.tsx"), "utf8");
  assert.match(map, /data-journey-music-slot/);
});

test("Lapland itinerary is a Rovaniemi journey picture, not a Hong Kong-scale overview", () => {
  assert.ok(lapland);
  const itinerary = buildJourneyItinerary({
    center: lapland.coordinates,
    city: lapland.city,
    journalEntries: lapland.journalEntries,
    photos: lapland.photos,
    places: lapland.places,
    route: lapland.travelRoute,
  });
  const layout = buildPosterLayout(itinerary, lapland.city);

  assert.ok(itinerary.arrival);
  assert.deepEqual(
    itinerary.arrival.map((city) => city.shortLabel),
    ["RVN", "HEL"],
  );
  assert.equal(layout.longHaulLabel, "Santa Claus Village · Helsinki");
  assert.equal(layout.cityLabel, "Lapland · Helsinki");
  assert.match(itinerary.regionalStops[0].listLabel, /Santa Claus Village/);
  assert.ok(layout.pins.some((pin) => pin.label === "Santa Claus Village" && pin.sublabel === "聖誕老人村"));
  assert.equal(itinerary.regionalStops.length, 5);
  assert.deepEqual(
    itinerary.regionalStops.map((stop) => stop.number),
    [1, 2, 3, 4, 5],
  );
  assert.match(itinerary.regionalStops[0].listLabel, /Santa Claus Village/);
  assert.equal(itinerary.regionalStops[0].dateLabel, null);
  assert.match(itinerary.regionalStops[1].listLabel, /Arctic Circle/);
  assert.equal(itinerary.regionalStops[1].dateLabel, null);
  assert.match(itinerary.regionalStops[2].listLabel, /Rovaniemi/);
  assert.doesNotMatch(itinerary.regionalStops[2].listLabel, /Cabin|Red cabin/);
  assert.equal(itinerary.regionalStops[2].dateLabel, null);
  assert.match(itinerary.regionalStops[3].listLabel, /Helsinki Cathedral/);
  assert.match(itinerary.regionalStops[4].listLabel, /South Harbour/);
  assert.ok(layout.pins.some((pin) => /Helsinki Cathedral/.test(pin.label)));
  assert.ok(layout.pins.some((pin) => /South Harbour/.test(pin.label)));
  assert.equal(layout.legendItems.length, 5);
  assert.ok(layout.legendItems.every((item) => item.x < 32), "notes column stays on the left");
  assert.ok(layout.pins.every((pin) => pin.x > 36), "numbered pins stay on the map, right of the notes");
  assert.ok(layout.legendItems.every((item) => item.blurb.length > 4));
  assert.equal(layout.legendItems[0].label, "聖誕老人村");
  assert.match(layout.legendItems[0].blurb, /積雪木屋/);
  assert.match(layout.legendItems[1].blurb, /走過去/);
  assert.equal(layout.legendItems[2].label, "羅瓦涅米");
  assert.equal(LAPLAND_POSTER_NOTES[2].titleEn, "Rovaniemi");
  assert.equal(LAPLAND_POSTER_NOTES[2].titleZh, "羅瓦涅米");
  assert.match(LAPLAND_POSTER_NOTES[2].blurbEn, /snowman|sled|stay/i);
  assert.ok(layout.pins.some((pin) => pin.number === 3 && pin.label === "Rovaniemi" && pin.sublabel === "羅瓦涅米"));
  assert.match(layout.legendItems[2].blurb, /過夜/);
  assert.match(layout.legendItems[3].blurb, /白教堂/);
  assert.match(layout.legendItems[4].blurb, /再往南/);
  assert.equal(LAPLAND_POSTER_NOTES.length, 5);
  assert.match(LAPLAND_POSTER_TITLE.kickerEn, /midwinter/);
  assert.doesNotMatch(LAPLAND_POSTER_TITLE.kickerEn, /2019|8\/23/);
  assert.equal(LAPLAND_POSTER_LEGEND_RATIO, 0.3);
  assert.ok(!itinerary.regionalPoints.some((point) => point.latitude === hongKong.latitude && point.longitude === hongKong.longitude));
  assert.equal(layout.pins.length, 5);
  assert.ok(layout.pins.every((pin) => pin.x >= 6 && pin.x <= 98 && pin.y >= 6 && pin.y <= 94));
  assert.equal(layout.bounds.zoom, 8);
  assert.ok(layout.arcticPath.length >= 3);
  assert.equal(layout.winterPath.length, 4);
  assert.equal(layout.sidePath.length, 2);
  assert.equal(layout.winterPath[0].x, layout.pins.find((pin) => pin.number === 1)?.x);
  assert.equal(layout.winterPath[1].x, layout.pins.find((pin) => pin.number === 3)?.x);
  assert.equal(layout.sidePath[1].x, layout.pins.find((pin) => pin.number === 5)?.x);
  assert.ok(layout.pins.find((pin) => pin.number === 1).y < layout.pins.find((pin) => pin.number === 4).y);
  assert.ok(itinerary.regionalLegs.some((leg) => leg.style === "solid" && leg.kind === "winter"));
  assert.ok(itinerary.regionalLegs.some((leg) => leg.style === "dotted" && leg.kind === "side"));
  assert.equal("scaleBar" in layout, false);
  assert.equal(LAPLAND_POSTER.src, "/travelos/maps/lapland-helsinki-poster.jpg");
  assert.equal(LAPLAND_POSTER.relativeFile, "public/travelos/maps/lapland-helsinki-poster.jpg");
  assert.match(LAPLAND_POSTER.alt, /Santa Claus Village/);
  assert.match(LAPLAND_POSTER.alt, /Helsinki/);
  assert.equal(LAPLAND_GLANCE_LABELS, "Santa Claus Village (聖誕老人村) · Helsinki");
  assert.equal(LAPLAND_PATH_HEADING, "拉普蘭，然後赫爾辛基 / Lapland, then Helsinki");
  assert.equal(LAPLAND_GLANCE_HOTSPOTS.length, 4);
  assert.deepEqual(
    LAPLAND_GLANCE_HOTSPOTS.map((spot) => [spot.id, spot.href, spot.label, spot.x, spot.y, spot.w, spot.h]),
    [
      ["tap-arctic", "#arctic-circle", "極地之旅 / Arctic Journey", 0.378906, 0.873047, 0.114258, 0.10612],
      ["tap-nature", "#place-knowledge", "自然風光 / Scenic Nature", 0.493164, 0.873047, 0.115234, 0.10612],
      ["tap-stay", "#cabin-4", "在地體驗 / Local Experience", 0.608398, 0.873047, 0.109375, 0.10612],
      ["tap-winter", "#christmas-window", "冬季限定 / Winter Exclusive", 0.717773, 0.873047, 0.099609, 0.10612],
    ],
  );
  assert.ok(LAPLAND_GLANCE_HOTSPOTS.every((spot) => spot.x >= 0.37), "theme cards sit in the footer band, not full width");
  assert.ok(LAPLAND_GLANCE_HOTSPOTS.every((spot) => spot.y === 0.873047));
  assert.ok(!LAPLAND_GLANCE_HOTSPOTS.some((spot) => /europe|locator/i.test(spot.id)));
  assert.equal(LAPLAND_POSTER_WIDTH, 1200);
  assert.equal(LAPLAND_POSTER_HEIGHT, 1800);
});

function jpegSize(buffer) {
  let index = 2;
  while (index < buffer.length - 8) {
    if (buffer[index] !== 0xff) {
      index += 1;
      continue;
    }
    const marker = buffer[index + 1];
    if (marker === 0xd8 || marker === 0xd9 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      index += 2;
      continue;
    }
    const length = buffer.readUInt16BE(index + 2);
    if (marker === 0xc0 || marker === 0xc1 || marker === 0xc2) {
      return { height: buffer.readUInt16BE(index + 5), width: buffer.readUInt16BE(index + 7) };
    }
    index += 2 + length;
  }
  return null;
}

test("public Journey picture JPEG is a committed portrait v5 plate, not landscape A3 or the GIS PNG", async () => {
  const jpeg = await readFile(resolve(root, LAPLAND_POSTER.relativeFile));
  const info = await stat(resolve(root, LAPLAND_POSTER.relativeFile));
  const composer = await readFile(resolve(root, "scripts/compose-lapland-helsinki-poster.mjs"), "utf8");
  const map = await readFile(resolve(root, "components/journey-map.tsx"), "utf8");
  const path = await readFile(resolve(root, "components/lapland-visual-path.tsx"), "utf8");
  const copy = await readFile(resolve(root, "lib/lapland-storefront-copy.ts"), "utf8");
  const knowledge = await readFile(resolve(root, "components/lapland-place-knowledge.tsx"), "utf8");
  const size = jpegSize(jpeg);

  assert.equal(jpeg[0], 0xff);
  assert.equal(jpeg[1], 0xd8);
  assert.equal(info.size, 442789);
  assert.equal(createHash("sha256").update(jpeg).digest("hex"), "480debd99daad4ecbd9fba70dcc2a42fe1bf82007cc13531bfe12ac42a23090a");
  assert.ok(size, "JPEG must include a SOF size marker");
  assert.equal(size.width, 1200);
  assert.equal(size.height, 1800);
  assert.ok(size.height > size.width, "Journey picture is portrait");
  assert.match(composer, /Ninara · CC BY 2\.0/);
  assert.match(composer, /drawEuropeLocator/);
  assert.match(composer, /blurbZh/);
  assert.match(composer, /極夜與雪國的純淨體驗/);
  assert.match(composer, /dump-cabin-4-snowman/);
  assert.match(composer, /fillText\("羅瓦涅米"/);
  assert.match(composer, /fillText\("Rovaniemi"/);
  assert.doesNotMatch(composer, /fillText\(["']Then South["']\)/);
  assert.doesNotMatch(composer, /fillText\(["']向南前行["']\)/);
  assert.doesNotMatch(composer, /2019-12-11/);
  assert.doesNotMatch(map, /fillText\("N"/);
  assert.doesNotMatch(map, /compass|north arrow/i);
  assert.match(path, /id=\{beat\.sectionId\}/);
  assert.match(copy, /sectionId: "arctic-circle"/);
  assert.match(copy, /sectionId: "cabin-4"/);
  assert.match(copy, /sectionId: "christmas-window"/);
  assert.match(knowledge, /id="place-knowledge"/);
  assert.doesNotMatch(map, /TravelpayoutsDrive|data-travelpayouts-drive/);
});

test("selecting stop N shows bilingual wording and the linked photo", () => {
  assert.ok(lapland);
  const itinerary = buildJourneyItinerary({
    center: lapland.coordinates,
    city: lapland.city,
    journalEntries: lapland.journalEntries,
    photos: lapland.photos,
    places: lapland.places,
    route: lapland.travelRoute,
  });

  const stopOne = itinerary.regionalStops.find((stop) => stop.number === 1);
  const stopFive = itinerary.regionalStops.find((stop) => stop.number === 5);
  assert.ok(stopOne);
  assert.ok(stopFive);

  const santaCard = getStopCardContent({
    journalEntries: lapland.journalEntries,
    photos: lapland.photos,
    stop: stopOne,
  });
  assert.ok(santaCard);
  assert.equal(santaCard.title, "聖誕老人村 / Santa Claus Village");
  assert.match(santaCard.wording, /北極圈上的聖誕老人村/);
  assert.equal(santaCard.photo?.storageKey, "/travelos/lapland/stills/cover_IMG_3619.jpeg");

  const leavingCard = getStopCardContent({
    journalEntries: lapland.journalEntries,
    photos: lapland.photos,
    stop: stopFive,
  });
  assert.ok(leavingCard);
  assert.equal(leavingCard.title, "南港 / South Harbour");
  assert.match(leavingCard.wording, /South Harbour/);
  assert.equal(leavingCard.photo?.storageKey, "/travelos/lapland/garnish-helsinki-harbour.jpeg");
});
