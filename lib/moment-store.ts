import { BlobAccessError } from "@vercel/blob";
import { afterResponse } from "@/lib/after-response";
import {
  countUniqueDisplayJpegs,
  findMomentPhoto,
  rebuildMomentsFromDriveFiles,
} from "@/lib/drive-photo-index";
import {
  DriveWarehouseError,
  driveObjectName,
  driveStorageKey,
  getIndex,
  isDriveWarehouseFetchOverridden,
  putBinary,
  putIndex,
  putItem,
  putVideoBinary,
  resetDriveWarehouseForTests,
  scanWarehouseFiles,
  type DriveWarehouseFile,
} from "@/lib/drive-warehouse";
import { isAdminPinValid } from "@/lib/editable-store";
import {
  fetchListedBlob,
  getMomentJsonBlob,
  isMomentBlobAdapterActive,
  listMomentBlobs,
  putMomentItemJson,
  putMomentJsonBlob,
  resetBlobStoreAccessForTests,
  resetMomentThumbCacheForTests,
  setMomentBlobAdapterForTests,
} from "@/lib/moment-blob";
import {
  createMomentItemRecord,
  loadMomentItemFromBlobGet,
  momentsFromListedItemBlobs,
  overlayMoments,
  putMomentItemRecord,
} from "@/lib/moment-item";
import { indexTravelMoment } from "@/lib/moment-index";
import { momentNeedsTranscript, transcribeAudioUrl } from "@/lib/moment-transcript";
import {
  MOMENT_ITEM_PREFIX,
  MOMENTS_BLOB_PATH,
  MOMENTS_SCHEMA_VERSION,
  applyMomentPhotoAppends,
  createTravelMoment,
  isCaptureVideoFile,
  mergeMomentPhotos,
  momentItemBlobPath,
  normalizeTravelJob,
  normalizeTravelMoment,
  sortMomentsNewestFirst,
  uniqueMomentsById,
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
export { setDriveWarehouseFetchForTests } from "@/lib/drive-warehouse";
export { rebuildMomentsFromDriveFiles } from "@/lib/drive-photo-index";

export type MomentStoreStatus = {
  configured: boolean;
  source: "blob" | "drive" | "memory";
};

export { isAdminPinValid };

function shouldUseDriveWarehouse() {
  if (isMomentBlobAdapterActive()) {
    return false;
  }
  if (isDriveWarehouseFetchOverridden()) {
    return true;
  }
  if (process.env.NODE_TEST_CONTEXT) {
    return false;
  }
  return true;
}

function isMomentWarehouseConfigured() {
  return isMomentBlobAdapterActive() || shouldUseDriveWarehouse();
}

function isBlobWarehouseReadError(error: unknown) {
  if (error instanceof BlobAccessError) {
    return true;
  }
  return (
    error instanceof Error &&
    /Vercel Blob:|Failed to fetch blob|403 Forbidden|BlobAccessError|Access denied/i.test(error.message)
  );
}

export function momentApiErrorResponse(error: unknown) {
  if (error instanceof MomentWarehouseUnavailableError || error instanceof DriveWarehouseError) {
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
const listedFilesCacheKey = "__travelosDriveFileListCache";
const LISTED_FILES_TTL_MS = 20_000;

type ListedFilesCache = {
  at: number;
  files: DriveWarehouseFile[];
  inflight: Promise<DriveWarehouseFile[]> | null;
};

type GlobalWarehouse = typeof globalThis & {
  [memoryKey]?: MomentContent;
  [itemCacheKey]?: Map<string, TravelMoment>;
  [lastIndexKey]?: MomentContent | null;
  [listedFilesCacheKey]?: ListedFilesCache;
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

function getListedFilesCache(): ListedFilesCache {
  const globalStore = globalThis as GlobalWarehouse;
  globalStore[listedFilesCacheKey] ??= { at: 0, files: [], inflight: null };
  return globalStore[listedFilesCacheKey];
}

export function resetMomentStoreForTests() {
  setMomentBlobAdapterForTests(null);
  resetBlobStoreAccessForTests();
  resetDriveWarehouseForTests();
  resetMomentThumbCacheForTests();
  setMemoryContent(createEmptyWarehouse());
  getItemCache().clear();
  setLastIndexWrite(null);
  const listed = getListedFilesCache();
  listed.at = 0;
  listed.files = [];
  listed.inflight = null;
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

export function rememberUploadedDisplayPhoto(momentId: string, photo: MomentPhoto) {
  const current = getItemCache().get(momentId);
  if (!current) {
    return;
  }

  rememberItem({
    ...current,
    photos: mergeMomentPhotos(current.photos, [photo]),
  });
}

export function rememberUploadedOriginal(momentId: string, photoId: string, originalStorageKey: string) {
  const current = getItemCache().get(momentId);
  if (!current) {
    return;
  }

  rememberItem({
    ...current,
    photos: current.photos.map((photo) => (photo.id === photoId ? { ...photo, originalStorageKey } : photo)),
  });
}

async function loadListedMomentItems(): Promise<TravelMoment[]> {
  if (isMomentBlobAdapterActive() || shouldUseDriveWarehouse()) {
    return [];
  }

  try {
    const listed = await listMomentBlobs(`${MOMENT_ITEM_PREFIX}/`);
    return await momentsFromListedItemBlobs(listed, fetchListedBlob);
  } catch {
    return [];
  }
}

async function loadDriveIndex(): Promise<MomentContent> {
  try {
    return await getIndex();
  } catch {
    // Dead or empty Drive index must not 503 Capture. Item files + last write stay the source of truth.
    return getLastIndexWrite() ?? createEmptyWarehouse();
  }
}

async function listedDriveFiles() {
  const cache = getListedFilesCache();
  const now = Date.now();
  if (cache.files.length > 0 && now - cache.at < LISTED_FILES_TTL_MS) {
    return cache.files;
  }
  if (cache.inflight) {
    return cache.inflight;
  }

  cache.inflight = (async () => {
    try {
      const files = await scanWarehouseFiles();
      cache.files = files;
      cache.at = Date.now();
      return files;
    } catch {
      return cache.files;
    } finally {
      cache.inflight = null;
    }
  })();
  return cache.inflight;
}

function withUniqueMoments(content: MomentContent): MomentContent {
  return {
    ...content,
    moments: uniqueMomentsById(content.moments),
  };
}

async function hydrateDriveMoments(moments: TravelMoment[]) {
  const files = await listedDriveFiles();
  if (files.length === 0) {
    return { changed: false, files, moments: uniqueMomentsById(moments) };
  }

  const rebuilt = rebuildMomentsFromDriveFiles(files, moments);
  const before = countUniqueDisplayJpegs(uniqueMomentsById(moments));
  const after = countUniqueDisplayJpegs(rebuilt);
  const changed =
    after > before ||
    rebuilt.length !== uniqueMomentsById(moments).length ||
    rebuilt.some((moment) => {
      const current = uniqueMomentsById(moments).find((item) => item.id === moment.id);
      return (current?.photos.length ?? 0) !== moment.photos.length;
    });
  return { changed, files, moments: rebuilt };
}

async function persistHydratedMoments(moments: TravelMoment[], jobs: TravelJob[]) {
  const unique = uniqueMomentsById(moments);
  for (const moment of unique) {
    await writeMomentItem(moment);
  }
  return writeWarehouse(unique, jobs);
}

export async function rebuildDriveMomentIndex() {
  return withWarehouseLock(async () => {
    const { content } = await readMoments({ hydrate: false });
    const hydrated = await hydrateDriveMoments(content.moments);
    const saved = await persistHydratedMoments(hydrated.moments, content.jobs);
    return {
      content: saved,
      displayJpegCount: countUniqueDisplayJpegs(saved.moments),
      fileCount: hydrated.files.length,
      momentCount: saved.moments.length,
      rebuilt: hydrated.changed || hydrated.files.length > 0,
    };
  });
}

async function readIndexRaw(): Promise<MomentContent> {
  if (!isMomentWarehouseConfigured()) {
    return withNormalizedContent(getMemoryContent());
  }

  if (shouldUseDriveWarehouse()) {
    const loaded = await loadDriveIndex();
    const lastWrite = getLastIndexWrite();
    const mergedMoments = overlayMoments(loaded.moments, [
      ...(lastWrite?.moments ?? []),
      ...getItemCache().values(),
    ]);
    const mergedJobs = lastWrite ? overlayJobs(loaded.jobs, lastWrite.jobs) : loaded.jobs;
    return withUniqueMoments({
      ...loaded,
      jobs: mergedJobs,
      moments: mergedMoments,
    });
  }

  const loaded = await loadWarehouseFromBlobGet(getMomentJsonBlob);
  const listedItems = await loadListedMomentItems();
  const lastWrite = getLastIndexWrite();
  const mergedMoments = overlayMoments(loaded.content.moments, [
    ...(lastWrite?.moments ?? []),
    ...listedItems,
    ...getItemCache().values(),
  ]);
  const mergedJobs = lastWrite
    ? overlayJobs(loaded.content.jobs, lastWrite.jobs)
    : loaded.content.jobs;

  // Missing index can be created once. An unreadable (403) index, or any listed
  // item files, must not be overwritten with an empty warehouse.
  if (loaded.createdEmpty && listedItems.length === 0 && getItemCache().size === 0 && !lastWrite) {
    try {
      await writeWarehouse(mergedMoments, mergedJobs);
    } catch {
      return {
        ...loaded.content,
        jobs: mergedJobs,
        moments: mergedMoments,
      };
    }
  }

  return withUniqueMoments({
    ...loaded.content,
    jobs: mergedJobs,
    moments: mergedMoments,
  });
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

export async function resolveMomentPhoto(momentId: string, photoId: string) {
  const moment = await getMomentById(momentId);
  const found = findMomentPhoto(moment, photoId);
  if (found) {
    return found;
  }

  const files = await listedDriveFiles();
  if (files.length === 0) {
    return null;
  }

  const rebuilt = rebuildMomentsFromDriveFiles(files, moment ? [moment] : []);
  const match = rebuilt.find((item) => item.id === momentId) ?? null;
  return findMomentPhoto(match, photoId);
}

async function readMomentItem(momentId: string): Promise<TravelMoment | null> {
  const cached = getItemCache().get(momentId);

  if (isMomentWarehouseConfigured() && shouldUseDriveWarehouse()) {
    if (cached) {
      return cached;
    }
    const index = await loadDriveIndex();
    const merged =
      uniqueMomentsById([...index.moments, ...getItemCache().values()]).find(
        (moment) => moment.id === momentId,
      ) ?? null;
    return merged ? rememberItem(merged) : null;
  }

  if (cached) {
    return cached;
  }

  if (isMomentWarehouseConfigured()) {
    const fromBlob = await loadMomentItemFromBlobGet(getMomentJsonBlob, momentId);
    if (fromBlob) {
      return rememberItem(fromBlob);
    }
  }

  const index = await readIndexRaw();
  const fromIndex = uniqueMomentsById(index.moments).find((moment) => moment.id === momentId) ?? null;
  if (fromIndex) {
    return rememberItem(fromIndex);
  }

  return null;
}

async function writeMomentItem(moment: TravelMoment) {
  const saved = rememberItem(moment);
  if (!isMomentWarehouseConfigured()) {
    return saved;
  }

  if (shouldUseDriveWarehouse()) {
    const record = createMomentItemRecord(saved);
    await putItem(driveObjectName(momentItemBlobPath(saved.id)), JSON.stringify(record, null, 2));
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

  try {
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
  } catch {
    // Item files are the source of truth. A dead index must not fail Capture dumps
    // and must not overwrite the warehouse with an empty snapshot.
    return {
      jobs: [],
      moments: overlayMoments(
        updatedMoments,
        photoAppends.length > 0 ? applyMomentPhotoAppends(updatedMoments, photoAppends) : [...getItemCache().values()],
      ),
      schemaVersion: MOMENTS_SCHEMA_VERSION,
      updatedAt: new Date().toISOString(),
    };
  }
}

export async function readMoments(options: { hydrate?: boolean } = {}): Promise<{ content: MomentContent; status: MomentStoreStatus }> {
  const content = await readIndexRaw();
  let moments = uniqueMomentsById(overlayMoments(content.moments, [...getItemCache().values()]));
  const hydrate = options.hydrate !== false && shouldUseDriveWarehouse();

  if (hydrate) {
    const hydrated = await hydrateDriveMoments(moments);
    moments = hydrated.moments;
    if (hydrated.changed) {
      afterResponse(() => persistHydratedMoments(hydrated.moments, content.jobs));
    }
  }

  return {
    content: {
      ...content,
      moments,
    },
    status: {
      configured: isMomentWarehouseConfigured(),
      source: isMomentBlobAdapterActive() ? "blob" : shouldUseDriveWarehouse() ? "drive" : "memory",
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

  if (!isMomentWarehouseConfigured()) {
    setMemoryContent(content);
    return content;
  }

  if (shouldUseDriveWarehouse()) {
    try {
      const latest = await loadDriveIndex();
      content.moments = uniqueMomentsById(overlayMoments(latest.moments, content.moments));
    } catch {
      content.moments = uniqueMomentsById(content.moments);
    }
    await putIndex(JSON.stringify(content, null, 2));
    return content;
  }

  await putMomentJsonBlob(MOMENTS_BLOB_PATH, JSON.stringify(content, null, 2), {
    access: "private",
    allowOverwrite: true,
    cacheControlMaxAge: 60,
    contentType: "application/json",
  });

  return content;
}

export async function storeMomentBinary(pathname: string, file: Blob) {
  if (shouldUseDriveWarehouse()) {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const mime = file.type || "application/octet-stream";
    const name = driveObjectName(pathname);
    const stored = isCaptureVideoFile({ name, type: mime })
      ? await putVideoBinary({
          bytes,
          mimeType: mime,
          name,
        })
      : await putBinary({
          bytes,
          mimeType: mime,
          name,
        });
    return { url: driveStorageKey(stored.id) };
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  const mime = file.type || "application/octet-stream";
  return { url: `data:${mime};base64,${bytes.toString("base64")}` };
}

export async function momentExists(momentId: string) {
  return Boolean(await readMomentItem(momentId));
}

export async function addMoment(moment: TravelMoment) {
  return withWarehouseLock(async () => {
    const cached = getItemCache().get(moment.id);
    if (cached) {
      const { content } = await readMoments({ hydrate: false });
      return { conflict: true as const, content };
    }

    const savedMoment = await writeMomentItem(moment);
    if (!shouldUseDriveWarehouse()) {
      const content = await syncIndexBestEffort([savedMoment]);
      return { conflict: false as const, content, moment: savedMoment };
    }

    // Drive index GET/PUT can stall for minutes. Capture only needs the item
    // JSON + id so the video hops can start; index sync is after the response.
    afterResponse(() => syncIndexBestEffort([savedMoment]));
    const lastWrite = getLastIndexWrite();
    return {
      conflict: false as const,
      content: {
        jobs: lastWrite?.jobs ?? [],
        moments: overlayMoments(lastWrite?.moments ?? [], [savedMoment]),
        schemaVersion: MOMENTS_SCHEMA_VERSION,
        updatedAt: new Date().toISOString(),
      },
      moment: savedMoment,
    };
  });
}

export async function updateMoment(moment: Partial<TravelMoment> & { id: string }) {
  return withWarehouseLock(async () => {
    // Same-isolate Capture has the item cache; another isolate may still be
    // waiting on a hung Drive index GET. Do not 404 or stall finalize.
    const cached = getItemCache().get(moment.id);
    let current = cached ?? (!shouldUseDriveWarehouse() ? await readMomentItem(moment.id) : null);
    if (!current) {
      if (!shouldUseDriveWarehouse()) {
        return null;
      }
      current = createTravelMoment({
        command: moment.command,
        coordinates: moment.coordinates ?? null,
        createdAt: moment.createdAt,
        draft: moment.draft,
        id: moment.id,
        note: moment.note,
        originalAudioUrl: moment.originalAudioUrl,
        time: moment.time,
        transcript: moment.transcript,
        tripId: moment.tripId,
      });
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
    if (!shouldUseDriveWarehouse()) {
      const content = await syncIndexBestEffort([next]);
      return { content, moment: next };
    }

    afterResponse(() => syncIndexBestEffort([next]));
    const lastWrite = getLastIndexWrite();
    return {
      content: {
        jobs: lastWrite?.jobs ?? [],
        moments: overlayMoments(lastWrite?.moments ?? [], [next]),
        schemaVersion: MOMENTS_SCHEMA_VERSION,
        updatedAt: new Date().toISOString(),
      },
      moment: next,
    };
  });
}

export async function addJob(job: TravelJob) {
  return withWarehouseLock(async () => {
    const { content } = await readMoments({ hydrate: false });
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
    const { content } = await readMoments({ hydrate: false });
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
          photos: mergeMomentPhotos(
            current.photos,
            items.map((item) => item.photo),
          ),
        });
        acceptedItems.push(next);
        accepted.push(...items);
      }

      let saved =
        acceptedItems.length > 0
          ? await syncIndexBestEffort(
              acceptedItems,
              accepted.map((item) => ({ momentId: item.momentId, photo: item.photo })),
            )
          : (await readMoments({ hydrate: false })).content;

      if (shouldUseDriveWarehouse() && acceptedItems.length > 0) {
        const hydrated = await hydrateDriveMoments(saved.moments);
        if (hydrated.changed) {
          saved = await persistHydratedMoments(hydrated.moments, saved.jobs);
        }
      }

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
