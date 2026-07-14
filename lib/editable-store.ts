import { list, put } from "@vercel/blob";
import { seedTripDetails } from "@/lib/trips";
import type { Photo, TripDetail } from "@/lib/types";

const DATA_BLOB_PATH = "travelos/content.json";

export type TravelOSContent = {
  trips: TripDetail[];
  updatedAt: string;
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
  const mergedContent = mergeSeedTrips(content);

  if (mergedContent.updatedAt !== content.updatedAt) {
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
    const mergedTrip = {
      ...trip,
      title: repairTripText ? seedTrip.title : trip.title,
      summary: repairTripText ? seedTrip.summary : trip.summary,
      coverPhotoId: trip.coverPhotoId ?? seedTrip.coverPhotoId,
      photos: mergeByIdWithRepair(trip.photos, seedTrip.photos, recordLooksCorrupted),
      journalEntries: mergeByIdWithRepair(trip.journalEntries, seedTrip.journalEntries, recordLooksCorrupted),
      places: mergeByIdWithRepair(trip.places, seedTrip.places, recordLooksCorrupted),
      costs: mergeByIdWithRepair(trip.costs, seedTrip.costs, recordLooksCorrupted),
    };

    if (
      mergedTrip.title !== trip.title ||
      mergedTrip.summary !== trip.summary ||
      JSON.stringify(mergedTrip.photos) !== JSON.stringify(trip.photos) ||
      JSON.stringify(mergedTrip.journalEntries) !== JSON.stringify(trip.journalEntries) ||
      JSON.stringify(mergedTrip.places) !== JSON.stringify(trip.places) ||
      JSON.stringify(mergedTrip.costs) !== JSON.stringify(trip.costs) ||
      mergedTrip.photos.length !== trip.photos.length ||
      mergedTrip.journalEntries.length !== trip.journalEntries.length ||
      mergedTrip.places.length !== trip.places.length ||
      mergedTrip.costs.length !== trip.costs.length ||
      mergedTrip.coverPhotoId !== trip.coverPhotoId
    ) {
      changed = true;
    }

    return mergedTrip;
  });

  const missingSeedTrips = seedTripDetails.filter((trip) => !existingIds.has(trip.id));

  if (missingSeedTrips.length === 0) {
    return changed
      ? {
          trips: mergedTrips,
          updatedAt: new Date().toISOString(),
        }
      : content;
  }

  return {
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
  return text.includes("???") || /[\uF000-\uF8FF]/.test(text);
}
