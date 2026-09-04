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
export const CAPTURE_MOMENT_FETCH_TIMEOUT_MS = 30_000;
export const CAPTURE_VIDEO_INIT_TIMEOUT_MS = 45_000;
// 8MiB on iPhone 4G often exceeds 20s. Desktop Wi-Fi hid this; Owner 4G did not.
export const CAPTURE_VIDEO_HOP_TIMEOUT_MS = 90_000;
export const CAPTURE_VIDEO_COMPLETE_TIMEOUT_MS = 30_000;
export const CAPTURE_PHOTO_FETCH_TIMEOUT_MS = 30_000;

export function captureVideoHopCount(fileSize: number) {
  if (fileSize <= 0) {
    return 1;
  }
  return Math.ceil(fileSize / captureVideoPutChunkBytes(fileSize));
}

export function captureUploadWatchdogMs(fileSize: number) {
  return (
    CAPTURE_MOMENT_FETCH_TIMEOUT_MS +
    CAPTURE_VIDEO_INIT_TIMEOUT_MS +
    captureVideoHopCount(fileSize) * CAPTURE_VIDEO_HOP_TIMEOUT_MS +
    CAPTURE_VIDEO_COMPLETE_TIMEOUT_MS
  );
}

export function isDirectDriveUploadUrl(url: string) {
  try {
    const parsed = new URL(url);
    return (
      parsed.protocol === "https:" &&
      (parsed.hostname === "www.googleapis.com" || parsed.hostname === "googleapis.com") &&
      parsed.pathname.includes("/upload/drive/")
    );
  } catch {
    return false;
  }
}

function isDriveHopContinue(response: Response) {
  return response.status === 308 || response.status === 0 || response.type === "opaqueredirect";
}

function isLikelyCorsOrNetworkError(error: unknown) {
  if (isCaptureUploadAbortError(error)) {
    return false;
  }
  if (error instanceof TypeError) {
    return true;
  }
  return error instanceof Error && /failed to fetch|networkerror|load failed|cors/i.test(error.message);
}

function readDriveFileId(payload: unknown) {
  if (!payload || typeof payload !== "object") {
    return "";
  }
  const id = (payload as { id?: unknown }).id;
  return typeof id === "string" ? id.trim() : "";
}

export function captureVideoPutChunkBytes(fileSize: number) {
  if (fileSize <= 0) {
    return CAPTURE_VIDEO_CHUNK_BYTES;
  }
  return Math.min(CAPTURE_VIDEO_CHUNK_BYTES, fileSize);
}

function mergeAbortSignals(signals: Array<AbortSignal | null | undefined>) {
  const present = signals.filter((signal): signal is AbortSignal => Boolean(signal));
  if (present.length === 0) {
    return undefined;
  }
  if (present.length === 1) {
    return present[0];
  }
  if (typeof AbortSignal.any === "function") {
    return AbortSignal.any(present);
  }
  const controller = new AbortController();
  const onAbort = () => controller.abort();
  for (const signal of present) {
    if (signal.aborted) {
      controller.abort();
      return controller.signal;
    }
    signal.addEventListener("abort", onAbort, { once: true });
  }
  return controller.signal;
}

export function isCaptureUploadAbortError(error: unknown) {
  if (typeof DOMException !== "undefined" && error instanceof DOMException && error.name === "AbortError") {
    return true;
  }
  if (error instanceof Error && (error.name === "AbortError" || error.name === "TimeoutError")) {
    return true;
  }
  return error instanceof Error && /aborted|timeout/i.test(error.message);
}

export async function captureFetch(input: RequestInfo | URL, init: RequestInit, timeoutMs: number) {
  const controller = new AbortController();
  const timer = globalThis.setTimeout(() => controller.abort(), timeoutMs);
  const signal = mergeAbortSignals([init.signal ?? undefined, controller.signal]);
  if (signal?.aborted) {
    globalThis.clearTimeout(timer);
    throw new Error(CAPTURE_UPLOAD_FAILED_MESSAGE);
  }

  try {
    const aborted = new Promise<Response>((_, reject) => {
      signal?.addEventListener(
        "abort",
        () => reject(new Error(CAPTURE_UPLOAD_FAILED_MESSAGE)),
        { once: true },
      );
    });
    return await Promise.race([fetch(input, { ...init, signal }), aborted]);
  } catch (error) {
    if (isCaptureUploadAbortError(error) || (error instanceof Error && error.message === CAPTURE_UPLOAD_FAILED_MESSAGE)) {
      throw new Error(CAPTURE_UPLOAD_FAILED_MESSAGE);
    }
    throw error;
  } finally {
    globalThis.clearTimeout(timer);
  }
}

const captureVideoSliceCache = new WeakMap<File, Blob[]>();
const captureVideoMaterialized = new WeakSet<File>();

export async function materializeCaptureVideoHop(chunk: Blob) {
  const bytes = new Uint8Array(await chunk.arrayBuffer());
  return new Blob([bytes], { type: chunk.type || "application/octet-stream" });
}

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

export async function materializeCaptureVideoSlices(file: File) {
  if (captureVideoMaterialized.has(file)) {
    return sliceCaptureVideo(file);
  }
  const views = sliceCaptureVideo(file);
  const durable: Blob[] = [];
  for (const view of views) {
    durable.push(view.size > 0 ? await materializeCaptureVideoHop(view) : view);
  }
  if (file.size > 0 && (durable.length === 0 || durable[0]?.size === 0)) {
    throw new Error(CAPTURE_UPLOAD_FAILED_MESSAGE);
  }
  captureVideoSliceCache.set(file, durable);
  captureVideoMaterialized.add(file);
  return durable;
}

