import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";
import { chooseZoom, getStopCardContent, partitionJourneyScales } from "../lib/journey-map-model.ts";

const root = resolve(import.meta.dirname, "..");

const laplandCenter = { latitude: 66.5039, longitude: 25.7294 };
const hongKong = { latitude: 22.308, longitude: 113.9185 };
const helsinki = { latitude: 60.3172, longitude: 24.9633 };
const rovaniemiAirport = { latitude: 66.5648, longitude: 25.8304 };
const santaVillage = { latitude: 66.5436, longitude: 25.8472 };
const cabin = { latitude: 66.4958, longitude: 25.7012 };
const sled = { latitude: 66.5382, longitude: 25.8595 };

const laplandPlaces = [
  { id: "place_hk", name: "Hong Kong International Airport", coordinates: hongKong, notes: "Long-haul start." },
  { id: "place_hel", name: "Helsinki Airport", coordinates: helsinki, notes: "Connection." },
  { id: "place_rvn", name: "Rovaniemi Airport", coordinates: rovaniemiAirport, notes: "Arrival airport." },
  { id: "place_santa", name: "Santa Claus Village", coordinates: santaVillage, notes: "Village lights." },
  { id: "place_arctic", name: "Arctic Circle Line", coordinates: santaVillage, notes: "Arctic Circle marker." },
  { id: "place_cabin", name: "Snow cabin", coordinates: cabin, notes: "雪屋。 / Snow cabin." },
  { id: "place_sled", name: "Sled route", coordinates: sled, notes: "雪地雪橇。 / Sled in the snow." },
].map((place) => ({
  address: null,
  city: "Rovaniemi",
  country: "Finland",
  createdAt: "2020-01-18T00:00:00.000Z",
  rating: null,
  tripId: "trip_lapland_2020",
  type: "attraction",
  updatedAt: "2020-01-18T00:00:00.000Z",
  ...place,
}));

const laplandRoute = [
  {
    createdAt: "2020-01-18T00:00:00.000Z",
    from: hongKong,
    fromLabel: "Hong Kong",
    id: "route_hk_hel",
    linkedJournalEntryId: "journal_arrival",
    linkedPhotoId: "photo_arctic",
    linkedPlaceId: "place_hel",
    note: "Long-haul flight.",
    to: helsinki,
    toLabel: "Helsinki Airport",
    transport: "flight",
    tripId: "trip_lapland_2020",
    updatedAt: "2020-01-18T00:00:00.000Z",
    visibility: "public",
  },
  {
    createdAt: "2020-01-18T00:00:00.000Z",
    from: helsinki,
    fromLabel: "Helsinki Airport",
    id: "route_hel_rvn",
    linkedJournalEntryId: "journal_arrival",
    linkedPhotoId: "photo_arctic",
    linkedPlaceId: "place_rvn",
    note: "Domestic flight.",
    to: rovaniemiAirport,
    toLabel: "Rovaniemi Airport",
    transport: "flight",
    tripId: "trip_lapland_2020",
    updatedAt: "2020-01-18T00:00:00.000Z",
    visibility: "public",
  },
  {
    createdAt: "2020-01-18T00:00:00.000Z",
    from: laplandCenter,
    fromLabel: "Rovaniemi",
    id: "route_city_santa",
    linkedJournalEntryId: "journal_santa",
    linkedPhotoId: "photo_santa",
    linkedPlaceId: "place_santa",
    note: "Short snowy ride.",
    to: santaVillage,
    toLabel: "Santa Claus Village",
    transport: "car",
    tripId: "trip_lapland_2020",
    updatedAt: "2020-01-18T00:00:00.000Z",
    visibility: "public",
  },
];

test("JourneyMap source renders two OSM scales and 44px numbered stops", async () => {
  const [source, model] = await Promise.all([
    readFile(resolve(root, "components/journey-map.tsx"), "utf8"),
    readFile(resolve(root, "lib/journey-map-model.ts"), "utf8"),
  ]);

  assert.match(source, /data-map-scale=\{slice\.scale\}/);
  assert.match(source, /"overview"/);
  assert.match(source, /"detail"/);
  assert.match(model, /tile\.openstreetmap\.org/);
  assert.match(source, /min-h-11 min-w-11/);
  assert.match(source, /data-stop-card/);
  assert.match(source, /data-stop-title/);
  assert.match(source, /data-stop-wording/);
  assert.doesNotMatch(source, /router\.push/);
  assert.doesNotMatch(source, /Writing guide/);
  assert.doesNotMatch(source, /Visitor scan/);
});

