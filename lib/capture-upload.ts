"use client";

import { filenameForAudioMime, resolveAudioMime } from "./moment-audio.ts";
import { captureFileMime, isCaptureVideoFile, isHeicPhoto } from "./moments.ts";
import { createTinyPreviewUrl, prepareDisplayPhoto, shouldKeepOriginal } from "./prepare-photo.ts";
import type { GeoPoint, MomentPhoto, TravelJob, TravelMoment } from "./types.ts";

export { createTinyPreviewUrl };
export const CAPTURE_UPLOAD_CONCURRENCY = 3;
export const CAPTURE_DUMP_LIMIT = 40;
// Google resumable requires multiples of 256KiB except the last chunk.
// 8MiB is 32 × 256KiB. iPhone Safari aborts a 40–46MB one-shot PUT and
// `new File([whole .mov])` on ingest can empty the preview, so the phone
// always hops 8MiB (last chunk shorter). Worker still accepts a larger
// single PUT from a datacenter.
export const CAPTURE_VIDEO_CHUNK_BYTES = 8 * 1024 * 1024;
export const CAPTURE_VIDEO_SINGLE_PUT_MAX_BYTES = 80_000_000;
export const CAPTURE_VIDEO_MAX_BYTES = 100_000_000;
export const CAPTURE_UPLOAD_FAILED_MESSAGE = "上傳失敗。";

export function captureVideoPutChunkBytes(fileSize: number) {
  if (fileSize <= 0) {
    return CAPTURE_VIDEO_CHUNK_BYTES;
  }
  return Math.min(CAPTURE_VIDEO_CHUNK_BYTES, fileSize);
}

const captureVideoSliceCache = new WeakMap<File, Blob[]>();

export function sliceCaptureVideo(file: File) {
  const cached = captureVideoSliceCache.get(file);
  if (cached) {
    return cached;
  }
  const total = file.size;
  const chunkSize = captureVideoPutChunkBytes(total);
  const slices: Blob[] = [];
  for (let offset = 0; offset < total; offset += chunkSize) {
    slices.push(file.slice(offset, Math.min(offset + chunkSize, total)));
  }
  captureVideoSliceCache.set(file, slices);
  return slices;
}

export type CapturePhotoDraft = {
  errorMessage: null;
  file: File;
  id: string;
  previewUrl: null;
  serverPhotoId: null;
  status: "queued";
};

export type CaptureFileIngestProgress = {
  copiedCount: number;
  fileListLength: number;
};

export function snapshotFileList(fileList: FileList | null | undefined) {
  if (!fileList || fileList.length === 0) {
    return [];
  }

  const files: File[] = [];
  for (let index = 0; index < fileList.length; index += 1) {
    const file = fileList.item(index) ?? fileList[index];
    if (file) {
      files.push(file);
    }
  }
  return files;
}

export function isCaptureImageFile(file: File) {
  return file.type.startsWith("image/") || isHeicPhoto(file);
}

export function isCaptureDumpFile(file: File) {
  return isCaptureImageFile(file) || isCaptureVideoFile(file);
}

export function captureVideoTooLargeMessage() {
  return CAPTURE_UPLOAD_FAILED_MESSAGE;
}

export function assertCaptureFileFits(file: File) {
  if (isCaptureVideoFile(file) && file.size > CAPTURE_VIDEO_MAX_BYTES) {
    throw new Error(captureVideoTooLargeMessage());
  }
}

export function withCaptureFileMime(file: File) {
  if (isCaptureVideoFile(file)) {
    return file;
  }
  const mime = captureFileMime(file);
  if (mime === file.type) {
    return file;
  }
  return new File([file], file.name, {
    lastModified: file.lastModified,
    type: mime,
  });
}

export function copyCaptureFile(file: File) {
  if (isCaptureVideoFile(file)) {
    sliceCaptureVideo(file);
    return file;
  }
  const blob = file.slice(0);
  return new File([blob], file.name, {
    lastModified: file.lastModified,
    type: file.type,
  });
}

export async function ingestCaptureFileList(
  fileList: FileList | null | undefined,
  options: {
    copyFile?: (file: File) => File;
    limit?: number;
    onCopied: (file: File, progress: CaptureFileIngestProgress) => void | Promise<void>;
    onReceived?: (fileListLength: number) => void;
    resetInput?: () => void;
  },
) {
  const fileListLength = fileList?.length ?? 0;
  const limit = options.limit ?? CAPTURE_DUMP_LIMIT;
  options.onReceived?.(fileListLength);

  if (!fileList || fileListLength === 0) {
    return { copied: [] as File[], fileListLength, limited: false };
  }

  const copyFile = options.copyFile ?? copyCaptureFile;
  const copied: File[] = [];

  for (let index = 0; index < fileListLength && copied.length < limit; index += 1) {
    const file = fileList.item(index) ?? fileList[index];
    if (!file || !isCaptureDumpFile(file)) {
      continue;
    }

    const independent = copyFile(file);
    copied.push(independent);
    const started = options.onCopied(independent, { copiedCount: copied.length, fileListLength });
    if (started) {
      await started;
    }
  }

  if (copied.length > 0 && !copied.some((file) => isCaptureVideoFile(file))) {
    options.resetInput?.();
  }

  return { copied, fileListLength, limited: fileListLength > copied.length };
}

