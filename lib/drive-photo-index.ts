import { driveStorageKey } from "@/lib/drive-warehouse";
import {
  displayPhotoStem,
  mergeMomentPhotos,
  mergeTravelMoment,
  normalizeTravelMoment,
  uniqueMomentsById,
} from "@/lib/moments";
import type { MomentPhoto, TravelMoment } from "@/lib/types";

export const DRIVE_PHOTO_NAME_PREFIX = "travelos__moments__photos__";
export const DRIVE_ITEM_NAME_PREFIX = "travelos__moments__items__";
export const DRIVE_AUDIO_NAME_PREFIX = "travelos__moments__audio__";

const MOMENT_FILE_RE = /^(moment_[A-Za-z0-9]+_[A-Za-z0-9]+)__(.+)$/;
const PHOTO_TAIL_RE = /^(original-)?(\d+)-(.+)$/;
const IMAGE_EXT_RE = /\.(jpe?g|png|webp|heic|heif|gif)$/i;

export type DriveListedFile = {
  id: string;
  mimeType?: string | null;
  name: string;
};

export type ParsedDrivePhotoFile = {
  filename: string;
  id: string;
  isOriginal: boolean;
  mimeType: string | null;
  momentId: string;
  name: string;
  stem: string;
};

export function parseDrivePhotoObjectName(name: string): ParsedDrivePhotoFile | null {
  if (!name.startsWith(DRIVE_PHOTO_NAME_PREFIX)) {
    return null;
  }

  const rest = name.slice(DRIVE_PHOTO_NAME_PREFIX.length);
  const match = rest.match(MOMENT_FILE_RE);
  if (!match) {
    return null;
  }

  const momentId = match[1];
  const tail = match[2];
  const tailMatch = tail.match(PHOTO_TAIL_RE);
  const isOriginal = tail.startsWith("original-");
  const filename = tailMatch?.[3] || tail.replace(/^original-/, "");
  if (!IMAGE_EXT_RE.test(filename) && !IMAGE_EXT_RE.test(name)) {
    return null;
  }

  return {
    filename,
    id: "",
    isOriginal,
    mimeType: null,
    momentId,
    name,
    stem: displayPhotoStem(filename),
  };
}

export function parseDriveItemObjectName(name: string): string | null {
  if (!name.startsWith(DRIVE_ITEM_NAME_PREFIX) || !name.endsWith(".json")) {
    return null;
  }
  const id = name.slice(DRIVE_ITEM_NAME_PREFIX.length, -".json".length);
  return id || null;
}

export function parseDriveAudioObjectName(name: string): string | null {
  if (!name.startsWith(DRIVE_AUDIO_NAME_PREFIX)) {
    return null;
  }
  const rest = name.slice(DRIVE_AUDIO_NAME_PREFIX.length);
  const match = rest.match(MOMENT_FILE_RE);
  return match?.[1] ?? null;
}

export function isDriveDisplayJpeg(file: ParsedDrivePhotoFile) {
  if (file.isOriginal) {
    return false;
  }
  return /\.jpe?g$/i.test(file.filename);
}

function photoFromDriveFile(file: ParsedDrivePhotoFile, createdAt: string): MomentPhoto {
  const storageKey = driveStorageKey(file.id);
  return {
    coordinates: null,
    createdAt,
    id: `moment_photo_drive_${file.id.replace(/[^A-Za-z0-9]/g, "").slice(0, 24)}`,
    momentId: file.momentId,
    originalFilename: file.filename,
    originalStorageKey: null,
    storageKey,
    takenAt: createdAt,
  };
}

function emptyMoment(momentId: string, createdAt: string): TravelMoment {
  return normalizeTravelMoment({
    command: null,
    coordinates: null,
    createdAt,
    draft: "",
    food: [],
    id: momentId,
    note: "",
    originalAudioUrl: null,
    people: [],
    photos: [],
    place: [],
    scenery: [],
    time: createdAt,
    topics: [],
    transcript: null,
    tripId: null,
  });
}

export function rebuildMomentsFromDriveFiles(
  files: DriveListedFile[],
  existingMoments: TravelMoment[] = [],
  now = new Date().toISOString(),
): TravelMoment[] {
  const byId = new Map<string, TravelMoment>();
  for (const moment of uniqueMomentsById(existingMoments)) {
    byId.set(moment.id, moment);
  }

  const displayByMoment = new Map<string, ParsedDrivePhotoFile[]>();
  const originalsByMoment = new Map<string, ParsedDrivePhotoFile[]>();
  const audioByMoment = new Map<string, string>();

  for (const file of files) {
    const audioMomentId = parseDriveAudioObjectName(file.name);
    if (audioMomentId && file.id) {
      audioByMoment.set(audioMomentId, driveStorageKey(file.id));
    }

    const parsed = parseDrivePhotoObjectName(file.name);
    if (!parsed || !file.id) {
      continue;
    }
    const photoFile = {
      ...parsed,
      id: file.id,
      mimeType: file.mimeType ?? null,
    };
    const bucket = photoFile.isOriginal ? originalsByMoment : displayByMoment;
    const list = bucket.get(photoFile.momentId) ?? [];
    list.push(photoFile);
    bucket.set(photoFile.momentId, list);
  }

  const momentIds = new Set([...byId.keys(), ...displayByMoment.keys(), ...originalsByMoment.keys(), ...audioByMoment.keys()]);

  for (const momentId of momentIds) {
    const current = byId.get(momentId) ?? emptyMoment(momentId, now);
    const displays = displayByMoment.get(momentId) ?? [];
    const originals = originalsByMoment.get(momentId) ?? [];
    const originalsByStem = new Map<string, ParsedDrivePhotoFile>();
    for (const original of originals) {
      if (!originalsByStem.has(original.stem)) {
        originalsByStem.set(original.stem, original);
      }
    }

    const fromFiles = displays.map((file) => {
      const photo = photoFromDriveFile(file, current.createdAt || now);
      const original = originalsByStem.get(file.stem);
      if (original) {
        photo.originalStorageKey = driveStorageKey(original.id);
      }
      return photo;
    });

    const photos = mergeMomentPhotos(current.photos, fromFiles);
    const withOriginals = photos.map((photo) => {
      if (photo.originalStorageKey) {
        return photo;
      }
      const original = originalsByStem.get(displayPhotoStem(photo.originalFilename ?? ""));
      return original ? { ...photo, originalStorageKey: driveStorageKey(original.id) } : photo;
    });

    const next: TravelMoment = {
      ...current,
      originalAudioUrl: current.originalAudioUrl ?? audioByMoment.get(momentId) ?? null,
      photos: withOriginals,
    };
    byId.set(momentId, mergeTravelMoment(current, next));
  }

  return uniqueMomentsById([...byId.values()]);
}

export function countUniqueDisplayJpegs(moments: TravelMoment[]) {
  const names = new Set<string>();
  for (const moment of moments) {
    for (const photo of moment.photos) {
      if (/\.jpe?g$/i.test(photo.originalFilename ?? "")) {
        names.add(`${moment.id}:${displayPhotoStem(photo.originalFilename)}`);
      }
    }
  }
  return names.size;
}

export function countUniqueDriveDisplayJpegs(files: DriveListedFile[]) {
  const names = new Set<string>();
  for (const file of files) {
    const parsed = parseDrivePhotoObjectName(file.name);
    if (!parsed || !isDriveDisplayJpeg(parsed)) {
      continue;
    }
    names.add(`${parsed.momentId}:${parsed.stem}`);
  }
  return names.size;
}
