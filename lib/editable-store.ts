import { list, put } from "@vercel/blob";
import { seedTripDetails } from "@/lib/trips";
import type { MusicTrack, Photo, TripDetail } from "@/lib/types";

const DATA_BLOB_PATH = "travelos/content.json";
const CONTENT_SCHEMA_VERSION = 4;

export type TravelOSContent = {
  trips: TripDetail[];
  updatedAt: string;
  schemaVersion?: number;
};

export type StoreStatus = {
  configured: boolean;
  source: "blob" | "seed";
};

export function isBlobConfigured() {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN || process.env.BLOB_STORE_ID);
}

export function isAdminPinValid(pin: string | null) {
  const expectedPin = process.env.TRAVELOS_ADMIN_PIN;
  return Boolean(expectedPin && pin && pin === expectedPin);
}

export async function readContent(): Promise<{ content: TravelOSContent; status: StoreStatus }> {
  if (!isBlobConfigured()) {
    return {
      content: createSeedContent(),
      status: { configured: false, source: "seed" },
    };
  }

  const blobs = await list({ prefix: DATA_BLOB_PATH, limit: 1 });
  const dataBlob = blobs.blobs.find((blob) => blob.pathname === DATA_BLOB_PATH);

  if (!dataBlob) {
    const content = createSeedContent();
    await writeContent(content.trips);
    return {
      content,
      status: { configured: true, source: "seed" },
    };
  }

  const response = await fetch(`${dataBlob.url}?v=${Date.now()}`, { cache: "no-store" });
  if (!response.ok) {
    return {
      content: createSeedContent(),
      status: { configured: true, source: "seed" },
    };
  }

  const content = (await response.json()) as TravelOSContent;
  const { changed, content: mergedContent } = normalizeContent(content);

  if (changed) {
    await writeContent(mergedContent.trips);
  }

  return {
    content: mergedContent,
    status: { configured: true, source: "blob" },
  };
}

export async function writeContent(trips: TripDetail[]) {
  const content: TravelOSContent = {
    trips,
    schemaVersion: CONTENT_SCHEMA_VERSION,
    updatedAt: new Date().toISOString(),
  };

  await put(DATA_BLOB_PATH, JSON.stringify(content, null, 2), {
    access: "public",
    allowOverwrite: true,
    contentType: "application/json",
  });

  return content;
}

export async function addPhotoToTrip(tripId: string, photo: Photo) {
  const { content } = await readContent();
  const trips = content.trips.map((trip) =>
    trip.id === tripId
      ? {
          ...trip,
          photos: [photo, ...trip.photos],
          updatedAt: new Date().toISOString(),
        }
      : trip,
  );

  return writeContent(trips);
}

export async function addMusicTrackToTrip(tripId: string, musicTrack: MusicTrack) {
  const { content } = await readContent();
  const trips = content.trips.map((trip) =>
    trip.id === tripId
      ? {
          ...trip,
          musicTracks: [musicTrack, ...(trip.musicTracks ?? [])],
          updatedAt: new Date().toISOString(),
        }
      : trip,
  );

  return writeContent(trips);
}

function createSeedContent(): TravelOSContent {
  return {
    schemaVersion: CONTENT_SCHEMA_VERSION,
    trips: seedTripDetails,
    updatedAt: new Date().toISOString(),
  };
}

function normalizeContent(content: TravelOSContent): { changed: boolean; content: TravelOSContent } {
  const mergedContent = mergeSeedTrips(content);
  const changed =
    mergedContent.updatedAt !== content.updatedAt ||
    content.schemaVersion !== CONTENT_SCHEMA_VERSION ||
    mergedContent.trips.length !== content.trips.length ||
    JSON.stringify(mergedContent.trips) !== JSON.stringify(content.trips);

  return {
    changed,
    content: changed
      ? {
          ...mergedContent,
          schemaVersion: CONTENT_SCHEMA_VERSION,
          updatedAt: new Date().toISOString(),
        }
      : {
          ...content,
          schemaVersion: content.schemaVersion ?? CONTENT_SCHEMA_VERSION,
        },
  };
}