export function captureVideoPreviewUrl(file: File) {
  const slices = sliceCaptureVideo(file);
  const first = slices[0];
  if (!first || first.size <= 0) {
    return null;
  }
  return URL.createObjectURL(first);
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
  if (isCaptureUploadAbortError(error)) {
    return fallback;
  }
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
  const response = await captureFetch(
    "/api/moments",
    {
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
    },
    CAPTURE_MOMENT_FETCH_TIMEOUT_MS,
  );

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
  const response = await captureFetch(
    "/api/moments",
    {
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
    },
    CAPTURE_MOMENT_FETCH_TIMEOUT_MS,
  );

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
  const slices = await materializeCaptureVideoSlices(source);

  void Promise.resolve(input.onDisplayReady?.(source)).catch(() => {
    // Tiny previews are optional; they must never block the video init POST.
  });

  const sendInit = async (momentId: string) =>
    captureFetch(
      "/api/moments/photos/video",
      {
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
      },
      CAPTURE_VIDEO_INIT_TIMEOUT_MS,
    );

  const { momentId, response: initResponse } = await sendWithMomentRetry(
    sendInit,
    input.momentId,
    input.retryMoment,
  );

  if (!initResponse.ok) {
    throw new Error(await readError(initResponse, CAPTURE_UPLOAD_FAILED_MESSAGE));
  }

  const initPayload = (await initResponse.json()) as { session?: string; uploadUrl?: string };
  const session = initPayload.session?.trim() ?? "";
  if (!session) {
    throw new Error(CAPTURE_UPLOAD_FAILED_MESSAGE);
  }
  const uploadUrl = initPayload.uploadUrl?.trim() ?? "";
  let hopViaWorker = !isDirectDriveUploadUrl(uploadUrl);

  const total = source.size;
  if (total > 0 && (slices.length === 0 || slices[0]?.size === 0)) {
    throw new Error(CAPTURE_UPLOAD_FAILED_MESSAGE);
  }
  const chunkSize = captureVideoPutChunkBytes(total);
  const mimeType = captureFileMime(source) || "video/quicktime";
  let offset = 0;
  let fileId = "";

  const completeDirectUpload = async (knownFileId = "") => {
    const response = await captureFetch(
      "/api/moments/photos/video",
      {
        body: JSON.stringify({
          complete: true,
          ...(knownFileId ? { fileId: knownFileId } : {}),
          session,
        }),
        headers: {
          "content-type": "application/json",
          ...pinHeaders(input.pin),
          "x-travelos-video-session": session,
        },
        method: "POST",
        signal: input.signal,
      },
      CAPTURE_VIDEO_COMPLETE_TIMEOUT_MS,
    );
    if (!response.ok) {
      throw new Error(await readError(response, CAPTURE_UPLOAD_FAILED_MESSAGE));
    }
    const payload = (await response.json()) as { photo?: MomentPhoto };
    if (!payload.photo) {
      throw new Error(CAPTURE_UPLOAD_FAILED_MESSAGE);
    }
    return { display: source, momentId, photo: payload.photo };
  };

  for (const chunk of slices) {
    const end = Math.min(offset + chunkSize, total);
    const contentRange = `bytes ${offset}-${end - 1}/${total}`;
    const body = chunk.size > 0 ? chunk : source.slice(offset, end);
    const lastHop = end === total || isLastVideoRange(contentRange, total);

    if (!hopViaWorker) {
      try {
        const response = await captureFetch(
          uploadUrl,
          {
            body,
            headers: {
              "content-range": contentRange,
              "content-type": mimeType,
            },
            method: "PUT",
            redirect: "manual",
            signal: input.signal,
          },
          CAPTURE_VIDEO_HOP_TIMEOUT_MS,
        );
        if (isDriveHopContinue(response)) {
          if (lastHop) {
            return await completeDirectUpload(fileId);
          }
          offset = end;
          continue;
        }
        if (!response.ok) {
          throw new Error(CAPTURE_UPLOAD_FAILED_MESSAGE);
        }
        if (lastHop) {
          try {
            fileId = readDriveFileId(await response.json()) || fileId;
          } catch {
            // Worker complete probes the Location if the phone cannot read Drive JSON.
          }
          return await completeDirectUpload(fileId);
        }
        offset = end;
        continue;
      } catch (error) {
        if (isCaptureUploadAbortError(error) || (error instanceof Error && error.message === CAPTURE_UPLOAD_FAILED_MESSAGE)) {
          throw new Error(CAPTURE_UPLOAD_FAILED_MESSAGE);
        }
        if (lastHop) {
          try {
            return await completeDirectUpload(fileId);
          } catch {
            // Last-hop CORS can hide a finished Drive PUT; if complete also
            // fails, drop through to Worker proxy only when nothing was sent.
          }
        }
        if (offset === 0 && isLikelyCorsOrNetworkError(error)) {
          hopViaWorker = true;
        } else {
          throw new Error(CAPTURE_UPLOAD_FAILED_MESSAGE);
        }
      }
    }

    const response = await captureFetch(
      "/api/moments/photos/video",
      {
        body,
        headers: {
          ...pinHeaders(input.pin),
          "content-range": contentRange,
          "content-type": "application/octet-stream",
          "x-travelos-video-session": session,
        },
        method: "PUT",
        signal: input.signal,
      },
      CAPTURE_VIDEO_HOP_TIMEOUT_MS,
    );
    if (!response.ok) {
      throw new Error(await readError(response, CAPTURE_UPLOAD_FAILED_MESSAGE));
    }
    if (lastHop) {
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

    return captureFetch(
      "/api/moments/photos",
      {
        body: formData,
        headers: pinHeaders(input.pin),
        method: "POST",
        signal: input.signal,
      },
      CAPTURE_PHOTO_FETCH_TIMEOUT_MS,
    );
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