export function createStagedCapturePhotos(files: File[]): CapturePhotoDraft[] {
  return files.filter(isCaptureDumpFile).map((file) => ({
    errorMessage: null,
    file,
    id: `staged_${file.name}_${file.size}_${file.lastModified}_${Math.random().toString(36).slice(2, 6)}`,
    previewUrl: null,
    serverPhotoId: null,
    status: "queued" as const,
  }));
}

export function captureDumpCapMessage(limit = CAPTURE_DUMP_LIMIT) {
  return `這一輪先上傳 ${limit} 張，其餘請再選一次繼續傳。`;
}

export function captureFreshDumpRoundMessage(limit = CAPTURE_DUMP_LIMIT) {
  return `這一輪是新的 ${limit} 張，上一輪已在倉庫裡。This round is a fresh ${limit}; previous photos are already in the warehouse.`;
}

export function shouldReplaceCaptureDumpRound(
  source: "choose-photos" | "take-photo",
  existingPhotoCount: number,
) {
  return source === "choose-photos" && existingPhotoCount > 0;
}

export function captureDumpProgressMessage(
  received: number,
  total: number,
  options: { freshRound?: boolean } = {},
) {
  const batch = captureBatchMessage(received, total);
  if (!options.freshRound || received <= 0) {
    return batch;
  }
  return `${captureFreshDumpRoundMessage()} ${batch}`;
}

export function detachStagedCapturePhotos<T extends { previewUrl: string | null }>(photos: T[]) {
  for (const photo of photos) {
    if (photo.previewUrl) {
      URL.revokeObjectURL(photo.previewUrl);
    }
  }
  return [] as T[];
}

export function captureBatchMessage(received: number, total: number) {
  if (received <= 0) {
    return "請選照片或影片。iPhone HEIC 會轉成 JPEG 上傳，原檔稍後另存。";
  }

  if (received > CAPTURE_DUMP_LIMIT) {
    return captureDumpCapMessage();
  }

  return `已收到 ${received} 張，分批上傳中。目前共 ${total} 張，會繼續傳到倉庫。`;
}

export function createWorkQueue(concurrency = CAPTURE_UPLOAD_CONCURRENCY) {
  if (!Number.isInteger(concurrency) || concurrency < 1) {
    throw new Error("Work queue concurrency must be a positive integer.");
  }

  let active = 0;
  const pending: Array<() => void> = [];

  function pump() {
    while (active < concurrency && pending.length > 0) {
      const start = pending.shift();
      if (!start) {
        continue;
      }
      start();
    }
  }

  return {
    get activeCount() {
      return active;
    },
    get pendingCount() {
      return pending.length;
    },
    enqueue<T>(work: () => Promise<T>): Promise<T> {
      return new Promise<T>((resolve, reject) => {
        const run = () => {
          active += 1;
          Promise.resolve()
            .then(work)
            .then(resolve, reject)
            .finally(() => {
              active -= 1;
              pump();
            });
        };
        pending.push(run);
        pump();
      });
    },
  };
}

export function pinHeaders(pin: string): Record<string, string> {
  return { "x-travelos-admin-pin": pin };
}

export function captureErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message.trim() ? error.message : fallback;
}

export function isRetryableUploadStatus(status: number) {
  return status === 404 || status >= 500;
}

export function createMomentSession(createMoment: (time: string) => Promise<{ moment: { id: string } }>) {
  let momentId: string | null = null;
  let momentPromise: Promise<string> | null = null;

  return {
    get momentId() {
      return momentId;
    },
    reset() {
      momentId = null;
      momentPromise = null;
    },
    async ensure(time: string) {
      if (momentId) {
        return momentId;
      }

      momentPromise ??= createMoment(time).then(
        (created) => {
          momentId = created.moment.id;
          return created.moment.id;
        },
        (error: unknown) => {
          momentPromise = null;
          momentId = null;
          throw error;
        },
      );

      try {
        return await momentPromise;
      } catch (error) {
        momentPromise = null;
        momentId = null;
        throw error;
      }
    },
  };
}

