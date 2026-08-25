import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";
import {
  buildJourneyItinerary,
  buildPosterLayout,
  getStopCardContent,
  isRegionalPointSet,
  LAPLAND_POSTER,
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
  assert.match(model, /\/travelos\/maps\/lapland-rovaniemi\.png/);
  assert.match(source, /data-arrival-locator/);
  assert.match(source, /data-longhaul-label/);
  assert.match(source, /data-stop-list/);
  assert.match(source, /min-h-11 min-w-11/);
  assert.match(source, /data-map-pin=\{pin\.number\}/);
  assert.match(source, /data-stop-card/);
  assert.match(source, /data-stop-title/);
  assert.match(source, /data-stop-wording/);
  assert.doesNotMatch(source, /getMapTiles/);
  assert.doesNotMatch(source, /data-map-tile/);
  assert.doesNotMatch(source, /tile\.openstreetmap\.org/);
  assert.doesNotMatch(source, /basemaps\.cartocdn\.com/);
  assert.doesNotMatch(source, /maps\.googleapis|mt\d\.google|@googlemaps/);
  assert.doesNotMatch(model, /tile\.openstreetmap\.org/);
  assert.doesNotMatch(model, /maps\.googleapis|mt\d\.google|@googlemaps/);
  assert.doesNotMatch(pkg, /@googlemaps/);
  const layout = source.slice(source.indexOf("export function JourneyMap"));
  assert.match(layout, /data-stop-list[\s\S]*<RegionalMap[\s\S]*data-stop-card/);
  assert.doesNotMatch(source, /data-map-scale=\{slice\.scale\}/);
  assert.doesNotMatch(source, /data-map-frame="overview"/);
  assert.doesNotMatch(source, /Writing guide/);
  assert.doesNotMatch(source, /Visitor scan/);
  assert.doesNotMatch(page, /Writing guide/);
  assert.doesNotMatch(page, /Visitor scan/);
  assert.match(page, /<JourneyMap/);
});

test("long-haul is a quiet label, not an equal-size second map", async () => {
  const source = await readFile(resolve(root, "components/journey-map.tsx"), "utf8");
  const locatorBlock = source.slice(source.indexOf("function QuietArrival"), source.indexOf("function RegionalMap"));
  const regionalBlock = source.slice(source.indexOf("function RegionalMap"), source.indexOf("export function JourneyMap"));

  assert.match(locatorBlock, /data-arrival-locator/);
  assert.match(locatorBlock, /data-longhaul-label/);
  assert.match(locatorBlock, /via \{labels\}/);
  assert.doesNotMatch(locatorBlock, /How we arrived/);
  assert.doesNotMatch(locatorBlock, /tile\.openstreetmap\.org/);
  assert.doesNotMatch(locatorBlock, /basemaps\.cartocdn\.com/);
  assert.doesNotMatch(locatorBlock, /min-h-\[22rem\]/);
  assert.doesNotMatch(locatorBlock, /polyline|LineString|svg[\s\S]*Hong Kong/i);
  assert.match(regionalBlock, /data-map-frame="regional"/);
  assert.match(regionalBlock, /data-map-poster-image/);
  assert.match(regionalBlock, /LAPLAND_POSTER/);
  assert.match(source, /Journey picture/);
  assert.match(source, /At a glance/);
});

