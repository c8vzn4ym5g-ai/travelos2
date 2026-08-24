import { list, put } from "@vercel/blob";
import { isAdminPinValid, isBlobConfigured } from "@/lib/editable-store";
import { indexTravelMoment } from "@/lib/moment-index";
import {
  MOMENTS_BLOB_PATH,
  MOMENTS_SCHEMA_VERSION,
  applyMomentPhotoAppends,
  normalizeTravelJob,
  normalizeTravelMoment,
} from "@/lib/moments";
import type { MomentPhoto, TravelJob, TravelMoment } from "@/lib/types";

export type MomentContent = {
  jobs: TravelJob[];
  moments: TravelMoment[];
  schemaVersion?: number;
  updatedAt: string;
};

export type MomentStoreStatus = {
  configured: boolean;
  source: "blob" | "memory";
};

export { isAdminPinValid, MOMENTS_BLOB_PATH };

const memoryKey = "__travelosMomentWarehouse";

type GlobalWarehouse = typeof globalThis & { [memoryKey]?: MomentContent };

function getMemoryContent() {
  const globalStore = globalThis as GlobalWarehouse;
  globalStore[memoryKey] ??= createEmptyContent();
  return globalStore[memoryKey];
}

function setMemoryContent(content: MomentContent) {
  (globalThis as GlobalWarehouse)[memoryKey] = content;
}

function createEmptyContent(): MomentContent {
  return {
    jobs: [],
    moments: [],
    schemaVersion: MOMENTS_SCHEMA_VERSION,
    updatedAt: new Date().toISOString(),
  };
}

