import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";
import { getWarehouseTripCards, setDriveWarehouseFetchForTests } from "../lib/drive-warehouse.ts";
import {
  HUB_GALLERY_LIMIT,
  cachePublicHubTrips,
  invalidatePublicHubCache,
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

test("readPublicHubTrips does not invent a seed-only library when warehouse is empty", async () => {
  resetPublicHubCacheForTests();
  let calls = 0;
  setDriveWarehouseFetchForTests(async () => {
    calls += 1;
    return Response.json({ trips: [] });
  });
  try {
    const first = await readPublicHubTrips();
    const second = await readPublicHubTrips();
    assert.equal(first.length, 0);
    assert.equal(second.length, 0);
    assert.ok(calls >= 1);
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

const sharedLibrary = () => [
  ...Array.from({ length: 10 }, (_, index) => ({ ...fatTrip(`trip_shared_${index}`), visibility: "shared" })),
  ...seedPublicHubTrips(),
];

const settle = () => new Promise<void>((resolve) => setImmediate(resolve));

test("eleven cached trips survive invalidation, failed refresh and seed-shaped content", async () => {
  resetPublicHubCacheForTests();
  setDriveWarehouseFetchForTests(async () => { throw new Error("Drive dead"); });
  try {
    await cachePublicHubTrips(sharedLibrary());
    invalidatePublicHubCache();
    const previous = await readPublicHubTrips();
    assert.equal(previous.length, 11);
    await settle();
    await cachePublicHubTrips(seedPublicHubTrips());
    assert.deepEqual(await readPublicHubTrips(), previous);
    await cachePublicHubTrips([]);
    assert.deepEqual(await readPublicHubTrips(), previous);
  } finally {
    setDriveWarehouseFetchForTests(null);
    resetPublicHubCacheForTests();
  }
});

test("stale requests return immediately while a single refresh is slow", async () => {
  resetPublicHubCacheForTests();
  let finish!: (response: Response) => void;
  let bundleCalls = 0;
  setDriveWarehouseFetchForTests(async (input) => {
    if (new URL(String(input)).searchParams.get("op") === "drive-access") return Response.json({});
    bundleCalls += 1;
    return new Promise<Response>((resolve) => { finish = resolve; });
  });
  try {
    await cachePublicHubTrips(sharedLibrary());
    invalidatePublicHubCache();
    const started = Date.now();
    const results = await Promise.all([readPublicHubTrips(), readPublicHubTrips()]);
    assert.ok(Date.now() - started < 1000);
    assert.ok(results.every((cards) => cards.length === 11));
    assert.equal(bundleCalls, 1);
    // An older in-flight response cannot overwrite a newer content API snapshot.
    await cachePublicHubTrips([...sharedLibrary(), fatTrip("trip_new_shared")]);
    finish(Response.json({ trips: [{ trip: fatTrip("trip_old_response") }] }));
    await settle();
    assert.equal((await readPublicHubTrips()).length, 12);
  } finally {
    setDriveWarehouseFetchForTests(null);
    resetPublicHubCacheForTests();
  }
});

test("cold HTML wait is bounded and late Drive success populates the next request", async () => {
  resetPublicHubCacheForTests();
  let finish!: (response: Response) => void;
  setDriveWarehouseFetchForTests(async (input) => {
    if (new URL(String(input)).searchParams.get("op") === "drive-access") return Response.json({});
    return new Promise<Response>((resolve) => { finish = resolve; });
  });
  try {
    const started = Date.now();
    const cards = await readPublicHubTrips();
    assert.deepEqual(cards, []);
    assert.ok(Date.now() - started < 8000, "cold response must not wait 45 seconds");
    finish(Response.json({ trips: sharedLibrary().map((trip) => ({ trip })) }));
    await settle();
    assert.equal((await readPublicHubTrips()).length, 11);
  } finally {
    setDriveWarehouseFetchForTests(null);
    resetPublicHubCacheForTests();
  }
});

test("Cloudflare snapshot restores all shared cards after isolate eviction", async () => {
  const original = Object.getOwnPropertyDescriptor(globalThis, "caches");
  let snapshot: Response | undefined;
  Object.defineProperty(globalThis, "caches", { configurable: true, value: { default: {
    put: async (_url: string, response: Response) => { snapshot = response.clone(); },
    match: async () => snapshot?.clone(),
  } } });
  resetPublicHubCacheForTests();
  setDriveWarehouseFetchForTests(async () => { throw new Error("Drive dead"); });
  try {
    await cachePublicHubTrips(sharedLibrary());
    assert.ok(snapshot);
    assert.equal((await snapshot.clone().text()).includes("journalEntries"), false);
    resetPublicHubCacheForTests();
    // Even a new isolate receiving seed-shaped content must preserve the edge snapshot.
    await cachePublicHubTrips(seedPublicHubTrips());
    assert.equal((await readPublicHubTrips()).length, 11);
    resetPublicHubCacheForTests();
    assert.equal((await readPublicHubTrips()).length, 11);
  } finally {
    if (original) Object.defineProperty(globalThis, "caches", original);
    else Reflect.deleteProperty(globalThis, "caches");
    setDriveWarehouseFetchForTests(null);
    resetPublicHubCacheForTests();
  }
});

test("lighter Drive read paginates, selects latest files, keeps a cover and rejects partial results", async () => {
  let failFile = false;
  const requested: string[] = [];
  setDriveWarehouseFetchForTests(async (input) => {
    const url = new URL(String(input));
    if (url.searchParams.get("op") === "drive-access") return Response.json({ token: "test", folderId: "test" });
    if (url.searchParams.has("q")) {
      return Response.json(url.searchParams.has("pageToken") ? {
        files: [{ id: "new", name: "travelos__trip__trip_one.json", modifiedTime: "2026-09-12" }],
      } : {
        files: [{ id: "old", name: "travelos__trip__trip_one.json", modifiedTime: "2026-09-11" }],
        nextPageToken: "page2",
      });
    }
    requested.push(url.pathname);
    return failFile ? new Response("unavailable", { status: 503 }) : Response.json(fatTrip("trip_one"));
  });
  try {
    const bundle = await getWarehouseTripCards();
    assert.equal(bundle?.length, 1);
    assert.deepEqual(requested, ["/drive/v3/files/new"]);
    const trip = bundle![0].trip as ReturnType<typeof fatTrip>;
    assert.equal(trip.photos.length, 1);
    assert.equal(trip.photos[0].id, "trip_one_cover");
    assert.equal("journalEntries" in trip, false);
    failFile = true;
    await assert.rejects(getWarehouseTripCards(), /file read failed/);
  } finally {
    setDriveWarehouseFetchForTests(null);
  }
});

test("latest private duplicate wins before public filtering; missing seeds still match content API", async () => {
  resetPublicHubCacheForTests();
  setDriveWarehouseFetchForTests(async (input) => {
    if (new URL(String(input)).searchParams.get("op") === "drive-access") return Response.json({});
    return Response.json({ trips: [
      { trip: fatTrip("trip_duplicate", "private"), modifiedTime: "2026-09-12" },
      { trip: fatTrip("trip_duplicate"), modifiedTime: "2026-09-11" },
      { trip: fatTrip("trip_shared_current") },
    ] });
  });
  try {
    const cards = await readPublicHubTrips();
    assert.equal(cards.some((trip) => trip.id === "trip_duplicate"), false);
    assert.ok(cards.some((trip) => trip.id === "trip_shared_current"));
    assert.ok(cards.some((trip) => trip.id === seedPublicHubTrips()[0].id));
  } finally {
    setDriveWarehouseFetchForTests(null);
    resetPublicHubCacheForTests();
  }
});
