import { S2TW } from "@/lib/s2tw-characters";
import type { JournalEntry, Photo, Place, TripDetail } from "@/lib/types";

/** Specialty/series metadata only. Never prepend this onto a journal title. */
export const VANITY_CREW_SERIES = "愛慕虛榮團";
export const VANITY_CREW_SERIES_ALIASES = ["Vanity Crew", "爱慕虚荣团", "愛慕虛榮團"] as const;

export const VANITY_CREW_MAPLE_JOURNAL_IDS = [
  "trip_kyoto_maple_arashiyama",
  "trip_kyoto_maple_ginkaku",
  "trip_kyoto_maple_higashiyama",
  "trip_kyoto_maple_crew_notes",
] as const;

export const VANITY_CREW_JOURNAL_TITLES = {
  trip_kyoto_maple_arashiyama: "嵐山翠嵐：溫泉飯店裡的楓葉禁區",
  trip_kyoto_maple_ginkaku: "銀閣寺線",
  trip_kyoto_maple_higashiyama: "東山朱色",
  trip_kyoto_maple_crew_notes: "京都四人怎麼一起玩開心",
} as const;

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
const SERIES_TITLE_PREFIX = /^\s*(爱慕虚荣团|愛慕虛榮團)\s*[·•:：]?\s*/u;
const KEEP_ZHU_SE = "\uE010\uE011";
const KEEP_ZHU_HONG = "\uE012\uE013";
const KEEP_ADRIATIC = "\uE014\uE015\uE016";

type CrewFields = {
  name?: string;
  members?: string;
  tone?: string;
  note?: string;
};

type TripExtras = TripDetail & {
  crew?: CrewFields;
  draftNotes?: string;
};

/** Taiwan 繁體 (OpenCC s2tw characters). Protect 朱色 and 亞得里亞 from over-conversion. */
export function toTraditional(value: string | null | undefined) {
  if (!value) {
    return value ?? "";
  }
  let next = value
    .split("朱色").join(KEEP_ZHU_SE)
    .split("朱紅").join(KEEP_ZHU_HONG)
    .split("亞得里亞").join(KEEP_ADRIATIC);
  next = [...next].map((char) => S2TW[char] ?? char).join("");
  return next
    .split(KEEP_ZHU_SE).join("朱色")
    .split(KEEP_ZHU_HONG).join("朱紅")
    .split(KEEP_ADRIATIC).join("亞得里亞")
    .split("硃色").join("朱色")
    .split("硃紅").join("朱紅");
}

function convertNullable(value: string | null | undefined): string | null {
  if (value == null) {
    return null;
  }
  return toTraditional(value);
}

export function stripSeriesFromTitle(title: string) {
  let next = title.trim();
  for (let i = 0; i < 4; i += 1) {
    const stripped = next.replace(SERIES_TITLE_PREFIX, "").trim();
    if (stripped === next) {
      break;
    }
    next = stripped;
  }
  return next;
}

export function mapleJournalTitle(trip: Pick<TripDetail, "id" | "title">) {
  const locked = VANITY_CREW_JOURNAL_TITLES[trip.id as keyof typeof VANITY_CREW_JOURNAL_TITLES];
  if (locked) {
    return locked;
  }
  return toTraditional(stripSeriesFromTitle(trip.title)).replace(/[（(]\s*Day\s*\d+\s*[）)]/gi, "").trim();
}

function convertJournalEntry(entry: JournalEntry, tripId: string, index: number): JournalEntry {
  return {
    ...entry,
    id: entry.id || `journal_${tripId}_${index + 1}`,
    tripId,
    title: toTraditional(entry.title),
    body: toTraditional(entry.body),
    mood: convertNullable(entry.mood),
    weatherSummary: convertNullable(entry.weatherSummary),
    aiSummary: convertNullable(entry.aiSummary),
  };
}

function convertCrew(crew: CrewFields | undefined) {
  if (!crew) {
    return crew;
  }
  return {
    ...crew,
    name: crew.name ? toTraditional(crew.name) : crew.name,
    members: crew.members ? toTraditional(crew.members) : crew.members,
    tone: crew.tone ? toTraditional(crew.tone) : crew.tone,
    note: crew.note ? toTraditional(crew.note) : crew.note,
  };
}

export function prepareReaderChinese(trip: TripDetail): TripDetail {
  const extra = trip as TripExtras;
  const draftNotes = typeof extra.draftNotes === "string" ? toTraditional(extra.draftNotes) : extra.draftNotes;
  const crew = convertCrew(extra.crew);
  return {
    ...trip,
    title: toTraditional(stripSeriesFromTitle(trip.title)).replace(/[（(]\s*Day\s*\d+\s*[）)]/gi, "").trim() || trip.title,
    summary: toTraditional(trip.summary),
    series: trip.series ? toTraditional(trip.series) : trip.series,
    photos: (trip.photos ?? []).map((photo) => ({
      ...photo,
      caption: convertNullable(photo.caption),
    })),
    places: (trip.places ?? []).map((place) => ({
      ...place,
      name: toTraditional(place.name),
      notes: convertNullable(place.notes),
      address: convertNullable(place.address),
    })),
    journalEntries: (trip.journalEntries ?? []).map((entry, index) => convertJournalEntry(entry, trip.id, index)),
    travelRoute: (trip.travelRoute ?? []).map((segment) => ({
      ...segment,
      fromLabel: toTraditional(segment.fromLabel),
      toLabel: toTraditional(segment.toLabel),
      note: convertNullable(segment.note),
    })),
    costs: (trip.costs ?? []).map((cost) => ({
      ...cost,
      merchant: convertNullable(cost.merchant),
      notes: convertNullable(cost.notes),
    })),
    musicTracks: (trip.musicTracks ?? []).map((track) => ({
      ...track,
      title: toTraditional(track.title),
      triggerLabel: toTraditional(track.triggerLabel),
      credit: track.credit ? toTraditional(track.credit) : track.credit,
    })),
    ...(crew ? { crew } : {}),
    ...(draftNotes !== undefined ? { draftNotes } : {}),
  };
}

export function prepareMapleJournal(trip: TripDetail): TripDetail {
  const photos = (trip.photos as IngestPhoto[])
    .map((photo, index) => normalizePhoto(photo, trip.id, index))
    .filter((photo): photo is Photo => Boolean(photo));
  const places = (trip.places ?? []).map((place, index) => normalizePlace(place, trip.id, index));
  const converted = prepareReaderChinese({ ...trip, photos, places });
  return {
    ...converted,
    userId: trip.userId || "user_travelos_owner",
    title: mapleJournalTitle(trip),
    visibility: "private",
    series: VANITY_CREW_SERIES,
    seriesAliases: [...VANITY_CREW_SERIES_ALIASES],
    coverPhotoId: trip.coverPhotoId || photos[0]?.id || converted.coverPhotoId || null,
  };
}

export function prepareTripForWarehouse(trip: TripDetail) {
  return MAPLE_JOURNAL_ID_SET.has(trip.id) ? prepareMapleJournal(trip) : prepareReaderChinese(trip);
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
    .map((trip) => (MAPLE_JOURNAL_ID_SET.has(trip.id) ? prepareMapleJournal(trip) : prepareReaderChinese(trip)));
}
