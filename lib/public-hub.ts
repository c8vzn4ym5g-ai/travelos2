import { afterResponse } from "@/lib/after-response";
import { DEFAULT_PUBLIC_SITE_ORIGIN } from "@/lib/site-url";
import { VANITY_CREW_HELD_TRIP_IDS } from "@/lib/trip-series";
import { getWarehouseTripBundle, getWarehouseTripCards, isDriveWarehouseConfigured } from "@/lib/drive-warehouse";
import { HOME_SESSION_PHOTO_LIMIT } from "@/lib/home-session-photos";
import { seedTripDetails } from "@/lib/trips";
import { compareTripsByStartDateDesc, isTripPublic } from "@/lib/trip-visibility";
import type { Money, Photo, TripDetail } from "@/lib/types";

export const PUBLIC_HUB_CACHE_TTL_MS = 120_000;
export const PUBLIC_HUB_SEED_TTL_MS = 20_000;
export const PUBLIC_HUB_DRIVE_BUDGET_MS = 6_000;
export const HUB_GALLERY_LIMIT = 4;

export type HubPhoto = {
  caption: string | null;
  id: string;
  storageKey: string;
};

export type HubTripCard = {
  city: string;
  country: string;
  coverPhoto: HubPhoto | null;
  endDate: string;
  id: string;
  photos: HubPhoto[];
  rating: number | null;
  slug: string;
  startDate: string;
  summary: string;
  title: string;
  totalCost: Money | null;
  visibility: TripDetail["visibility"];
};

type CacheEntry = {
  at: number;
  ttl: number;
  trips: HubTripCard[];
};

const cacheKey = "__travelosPublicHubTripCache";

type GlobalHubCache = typeof globalThis & {
  [cacheKey]?: {
    entry: CacheEntry | null;
    seenNonSeed: boolean;
    revision: number;
    inflight: Promise<HubTripCard[]> | null;
  };
};

function cacheStore() {
  const globalStore = globalThis as GlobalHubCache;
  if (!globalStore[cacheKey]) {
    globalStore[cacheKey] = { entry: null, inflight: null, seenNonSeed: false, revision: 0 };
  }
  return globalStore[cacheKey];
}

function isRenderablePhoto(photo: { storageKey?: string } | null | undefined): photo is { storageKey: string } {
  return Boolean(photo?.storageKey && (photo.storageKey.startsWith("http") || photo.storageKey.startsWith("/")));
}

function toHubPhoto(photo: { caption?: string | null; id?: string; storageKey: string }, fallbackId: string): HubPhoto {
  return {
    caption: photo.caption ?? null,
    id: photo.id || fallbackId,
    storageKey: photo.storageKey,
  };
}

export function slimTripToHubCard(trip: TripDetail): HubTripCard {
  const renderable = trip.photos.filter(isRenderablePhoto);
  const cover =
    (trip.coverPhotoId ? renderable.find((photo) => photo.id === trip.coverPhotoId) : undefined) ?? renderable[0] ?? null;
  const extras = renderable.filter((photo) => photo !== cover).slice(0, HUB_GALLERY_LIMIT);
  const photos = [
    ...(cover ? [toHubPhoto(cover, `${trip.id}_cover`)] : []),
    ...extras.map((photo, index) => toHubPhoto(photo, `${trip.id}_g${index}`)),
  ];

  return {
    city: trip.city,
    country: trip.country,
    coverPhoto: cover ? toHubPhoto(cover, `${trip.id}_cover`) : null,
    endDate: trip.endDate ?? "",
    id: trip.id,
    photos,
    rating: trip.rating,
    slug: trip.slug,
    startDate: trip.startDate ?? "",
    summary: trip.summary,
    title: trip.title,
    totalCost: trip.totalCost,
    visibility: trip.visibility,
  };
}

export function seedPublicHubTrips() {
  return seedTripDetails.filter(isTripPublic).map(slimTripToHubCard).sort(compareTripsByStartDateDesc);
}

function preferLatestHubCards(cards: HubTripCard[]) {
  const byId = new Map<string, HubTripCard>();
  for (const card of cards) {
    byId.set(card.id, card);
  }
  return [...byId.values()];
}

export function mergeSeedHubCards(saved: HubTripCard[]) {
  const savedIds = new Set(saved.map((trip) => trip.id));
  return [...saved, ...seedPublicHubTrips().filter((trip) => !savedIds.has(trip.id))].sort(compareTripsByStartDateDesc);
}

const heldTripIds = new Set<string>(VANITY_CREW_HELD_TRIP_IDS);

