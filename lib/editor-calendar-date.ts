import type { Photo } from "./types";

/** A journal day or camera-local day is a calendar value, not a UTC instant. */
export function formatCalendarDate(value: string | null | undefined) {
  if (!value) return "時間尚未整理";
  const day = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  return day ? `${Number(day[1])}年${Number(day[2])}月${Number(day[3])}日` : value.slice(0, 10);
}

export function formatPhotoDate(photo: Pick<Photo, "takenAt" | "captureMetadata"> | null | undefined) {
  const capture = photo?.captureMetadata;
  if (capture?.source === "exif" && capture.localTakenAt) return formatCalendarDate(capture.localTakenAt);
  if (!photo?.takenAt) return "時間尚未整理";
  // Legacy timestamp display remains a fallback; never rewrite the stored timestamp.
  const date = new Date(photo.takenAt);
  return Number.isNaN(date.getTime()) ? photo.takenAt.slice(0, 10)
    : new Intl.DateTimeFormat("zh-TW", { year: "numeric", month: "long", day: "numeric" }).format(date);
}

export function formatJournalDate(entryDate: string | null | undefined, photo: Pick<Photo, "takenAt" | "captureMetadata"> | null | undefined) {
  return entryDate ? formatCalendarDate(entryDate) : formatPhotoDate(photo);
}
