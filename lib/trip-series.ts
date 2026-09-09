import type { Photo, Place, TripDetail } from "@/lib/types";

export const VANITY_CREW_SERIES = "爱慕虚荣团";

export const VANITY_CREW_MAPLE_JOURNAL_IDS = [
  "trip_kyoto_maple_arashiyama",
  "trip_kyoto_maple_ginkaku",
  "trip_kyoto_maple_higashiyama",
  "trip_kyoto_maple_crew_notes",
] as const;

export const VANITY_CREW_HELD_TRIP_IDS = [
  "trip_kyoto_maple_tofukuji_path",
  "trip_kyoto_maple",
] as const;

const MAPLE_JOURNAL_ID_SET = new Set<string>(VANITY_CREW_MAPLE_JOURNAL_IDS);
const HELD_TRIP_ID_SET = new Set<string>(VANITY_CREW_HELD_TRIP_IDS);

type IngestPhoto = Partial<Photo> & {
  date?: string;
  sourceTime?: string;
  sourceRecords?: Array<{ driveId?: string | null }>;
};

function isoNow() {
  return "2022-11-15T00:00:00.000Z";
}

function driveIdFromPhoto(photo: IngestPhoto) {
  const fromKey = photo.storageKey?.startsWith("/api/trips/media?id=")
    ? photo.storageKey.slice("/api/trips/media?id=".length)
    : null;
  return photo.sourceRecords?.find((record) => record.driveId)?.driveId || fromKey || null;
}

function photoTakenAt(photo: IngestPhoto) {
  if (photo.takenAt) {
    return photo.takenAt;
  }
  const day = photo.date?.slice(0, 10);
  if (!day) {
    return null;
  }
  const time = photo.sourceTime && /^\d{2}:\d{2}/.test(photo.sourceTime) ? photo.sourceTime : "00:00:00";
  return `${day}T${time}.000Z`;
}

function normalizePhoto(photo: IngestPhoto, tripId: string, index: number): Photo | null {
  const driveId = driveIdFromPhoto(photo);
  const id = photo.id || (driveId ? `photo_${tripId}_${driveId}` : `photo_${tripId}_${index}`);
  const storageKey = photo.storageKey?.startsWith("http") || photo.storageKey?.startsWith("/")
    ? photo.storageKey
    : driveId
      ? `/api/trips/media?id=${driveId}`
      : "";
  if (!storageKey) {
    return null;
  }
  return {
    id,
    tripId,
    storageKey,
    originalFilename: photo.originalFilename || `maple-${index + 1}.jpg`,
    caption: photo.caption ?? null,
    takenAt: photoTakenAt(photo),
    coordinates: photo.coordinates ?? null,
    cameraMake: photo.cameraMake ?? null,
    cameraModel: photo.cameraModel ?? null,
    createdAt: photo.createdAt || isoNow(),
  };
}

function normalizePlace(place: Partial<Place>, tripId: string, index: number): Place {
  return {
    id: place.id || `place_${tripId}_${index + 1}`,
    tripId,
    type: place.type || "attraction",
    name: place.name?.trim() || `地点 ${index + 1}`,
    country: place.country || "Japan",
    city: place.city || "Kyoto",
    address: place.address ?? null,
    coordinates: place.coordinates ?? null,
    rating: place.rating ?? null,
    notes: place.notes ?? null,
    createdAt: place.createdAt || isoNow(),
    updatedAt: place.updatedAt || isoNow(),
  };
}

function vanityCrewTitle(trip: TripDetail) {
  if (trip.id === "trip_kyoto_maple_crew_notes") {
    return "爱慕虚荣团 · 团主题：四个人怎么一起把京都玩开心";
  }
  if (trip.title.includes(VANITY_CREW_SERIES)) {
    return trip.title;
  }
  return `${VANITY_CREW_SERIES} · ${trip.title}`;
}

function prepareMapleJournal(trip: TripDetail): TripDetail {
  const photos = (trip.photos as IngestPhoto[])
    .map((photo, index) => normalizePhoto(photo, trip.id, index))
    .filter((photo): photo is Photo => Boolean(photo));

  return {
    ...trip,
    userId: trip.userId || "user_travelos_owner",
    title: vanityCrewTitle(trip),
    visibility: "private",
    series: VANITY_CREW_SERIES,
    seriesAliases: ["Vanity Crew", "爱慕虚荣团"],
    coverPhotoId: trip.coverPhotoId || photos[0]?.id || null,
    photos,
    places: (trip.places ?? []).map((place, index) => normalizePlace(place, trip.id, index)),
    journalEntries: (trip.journalEntries ?? []).map((entry, index) => ({
      ...entry,
      id: entry.id || `journal_${trip.id}_${index + 1}`,
      tripId: trip.id,
    })),
    travelRoute: trip.travelRoute ?? [],
    costs: trip.costs ?? [],
    musicTracks: trip.musicTracks ?? [],
  };
}

export function isHeldFamilyEditorTrip(tripId: string) {
  return HELD_TRIP_ID_SET.has(tripId);
}

export function tripSeriesNames(trip: Pick<TripDetail, "series" | "seriesAliases" | "title">) {
  return [trip.series, ...(trip.seriesAliases ?? []), trip.title].filter((value): value is string => Boolean(value));
}

export function searchTripsBySeries(trips: TripDetail[], query: string) {
  const needle = query.trim();
  if (!needle) {
    return trips;
  }
  return trips.filter((trip) => tripSeriesNames(trip).some((name) => name.includes(needle)));
}

export function prepareFamilyEditorTrips(trips: TripDetail[]): TripDetail[] {
  return trips
    .filter((trip) => !isHeldFamilyEditorTrip(trip.id))
    .map((trip) => (MAPLE_JOURNAL_ID_SET.has(trip.id) ? prepareMapleJournal(trip) : trip));
}
