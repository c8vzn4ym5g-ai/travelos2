import type { GeoPoint, TravelMoment } from "@/lib/types";

export const MOMENTS_BLOB_PATH = "travelos/moments.json";
export const MOMENTS_SCHEMA_VERSION = 1;

const heicTypes = new Set(["image/heic", "image/heif", "image/heic-sequence", "image/heif-sequence"]);

const commandStartPattern =
  /^(please\s+)?(add|save|put|move|delete|remove|tag|attach)\b/i;
const commandChinesePattern = /^(幫我|請)(把|將|存|刪|加入|移到)/;

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

export function appendMomentPhotos<T>(current: T[], incoming: T[]) {
  return [...current, ...incoming];
}

export function isHeicPhoto(file: { name: string; type: string }) {
  const type = file.type.toLowerCase();
  const name = file.name.toLowerCase();
  return heicTypes.has(type) || name.endsWith(".heic") || name.endsWith(".heif");
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

  return commandStartPattern.test(trimmed) || commandChinesePattern.test(trimmed);
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

export function createTravelMoment(
  input: {
    command?: string | null;
    coordinates?: GeoPoint | null;
    createdAt?: string;
    draft?: string;
    note?: string;
    originalAudioUrl?: string | null;
    time?: string | null;
    transcript?: string | null;
    tripId?: string | null;
  } = {},
): TravelMoment {
  const createdAt = input.createdAt ?? new Date().toISOString();

  return {
    command: input.command?.trim() ? input.command.trim() : null,
    coordinates: input.coordinates ?? null,
    createdAt,
    draft: input.draft ?? "",
    food: [],
    id: makeMomentId("moment"),
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