function mergeSeedTrips(content: TravelOSContent): TravelOSContent {
  let changed = false;
  const savedSchemaVersion = content.schemaVersion ?? 1;
  const seedTripsById = new Map(seedTripDetails.map((trip) => [trip.id, trip]));
  const existingIds = new Set(content.trips.map((trip) => trip.id));

  const mergedTrips = content.trips.map((trip) => {
    const seedTrip = seedTripsById.get(trip.id);

    if (!seedTrip) {
      return trip;
    }

    const repairTripText =
      recordLooksCorrupted(trip.title) ||
      recordLooksCorrupted(trip.summary) ||
      shouldMigrateSeedTripCopy(trip, seedTrip, savedSchemaVersion);
    const repairTripSlug = !trip.slug || recordLooksCorrupted(trip.slug);
    const repairCoverPhoto =
      !trip.coverPhotoId ||
      !trip.photos.some((photo) => photo.id === trip.coverPhotoId && photoIsRenderable(photo));
    const savedMusicTracks = Array.isArray(trip.musicTracks) ? trip.musicTracks : [];

    const mergedTrip = {
      ...trip,
      title: repairTripText ? seedTrip.title : trip.title,
      summary: repairTripText ? seedTrip.summary : trip.summary,
      slug: repairTripSlug ? seedTrip.slug : trip.slug,
      coverPhotoId: repairCoverPhoto ? seedTrip.coverPhotoId : trip.coverPhotoId,
      photos: mergeByIdWithRepair(trip.photos, seedTrip.photos, (photo) =>
        photoNeedsSeedRepair(photo) || shouldMigrateSeedItemCopy(photo, seedTrip, savedSchemaVersion),
      ),
      journalEntries: mergeByIdWithRepair(trip.journalEntries, seedTrip.journalEntries, (entry) =>
        recordLooksCorrupted(entry) || shouldMigrateSeedItemCopy(entry, seedTrip, savedSchemaVersion),
      ),
      places: mergeByIdWithRepair(trip.places, seedTrip.places, (place) =>
        recordLooksCorrupted(place) || shouldMigrateSeedItemCopy(place, seedTrip, savedSchemaVersion),
      ),
      costs: mergeByIdWithRepair(trip.costs, seedTrip.costs, recordLooksCorrupted),
      musicTracks: mergeByIdWithRepair(savedMusicTracks, seedTrip.musicTracks, musicTrackNeedsSeedRepair),
    };

    if (JSON.stringify(mergedTrip) !== JSON.stringify(trip)) {
      changed = true;
    }

    return mergedTrip;
  });

  const missingSeedTrips = seedTripDetails.filter((trip) => !existingIds.has(trip.id));

  if (missingSeedTrips.length === 0) {
    return changed
      ? {
          schemaVersion: CONTENT_SCHEMA_VERSION,
          trips: mergedTrips,
          updatedAt: new Date().toISOString(),
        }
      : content;
  }

  return {
    schemaVersion: CONTENT_SCHEMA_VERSION,
    trips: [...missingSeedTrips, ...mergedTrips],
    updatedAt: new Date().toISOString(),
  };
}

function mergeByIdWithRepair<T extends { id: string }>(
  savedItems: T[],
  seedItems: T[],
  shouldRepair: (item: T) => boolean,
) {
  const seedItemsById = new Map(seedItems.map((item) => [item.id, item]));
  const savedIds = new Set(savedItems.map((item) => item.id));

  return [
    ...savedItems.map((item) => {
      const seedItem = seedItemsById.get(item.id);
      return seedItem && shouldRepair(item) ? seedItem : item;
    }),
    ...seedItems.filter((item) => !savedIds.has(item.id)),
  ];
}

function recordLooksCorrupted(record: unknown) {
  const text = typeof record === "string" ? record : JSON.stringify(record);
  return text.includes("???") || /[\uF000-\uF8FF]/.test(text) || looksLikeMojibake(text);
}

function shouldMigrateSeedTripCopy(trip: TripDetail, seedTrip: TripDetail, savedSchemaVersion: number) {
  if (savedSchemaVersion >= CONTENT_SCHEMA_VERSION || !seedContainsTraditionalChinese(seedTrip)) {
    return false;
  }

  return trip.id === seedTrip.id && !containsTraditionalTravelosMarker(`${trip.title} ${trip.summary}`);
}

function shouldMigrateSeedItemCopy<T extends { id: string; tripId?: string }>(
  item: T,
  seedTrip: TripDetail,
  savedSchemaVersion: number,
) {
  if (savedSchemaVersion >= CONTENT_SCHEMA_VERSION || item.tripId !== seedTrip.id) {
    return false;
  }

  return !containsTraditionalTravelosMarker(JSON.stringify(item));
}

function seedContainsTraditionalChinese(seedTrip: TripDetail) {
  return containsTraditionalTravelosMarker(`${seedTrip.title} ${seedTrip.summary}`);
}

function containsTraditionalTravelosMarker(text: string) {
  return /[\u862d\u8a18\u61b6\u8056\u8a95\u5713\u6a19\u71df\u71c8]/.test(text);
}

function looksLikeMojibake(text: string) {
  const mojibakeMarkerCodes = [
    0x929d, 0x877a, 0x5697, 0x648c, 0x761b, 0x8761, 0x981d, 0x95ac, 0x6470,
    0x61ad, 0x64a0, 0x6468, 0x96a4, 0x96ff, 0x7486, 0x922d, 0x66ba, 0x9908,
  ];

  return [...text].some((character) => mojibakeMarkerCodes.includes(character.codePointAt(0) ?? 0));
}

function photoNeedsSeedRepair(photo: Photo) {
  return recordLooksCorrupted(photo) || !photoIsRenderable(photo) || photo.storageKey.startsWith("placeholder/");
}

function photoIsRenderable(photo: Photo) {
  return photo.storageKey.startsWith("http") || photo.storageKey.startsWith("/");
}

function musicTrackNeedsSeedRepair(musicTrack: MusicTrack) {
  return recordLooksCorrupted(musicTrack) || musicTrack.audioUrl.trim().length === 0 || musicTrack.volume < 0 || musicTrack.volume > 1;
}