function unwrapTripRecord(raw: unknown): Record<string, unknown> | null {
  if (!raw || typeof raw !== "object") {
    return null;
  }
  const record = raw as Record<string, unknown>;
  const nested =
    typeof record.id !== "string" && record.moment && typeof record.moment === "object"
      ? record.moment
      : typeof record.id !== "string" && record.trip && typeof record.trip === "object"
        ? record.trip
        : record;
  return nested && typeof nested === "object" ? (nested as Record<string, unknown>) : null;
}

function pickHubPhotos(rawPhotos: unknown, coverPhotoId: string | null, tripId: string) {
  if (!Array.isArray(rawPhotos)) {
    return { coverPhoto: null, photos: [] as HubPhoto[] };
  }

  const renderable: HubPhoto[] = [];
  for (const item of rawPhotos) {
    if (!item || typeof item !== "object") {
      continue;
    }
    const photo = item as { caption?: unknown; id?: unknown; storageKey?: unknown };
    if (typeof photo.storageKey !== "string" || !isRenderablePhoto({ storageKey: photo.storageKey })) {
      continue;
    }
    renderable.push(
      toHubPhoto(
        {
          caption: typeof photo.caption === "string" ? photo.caption : null,
          id: typeof photo.id === "string" ? photo.id : undefined,
          storageKey: photo.storageKey,
        },
        `${tripId}_p${renderable.length}`,
      ),
    );
  }

  const cover = (coverPhotoId ? renderable.find((photo) => photo.id === coverPhotoId) : undefined) ?? renderable[0] ?? null;
  const extras = renderable.filter((photo) => photo !== cover).slice(0, HUB_GALLERY_LIMIT);
  return {
    coverPhoto: cover,
    photos: [...(cover ? [cover] : []), ...extras],
  };
}

/** Card fields only. Do not keep journals, places, costs, or the full album. */
export function parseHubCard(raw: unknown): HubTripCard | null {
  const trip = unwrapTripRecord(raw);
  if (!trip) {
    return null;
  }
  const id = typeof trip.id === "string" ? trip.id : "";
  if (!id.startsWith("trip_") || heldTripIds.has(id)) {
    return null;
  }
  const visibility = trip.visibility === "public" || trip.visibility === "shared" ? trip.visibility : "private";
  if (visibility === "private") {
    return null;
  }
  const coverPhotoId = typeof trip.coverPhotoId === "string" ? trip.coverPhotoId : null;
  const { coverPhoto, photos } = pickHubPhotos(trip.photos, coverPhotoId, id);
  return {
    city: typeof trip.city === "string" ? trip.city : "",
    country: typeof trip.country === "string" ? trip.country : "",
    coverPhoto,
    endDate: typeof trip.endDate === "string" ? trip.endDate : "",
    id,
    photos,
    rating: typeof trip.rating === "number" ? trip.rating : null,
    slug: typeof trip.slug === "string" && trip.slug.trim() ? trip.slug : id.replace(/_/g, "-"),
    startDate: typeof trip.startDate === "string" ? trip.startDate : "",
    summary: typeof trip.summary === "string" ? trip.summary : "",
    title: typeof trip.title === "string" ? trip.title : "",
    totalCost:
      trip.totalCost && typeof trip.totalCost === "object"
        ? (trip.totalCost as Money)
        : null,
    visibility,
  };
}

async function withBudget<T>(ms: number, work: Promise<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error("hub-drive-budget")), ms);
  });
  try {
    return await Promise.race([work, timeout]);
  } finally {
    if (timer) {
      clearTimeout(timer);
    }
  }
}

// Cache API survives isolate eviction within a Cloudflare data center. Keep the
// snapshot longer than its freshness TTL so a Drive outage can use stale cards.
const snapshotUrl = `${DEFAULT_PUBLIC_SITE_ORIGIN}/__cache/public-hub-v1`;
function edgeCache(): Cache | undefined {
  return (globalThis as typeof globalThis & { caches?: CacheStorage & { default?: Cache } }).caches?.default;
}

function remember(trips: HubTripCard[], at = Date.now()) {
  const store = cacheStore();
  const seedIds = new Set(seedPublicHubTrips().map((trip) => trip.id));
  const hasNonSeed = trips.some((trip) => !seedIds.has(trip.id));
  // Includes seed-shaped warehouse responses: never replace a known library
  // with the bootstrap list, even after invalidation or an overlapping refresh.
  // A cold isolate cannot know whether a slow/missing edge lookup hides a known
  // library. Leave it loading instead of committing seeds over that snapshot.
  if (!hasNonSeed && (!store.entry || store.seenNonSeed || store.entry.trips.length > trips.length)) {
    return store.entry?.trips ?? [];
  }
  store.seenNonSeed ||= hasNonSeed;
  store.entry = { at, ttl: PUBLIC_HUB_CACHE_TTL_MS, trips };
  return trips;
}

