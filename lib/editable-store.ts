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
  return {
    content,
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
