import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";
import { setDriveWarehouseFetchForTests } from "../lib/drive-warehouse.ts";
import {
  HUB_GALLERY_LIMIT,
  mergeSeedHubCards,
  parseHubCard,
  readPublicHubTrips,
  resetPublicHubCacheForTests,
  seedPublicHubTrips,
  slimTripToHubCard,
} from "../lib/public-hub.ts";
import { seedTripDetails } from "../lib/trips.ts";

const root = resolve(import.meta.dirname, "..");

function fatTrip(id: string, visibility: "public" | "private" = "public") {
  return {
    city: "Paris",
    country: "France",
    coverPhotoId: `${id}_cover`,
    endDate: "2023-08-31",
    id,
    journalEntries: Array.from({ length: 40 }, (_, index) => ({
      body: "x".repeat(2000),
      id: `${id}_j${index}`,
      title: `entry ${index}`,
    })),
    photos: Array.from({ length: 80 }, (_, index) => ({
      caption: `photo ${index}`,
      id: index === 0 ? `${id}_cover` : `${id}_p${index}`,
      storageKey: `/api/trips/media?id=${id}-${index}`,
    })),
    places: [{ id: `${id}_place`, name: "Louvre" }],
    rating: 5,
    slug: id.replace(/_/g, "-"),
    startDate: "2023-08-28",
    summary: "Umbrella street",
    title: "Paris summer",
    totalCost: { amount: 10, currency: "EUR" },
    visibility,
  };
}

test("hub cards keep cover plus a short gallery and drop journals", () => {
  const seed = seedTripDetails.find((trip) => trip.visibility !== "private");
  assert.ok(seed);
  const card = slimTripToHubCard({
    ...seed,
    photos: Array.from({ length: 30 }, (_, index) => ({
      ...seed.photos[0],
      id: `${seed.id}_p${index}`,
      storageKey: `/api/trips/media?id=${seed.id}-${index}`,
    })),
  });
  assert.equal(card.photos.length <= HUB_GALLERY_LIMIT + 1, true);
  assert.ok(card.coverPhoto);
  assert.equal("journalEntries" in card, false);
  assert.equal("places" in card, false);
  assert.equal("costs" in card, false);
});

test("parseHubCard keeps public cards, skips private and held vanity files", () => {
  const publicCard = parseHubCard(fatTrip("trip_paris_hub_2023"));
  assert.ok(publicCard);
  assert.equal(publicCard.photos.length <= HUB_GALLERY_LIMIT + 1, true);
  assert.equal(publicCard.coverPhoto?.id, "trip_paris_hub_2023_cover");
  assert.equal(parseHubCard(fatTrip("trip_secret", "private")), null);
  assert.equal(parseHubCard({ id: "trip_kyoto_maple", visibility: "public", title: "held" }), null);
});

test("seed hub list is the public journeys and merge keeps Drive cards first", () => {
  const seed = seedPublicHubTrips();
  // Seed storefront is Lapland (shared) plus any later public seeds — not the private drafts.
  assert.ok(seed.length >= 1);
  assert.ok(seed.every((trip) => trip.visibility !== "private"));
  const extra = parseHubCard(fatTrip("trip_new_public_2026"));
  assert.ok(extra);
  const merged = mergeSeedHubCards([extra]);
  assert.equal(merged[0].id === extra.id || merged.some((trip) => trip.id === extra.id), true);
  assert.ok(merged.some((trip) => trip.id === seed[0].id));
});

test("readPublicHubTrips serves seed when warehouse is empty and caches the slim list", async () => {
  resetPublicHubCacheForTests();
  let calls = 0;
  setDriveWarehouseFetchForTests(async () => {
    calls += 1;
    return Response.json({ trips: [] });
  });
  try {
    const first = await readPublicHubTrips();
    const second = await readPublicHubTrips();
    assert.equal(first.length, seedPublicHubTrips().length);
    assert.equal(second, first);
    assert.equal(calls, 1);
  } finally {
    setDriveWarehouseFetchForTests(null);
    resetPublicHubCacheForTests();
  }
});

test("warehouse overlay slims a fat public trip and ignores private ones", async () => {
  resetPublicHubCacheForTests();
  setDriveWarehouseFetchForTests(async () => {
    return Response.json({
      trips: [
        { trip: fatTrip("trip_paris_hub_2023"), modifiedTime: "2026-09-11T00:00:00.000Z" },
        { trip: fatTrip("trip_secret_hub", "private"), modifiedTime: "2026-09-11T00:00:00.000Z" },
      ],
    });
  });
  try {
    const trips = await readPublicHubTrips();
    const paris = trips.find((trip) => trip.id === "trip_paris_hub_2023");
    assert.ok(paris);
    assert.equal(paris.photos.length <= HUB_GALLERY_LIMIT + 1, true);
    assert.equal(trips.some((trip) => trip.id === "trip_secret_hub"), false);
  } finally {
    setDriveWarehouseFetchForTests(null);
    resetPublicHubCacheForTests();
  }
});

test("home and trips hubs do not load the full editable store on each hit", async () => {
  const [home, trips] = await Promise.all([
    readFile(resolve(root, "app/page.tsx"), "utf8"),
    readFile(resolve(root, "app/trips/page.tsx"), "utf8"),
  ]);
  for (const source of [home, trips]) {
    assert.match(source, /readPublicHubTrips/);
    assert.doesNotMatch(source, /readContent/);
    assert.doesNotMatch(source, /from "@\/lib\/editable-store"/);
  }
  const hub = await readFile(resolve(root, "lib/public-hub.ts"), "utf8");
  assert.match(hub, /PUBLIC_HUB_CACHE_TTL_MS/);
  assert.match(hub, /PUBLIC_HUB_DRIVE_BUDGET_MS/);
  assert.doesNotMatch(hub, /prepareFamilyEditorTrips/);
  assert.doesNotMatch(hub, /readDriveTrips/);
});
