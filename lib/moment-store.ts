import { afterResponse } from "@/lib/after-response";
import { put } from "@vercel/blob";
import { getMomentJsonBlob, isMomentJsonBlobConfigured, putMomentItemJson, putMomentJsonBlob, setMomentBlobAdapterForTests } from "@/lib/moment-blob";
import { isAdminPinValid, isBlobConfigured } from "@/lib/editable-store";
import {
  loadMomentItemFromBlobGet,
  overlayMoments,
  putMomentItemRecord,
} from "@/lib/moment-item";
import { indexTravelMoment } from "@/lib/moment-index";
import { momentNeedsTranscript, transcribeAudioUrl } from "@/lib/moment-transcript";
import {
  MOMENTS_BLOB_PATH,
  MOMENTS_SCHEMA_VERSION,
  appendMomentPhotos,
  applyMomentPhotoAppends,
  normalizeTravelJob,
  normalizeTravelMoment,
  sortMomentsNewestFirst,
} from "@/lib/moments";
import type { MomentPhoto, TravelJob, TravelMoment } from "@/lib/types";
import {
  type MomentContent,
  MomentWarehouseUnavailableError,
  createEmptyWarehouse,
  loadWarehouseFromBlobGet,
  withNormalizedContent,
} from "@/lib/warehouse-read";

export type { MomentContent, WarehouseGet, WarehouseGetResult } from "@/lib/warehouse-read";
export {
  MOMENTS_BLOB_PATH,
  MomentWarehouseUnavailableError,
  WAREHOUSE_GET_OPTIONS,
  loadWarehouseFromBlobGet,
} from "@/lib/warehouse-read";
export { momentItemBlobPath } from "@/lib/moments";
export { setMomentBlobAdapterForTests };

export type MomentStoreStatus = {
  configured: boolean;
  source: "blob" | "memory";
};

export { isAdminPinValid };

function isBlobWarehouseReadError(error: unknown) {
  return (
    error instanceof Error &&
    /Vercel Blob:|Failed to fetch blob|403 Forbidden|BlobAccessError/i.test(error.message)
  );
}

export function momentApiErrorResponse(error: unknown) {
  if (error instanceof MomentWarehouseUnavailableError) {
    return Response.json({ error: error.message }, { status: 503 });
  }
  if (isBlobWarehouseReadError(error)) {
    const detail = error instanceof Error ? error.message : "blob get failed";
    return Response.json(
      { error: detail.startsWith("Could not read") ? detail : `Could not read the moment warehouse. ${detail}` },
      { status: 503 },
    );
  }
  throw error;
}

const memoryKey = "__travelosMomentWarehouse";
const itemCacheKey = "__travelosMomentItemCache";
const lastIndexKey = "__travelosMomentLastIndexWrite";

type GlobalWarehouse = typeof globalThis & {
  [memoryKey]?: MomentContent;
  [itemCacheKey]?: Map<string, TravelMoment>;
  [lastIndexKey]?: MomentContent | null;
};

function getMemoryContent() {
  const globalStore = globalThis as GlobalWarehouse;
  globalStore[memoryKey] ??= createEmptyWarehouse();
  return globalStore[memoryKey];
}

function setMemoryContent(content: MomentContent) {
  (globalThis as GlobalWarehouse)[memoryKey] = content;
}

function getItemCache() {
  const globalStore = globalThis as GlobalWarehouse;
  globalStore[itemCacheKey] ??= new Map<string, TravelMoment>();
  return globalStore[itemCacheKey];
}

function getLastIndexWrite() {
  return (globalThis as GlobalWarehouse)[lastIndexKey] ?? null;
}

function setLastIndexWrite(content: MomentContent | null) {
  (globalThis as GlobalWarehouse)[lastIndexKey] = content;
}

export function resetMomentStoreForTests() {
  setMomentBlobAdapterForTests(null);
  setMemoryContent(createEmptyWarehouse());
  getItemCache().clear();
  setLastIndexWrite(null);
  warehouseWriteQueue = Promise.resolve();
  pendingPhotoAppends.length = 0;
  photoAppendFlush = null;
  transcriptInFlight.clear();
  transcriptJobs.clear();
}

let warehouseWriteQueue: Promise<void> = Promise.resolve();