export async function sendWithMomentRetry(
  send: (momentId: string) => Promise<Response>,
  momentId: string,
  retryMoment?: (status: number) => Promise<string>,
) {
  const first = await send(momentId);
  if (first.ok || !retryMoment || !isRetryableUploadStatus(first.status)) {
    return { momentId, response: first };
  }

  const nextMomentId = await retryMoment(first.status);
  const response = await send(nextMomentId);
  return { momentId: nextMomentId, response };
}

async function readError(response: Response, fallback: string) {
  try {
    const data = (await response.json()) as { error?: string };
    return data.error ?? fallback;
  } catch {
    return fallback;
  }
}

export async function createCaptureMoment(input: {
  command?: string | null;
  coordinates: GeoPoint | null;
  note?: string;
  pin: string;
  time: string;
}) {
  const response = await fetch("/api/moments", {
    body: JSON.stringify({
      command: input.command ?? null,
      coordinates: input.coordinates,
      note: input.note ?? "",
      time: input.time,
    }),
    headers: {
      "content-type": "application/json",
      ...pinHeaders(input.pin),
    },
    method: "POST",
  });

  if (!response.ok) {
    throw new Error(await readError(response, "Could not save this moment."));
  }

  return (await response.json()) as { job: TravelJob | null; moment: TravelMoment };
}

export async function finalizeCaptureMoment(input: {
  command: string | null;
  coordinates: GeoPoint | null;
  momentId: string;
  note: string;
  pin: string;
  time: string;
  transcript?: string | null;
}) {
  const response = await fetch("/api/moments", {
    body: JSON.stringify({
      moment: {
        command: input.command,
        coordinates: input.coordinates,
        id: input.momentId,
        note: input.note,
        time: input.time,
        ...(input.transcript?.trim() ? { transcript: input.transcript.trim() } : {}),
      },
    }),
    headers: {
      "content-type": "application/json",
      ...pinHeaders(input.pin),
    },
    method: "PUT",
  });

  if (!response.ok) {
    throw new Error(await readError(response, "Could not save this moment."));
  }

  return (await response.json()) as { job: TravelJob | null; moment: TravelMoment };
}

export async function updateMomentTranscript(input: {
  momentId: string;
  pin: string;
  transcript: string;
}) {
  const response = await fetch("/api/moments", {
    body: JSON.stringify({
      moment: {
        id: input.momentId,
        transcript: input.transcript,
      },
    }),
    headers: {
      "content-type": "application/json",
      ...pinHeaders(input.pin),
    },
    method: "PUT",
  });

  if (!response.ok) {
    throw new Error(await readError(response, "Could not save this line."));
  }

  return (await response.json()) as { moment: TravelMoment };
}

function isLastVideoRange(contentRange: string | null, total: number) {
  if (!contentRange) {
    return false;
  }
  return contentRange.endsWith(`/${total}`) && contentRange.includes(`${total - 1}/`);
}

export async function uploadCaptureVideo(input: {
  coordinates: GeoPoint | null;
  file: File;
  momentId: string;
  onDisplayReady?: (display: File) => void | Promise<void>;
  pin: string;
  retryMoment?: (status: number) => Promise<string>;
  signal?: AbortSignal;
  takenAt: string;
}) {
  assertCaptureFileFits(input.file);
  const source = withCaptureFileMime(input.file);
  const slices = sliceCaptureVideo(source);

  void Promise.resolve(input.onDisplayReady?.(source)).catch(() => {
    // Tiny previews are optional; they must never block the video init POST.
  });

  const sendInit = async (momentId: string) =>
    fetch("/api/moments/photos/video", {
      body: JSON.stringify({
        coordinates: input.coordinates,
        filename: source.name,
        mimeType: captureFileMime(source),
        momentId,
        size: source.size,
        takenAt: input.takenAt,
      }),
      headers: {
        "content-type": "application/json",
        ...pinHeaders(input.pin),
      },
      method: "POST",
      signal: input.signal,
    });

  const { momentId, response: initResponse } = await sendWithMomentRetry(
    sendInit,
    input.momentId,
    input.retryMoment,
  );

  if (!initResponse.ok) {
    throw new Error(await readError(initResponse, CAPTURE_UPLOAD_FAILED_MESSAGE));
  }

  const initPayload = (await initResponse.json()) as { session?: string };
  const session = initPayload.session?.trim() ?? "";
  if (!session) {
    throw new Error(CAPTURE_UPLOAD_FAILED_MESSAGE);
  }

  const total = source.size;
  const chunkSize = captureVideoPutChunkBytes(total);
  let offset = 0;
  for (const chunk of slices) {
    const end = Math.min(offset + chunkSize, total);
    const contentRange = `bytes ${offset}-${end - 1}/${total}`;
    const body = chunk.size > 0 ? chunk : source.slice(offset, end);
    const response = await fetch("/api/moments/photos/video", {
      body,
      headers: {
        ...pinHeaders(input.pin),
        "content-range": contentRange,
        "content-type": "application/octet-stream",
        "x-travelos-video-session": session,
      },
      method: "PUT",
      signal: input.signal,
    });
    if (!response.ok) {
      throw new Error(await readError(response, CAPTURE_UPLOAD_FAILED_MESSAGE));
    }
    if (end === total || isLastVideoRange(contentRange, total)) {
      const payload = (await response.json()) as { photo?: MomentPhoto };
      if (!payload.photo) {
        throw new Error(CAPTURE_UPLOAD_FAILED_MESSAGE);
      }
      return { display: source, momentId, photo: payload.photo };
    }
    offset = end;
  }

  throw new Error(CAPTURE_UPLOAD_FAILED_MESSAGE);
}