function withNormalizedContent(content: MomentContent): MomentContent {
  return {
    jobs: (content.jobs ?? []).map(normalizeTravelJob),
    moments: (content.moments ?? []).map(normalizeTravelMoment),
    schemaVersion: content.schemaVersion ?? MOMENTS_SCHEMA_VERSION,
    updatedAt: content.updatedAt,
  };
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

export async function readMoments(): Promise<{ content: MomentContent; status: MomentStoreStatus }> {
  if (!isBlobConfigured()) {
    return {
      content: withNormalizedContent(getMemoryContent()),
      status: { configured: false, source: "memory" },
    };
  }

  const blobs = await list({ prefix: MOMENTS_BLOB_PATH, limit: 1 });
  const dataBlob = blobs.blobs.find((blob) => blob.pathname === MOMENTS_BLOB_PATH);

  if (!dataBlob) {
    const content = createEmptyContent();
    await writeWarehouse(content.moments, content.jobs);
    return {
      content,
      status: { configured: true, source: "blob" },
    };
  }

  const response = await fetch(`${dataBlob.url}?v=${Date.now()}`, { cache: "no-store" });
  if (!response.ok) {
    return {
      content: createEmptyContent(),
      status: { configured: true, source: "blob" },
    };
  }

  const content = withNormalizedContent((await response.json()) as MomentContent);
  return {
    content,
    status: { configured: true, source: "blob" },
  };
}

export async function writeWarehouse(moments: TravelMoment[], jobs: TravelJob[]) {
  const content: MomentContent = {
    jobs: jobs.map(normalizeTravelJob),
    moments: moments.map(normalizeTravelMoment),
    schemaVersion: MOMENTS_SCHEMA_VERSION,
    updatedAt: new Date().toISOString(),
  };

  if (!isBlobConfigured()) {
    setMemoryContent(content);
    return content;
  }

  await put(MOMENTS_BLOB_PATH, JSON.stringify(content, null, 2), {
    access: "public",
    allowOverwrite: true,
    contentType: "application/json",
  });

  return content;
}

export async function storeMomentBinary(pathname: string, file: File) {
  if (!isBlobConfigured()) {
    const bytes = Buffer.from(await file.arrayBuffer());
    const mime = file.type || "application/octet-stream";
    return { url: `data:${mime};base64,${bytes.toString("base64")}` };
  }

  const blob = await put(pathname, file, {
    access: "public",
    addRandomSuffix: true,
  });
  return { url: blob.url };
}

export async function momentExists(momentId: string) {
  const { content } = await readMoments();
  return content.moments.some((moment) => moment.id === momentId);
}

export async function addMoment(moment: TravelMoment) {
  return withWarehouseLock(async () => {
    const { content } = await readMoments();
    if (content.moments.some((item) => item.id === moment.id)) {
      return { conflict: true as const, content };
    }

    const saved = await writeWarehouse([normalizeTravelMoment(moment), ...content.moments], content.jobs);
    return { conflict: false as const, content: saved, moment: normalizeTravelMoment(moment) };
  });
}

export async function updateMoment(moment: Partial<TravelMoment> & { id: string }) {
  return withWarehouseLock(async () => {
    const { content } = await readMoments();
    const current = content.moments.find((item) => item.id === moment.id);
    if (!current) {
      return null;
    }

    const next = normalizeTravelMoment({
      ...current,
      ...moment,
      originalAudioUrl:
        moment.originalAudioUrl !== undefined ? moment.originalAudioUrl : current.originalAudioUrl,
      photos: moment.photos ?? current.photos,
    });
    const moments = content.moments.map((item) => (item.id === next.id ? next : item));
    const saved = await writeWarehouse(moments, content.jobs);
    return { content: saved, moment: next };
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

async function flushPhotoAppends() {
  await Promise.resolve();
  await withWarehouseLock(async () => {
    const batch = pendingPhotoAppends.splice(0);
    photoAppendFlush = null;
    if (batch.length === 0) {
      return;
    }

    try {
      const { content } = await readMoments();
      const knownIds = new Set(content.moments.map((moment) => moment.id));
      const accepted = batch.filter((item) => knownIds.has(item.momentId));
      const missing = batch.filter((item) => !knownIds.has(item.momentId));
      const saved =
        accepted.length > 0
          ? await writeWarehouse(
              applyMomentPhotoAppends(
                content.moments,
                accepted.map((item) => ({ momentId: item.momentId, photo: item.photo })),
              ),
              content.jobs,
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

export async function setMomentAudio(momentId: string, originalAudioUrl: string | null) {
  return withWarehouseLock(async () => {
    const { content } = await readMoments();
    const current = content.moments.find((moment) => moment.id === momentId);
    if (!current) {
      return null;
    }

    const next = {
      ...current,
      originalAudioUrl,
    };
    const saved = await writeWarehouse(
      content.moments.map((moment) => (moment.id === momentId ? next : moment)),
      content.jobs,
    );
    return { content: saved, moment: next };
  });
}

export async function setPhotoOriginal(momentId: string, photoId: string, originalStorageKey: string) {
  return withWarehouseLock(async () => {
    const { content } = await readMoments();
    let nextPhoto: MomentPhoto | null = null;
    const moments = content.moments.map((moment) => {
      if (moment.id !== momentId) {
        return moment;
      }

      return {
        ...moment,
        photos: moment.photos.map((photo) => {
          if (photo.id !== photoId) {
            return photo;
          }

          nextPhoto = { ...photo, originalStorageKey };
          return nextPhoto;
        }),
      };
    });

    if (!nextPhoto) {
      return null;
    }

    const saved = await writeWarehouse(moments, content.jobs);
    return { content: saved, photo: nextPhoto };
  });
}

export async function removePhotoFromMoment(momentId: string, photoId: string) {
  return withWarehouseLock(async () => {
    const { content } = await readMoments();
    let found = false;
    const moments = content.moments.map((moment) => {
      if (moment.id !== momentId) {
        return moment;
      }

      const photos = moment.photos.filter((photo) => photo.id !== photoId);
      found = photos.length !== moment.photos.length;
      return { ...moment, photos };
    });

    if (!found) {
      return null;
    }

    return writeWarehouse(moments, content.jobs);
  });
}

export function scheduleMomentIndex(momentId: string) {
  void indexSavedMoment(momentId);
}

async function indexSavedMoment(momentId: string) {
  try {
    const { content } = await readMoments();
    const current = content.moments.find((moment) => moment.id === momentId);
    if (!current) {
      return;
    }

    const indexed = indexTravelMoment(current);
    if (JSON.stringify(indexed) === JSON.stringify(current)) {
      return;
    }

    await withWarehouseLock(async () => {
      const latest = await readMoments();
      const latestMoment = latest.content.moments.find((moment) => moment.id === momentId);
      if (!latestMoment) {
        return;
      }

      const next = indexTravelMoment(latestMoment);
      await writeWarehouse(
        latest.content.moments.map((moment) => (moment.id === momentId ? next : moment)),
        latest.content.jobs,
      );
    });
  } catch {
    // Indexing must never fail capture or photo upload.
  }
}
