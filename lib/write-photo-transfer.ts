import { driveFileIdFromStorageKey, isMomentVideo, momentPhotoPlayUrl } from "./moments.ts";
import type { JournalEntry, MomentPhoto, Photo, TripDetail } from "./types.ts";

/** Manual destination only. Preserve source references and never turn upload time into a memory. */
export function transferWritingToTrip(input: { trip: TripDetail; photos: MomentPhoto[]; draft: string; sourceKey: string; now: string }): TripDetail {
  const { trip, now } = input;
  const selected = input.photos.filter((photo) => !isMomentVideo(photo));
  const photos = [...trip.photos];
  const selectedIds: string[] = [];
  for (const source of selected) {
    const existing = photos.find((photo) => photo.id === source.id || photo.storageKey === source.storageKey || (photo.sourceMomentId === source.momentId && photo.sourcePhotoId === source.id));
    if (existing) { selectedIds.push(existing.id); continue; }
    const capture = source.captureMetadataStatus === "verified" && source.captureMetadata?.source === "exif" ? source.captureMetadata : null;
    const fileId = driveFileIdFromStorageKey(source.storageKey);
    const photo: Photo = {
      id: source.id, tripId: trip.id,
      storageKey: fileId ? momentPhotoPlayUrl(source.momentId, source.id, { fileId, variant: "thumb" }) : source.storageKey,
      originalStorageKey: source.originalStorageKey || source.storageKey, originalFilename: source.originalFilename,
      sourceMomentId: source.momentId, sourcePhotoId: source.id,
      caption: null, takenAt: capture?.takenAt ?? null, coordinates: capture?.coordinates ?? null,
      cameraMake: null, cameraModel: null, createdAt: source.createdAt,
      captureMetadata: capture,
    };
    photos.push(photo);
    selectedIds.push(photo.id);
  }
  const captureDays = selected.map((photo) => photo.captureMetadataStatus === "verified" ? photo.captureMetadata?.localTakenAt?.slice(0, 10) ?? "" : "");
  const entryDate = captureDays.length && captureDays.every((day) => /^\d{4}-\d{2}-\d{2}$/.test(day) && day === captureDays[0]) ? captureDays[0] : "";
  const id = `journal_from_${encodeURIComponent(input.sourceKey)}`;
  const existingEntry = trip.journalEntries.find((entry) => entry.id === id);
  const entry: JournalEntry = {
    id, tripId: trip.id, title: existingEntry?.title || entryDate || "這一段回憶", body: input.draft,
    entryDate, entryKind: existingEntry?.entryKind ?? "unreviewed",
    storyPhotoId: selectedIds[0] ?? null,
    createdAt: existingEntry?.createdAt ?? now, updatedAt: now,
    mood: existingEntry?.mood ?? null, weatherSummary: existingEntry?.weatherSummary ?? null, aiSummary: null,
  };
  return { ...trip, photos, journalEntries: [entry, ...trip.journalEntries.filter((item) => item.id !== id)], updatedAt: now };
}