test("public trip page still has no writer chrome", async () => {
  const page = await readFile(resolve(root, "app/trips/[slug]/page.tsx"), "utf8");

  assert.doesNotMatch(page, /Writing guide/);
  assert.doesNotMatch(page, /Visitor scan/);
  assert.match(page, /<JourneyMap/);
});

test("Lapland default music is one quiet CC0 winter bed", async () => {
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

test("partitionJourneyScales splits Hong Kong flights from the Finland cluster", () => {
  const scales = partitionJourneyScales({
    center: laplandCenter,
    places: laplandPlaces,
    route: laplandRoute,
  });

  assert.equal(scales.single, null);
  assert.ok(scales.overview);
  assert.ok(scales.detail);
  assert.equal(scales.overview.scale, "overview");
  assert.equal(scales.detail.scale, "detail");
  assert.deepEqual(
    scales.overview.places.map((place) => place.id).sort(),
    ["place_hel", "place_hk", "place_rvn"],
  );
  assert.ok(scales.detail.places.some((place) => place.id === "place_santa"));
  assert.ok(scales.detail.places.some((place) => place.id === "place_cabin"));
  assert.ok(scales.detail.places.some((place) => place.id === "place_sled"));
  assert.ok(!scales.detail.places.some((place) => place.id === "place_hk"));
  assert.ok(chooseZoom(scales.overview.points, "overview") <= 3);
  assert.ok(chooseZoom(scales.detail.points, "detail") >= 9);
});

test("selecting a numbered stop exposes photo and wording even without a photo", () => {
  const photos = [
    {
      cameraMake: null,
      cameraModel: null,
      caption: "入夜後的聖誕老人村。 / Santa Claus Village at night.",
      coordinates: santaVillage,
      createdAt: "2020-01-20T18:25:00.000Z",
      id: "photo_santa",
      originalFilename: "santa-village-night.jpeg",
      storageKey: "/travelos/lapland/santa-village-night.jpeg",
      takenAt: "2020-01-20T18:20:00.000Z",
      tripId: "trip_lapland_2020",
    },
  ];
  const journalEntries = [
    {
      aiSummary: null,
      body: "After dark the village is lit.\n\nSecond paragraph stays in the journal.",
      createdAt: "2020-01-20T18:10:00.000Z",
      entryDate: "2020-01-20",
      id: "journal_santa",
      mood: "明亮",
      storyPhotoId: "photo_santa",
      title: "聖誕老人村 / Santa Claus Village",
      tripId: "trip_lapland_2020",
      updatedAt: "2020-01-20T18:10:00.000Z",
      weatherSummary: null,
    },
  ];

  const withPhoto = getStopCardContent({
    journalEntries,
    photos,
    pin: {
      id: "place_santa",
      kind: "place",
      label: "Santa Claus Village",
      linkedJournalEntryId: "journal_santa",
      linkedPhotoId: "photo_santa",
      note: "Village lights.",
      point: santaVillage,
    },
  });

  assert.ok(withPhoto);
  assert.equal(withPhoto.title, "聖誕老人村 / Santa Claus Village");
  assert.match(withPhoto.wording, /After dark the village is lit/);
  assert.equal(withPhoto.photo?.storageKey, "/travelos/lapland/santa-village-night.jpeg");
  assert.equal(withPhoto.caption, "入夜後的聖誕老人村。 / Santa Claus Village at night.");

  const withoutPhoto = getStopCardContent({
    journalEntries: [],
    photos: [],
    pin: {
      id: "place_hk",
      kind: "place",
      label: "Hong Kong International Airport",
      note: "長途出發點。 / Long-haul starting point.",
      point: hongKong,
    },
  });

  assert.ok(withoutPhoto);
  assert.equal(withoutPhoto.photo, null);
  assert.match(withoutPhoto.wording, /Long-haul starting point/);
  assert.equal(withoutPhoto.title, "Hong Kong International Airport");
});
