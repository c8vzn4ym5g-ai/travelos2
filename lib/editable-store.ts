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

  if (mergedContent.trips.length !== content.trips.length) {
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

    const mergedTrip = {
      ...trip,
      title: trip.id === "trip_lapland_2020" ? seedTrip.title : trip.title,
      summary: trip.id === "trip_lapland_2020" ? seedTrip.summary : trip.summary,
      coverPhotoId: trip.id === "trip_lapland_2020" ? seedTrip.coverPhotoId : trip.coverPhotoId ?? seedTrip.coverPhotoId,
      photos:
        trip.id === "trip_lapland_2020"
          ? mergeById(seedTrip.photos, trip.photos)
          : mergeById(trip.photos, seedTrip.photos),
      journalEntries:
        trip.id === "trip_lapland_2020"
          ? mergeById(seedTrip.journalEntries, trip.journalEntries)
          : mergeById(trip.journalEntries, seedTrip.journalEntries),
      places:
        trip.id === "trip_lapland_2020"
          ? mergeById(seedTrip.places, trip.places)
          : mergeById(trip.places, seedTrip.places),
      costs:
        trip.id === "trip_lapland_2020"
          ? mergeById(seedTrip.costs, trip.costs)
          : mergeById(trip.costs, seedTrip.costs),
    };

    if (
      mergedTrip.title !== trip.title ||
      mergedTrip.summary !== trip.summary ||
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

function mergeById<T extends { id: string }>(savedItems: T[], seedItems: T[]) {
  const savedIds = new Set(savedItems.map((item) => item.id));
  return [...savedItems, ...seedItems.filter((item) => !savedIds.has(item.id))];
}
