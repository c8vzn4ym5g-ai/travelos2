import { list, put } from "@vercel/blob";
import { isAdminPinValid, isBlobConfigured } from "@/lib/editable-store";
import { indexTravelMoment } from "@/lib/moment-index";
import {
  MOMENTS_BLOB_PATH,
  MOMENTS_SCHEMA_VERSION,
  appendMomentPhotos,
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
  const { content } = await readMoments();
  if (content.moments.some((item) => item.id === moment.id)) {
    return { conflict: true as const, content };
  }

  const saved = await writeWarehouse([normalizeTravelMoment(moment), ...content.moments], content.jobs);
  return { conflict: false as const, content: saved, moment: normalizeTravelMoment(moment) };
}

export async function updateMoment(moment: TravelMoment) {
  const { content } = await readMoments();
  if (!content.moments.some((item) => item.id === moment.id)) {
    return null;
  }

  const next = normalizeTravelMoment(moment);
  const moments = content.moments.map((item) => (item.id === next.id ? next : item));
  const saved = await writeWarehouse(moments, content.jobs);
  return { content: saved, moment: next };
}

export async function addJob(job: TravelJob) {
  const { content } = await readMoments();
  if (content.jobs.some((item) => item.id === job.id)) {
    return { conflict: true as const, content };
  }

  const next = normalizeTravelJob(job);
  const saved = await writeWarehouse(content.moments, [next, ...content.jobs]);
  return { conflict: false as const, content: saved, job: next };
}

export async function updateJob(job: TravelJob) {
  const { content } = await readMoments();
  if (!content.jobs.some((item) => item.id === job.id)) {
    return null;
  }

  const next = normalizeTravelJob(job);
  const jobs = content.jobs.map((item) => (item.id === next.id ? next : item));
  const saved = await writeWarehouse(content.moments, jobs);
  return { content: saved, job: next };
}

export async function addPhotoToMoment(momentId: string, photo: MomentPhoto) {
  const { content } = await readMoments();
  let found = false;
  const moments = content.moments.map((moment) => {
    if (moment.id !== momentId) {
      return moment;
    }

    found = true;
    return {
      ...moment,
      photos: appendMomentPhotos(moment.photos, [photo]),
    };
  });

  if (!found) {
    return null;
  }

  return writeWarehouse(moments, content.jobs);
}

export async function setMomentAudio(momentId: string, originalAudioUrl: string) {
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
  } catch {
    // Indexing must never fail capture or photo upload.
  }
}
