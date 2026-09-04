import { calendarDayInTimeZone, momentCalendarDay, shiftCalendarDay } from "./moment-index.ts";
import type { GeoPoint, MomentPhoto, TravelJob, TravelMoment } from "@/lib/types";

export const MOMENTS_BLOB_PATH = "travelos/moments.json";
export const MOMENT_PHOTO_PLAY_PATH = "/api/moments/photos";
export const DRIVE_STORAGE_PREFIX = "drive:";

export function driveFileIdFromStorageKey(storageKey: string | null | undefined): string | null {
  const key = storageKey?.trim() ?? "";
  if (!key.startsWith(DRIVE_STORAGE_PREFIX)) {
    return null;
  }
  const id = key.slice(DRIVE_STORAGE_PREFIX.length).trim();
  return id || null;
}

export function momentPhotoPlayUrl(
  momentId: string,
  photoId: string,
  options: { fileId?: string | null; variant?: "display" | "thumb" } = {},
) {
  const params = new URLSearchParams({ momentId, photoId });
  if (options.variant === "thumb") {
    params.set("variant", "thumb");
  }
  if (options.fileId) {
    params.set("file", options.fileId);
  }
  return `${MOMENT_PHOTO_PLAY_PATH}?${params.toString()}`;
}

export const MOMENT_ITEM_PREFIX = "travelos/moments/items";
export const MOMENTS_SCHEMA_VERSION = 2;

export function momentItemBlobPath(momentId: string) {
  const safeId = momentId.replace(/[^A-Za-z0-9._-]/g, "-");
  return `${MOMENT_ITEM_PREFIX}/${safeId}.json`;
}

const heicTypes = new Set(["image/heic", "image/heif", "image/heic-sequence", "image/heif-sequence"]);
const videoExtensions = [".mov", ".mp4", ".m4v"];

const instructionVerbPattern = /^(please\s+)?(add|save|put|move|delete|remove|tag|attach)\b/i;
const writeLogPattern = /\bwrite\b[\s\S]{0,80}\b(log|journal)\b/i;
const travelosImportPattern = /\binto\s+travelos\b/i;
const commandChinesePattern = /^(幫我|請)(把|將|存|刪|加入|移到|寫)/;

