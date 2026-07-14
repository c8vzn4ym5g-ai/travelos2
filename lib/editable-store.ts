import { list, put } from "@vercel/blob";
import { seedTripDetails } from "@/lib/trips";
import type { Photo, TripDetail } from "@/lib/types";

const DATA_BLOB_PATH = "travelos/content.json";
const CONTENT_SCHEMA_VERSION = 2;

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

function createSeedContent(): TravelOSContent {
  return {
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
  const seedTripsById = new Map(seedTripDetails.map((trip) => [trip.id, trip]));
  const existingIds = new Set(content.trips.map((trip) => trip.id));

  const mergedTrips = content.trips.map((trip) => {
    const seedTrip = seedTripsById.get(trip.id);

    if (!seedTrip) {
      return trip;
    }

    const repairTripText = recordLooksCorrupted(trip.title) || recordLooksCorrupted(trip.summary);
    const repairTripSlug = !trip.slug || recordLooksCorrupted(trip.slug);
    const repairCoverPhoto =
      !trip.coverPhotoId ||
      !trip.photos.some((photo) => photo.id === trip.coverPhotoId && photoIsRenderable(photo));

    const mergedTrip = {
      ...trip,
      title: repairTripText ? seedTrip.title : trip.title,
      summary: repairTripText ? seedTrip.summary : trip.summary,
      slug: repairTripSlug ? seedTrip.slug : trip.slug,
      coverPhotoId: repairCoverPhoto ? seedTrip.coverPhotoId : trip.coverPhotoId,
      photos: mergeByIdWithRepair(trip.photos, seedTrip.photos, photoNeedsSeedRepair),
      journalEntries: mergeByIdWithRepair(trip.journalEntries, seedTrip.journalEntries, recordLooksCorrupted),
      places: mergeByIdWithRepair(trip.places, seedTrip.places, recordLooksCorrupted),
      costs: mergeByIdWithRepair(trip.costs, seedTrip.costs, recordLooksCorrupted),
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