test("poster generator stitches Carto Voyager tiles and the PNG is committed", async () => {
  const [generator, pkg, png] = await Promise.all([
    readFile(resolve(root, "scripts/generate-lapland-poster.mjs"), "utf8"),
    readFile(resolve(root, "package.json"), "utf8"),
    readFile(resolve(root, LAPLAND_POSTER.relativeFile)),
  ]);
  const info = await stat(resolve(root, LAPLAND_POSTER.relativeFile));

  assert.match(pkg, /generate:lapland-poster/);
  assert.match(generator, /lib\/journey-map-model\.ts/);
  assert.match(generator, /basemaps\.cartocdn\.com\/rastertiles\/voyager\/\{z\}\/\{x\}\/\{y\}\.png/);
  assert.match(generator, /getStreetTileUrl/);
  assert.match(generator, /buildPosterLayout/);
  assert.match(generator, /layout\.winterPath/);
  assert.match(generator, /layout\.longHaulLabel/);
  assert.doesNotMatch(generator, /scaleBar/);
  assert.doesNotMatch(generator, /fillText\("N"/);
  assert.doesNotMatch(generator, /Winter route/);
  assert.doesNotMatch(generator, /grayscale|desaturat|opacity-55|saturate-\[/);
  assert.doesNotMatch(generator, /maps\.googleapis|mt\d\.google|@googlemaps|tile\.openstreetmap\.org/);
  assert.equal(STREET_BASEMAP.urlTemplate, "https://basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png");
  assert.match(STREET_BASEMAP.attribution, /OpenStreetMap contributors/);
  assert.match(STREET_BASEMAP.attribution, /CARTO/);
  assert.equal(png[0], 0x89);
  assert.equal(png[1], 0x50);
  assert.equal(png[2], 0x4e);
  assert.equal(png[3], 0x47);
  assert.ok(info.size > 80_000, `poster too small to be a street raster (${info.size} bytes)`);
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
    ["HK", "HEL", "RVN"],
  );
  assert.equal(layout.longHaulLabel, "HK · HEL · RVN");
  assert.equal(itinerary.regionalStops.length, 6);
  assert.deepEqual(
    itinerary.regionalStops.map((stop) => stop.number),
    [1, 2, 3, 4, 5, 6],
  );
  assert.match(itinerary.regionalStops[0].listLabel, /Arrival/);
  assert.equal(itinerary.regionalStops[0].dateLabel, "1/18");
  assert.match(itinerary.regionalStops[1].listLabel, /Santa Village/);
  assert.equal(itinerary.regionalStops[1].dateLabel, "1/20");
  assert.match(itinerary.regionalStops[2].listLabel, /Arctic Circle/);
  assert.match(itinerary.regionalStops[3].listLabel, /Sled/);
  assert.match(itinerary.regionalStops[4].listLabel, /Campfire/);
  assert.equal(itinerary.regionalStops[4].dateLabel, "1/22");
  assert.match(itinerary.regionalStops[5].listLabel, /Cabin/);
  assert.ok(itinerary.regionalStops.every((stop) => isRegionalPointSet([stop.point, itinerary.regionalPoints[0]])));
  assert.ok(!itinerary.regionalPoints.some((point) => point.latitude === hongKong.latitude && point.longitude === hongKong.longitude));
  assert.ok(isRegionalPointSet(itinerary.regionalPoints));
  assert.equal(layout.pins.length, 6);
  assert.ok(layout.pins.every((pin) => pin.x >= 6 && pin.x <= 94 && pin.y >= 8 && pin.y <= 92));
  assert.ok(layout.bounds.zoom >= 12);
  assert.equal(layout.winterPath.length, 4);
  assert.equal(layout.sidePath.length, 2);
  assert.equal(layout.winterPath[0].x, layout.pins.find((pin) => pin.number === 1)?.x);
  assert.equal(layout.winterPath[1].x, layout.pins.find((pin) => pin.number === 2)?.x);
  assert.equal(layout.sidePath[1].x, layout.pins.find((pin) => pin.number === 4)?.x);
  assert.ok(itinerary.regionalLegs.some((leg) => leg.style === "solid" && leg.kind === "winter"));
  assert.ok(itinerary.regionalLegs.some((leg) => leg.style === "dotted" && leg.kind === "side"));
  assert.equal("scaleBar" in layout, false);
  assert.equal(LAPLAND_POSTER.src, "/travelos/maps/lapland-rovaniemi.png");
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

  const stopTwo = itinerary.regionalStops.find((stop) => stop.number === 2);
  const stopFive = itinerary.regionalStops.find((stop) => stop.number === 5);
  assert.ok(stopTwo);
  assert.ok(stopFive);

  const santaCard = getStopCardContent({
    journalEntries: lapland.journalEntries,
    photos: lapland.photos,
    stop: stopTwo,
  });
  assert.ok(santaCard);
  assert.equal(santaCard.title, "聖誕老人村 / Santa Claus Village");
  assert.match(santaCard.wording, /入夜後燈光亮起/);
  assert.match(santaCard.wording, /After dark the village is lit/);
  assert.equal(santaCard.photo?.storageKey, "/travelos/lapland/santa-village-night.jpeg");

  const campfireCard = getStopCardContent({
    journalEntries: lapland.journalEntries,
    photos: lapland.photos,
    stop: stopFive,
  });
  assert.ok(campfireCard);
  assert.equal(campfireCard.title, "雪地營火 / Campfire in the snow");
  assert.match(campfireCard.wording, /1 月 22 日晚/);
  assert.equal(campfireCard.photo?.storageKey, "/travelos/lapland/campfire.jpeg");
});