export function makeMomentId(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export function emptyMomentLabels() {
  return {
    food: [] as string[],
    people: [] as string[],
    place: [] as string[],
    scenery: [] as string[],
    topics: [] as string[],
  };
}

export function displayPhotoStem(name: string) {
  return name.trim().toLowerCase().replace(/\.[^.]+$/, "");
}

export function mergeMomentPhoto(left: MomentPhoto, right: MomentPhoto): MomentPhoto {
  const leftCreated = Date.parse(left.createdAt) || Number.POSITIVE_INFINITY;
  const rightCreated = Date.parse(right.createdAt) || Number.POSITIVE_INFINITY;
  const earlier = leftCreated <= rightCreated ? left : right;
  const later = earlier === left ? right : left;

  return {
    ...earlier,
    ...later,
    coordinates: later.coordinates ?? earlier.coordinates,
    createdAt: earlier.createdAt || later.createdAt,
    id: left.id || right.id,
    momentId: left.momentId || right.momentId,
    kind: later.kind ?? earlier.kind,
    mimeType: later.mimeType || earlier.mimeType || null,
    originalFilename: later.originalFilename || earlier.originalFilename,
    originalStorageKey: later.originalStorageKey || earlier.originalStorageKey,
    storageKey: later.storageKey || earlier.storageKey,
    takenAt: later.takenAt || earlier.takenAt,
  };
}

export function mergeMomentPhotos(...groups: MomentPhoto[][]) {
  const byStorage = new Map<string, MomentPhoto>();
  const byId = new Map<string, MomentPhoto>();
  const byStem = new Map<string, MomentPhoto>();
  const order: MomentPhoto[] = [];

  const remember = (photo: MomentPhoto) => {
    if (photo.storageKey) {
      byStorage.set(photo.storageKey, photo);
    }
    if (photo.id) {
      byId.set(photo.id, photo);
    }
    const stem = displayPhotoStem(photo.originalFilename ?? "");
    if (stem) {
      byStem.set(stem, photo);
    }
  };

  for (const group of groups) {
    for (const incoming of group) {
      if (!incoming) {
        continue;
      }
      const stem = displayPhotoStem(incoming.originalFilename ?? "");
      const existing =
        (incoming.storageKey ? byStorage.get(incoming.storageKey) : undefined) ??
        (incoming.id ? byId.get(incoming.id) : undefined) ??
        (stem ? byStem.get(stem) : undefined) ??
        null;
      if (!existing) {
        order.push(incoming);
        remember(incoming);
        continue;
      }

      const merged = mergeMomentPhoto(existing, incoming);
      const index = order.indexOf(existing);
      if (index >= 0) {
        order[index] = merged;
      }
      remember(merged);
    }
  }

  return order;
}

export function appendMomentPhotos<T extends { id?: string }>(current: T[], incoming: T[]) {
  const seen = new Set(current.map((item) => item.id).filter((id): id is string => Boolean(id)));
  const extra: T[] = [];
  for (const item of incoming) {
    if (item.id && seen.has(item.id)) {
      continue;
    }
    extra.push(item);
    if (item.id) {
      seen.add(item.id);
    }
  }
  return [...current, ...extra];
}

export function mergeTravelMoment(base: TravelMoment, extra: TravelMoment): TravelMoment {
  return normalizeTravelMoment({
    ...base,
    ...extra,
    command: extra.command ?? base.command,
    coordinates: extra.coordinates ?? base.coordinates,
    createdAt: base.createdAt || extra.createdAt,
    draft: extra.draft || base.draft,
    note: extra.note || base.note,
    originalAudioUrl: extra.originalAudioUrl ?? base.originalAudioUrl,
    photos: mergeMomentPhotos(base.photos ?? [], extra.photos ?? []),
    time: extra.time || base.time,
    transcript: extra.transcript ?? base.transcript,
    tripId: extra.tripId ?? base.tripId,
  });
}

export function uniqueMomentsById(moments: TravelMoment[]) {
  const byId = new Map<string, TravelMoment>();
  const order: string[] = [];
  for (const moment of moments) {
    const current = byId.get(moment.id);
    if (!current) {
      byId.set(moment.id, normalizeTravelMoment(moment));
      order.push(moment.id);
      continue;
    }
    byId.set(moment.id, mergeTravelMoment(current, moment));
  }
  return order.map((id) => byId.get(id)).filter((moment): moment is TravelMoment => moment != null);
}

function momentReceivedStamp(moment: TravelMoment) {
  return Date.parse(moment.createdAt) || Date.parse(moment.time ?? "") || 0;
}

export function momentNeedsTranscript(moment: Pick<TravelMoment, "originalAudioUrl" | "transcript">) {
  return Boolean(moment.originalAudioUrl?.trim()) && !moment.transcript?.trim();
}

export function sortMomentsNewestFirst(moments: TravelMoment[]) {
  return uniqueMomentsById(moments).sort((left, right) => {
    return momentReceivedStamp(right) - momentReceivedStamp(left);
  });
}

export function applyMomentPhotoAppends(
  moments: TravelMoment[],
  incoming: Array<{ momentId: string; photo: MomentPhoto }>,
) {
  const grouped = new Map<string, MomentPhoto[]>();
  for (const item of incoming) {
    const list = grouped.get(item.momentId) ?? [];
    list.push(item.photo);
    grouped.set(item.momentId, list);
  }

  return moments.map((moment) => {
    const extra = grouped.get(moment.id);
    if (!extra?.length) {
      return moment;
    }

    return {
      ...moment,
      photos: appendMomentPhotos(moment.photos, extra),
    };
  });
}

export function isHeicPhoto(file: { name: string; type: string }) {
  const type = file.type.toLowerCase();
  const name = file.name.toLowerCase();
  return heicTypes.has(type) || name.endsWith(".heic") || name.endsWith(".heif");
}

export function isCaptureVideoFile(file: { name: string; type: string }) {
  const type = file.type.toLowerCase();
  const name = file.name.toLowerCase();
  return type.startsWith("video/") || videoExtensions.some((extension) => name.endsWith(extension));
}

export function captureFileMime(file: { name: string; type: string }) {
  const type = file.type.trim();
  if (type) {
    return type;
  }

  const name = file.name.toLowerCase();
  if (name.endsWith(".mov")) {
    return "video/quicktime";
  }
  if (name.endsWith(".mp4") || name.endsWith(".m4v")) {
    return "video/mp4";
  }
  if (name.endsWith(".heic")) {
    return "image/heic";
  }
  if (name.endsWith(".heif")) {
    return "image/heif";
  }
  return file.type;
}

export function momentMediaKindFromFile(file: { name: string; type: string }) {
  return isCaptureVideoFile(file) ? ("video" as const) : ("photo" as const);
}

export function isMomentVideo(photo: Pick<MomentPhoto, "kind" | "mimeType" | "originalFilename">) {
  if (photo.kind === "video") {
    return true;
  }
  if (photo.kind === "photo") {
    return false;
  }
  return isCaptureVideoFile({
    name: photo.originalFilename ?? "",
    type: photo.mimeType ?? "",
  });
}

export function contentTypeForMomentMedia(
  photo: Pick<MomentPhoto, "kind" | "mimeType" | "originalFilename">,
  fallback = "image/jpeg",
) {
  const mime = photo.mimeType?.trim();
  if (mime) {
    return mime;
  }

  const name = (photo.originalFilename ?? "").toLowerCase();
  if (name.endsWith(".mp4") || name.endsWith(".m4v")) {
    return "video/mp4";
  }
  if (name.endsWith(".mov")) {
    return "video/quicktime";
  }
  if (name.endsWith(".png")) {
    return "image/png";
  }
  if (name.endsWith(".webp")) {
    return "image/webp";
  }
  if (name.endsWith(".gif")) {
    return "image/gif";
  }
  if (isMomentVideo(photo)) {
    return "video/mp4";
  }
  return fallback;
}

export function heicJpegFilename(name: string) {
  const base = name.replace(/\.[^.]+$/, "") || "moment-photo";
  return `${base}.jpg`;
}

export function looksLikeSystemCommand(text: string) {
  const trimmed = text.trim();
  if (!trimmed) {
    return false;
  }

  if (trimmed.startsWith("/")) {
    return true;
  }

  if (instructionVerbPattern.test(trimmed) || commandChinesePattern.test(trimmed)) {
    return true;
  }

  if (writeLogPattern.test(trimmed)) {
    return true;
  }

  return travelosImportPattern.test(trimmed) && /\b(put|save|add|photos?)\b/i.test(trimmed);
}

export function classifyCaptureNote(text: string): { command: string | null; note: string } {
  const trimmed = text.trim();
  if (!trimmed) {
    return { command: null, note: "" };
  }

  if (looksLikeSystemCommand(trimmed)) {
    return { command: trimmed, note: "" };
  }

  return { command: null, note: trimmed };
}

export function parseCommandAssetWindow(command: string): { days: number | null; todayOnly: boolean } {
  const dayMatch = command.match(/\b(\d+)\s*-?\s*days?\b/i);
  if (dayMatch) {
    return { days: Number(dayMatch[1]), todayOnly: false };
  }

  if (/\btoday\b/i.test(command) || command.includes("今天")) {
    return { days: null, todayOnly: true };
  }

  return { days: null, todayOnly: false };
}

export function selectMomentIdsForCommand(
  command: string,
  moments: TravelMoment[],
  sourceMomentId: string,
  now = new Date(),
) {
  const selected = new Set<string>([sourceMomentId]);
  const window = parseCommandAssetWindow(command);
  const nowDay = calendarDayInTimeZone(now.toISOString());
  let startDay = nowDay;

  if (window.days != null) {
    startDay = shiftCalendarDay(nowDay, -Math.max(0, window.days - 1));
  }

  for (const moment of moments) {
    const day = momentCalendarDay(moment);
    if (window.todayOnly && day === nowDay) {
      selected.add(moment.id);
    }

    if (window.days != null && day >= startDay && day <= nowDay) {
      selected.add(moment.id);
    }
  }

  return [...selected];
}

export function createTravelMoment(
  input: {
    command?: string | null;
    coordinates?: GeoPoint | null;
    createdAt?: string;
    draft?: string;
    id?: string;
    note?: string;
    originalAudioUrl?: string | null;
    time?: string | null;
    transcript?: string | null;
    tripId?: string | null;
  } = {},
): TravelMoment {
  const createdAt = input.createdAt ?? new Date().toISOString();
  const id = input.id?.trim();

  return {
    command: input.command?.trim() ? input.command.trim() : null,
    coordinates: input.coordinates ?? null,
    createdAt,
    draft: input.draft ?? "",
    food: [],
    id: id || makeMomentId("moment"),
    note: input.note ?? "",
    originalAudioUrl: input.originalAudioUrl ?? null,
    people: [],
    photos: [],
    place: [],
    scenery: [],
    time: input.time ?? createdAt,
    topics: [],
    transcript: input.transcript ?? null,
    tripId: input.tripId ?? null,
  };
}

export function createTravelJob(input: {
  command: string;
  createdAt?: string;
  draft?: string;
  momentIds: string[];
  sourceMomentId: string;
}): TravelJob {
  const createdAt = input.createdAt ?? new Date().toISOString();
  const momentIds = [...new Set([input.sourceMomentId, ...input.momentIds])];

  return {
    command: input.command.trim(),
    createdAt,
    draft: input.draft ?? "",
    id: makeMomentId("job"),
    momentIds,
    sourceMomentId: input.sourceMomentId,
  };
}

export function normalizeTravelMoment(moment: TravelMoment): TravelMoment {
  const labels = emptyMomentLabels();

  return {
    command: moment.command ?? null,
    coordinates: moment.coordinates ?? null,
    createdAt: moment.createdAt,
    draft: moment.draft ?? "",
    food: Array.isArray(moment.food) ? moment.food : labels.food,
    id: moment.id,
    note: moment.note ?? "",
    originalAudioUrl: moment.originalAudioUrl ?? null,
    people: Array.isArray(moment.people) ? moment.people : labels.people,
    photos: Array.isArray(moment.photos) ? moment.photos : [],
    place: Array.isArray(moment.place) ? moment.place : labels.place,
    scenery: Array.isArray(moment.scenery) ? moment.scenery : labels.scenery,
    time: moment.time ?? moment.createdAt,
    topics: Array.isArray(moment.topics) ? moment.topics : labels.topics,
    transcript: moment.transcript ?? null,
    tripId: moment.tripId ?? null,
  };
}

export function normalizeTravelJob(job: TravelJob): TravelJob {
  const sourceMomentId = job.sourceMomentId;
  const momentIds = Array.isArray(job.momentIds) ? job.momentIds : [sourceMomentId];

  return {
    command: job.command,
    createdAt: job.createdAt,
    draft: job.draft ?? "",
    id: job.id,
    momentIds: [...new Set([sourceMomentId, ...momentIds])],
    sourceMomentId,
  };
}
