import type { JournalEntry, TripDetail } from "@/lib/types";

export const PUBLIC_LAPLAND_TRIP_ID = "trip_lapland_2020";
export const PUBLIC_LAPLAND_SLUG = "finland-lapland-winter-journal-2020";
export const FAMILY_ADMIN_SESSION_KEY = "travelos-admin-pin";

const heicTypes = new Set(["image/heic", "image/heif", "image/heic-sequence", "image/heif-sequence"]);

export function isProtectedPublicLaplandTrip(trip: Pick<TripDetail, "id" | "slug">) {
  return trip.id === PUBLIC_LAPLAND_TRIP_ID || trip.slug === PUBLIC_LAPLAND_SLUG;
}

export function appendCapturePhotos<T>(current: T[], incoming: T[]) {
  return [...current, ...incoming];
}

export function isHeicPhoto(file: { name: string; type: string }) {
  const type = file.type.toLowerCase();
  const name = file.name.toLowerCase();
  return heicTypes.has(type) || name.endsWith(".heic") || name.endsWith(".heif");
}

export function heicJpegFilename(name: string) {
  const base = name.replace(/\.[^.]+$/, "") || "trip-photo";
  return `${base}.jpg`;
}

export function makeCaptureId(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export function buildPrivateCaptureTrip(input: { journalBody?: string; now?: Date } = {}): TripDetail {
  const now = (input.now ?? new Date()).toISOString();
  const date = now.slice(0, 10);
  const id = makeCaptureId("trip_moment");
  const slug = `family-moment-${date}-${id.slice(-8)}`;

  return {
    id,
    userId: "user_travelos_owner",
    title: `此刻記錄 / Family moment ${date}`,
    slug,
    summary: (input.journalBody ?? "").trim() || "A private family travel moment.",
    country: "Family",
    city: "On the road",
    startDate: date,
    endDate: date,
    coverPhotoId: null,
    visibility: "private",
    rating: null,
    totalCost: null,
    coordinates: null,
    createdAt: now,
    updatedAt: now,
    journalEntries: [],
    photos: [],
    places: [],
    travelRoute: [],
    costs: [],
    musicTracks: [],
  };
}

export function attachCaptureJournal(trip: TripDetail, body: string, now = new Date()): TripDetail {
  const timestamp = now.toISOString();
  const entry: JournalEntry = {
    id: makeCaptureId("journal"),
    tripId: trip.id,
    title: "此刻",
    body: body.trim() || "A private family travel moment.",
    entryDate: trip.startDate || timestamp.slice(0, 10),
    storyPhotoId: trip.photos[0]?.id ?? null,
    mood: null,
    weatherSummary: null,
    aiSummary: null,
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  return {
    ...trip,
    coverPhotoId: trip.coverPhotoId ?? trip.photos[0]?.id ?? null,
    journalEntries: [entry, ...trip.journalEntries],
    summary: body.trim() || trip.summary,
    updatedAt: timestamp,
  };
}