/** Feed the same shared trips seen by a successful content API read into the hub. */
export async function cachePublicHubTrips(trips: unknown[]) {
  if (!cacheStore().entry) await withBudget(500, restoreSnapshot()).catch(() => {});
  const cards = preferLatestHubCards(trips.flatMap((trip) => {
    const card = parseHubCard(trip);
    return card ? [card] : [];
  })).sort(compareTripsByStartDateDesc);
  const store = cacheStore();
  store.revision += 1;
  const saved = remember(cards);
  if (saved !== cards) return;
  try {
    await edgeCache()?.put(snapshotUrl, Response.json(store.entry, {
      headers: { "Cache-Control": "public, max-age=2592000" },
    }));
  } catch { /* Memory remains usable if the edge cache is unavailable. */ }
}

async function restoreSnapshot() {
  try {
    const response = await edgeCache()?.match(snapshotUrl);
    if (!response) return;
    const entry = await response.json() as CacheEntry;
    if (!Array.isArray(entry.trips) || !Number.isFinite(entry.at)) return;
    if (!cacheStore().entry || entry.at > cacheStore().entry!.at) {
      // Re-parse public fields; snapshots never contain private trips or journals.
      const cards = entry.trips.flatMap((trip) => {
        const card = parseHubCard(trip);
        return card ? [card] : [];
      });
      remember(cards, entry.at);
    }
  } catch { /* The request still has a bounded Drive attempt. */ }
}

async function loadPublicHubTrips() {
  const store = cacheStore();
  const revision = store.revision;
  // Direct Drive reads fan out the trip files and keep only card fields; the
  // existing bundle remains a compatibility fallback for warehouse deployments.
  const read = async (work: ReturnType<typeof getWarehouseTripBundle>) => {
    const bundle = await work;
    if (!bundle?.length) throw new Error("hub-warehouse-unavailable");
    const latest = new Map<string, Record<string, unknown>>();
    for (const item of [...bundle].sort((a, b) => (a.modifiedTime ?? "").localeCompare(b.modifiedTime ?? ""))) {
      const trip = unwrapTripRecord(item.trip ?? item);
      if (typeof trip?.id === "string") latest.set(trip.id, trip);
    }
    const cards = [...latest.values()].flatMap((trip) => {
      const card = parseHubCard(trip);
      return card ? [card] : [];
    });
    // Match the content API's missing-seed merge, without resurrecting a seed
    // that the warehouse explicitly marked private.
    return [...cards, ...seedPublicHubTrips().filter((trip) => !latest.has(trip.id))];
  };
  try {
    const cards = await withBudget(30_000, Promise.any([
      read(getWarehouseTripCards()),
      read(getWarehouseTripBundle()),
    ]));
    if (revision === store.revision) await cachePublicHubTrips(cards);
  } catch { /* Preserve the last good entry; never commit a failure fallback. */ }
  return store.entry?.trips ?? [];
}

/** Stale-while-revalidate, with a single bounded wait on a truly cold request. */
export async function readPublicHubTrips(): Promise<HubTripCard[]> {
  const store = cacheStore();
  if (!store.entry) {
    await withBudget(500, restoreSnapshot()).catch(() => {});
  }
  if (store.entry && Date.now() - store.entry.at < store.entry.ttl) return store.entry.trips;
  if (!isDriveWarehouseConfigured()) return store.entry?.trips ?? [];
  if (!store.inflight) {
    const pending = loadPublicHubTrips().finally(() => {
      if (store.inflight === pending) store.inflight = null;
    });
    store.inflight = pending;
  }
  // Attach to every requesting Worker's lifetime, including concurrent callers.
  const pending = store.inflight;
  afterResponse(() => pending);
  if (store.entry) return store.entry.trips;
  return withBudget(PUBLIC_HUB_DRIVE_BUDGET_MS, pending)
    .catch(() => store.entry?.trips ?? []);
}

export function invalidatePublicHubCache() {
  const store = cacheStore();
  store.revision += 1;
  // Invalidation expires freshness, never the last good library or its history.
  if (store.entry) store.entry.at = 0;
}

export function resetPublicHubCacheForTests() {
  delete (globalThis as GlobalHubCache)[cacheKey];
}

export function hubCardAsSessionTrip(trip: HubTripCard) {
  return {
    coverPhotoId: trip.coverPhoto?.id ?? null,
    photos: trip.photos as Photo[],
    title: trip.title,
  };
}

export function isHubPhotoRenderable(photo: HubPhoto) {
  return isRenderablePhoto(photo);
}

export { HOME_SESSION_PHOTO_LIMIT };
