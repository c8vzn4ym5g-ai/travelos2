import { createHash } from "node:crypto";
import type { MomentPhoto, TravelMoment } from "@/lib/types";

export function hashPhotoBytes(bytes: Uint8Array | Buffer): string {
  return createHash("sha256").update(bytes).digest("hex");
}

export function normalizePhotoContentHash(value: string | null | undefined) {
  const hash = value?.trim().toLowerCase() ?? "";
  return /^[a-f0-9]{64}$/.test(hash) ? hash : "";
}

export function findPhotoByContentHash(moments: TravelMoment[], contentHash: string): MomentPhoto | null {
  const hash = normalizePhotoContentHash(contentHash);
  if (!hash) {
    return null;
  }

  let match: MomentPhoto | null = null;
  for (const moment of moments) {
    for (const photo of moment.photos) {
      if (normalizePhotoContentHash(photo.contentHash) !== hash) {
        continue;
      }
      if (!match) {
        match = photo;
        continue;
      }
      const matchCreated = Date.parse(match.createdAt) || Number.POSITIVE_INFINITY;
      const photoCreated = Date.parse(photo.createdAt) || Number.POSITIVE_INFINITY;
      if (photoCreated < matchCreated) {
        match = photo;
      }
    }
  }

  return match;
}

export type JournalLinkedTrip = {
  coverPhotoId?: string | null;
  photos?: Array<{ id?: string | null }>;
  journalEntries?: Array<{ storyPhotoId?: string | null }>;
  travelRoute?: Array<{ linkedPhotoId?: string | null }>;
};

export function journalLinkedPhotoIds(trips: JournalLinkedTrip[]): Set<string> {
  const linked = new Set<string>();
  for (const trip of trips) {
    if (trip.coverPhotoId) {
      linked.add(trip.coverPhotoId);
    }
    for (const photo of trip.photos ?? []) {
      if (photo.id) {
        linked.add(photo.id);
      }
    }
    for (const entry of trip.journalEntries ?? []) {
      if (entry.storyPhotoId) {
        linked.add(entry.storyPhotoId);
      }
    }
    for (const route of trip.travelRoute ?? []) {
      if (route.linkedPhotoId) {
        linked.add(route.linkedPhotoId);
      }
    }
  }
  return linked;
}

type PhotoRecord = {
  momentId: string;
  photo: MomentPhoto;
};

function recordKey(record: PhotoRecord) {
  return `${record.momentId}:${record.photo.id}`;
}

function collectPhotoRecords(moments: TravelMoment[]): PhotoRecord[] {
  const records: PhotoRecord[] = [];
  for (const moment of moments) {
    for (const photo of moment.photos) {
      records.push({ momentId: moment.id, photo });
    }
  }
  return records;
}

function findParent(parents: Map<string, string>, key: string) {
  let current = key;
  while (parents.get(current) !== current) {
    const next = parents.get(current);
    if (!next) {
      parents.set(current, current);
      return current;
    }
    current = next;
  }
  return current;
}

function unionKeys(parents: Map<string, string>, left: string, right: string) {
  const leftRoot = findParent(parents, left);
  const rightRoot = findParent(parents, right);
  if (leftRoot !== rightRoot) {
    parents.set(rightRoot, leftRoot);
  }
}

export function groupDuplicatePhotoRecords(moments: TravelMoment[]): PhotoRecord[][] {
  const records = collectPhotoRecords(moments);
  const parents = new Map<string, string>();
  const byHash = new Map<string, string>();
  const byStorage = new Map<string, string>();

  for (const record of records) {
    const key = recordKey(record);
    parents.set(key, key);
  }

  for (const record of records) {
    const key = recordKey(record);
    const hash = normalizePhotoContentHash(record.photo.contentHash);
    if (hash) {
      const existing = byHash.get(hash);
      if (existing) {
        unionKeys(parents, existing, key);
      } else {
        byHash.set(hash, key);
      }
    }
    const storageKey = record.photo.storageKey?.trim() ?? "";
    if (storageKey) {
      const existing = byStorage.get(storageKey);
      if (existing) {
        unionKeys(parents, existing, key);
      } else {
        byStorage.set(storageKey, key);
      }
    }
  }

  const groups = new Map<string, PhotoRecord[]>();
  for (const record of records) {
    const root = findParent(parents, recordKey(record));
    const list = groups.get(root) ?? [];
    list.push(record);
    groups.set(root, list);
  }

  return [...groups.values()].filter((group) => group.length > 1);
}

function earlierRecord(left: PhotoRecord, right: PhotoRecord) {
  const leftCreated = Date.parse(left.photo.createdAt) || Number.POSITIVE_INFINITY;
  const rightCreated = Date.parse(right.photo.createdAt) || Number.POSITIVE_INFINITY;
  if (leftCreated !== rightCreated) {
    return leftCreated <= rightCreated ? left : right;
  }
  return left.photo.id <= right.photo.id ? left : right;
}

export function dropUnreferencedDuplicatePhotos(
  moments: TravelMoment[],
  linkedPhotoIds: Iterable<string>,
): { droppedIds: string[]; moments: TravelMoment[] } {
  const linked = new Set([...linkedPhotoIds].filter(Boolean));
  const dropKeys = new Set<string>();
  const droppedIds: string[] = [];

  for (const group of groupDuplicatePhotoRecords(moments)) {
    const linkedRecords = group.filter((record) => linked.has(record.photo.id));
    const drop =
      linkedRecords.length > 0
        ? group.filter((record) => !linked.has(record.photo.id))
        : group.filter((record) => record !== group.reduce(earlierRecord));
    for (const record of drop) {
      const key = recordKey(record);
      if (dropKeys.has(key)) {
        continue;
      }
      dropKeys.add(key);
      droppedIds.push(record.photo.id);
    }
  }

  if (dropKeys.size === 0) {
    return { droppedIds, moments };
  }

  return {
    droppedIds,
    moments: moments.map((moment) => ({
      ...moment,
      photos: moment.photos.filter((photo) => !dropKeys.has(`${moment.id}:${photo.id}`)),
    })),
  };
}