function withWarehouseLock<T>(work: () => Promise<T>): Promise<T> {
  const run = warehouseWriteQueue.then(work, work);
  warehouseWriteQueue = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

function rememberItem(moment: TravelMoment) {
  const next = normalizeTravelMoment(moment);
  getItemCache().set(next.id, next);
  return next;
}

async function readIndexRaw(): Promise<MomentContent> {
  if (!isMomentJsonBlobConfigured()) {
    return withNormalizedContent(getMemoryContent());
  }

  const loaded = await loadWarehouseFromBlobGet(getMomentJsonBlob);
  const lastWrite = getLastIndexWrite();
  const mergedMoments = overlayMoments(loaded.content.moments, [
    ...(lastWrite?.moments ?? []),
    ...getItemCache().values(),
  ]);
  const mergedJobs = lastWrite
    ? overlayJobs(loaded.content.jobs, lastWrite.jobs)
    : loaded.content.jobs;

  if (loaded.createdEmpty && getItemCache().size === 0 && !lastWrite) {
    await writeWarehouse(mergedMoments, mergedJobs);
  }

  return {
    ...loaded.content,
    jobs: mergedJobs,
    moments: mergedMoments,
  };
}

function overlayJobs(indexJobs: TravelJob[], extraJobs: TravelJob[]) {
  const byId = new Map(indexJobs.map((job) => [job.id, job]));
  for (const job of extraJobs) {
    byId.set(job.id, job);
  }
  const extra = extraJobs.filter((job) => !indexJobs.some((item) => item.id === job.id));
  return [...extra, ...indexJobs.map((job) => byId.get(job.id) ?? job)];
}

export async function getMomentById(momentId: string) {
  return readMomentItem(momentId);
}

async function readMomentItem(momentId: string): Promise<TravelMoment | null> {
  const cached = getItemCache().get(momentId);
  if (cached) {
    return cached;
  }

  if (isMomentJsonBlobConfigured()) {
    const fromBlob = await loadMomentItemFromBlobGet(getMomentJsonBlob, momentId);
    if (fromBlob) {
      return rememberItem(fromBlob);
    }
  }

  const index = await readIndexRaw();
  const fromIndex = index.moments.find((moment) => moment.id === momentId) ?? null;
  if (fromIndex) {
    return rememberItem(fromIndex);
  }

  return null;
}

async function writeMomentItem(moment: TravelMoment) {
  const saved = rememberItem(moment);
  if (!isMomentJsonBlobConfigured()) {
    return saved;
  }

  await putMomentItemRecord(putMomentItemJson, saved);
  return saved;
}

async function syncIndexBestEffort(
  updatedMoments: TravelMoment[] = [],
  photoAppends: Array<{ momentId: string; photo: MomentPhoto }> = [],
) {
  for (const moment of updatedMoments) {
    rememberItem(moment);
  }

  const index = await readIndexRaw();
  const withPhotos = photoAppends.length > 0 ? applyMomentPhotoAppends(index.moments, photoAppends) : index.moments;
  const moments = overlayMoments(withPhotos, [...getItemCache().values()]);
  try {
    return await writeWarehouse(moments, index.jobs);
  } catch {
    return {
      ...index,
      moments,
      updatedAt: new Date().toISOString(),
    };
  }
}

export async function readMoments(): Promise<{ content: MomentContent; status: MomentStoreStatus }> {
  const content = await readIndexRaw();
  return {
    content: {
      ...content,
      moments: overlayMoments(content.moments, [...getItemCache().values()]),
    },
    status: {
      configured: isMomentJsonBlobConfigured(),
      source: isMomentJsonBlobConfigured() ? "blob" : "memory",
    },
  };
}

export async function writeWarehouse(moments: TravelMoment[], jobs: TravelJob[]) {
  const content: MomentContent = {
    jobs: jobs.map(normalizeTravelJob),
    moments: moments.map(normalizeTravelMoment),
    schemaVersion: MOMENTS_SCHEMA_VERSION,
    updatedAt: new Date().toISOString(),
  };

  setLastIndexWrite(content);

  if (!isMomentJsonBlobConfigured()) {
    setMemoryContent(content);
    return content;
  }

  await putMomentJsonBlob(MOMENTS_BLOB_PATH, JSON.stringify(content, null, 2), {
    access: "public",
    allowOverwrite: true,
    cacheControlMaxAge: 60,
    contentType: "application/json",
  });

  return content;
}

export async function storeMomentBinary(pathname: string, file: Blob) {
  if (!isBlobConfigured()) {
    const bytes = Buffer.from(await file.arrayBuffer());
    const mime = file.type || "application/octet-stream";
    return { url: `data:${mime};base64,${bytes.toString("base64")}` };
  }

  const blob = await put(pathname, file, {
    access: "public",
    addRandomSuffix: true,
    ...(file.type ? { contentType: file.type } : {}),
  });
  return { url: blob.url };
}

export async function momentExists(momentId: string) {
  return Boolean(await readMomentItem(momentId));
}

export async function addMoment(moment: TravelMoment) {
  return withWarehouseLock(async () => {
    const existing = await readMomentItem(moment.id);
    if (existing) {
      const { content } = await readMoments();
      return { conflict: true as const, content };
    }

    const savedMoment = await writeMomentItem(moment);
    const content = await syncIndexBestEffort([savedMoment]);
    return { conflict: false as const, content, moment: savedMoment };
  });
}

export async function updateMoment(moment: Partial<TravelMoment> & { id: string }) {
  return withWarehouseLock(async () => {
    const current = await readMomentItem(moment.id);
    if (!current) {
      return null;
    }

    const next = await writeMomentItem(
      normalizeTravelMoment({
        ...current,
        ...moment,
        originalAudioUrl:
          moment.originalAudioUrl !== undefined ? moment.originalAudioUrl : current.originalAudioUrl,
        photos: moment.photos ?? current.photos,
        transcript: moment.transcript !== undefined ? moment.transcript : current.transcript,
      }),
    );
    const content = await syncIndexBestEffort([next]);
    return { content, moment: next };
  });
}

export async function addJob(job: TravelJob) {
  return withWarehouseLock(async () => {
    const { content } = await readMoments();
    if (content.jobs.some((item) => item.id === job.id)) {
      return { conflict: true as const, content };
    }

    const next = normalizeTravelJob(job);
    const saved = await writeWarehouse(content.moments, [next, ...content.jobs]);
    return { conflict: false as const, content: saved, job: next };
  });
}

export async function updateJob(job: TravelJob) {
  return withWarehouseLock(async () => {
    const { content } = await readMoments();
    if (!content.jobs.some((item) => item.id === job.id)) {
      return null;
    }

    const next = normalizeTravelJob(job);
    const jobs = content.jobs.map((item) => (item.id === next.id ? next : item));
    const saved = await writeWarehouse(content.moments, jobs);
    return { content: saved, job: next };
  });
}

type PendingPhotoAppend = {
  momentId: string;
  photo: MomentPhoto;
  resolve: (content: MomentContent | null) => void;
  reject: (error: unknown) => void;
};

const pendingPhotoAppends: PendingPhotoAppend[] = [];
let photoAppendFlush: Promise<void> | null = null;
const transcriptInFlight = new Set<string>();
const transcriptJobs = new Map<string, Promise<TravelMoment | null>>();

async function flushPhotoAppends() {
  await Promise.resolve();
  await withWarehouseLock(async () => {
    const batch = pendingPhotoAppends.splice(0);
    photoAppendFlush = null;
    if (batch.length === 0) {
      return;
    }

    try {
      const grouped = new Map<string, PendingPhotoAppend[]>();
      for (const item of batch) {
        const list = grouped.get(item.momentId) ?? [];
        list.push(item);
        grouped.set(item.momentId, list);
      }

      const acceptedItems: TravelMoment[] = [];
      const accepted: PendingPhotoAppend[] = [];
      const missing: PendingPhotoAppend[] = [];

      for (const [momentId, items] of grouped) {
        const current = await readMomentItem(momentId);
        if (!current) {
          missing.push(...items);
          continue;
        }

        const next = await writeMomentItem({
          ...current,
          photos: appendMomentPhotos(
            current.photos,
            items.map((item) => item.photo),
          ),
        });
        acceptedItems.push(next);
        accepted.push(...items);
      }

      const { content } = await readMoments();
      const saved =
        acceptedItems.length > 0
          ? await syncIndexBestEffort(
              acceptedItems,
              accepted.map((item) => ({ momentId: item.momentId, photo: item.photo })),
            )
          : content;

      for (const item of accepted) {
        item.resolve(saved);
      }
      for (const item of missing) {
        item.resolve(null);
      }
    } catch (error) {
      for (const item of batch) {
        item.reject(error);
      }
    }
  });
}

export function addPhotoToMoment(momentId: string, photo: MomentPhoto) {
  return new Promise<MomentContent | null>((resolve, reject) => {
    pendingPhotoAppends.push({ momentId, photo, reject, resolve });
    photoAppendFlush ??= flushPhotoAppends();
  });
}

export async function setMomentAudio(
  momentId: string,
  originalAudioUrl: string | null,
  options: { transcript?: string | null } = {},
) {
  return withWarehouseLock(async () => {
    const current = await readMomentItem(momentId);
    if (!current) {
      return null;
    }

    const spoken = options.transcript?.trim() || null;
    const next = await writeMomentItem({
      ...current,
      originalAudioUrl,
      transcript:
        originalAudioUrl === null
          ? null
          : spoken ?? (originalAudioUrl === current.originalAudioUrl ? current.transcript : null),
    });
    const content = await syncIndexBestEffort([next]);
    return { content, moment: next };
  });
}

export async function setPhotoOriginal(momentId: string, photoId: string, originalStorageKey: string) {
  return withWarehouseLock(async () => {
    const current = await readMomentItem(momentId);
    if (!current) {
      return null;
    }

    let nextPhoto: MomentPhoto | null = null;
    const photos = current.photos.map((photo) => {
      if (photo.id !== photoId) {
        return photo;
      }
      nextPhoto = { ...photo, originalStorageKey };
      return nextPhoto;
    });

    if (!nextPhoto) {
      return null;
    }

    const next = await writeMomentItem({ ...current, photos });
    const content = await syncIndexBestEffort([next]);
    return { content, photo: nextPhoto, moment: next };
  });
}

export async function removePhotoFromMoment(momentId: string, photoId: string) {
  return withWarehouseLock(async () => {
    const current = await readMomentItem(momentId);
    if (!current) {
      return null;
    }

    const photos = current.photos.filter((photo) => photo.id !== photoId);
    if (photos.length === current.photos.length) {
      return null;
    }

    const next = await writeMomentItem({ ...current, photos });
    return syncIndexBestEffort([next]);
  });
}

export function scheduleMomentIndex(momentId: string) {
  void indexSavedMoment(momentId);
}

export function scheduleMomentTranscript(momentId: string) {
  afterResponse(() => runMomentTranscript(momentId));
}

export function scheduleMissingMomentTranscripts(moments: TravelMoment[], limit = 5) {
  const waiting = sortMomentsNewestFirst(moments.filter((moment) => momentNeedsTranscript(moment)));
  for (const moment of waiting.slice(0, limit)) {
    scheduleMomentTranscript(moment.id);
  }
}

export function runMomentTranscript(momentId: string) {
  const existing = transcriptJobs.get(momentId);
  if (existing) {
    return existing;
  }

  const job = fillMomentTranscript(momentId).finally(() => {
    transcriptJobs.delete(momentId);
    transcriptInFlight.delete(momentId);
  });
  transcriptJobs.set(momentId, job);
  return job;
}

async function fillMomentTranscript(momentId: string): Promise<TravelMoment | null> {
  try {
    const current = await readMomentItem(momentId);
    if (!current) {
      return null;
    }
    if (!momentNeedsTranscript(current) || !current.originalAudioUrl) {
      return current;
    }

    transcriptInFlight.add(momentId);
    const audioUrl = current.originalAudioUrl;
    const transcript = await transcribeAudioUrl(audioUrl);
    if (!transcript) {
      return current;
    }

    return withWarehouseLock(async () => {
      const latest = await readMomentItem(momentId);
      if (!latest) {
        return null;
      }
      if (latest.originalAudioUrl !== audioUrl || latest.transcript?.trim()) {
        return latest;
      }

      const next = await writeMomentItem({
        ...latest,
        originalAudioUrl: latest.originalAudioUrl,
        transcript,
      });
      await syncIndexBestEffort([next]);
      return next;
    });
  } catch {
    // Transcripts are best-effort and must never fail Capture or Bench.
    return readMomentItem(momentId);
  }
}

async function indexSavedMoment(momentId: string) {
  try {
    const current = await readMomentItem(momentId);
    if (!current) {
      return;
    }

    const indexed = indexTravelMoment(current);
    if (JSON.stringify(indexed) === JSON.stringify(current)) {
      return;
    }

    await withWarehouseLock(async () => {
      const latestMoment = await readMomentItem(momentId);
      if (!latestMoment) {
        return;
      }

      const next = indexTravelMoment(latestMoment);
      await writeMomentItem(next);
      await syncIndexBestEffort([next]);
    });
  } catch {
    // Indexing must never fail capture or photo upload.
  }
}
