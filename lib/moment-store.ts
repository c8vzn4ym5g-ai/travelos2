import { list, put } from "@vercel/blob";
import { isAdminPinValid, isBlobConfigured } from "@/lib/editable-store";
import { MOMENTS_BLOB_PATH, MOMENTS_SCHEMA_VERSION, appendMomentPhotos, normalizeTravelMoment } from "@/lib/moments";
import type { MomentPhoto, TravelMoment } from "@/lib/types";

export type MomentContent = {
  moments: TravelMoment[];
  schemaVersion?: number;
  updatedAt: string;
};

export type MomentStoreStatus = {
  configured: boolean;
  source: "blob" | "memory";
};

export { isAdminPinValid, MOMENTS_BLOB_PATH };

let memoryContent: MomentContent | null = null;

function createEmptyContent(): MomentContent {
  return {
    moments: [],
    schemaVersion: MOMENTS_SCHEMA_VERSION,
    updatedAt: new Date().toISOString(),
  };
}

function withNormalizedMoments(content: MomentContent): MomentContent {
  return {
    moments: content.moments.map(normalizeTravelMoment),
    schemaVersion: content.schemaVersion ?? MOMENTS_SCHEMA_VERSION,
    updatedAt: content.updatedAt,
  };
}

export async function readMoments(): Promise<{ content: MomentContent; status: MomentStoreStatus }> {
  if (!isBlobConfigured()) {
    memoryContent ??= createEmptyContent();
    return {
      content: withNormalizedMoments(memoryContent),
      status: { configured: false, source: "memory" },
    };
  }

  const blobs = await list({ prefix: MOMENTS_BLOB_PATH, limit: 1 });
  const dataBlob = blobs.blobs.find((blob) => blob.pathname === MOMENTS_BLOB_PATH);

  if (!dataBlob) {
    const content = createEmptyContent();
    await writeMoments(content.moments);
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

  const content = withNormalizedMoments((await response.json()) as MomentContent);
  return {
    content,
    status: { configured: true, source: "blob" },
  };
}

export async function writeMoments(moments: TravelMoment[]) {
  const content: MomentContent = {
    moments: moments.map(normalizeTravelMoment),
    schemaVersion: MOMENTS_SCHEMA_VERSION,
    updatedAt: new Date().toISOString(),
  };

  if (!isBlobConfigured()) {
    memoryContent = content;
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

  const saved = await writeMoments([normalizeTravelMoment(moment), ...content.moments]);
  return { conflict: false as const, content: saved, moment: normalizeTravelMoment(moment) };
}

export async function updateMoment(moment: TravelMoment) {
  const { content } = await readMoments();
  if (!content.moments.some((item) => item.id === moment.id)) {
    return null;
  }

  const next = normalizeTravelMoment(moment);
  const moments = content.moments.map((item) => (item.id === next.id ? next : item));
  const saved = await writeMoments(moments);
  return { content: saved, moment: next };
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

  return writeMoments(moments);
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
  const saved = await writeMoments(content.moments.map((moment) => (moment.id === momentId ? next : moment)));
  return { content: saved, moment: next };
}
