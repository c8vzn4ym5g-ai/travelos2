import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";
import {
  buildJourneyItinerary,
  chooseZoom,
  getStopCardContent,
  isRegionalPointSet,
} from "../lib/journey-map-model.ts";
import { seedTripDetails } from "../lib/trips.ts";

const root = resolve(import.meta.dirname, "..");
const lapland = seedTripDetails.find((trip) => trip.id === "trip_lapland_2020");
const hongKong = { latitude: 22.308, longitude: 113.9185 };

test("JourneyMap source makes the regional map the large frame", async () => {
  const [source, model, page] = await Promise.all([
    readFile(resolve(root, "components/journey-map.tsx"), "utf8"),
    readFile(resolve(root, "lib/journey-map-model.ts"), "utf8"),
    readFile(resolve(root, "app/trips/[slug]/page.tsx"), "utf8"),
  ]);

  assert.match(source, /data-map-frame="regional"/);
  assert.match(source, /min-h-\[22rem\].*lg:min-h-\[32rem\]/);
  assert.match(source, /data-arrival-locator/);
  assert.match(source, /data-stop-list/);
  assert.match(source, /min-h-11/);
  assert.match(source, /data-stop-card/);
  assert.match(source, /data-stop-title/);
  assert.match(source, /data-stop-wording/);
  assert.match(model, /tile\.openstreetmap\.org/);
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

test("arrival locator is not an equal-size second map", async () => {
  const source = await readFile(resolve(root, "components/journey-map.tsx"), "utf8");
  const locatorBlock = source.slice(source.indexOf("function ArrivalLocator"), source.indexOf("function RegionalMap"));
  const regionalBlock = source.slice(source.indexOf("function RegionalMap"), source.indexOf("export function JourneyMap"));

  assert.match(locatorBlock, /data-arrival-locator/);
  assert.doesNotMatch(locatorBlock, /tile\.openstreetmap\.org/);
  assert.doesNotMatch(locatorBlock, /min-h-\[22rem\]/);
  assert.match(regionalBlock, /data-map-frame="regional"/);
  assert.match(regionalBlock, /getMapTiles/);
  assert.match(regionalBlock, /min-h-\[22rem\]/);
  assert.match(source, /How we arrived/);
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

test("Lapland itinerary is a Rovaniemi regional map, not a Hong Kong-scale overview", () => {
  assert.ok(lapland);
  const itinerary = buildJourneyItinerary({
    center: lapland.coordinates,
    city: lapland.city,
    journalEntries: lapland.journalEntries,
    photos: lapland.photos,
    places: lapland.places,
    route: lapland.travelRoute,
  });

  assert.ok(itinerary.arrival);
  assert.deepEqual(
    itinerary.arrival.map((city) => city.shortLabel),
    ["HK", "HEL", "RVN"],
  );
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
  assert.ok(chooseZoom(itinerary.regionalPoints, "regional") >= 10);
  assert.ok(itinerary.regionalLegs.some((leg) => leg.style === "solid" && leg.kind === "winter"));
  assert.ok(itinerary.regionalLegs.some((leg) => leg.style === "dotted" && leg.kind === "side"));
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
