import type { JournalEntry, Photo, Place, TripDetail } from "@/lib/types";

export const KYOTO_MAPLE_TRIP_ID = "trip_kyoto_maple";
export const KYOTO_MAPLE_SLUG = "kyoto-maple";
export const KYOTO_MAPLE_TITLE = "爱慕虚荣团 · 京都枫叶";

export const KYOTO_MAPLE_CHAPTER_IDS = [
  "trip_kyoto_maple_crew_notes",
  "trip_kyoto_maple_arashiyama",
  "trip_kyoto_maple_ginkaku",
  "trip_kyoto_maple_tofukuji_path",
  "trip_kyoto_maple_higashiyama",
] as const;

const CHAPTER_ID_SET = new Set<string>(KYOTO_MAPLE_CHAPTER_IDS);

const PHOTO_CHAPTER_ORDER = [
  "trip_kyoto_maple_arashiyama",
  "trip_kyoto_maple_ginkaku",
  "trip_kyoto_maple_higashiyama",
  "trip_kyoto_maple_tofukuji_path",
  "trip_kyoto_maple_crew_notes",
] as const;

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
  const id = photo.id || (driveId ? `photo_maple_${driveId}` : `photo_maple_${index}`);
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
  const name = place.name?.trim() || `地点 ${index + 1}`;
  return {
    id: place.id || `place_maple_${index + 1}`,
    tripId,
    type: place.type || "attraction",
    name,
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

function normalizeJournal(entry: Partial<JournalEntry>, tripId: string, fallbackId: string): JournalEntry {
  return {
    id: entry.id || fallbackId,
    tripId,
    title: entry.title || "京都枫叶",
    body: entry.body || "",
    entryDate: (entry.entryDate || (entry as { date?: string }).date || "").slice(0, 10) || "2022-11-15",
    storyPhotoId: entry.storyPhotoId ?? null,
    voiceNoteUrl: entry.voiceNoteUrl ?? null,
    mood: entry.mood ?? null,
    weatherSummary: entry.weatherSummary ?? null,
    aiSummary: entry.aiSummary ?? null,
    createdAt: entry.createdAt || isoNow(),
    updatedAt: entry.updatedAt || isoNow(),
  };
}

function sectionEntry(chapter: TripDetail, tripId: string): JournalEntry {
  return {
    id: `maple_section_${chapter.id}`,
    tripId,
    title: chapter.title,
    body: chapter.summary || "",
    entryDate: chapter.startDate?.slice(0, 10) || "2022-11-15",
    storyPhotoId: null,
    voiceNoteUrl: null,
    mood: null,
    weatherSummary: null,
    aiSummary: null,
    createdAt: chapter.createdAt || isoNow(),
    updatedAt: chapter.updatedAt || isoNow(),
  };
}

function collectPhotos(chapters: TripDetail[], tripId: string) {
  const used = new Set<string>();
  const photos: Photo[] = [];
  for (const chapterId of PHOTO_CHAPTER_ORDER) {
    const chapter = chapters.find((item) => item.id === chapterId);
    if (!chapter) {
      continue;
    }
    (chapter.photos as IngestPhoto[]).forEach((photo, index) => {
      const driveId = driveIdFromPhoto(photo);
      const dedupeKey = driveId || photo.id || `${chapterId}:${photo.originalFilename || index}`;
      if (used.has(dedupeKey)) {
        return;
      }
      const normalized = normalizePhoto(photo, tripId, photos.length);
      if (!normalized) {
        return;
      }
      used.add(dedupeKey);
      photos.push(normalized);
    });
  }
  return photos;
}

function collectJournals(chapters: TripDetail[], tripId: string) {
  const journals: JournalEntry[] = [];
  for (const chapterId of KYOTO_MAPLE_CHAPTER_IDS) {
    const chapter = chapters.find((item) => item.id === chapterId);
    if (!chapter) {
      continue;
    }
    journals.push(sectionEntry(chapter, tripId));
    chapter.journalEntries.forEach((entry, index) => {
      journals.push(normalizeJournal(entry, tripId, `maple_journal_${chapterId}_${index + 1}`));
    });
  }
  return journals;
}

function collectPlaces(chapters: TripDetail[], tripId: string) {
  const seen = new Set<string>();
  const places: Place[] = [];
  for (const chapter of chapters) {
    for (const place of chapter.places ?? []) {
      const key = `${place.name ?? ""}:${place.city ?? ""}`;
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);
      places.push(normalizePlace(place, tripId, places.length));
    }
  }
  return places;
}

export function buildKyotoMapleTrip(chapters: TripDetail[]): TripDetail {
  const ordered = KYOTO_MAPLE_CHAPTER_IDS
    .map((id) => chapters.find((chapter) => chapter.id === id))
    .filter((chapter): chapter is TripDetail => Boolean(chapter));
  const photos = collectPhotos(ordered, KYOTO_MAPLE_TRIP_ID);
  const startDate = ordered.map((chapter) => chapter.startDate).filter(Boolean).sort()[0] || "2022-11-15";
  const endDate = ordered.map((chapter) => chapter.endDate).filter(Boolean).sort().at(-1) || "2022-11-18";
  const updatedAt = ordered.map((chapter) => chapter.updatedAt).filter(Boolean).sort().at(-1) || isoNow();

  return {
    id: KYOTO_MAPLE_TRIP_ID,
    userId: ordered[0]?.userId || "user_travelos_owner",
    title: KYOTO_MAPLE_TITLE,
    slug: KYOTO_MAPLE_SLUG,
    summary:
      "爱慕虚荣团的京都赏枫：岚山翠嵐温泉饭店、禁区竹林、茶寮看河、银阁寺线、东山朱色，再加上四个人怎么一起玩开心。私人草稿，不进公开行程。",
    country: "Japan",
    city: "Kyoto",
    startDate,
    endDate,
    coverPhotoId: photos[0]?.id ?? null,
    visibility: "private",
    rating: null,
    totalCost: null,
    coordinates: null,
    createdAt: startDate.slice(0, 10) + "T00:00:00.000Z",
    updatedAt,
    journalEntries: collectJournals(ordered, KYOTO_MAPLE_TRIP_ID),
    photos,
    places: collectPlaces(ordered, KYOTO_MAPLE_TRIP_ID),
    travelRoute: [],
    costs: [],
    musicTracks: [],
  };
}

export function foldKyotoMapleTrips(trips: TripDetail[]): TripDetail[] {
  const canonical = trips.find((trip) => trip.id === KYOTO_MAPLE_TRIP_ID);
  const chapters = trips.filter((trip) => CHAPTER_ID_SET.has(trip.id));
  const rest = trips.filter((trip) => trip.id !== KYOTO_MAPLE_TRIP_ID && !CHAPTER_ID_SET.has(trip.id));

  if (canonical) {
    return [...rest, { ...canonical, visibility: "private" }];
  }

  if (chapters.length === 0) {
    return trips;
  }

  return [...rest, buildKyotoMapleTrip(chapters)];
}