export async function uploadDisplayPhoto(input: {
  coordinates: GeoPoint | null;
  file: File;
  momentId: string;
  onDisplayReady?: (display: File) => void | Promise<void>;
  pin: string;
  retryMoment?: (status: number) => Promise<string>;
  signal?: AbortSignal;
  takenAt: string;
}) {
  if (isCaptureVideoFile(input.file)) {
    return uploadCaptureVideo(input);
  }

  assertCaptureFileFits(input.file);
  const source = withCaptureFileMime(input.file);

  let display: File;
  try {
    display = await prepareDisplayPhoto(source);
  } catch {
    display = source;
  }

  void Promise.resolve(input.onDisplayReady?.(display)).catch(() => {
    // Tiny previews are optional; they must never block the display POST.
  });

  const send = async (momentId: string) => {
    const formData = new FormData();
    formData.set("file", display);
    formData.set("momentId", momentId);
    formData.set("takenAt", input.takenAt);
    if (input.coordinates) {
      formData.set("latitude", String(input.coordinates.latitude));
      formData.set("longitude", String(input.coordinates.longitude));
    }

    return fetch("/api/moments/photos", {
      body: formData,
      headers: pinHeaders(input.pin),
      method: "POST",
      signal: input.signal,
    });
  };

  const { momentId, response } = await sendWithMomentRetry(send, input.momentId, input.retryMoment);

  if (!response.ok) {
    throw new Error(await readError(response, CAPTURE_UPLOAD_FAILED_MESSAGE));
  }

  const payload = (await response.json()) as { photo: MomentPhoto };
  return { display, momentId, photo: payload.photo };
}

export function uploadOriginalPhotoInBackground(input: {
  display: File;
  momentId: string;
  original: File;
  photoId: string;
  pin: string;
}) {
  if (!shouldKeepOriginal(input.original, input.display)) {
    return;
  }

  const formData = new FormData();
  formData.set("momentId", input.momentId);
  formData.set("original", input.original);
  formData.set("photoId", input.photoId);

  void fetch("/api/moments/photos", {
    body: formData,
    headers: pinHeaders(input.pin),
    method: "POST",
  }).catch(() => {
    // Originals are durable when they land; they must never block Capture.
  });
}

export async function uploadMomentAudio(input: {
  blob: Blob;
  momentId: string;
  pin: string;
  retryMoment?: (status: number) => Promise<string>;
  signal?: AbortSignal;
  transcript?: string | null;
}) {
  const send = async (momentId: string) => {
    const bytes = new Uint8Array(await input.blob.slice(0).arrayBuffer());
    const mime = resolveAudioMime(bytes, input.blob.type) ?? input.blob.type ?? "application/octet-stream";
    const file = new File([bytes], filenameForAudioMime(mime), { type: mime });
    const audioData = new FormData();
    audioData.set("momentId", momentId);
    audioData.set("file", file);
    if (input.transcript?.trim()) {
      audioData.set("transcript", input.transcript.trim());
    }
    return fetch("/api/moments/audio", {
      body: audioData,
      headers: pinHeaders(input.pin),
      method: "POST",
      signal: input.signal,
    });
  };

  const { response } = await sendWithMomentRetry(send, input.momentId, input.retryMoment);
  if (!response.ok) {
    throw new Error(await readError(response, "Audio upload failed."));
  }
}

export function removeUploadedPhotoInBackground(input: {
  momentId: string;
  photoId: string;
  pin: string;
}) {
  const params = new URLSearchParams({ momentId: input.momentId, photoId: input.photoId });
  void fetch(`/api/moments/photos?${params.toString()}`, {
    headers: pinHeaders(input.pin),
    method: "DELETE",
  }).catch(() => {
    // Removing a retake from the warehouse is best-effort.
  });
}

export function clearMomentAudioInBackground(input: { momentId: string; pin: string }) {
  const params = new URLSearchParams({ momentId: input.momentId });
  void fetch(`/api/moments/audio?${params.toString()}`, {
    headers: pinHeaders(input.pin),
    method: "DELETE",
  }).catch(() => {
    // Clearing a retake is best-effort.
  });
}
