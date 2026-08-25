"use client";

import { isHeicPhoto } from "./moments.ts";
import { createTinyPreviewUrl, prepareDisplayPhoto, shouldKeepOriginal } from "./prepare-photo.ts";
import type { GeoPoint, MomentPhoto, TravelJob, TravelMoment } from "./types.ts";

export { createTinyPreviewUrl };
export const CAPTURE_UPLOAD_CONCURRENCY = 3;
export const CAPTURE_DUMP_LIMIT = 40;

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

export function copyCaptureFile(file: File) {
  const blob = file.slice(0);
  return new File([blob], file.name, {
    lastModified: file.lastModified,
    type: file.type,
  });
}

export function yieldToBrowser() {
  return new Promise<void>((resolve) => {
    const later = () => {
      setTimeout(resolve, 0);
    };

    if (typeof requestAnimationFrame === "function") {
      requestAnimationFrame(later);
      return;
    }

    later();
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
    yieldTurn?: () => Promise<void>;
  },
) {
  const fileListLength = fileList?.length ?? 0;
  const limit = options.limit ?? CAPTURE_DUMP_LIMIT;
  options.onReceived?.(fileListLength);

  if (!fileList || fileListLength === 0) {
    return { copied: [] as File[], fileListLength, limited: false };
  }

  const copyFile = options.copyFile ?? copyCaptureFile;
  const yieldTurn = options.yieldTurn ?? yieldToBrowser;
  const copied: File[] = [];

  for (let index = 0; index < fileListLength && copied.length < limit; index += 1) {
    const file = fileList.item(index) ?? fileList[index];
    if (!file || !isCaptureImageFile(file)) {
      continue;
    }

    const independent = copyFile(file);
    copied.push(independent);
    await options.onCopied(independent, { copiedCount: copied.length, fileListLength });
    await yieldTurn();
  }

  if (copied.length > 0) {
    options.resetInput?.();
  }

  return { copied, fileListLength, limited: fileListLength > copied.length };
}

export function createStagedCapturePhotos(files: File[]): CapturePhotoDraft[] {
  return files.filter(isCaptureImageFile).map((file) => ({
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

export function captureBatchMessage(received: number, total: number) {
  if (received <= 0) {
    return "請選照片。iPhone HEIC 會轉成 JPEG 上傳，原檔稍後另存。";
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
}) {
  const response = await fetch("/api/moments", {
    body: JSON.stringify({
      moment: {
        command: input.command,
        coordinates: input.coordinates,
        id: input.momentId,
        note: input.note,
        time: input.time,
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
  let display: File;
  try {
    display = await prepareDisplayPhoto(input.file);
  } catch {
    display = input.file;
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
    throw new Error(await readError(response, "Photo upload failed."));
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
}) {
  const send = async (momentId: string) => {
    const audioData = new FormData();
    audioData.set("momentId", momentId);
    audioData.set("file", input.blob, "moment-audio.webm");
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
