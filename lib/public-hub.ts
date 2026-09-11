import { VANITY_CREW_HELD_TRIP_IDS } from "@/lib/trip-series";
import { getWarehouseTripBundle, isDriveWarehouseConfigured } from "@/lib/drive-warehouse";
import { HOME_SESSION_PHOTO_LIMIT } from "@/lib/home-session-photos";
import { seedTripDetails } from "@/lib/trips";
import { compareTripsByStartDateDesc, isTripPublic } from "@/lib/trip-visibility";
import type { Money, Photo, TripDetail } from "@/lib/types";

export const PUBLIC_HUB_CACHE_TTL_MS = 120_000;
export const PUBLIC_HUB_SEED_TTL_MS = 20_000;
export const PUBLIC_HUB_DRIVE_BUDGET_MS = 10_000;
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
    inflight: Promise<HubTripCard[]> | null;
  };
};

function cacheStore() {
  const globalStore = globalThis as GlobalHubCache;
  if (!globalStore[cacheKey]) {
    globalStore[cacheKey] = { entry: null, inflight: null };
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

async function readHubTripsFromWarehouse(): Promise<HubTripCard[] | null> {
  if (!isDriveWarehouseConfigured()) {
    return null;
  }

  const bundle = await getWarehouseTripBundle();
  if (!bundle?.length) {
    return null;
  }

  const cards: HubTripCard[] = [];
  for (const item of bundle) {
    const card = parseHubCard(item.trip ?? item);
    if (card) {
      cards.push(card);
    }
  }
  return cards.length > 0 ? preferLatestHubCards(cards) : null;
}

async function loadPublicHubTrips() {
  const seed = seedPublicHubTrips();
  const previous = cacheStore().entry?.trips ?? [];
  const preferPreviousOrSeed = () => (previous.length > seed.length ? previous : seed);
  try {
    const fromDrive = await withBudget(PUBLIC_HUB_DRIVE_BUDGET_MS, readHubTripsFromWarehouse());
    if (!fromDrive?.length) {
      const trips = preferPreviousOrSeed();
      cacheStore().entry = {
        at: Date.now(),
        ttl: trips === seed ? PUBLIC_HUB_SEED_TTL_MS : PUBLIC_HUB_CACHE_TTL_MS,
        trips,
      };
      return trips;
    }
    const trips = mergeSeedHubCards(fromDrive);
    cacheStore().entry = { at: Date.now(), ttl: PUBLIC_HUB_CACHE_TTL_MS, trips };
    return trips;
  } catch {
    const trips = preferPreviousOrSeed();
    cacheStore().entry = {
      at: Date.now(),
      ttl: trips === seed ? PUBLIC_HUB_SEED_TTL_MS : PUBLIC_HUB_CACHE_TTL_MS,
      trips,
    };
    return trips;
  }
}

/** Isolate memory cache. Hubs must not call readContent() / full Drive trip trees. */
export async function readPublicHubTrips(): Promise<HubTripCard[]> {
  const store = cacheStore();
  const now = Date.now();
  if (store.entry && now - store.entry.at < store.entry.ttl) {
    return store.entry.trips;
  }
  if (store.inflight) {
    return store.inflight;
  }
  store.inflight = loadPublicHubTrips().finally(() => {
    store.inflight = null;
  });
  return store.inflight;
}

export function invalidatePublicHubCache() {
  const store = cacheStore();
  store.entry = null;
  store.inflight = null;
}

export function resetPublicHubCacheForTests() {
  invalidatePublicHubCache();
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
