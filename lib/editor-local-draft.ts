import type { TripDetail } from "@/lib/types";

export const TRIP_LOCAL_DRAFT_PREFIX = "travelos-trip-draft:";
export const WRITE_LOCAL_DRAFT_PREFIX = "travelos-write-draft:";
export const EDITOR_LOCAL_DRAFT_INTERVAL_MS = 8000;
export const EDITOR_LOCAL_DRAFT_DEBOUNCE_MS = 400;

export type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export type TripLocalDraftRecord = {
  savedAt: string;
  trip: TripDetail;
  v: 1;
};

export type WriteLocalDraftRecord = {
  attachTripId: string;
  draft: string;
  hiddenPhotoIds: string[];
  key: string;
  savedAt: string;
  v: 1;
};

export function browserLocalStorage(): StorageLike | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function tripLocalDraftKey(tripId: string) {
  return `${TRIP_LOCAL_DRAFT_PREFIX}${tripId}`;
}

export function writeLocalDraftStorageKey(key: string) {
  return `${WRITE_LOCAL_DRAFT_PREFIX}${key}`;
}

export function writeDraftIdentity(input: {
  dayFilter?: string;
  jobId?: string | null;
  momentId?: string | null;
  placeFilter?: string;
  usingFoundSet?: boolean;
}) {
  if (input.jobId) {
    return `job:${input.jobId}`;
  }

  if (input.usingFoundSet) {
    return `found:${input.dayFilter ?? ""}\0${input.placeFilter ?? ""}`;
  }

  if (input.momentId) {
    return `moment:${input.momentId}`;
  }

  return null;
}

export function tripFingerprint(trip: TripDetail) {
  return JSON.stringify({
    city: trip.city,
    country: trip.country,
    coverPhotoId: trip.coverPhotoId,
    endDate: trip.endDate,
    id: trip.id,
    journalEntries: trip.journalEntries.map((entry) => ({
      body: entry.body,
      entryDate: entry.entryDate,
      id: entry.id,
      mood: entry.mood,
      storyPhotoId: entry.storyPhotoId ?? null,
      title: entry.title,
      voiceNoteUrl: entry.voiceNoteUrl ?? null,
      weatherSummary: entry.weatherSummary,
    })),
    photos: trip.photos.map((photo) => ({
      caption: photo.caption,
      id: photo.id,
      storageKey: photo.storageKey,
    })),
    slug: trip.slug,
    startDate: trip.startDate,
    summary: trip.summary,
    title: trip.title,
    visibility: trip.visibility,
  });
}

function readJson<T>(storage: StorageLike | null | undefined, key: string): T | null {
  if (!storage) {
    return null;
  }

  try {
    const raw = storage.getItem(key);
    if (!raw) {
      return null;
    }

    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function writeJson(storage: StorageLike | null | undefined, key: string, value: unknown) {
  if (!storage) {
    return false;
  }

  try {
    storage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

function removeKey(storage: StorageLike | null | undefined, key: string) {
  if (!storage) {
    return;
  }

  try {
    storage.removeItem(key);
  } catch {
    // Private mode can block localStorage.
  }
}

export function readTripLocalDraft(tripId: string, storage: StorageLike | null | undefined = browserLocalStorage()) {
  const record = readJson<TripLocalDraftRecord>(storage, tripLocalDraftKey(tripId));
  if (!record || record.v !== 1 || record.trip?.id !== tripId) {
    return null;
  }

  return record;
}

export function writeTripLocalDraft(trip: TripDetail, storage: StorageLike | null | undefined = browserLocalStorage()) {
  const record: TripLocalDraftRecord = {
    savedAt: new Date().toISOString(),
    trip,
    v: 1,
  };
  return writeJson(storage, tripLocalDraftKey(trip.id), record);
}

export function clearTripLocalDraft(tripId: string, storage: StorageLike | null | undefined = browserLocalStorage()) {
  removeKey(storage, tripLocalDraftKey(tripId));
}

export function applyTripLocalDrafts(
  trips: TripDetail[],
  storage: StorageLike | null | undefined = browserLocalStorage(),
) {
  const restoredIds: string[] = [];
  const next = trips.map((trip) => {
    const local = readTripLocalDraft(trip.id, storage);
    if (!local) {
      return trip;
    }

    if (tripFingerprint(local.trip) === tripFingerprint(trip)) {
      clearTripLocalDraft(trip.id, storage);
      return trip;
    }

    restoredIds.push(trip.id);
    return local.trip;
  });

  return { restoredIds, trips: next };
}

export function readWriteLocalDraft(key: string, storage: StorageLike | null | undefined = browserLocalStorage()) {
  const record = readJson<WriteLocalDraftRecord>(storage, writeLocalDraftStorageKey(key));
  if (!record || record.v !== 1 || record.key !== key) {
    return null;
  }

  return record;
}

export function writeWriteLocalDraft(
  record: Omit<WriteLocalDraftRecord, "savedAt" | "v">,
  storage: StorageLike | null | undefined = browserLocalStorage(),
) {
  const next: WriteLocalDraftRecord = {
    ...record,
    savedAt: new Date().toISOString(),
    v: 1,
  };
  return writeJson(storage, writeLocalDraftStorageKey(record.key), next);
}

export function clearWriteLocalDraft(key: string, storage: StorageLike | null | undefined = browserLocalStorage()) {
  removeKey(storage, writeLocalDraftStorageKey(key));
}

export function writeDraftNeedsRestore(
  local: WriteLocalDraftRecord,
  current: { attachTripId: string; draft: string; hiddenPhotoIds: string[] },
) {
  return (
    local.draft !== current.draft ||
    local.attachTripId !== current.attachTripId ||
    JSON.stringify(local.hiddenPhotoIds) !== JSON.stringify(current.hiddenPhotoIds)
  );
}
