import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";
import {
  CAPTURE_DUMP_LIMIT,
  CAPTURE_MOMENT_FETCH_TIMEOUT_MS,
  CAPTURE_PHOTO_FETCH_TIMEOUT_MS,
  CAPTURE_UPLOAD_CONCURRENCY,
  CAPTURE_UPLOAD_FAILED_MESSAGE,
  CAPTURE_VIDEO_CHUNK_BYTES,
  CAPTURE_VIDEO_COMPLETE_TIMEOUT_MS,
  CAPTURE_VIDEO_HOP_TIMEOUT_MS,
  CAPTURE_VIDEO_INIT_TIMEOUT_MS,
  CAPTURE_VIDEO_MAX_BYTES,
  CAPTURE_VIDEO_SINGLE_PUT_MAX_BYTES,
  isDirectDriveUploadUrl,
  assertCaptureFileFits,
  captureErrorMessage,
  captureFetch,
  captureUploadWatchdogMs,
  captureVideoHopCount,
  captureVideoPreviewUrl,
  captureVideoPutChunkBytes,
  materializeCaptureVideoHop,
  materializeCaptureVideoSlices,
  captureVideoTooLargeMessage,
  copyCaptureFile,
  isCaptureUploadAbortError,
  sliceCaptureVideo,
  createMomentSession,
  ingestCaptureFileList,
  uploadDisplayPhoto,
} from "../lib/capture-upload.ts";
import {
  DRIVE_UPLOAD_CHUNK_BYTES,
  DRIVE_UPLOAD_SINGLE_PUT_MAX_BYTES,
  DRIVE_WAREHOUSE_FOLDER_ID,
  initDriveResumableUpload,
  putDriveResumableChunk,
  putVideoBinary,
  queryDriveResumableStatus,
  resetDriveWarehouseForTests,
  setDriveWarehouseFetchForTests,
  signDriveResumableSession,
  verifyDriveResumableSession,
} from "../lib/drive-warehouse.ts";
import { isCaptureVideoFile } from "../lib/moments.ts";

const root = resolve(import.meta.dirname, "..");

async function readSource(path: string) {
  return readFile(resolve(root, path), "utf8");
}

function fakeFileList(files: File[]): FileList {
  const list: Record<string, unknown> = {
    length: files.length,
    item(index: number) {
      return files[index] ?? null;
    },
    *[Symbol.iterator]() {
      yield* files;
    },
  };
  files.forEach((file, index) => {
    list[index] = file;
  });
  return list as unknown as FileList;
}

function videoFileWithSize(bytes: number, name = "IMG_1504.MOV") {
  const file = new File([new Uint8Array([0, 0, 1, 2])], name, { type: "video/quicktime" });
  Object.defineProperty(file, "size", { configurable: true, value: bytes });
  return file;
}

const IMG_1504_BYTES = 45_901_603;
const NINETY_MB = 90_000_000;

function expectedPutCount(fileSize: number) {
  return Math.ceil(fileSize / captureVideoPutChunkBytes(fileSize));
}

function threeChunkMovieBytes() {
  const chunk = 256 * 1024;
  const last = 100;
  const bytes = new Uint8Array(chunk * 2 + last);
  bytes.fill(7, 0, chunk);
  bytes.fill(8, chunk, chunk * 2);
  bytes.fill(9, chunk * 2);
  return { bytes, chunk, last, total: bytes.byteLength };
}

function headerValue(headers: HeadersInit | undefined, name: string) {
  if (!headers) {
    return null;
  }
  if (headers instanceof Headers) {
    return headers.get(name);
  }
  if (Array.isArray(headers)) {
    const found = headers.find(([key]) => key.toLowerCase() === name.toLowerCase());
    return found?.[1] ?? null;
  }
  const record = headers as Record<string, string>;
  return (
    record[name] ??
    record[name.toLowerCase()] ??
    record[name.replace(/^[a-z]/, (ch) => ch.toUpperCase())] ??
    null
  );
}

function jsonResponse(value: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(value), {
    ...init,
    headers: { "content-type": "application/json", ...(init.headers ?? {}) },
  });
}

async function bodyBytes(body: BodyInit | null | undefined) {
  if (body == null) {
    return new Uint8Array();
  }
  if (typeof body === "string") {
    return new Uint8Array(Buffer.from(body));
  }
  if (body instanceof Uint8Array) {
    return body;
  }
  if (typeof ArrayBuffer !== "undefined" && body instanceof ArrayBuffer) {
    return new Uint8Array(body);
  }
  if (typeof Blob !== "undefined" && body instanceof Blob) {
    return new Uint8Array(await body.arrayBuffer());
  }
  if (typeof Buffer !== "undefined" && Buffer.isBuffer(body)) {
    return new Uint8Array(body);
  }
  throw new Error("unsupported body");
}

function bodyKind(body: BodyInit | null | undefined) {
  if (body == null) {
    return "empty";
  }
  if (typeof body === "string") {
    return body.includes("base64") ? "json-base64" : "json";
  }
  if (
    (typeof Buffer !== "undefined" && Buffer.isBuffer(body)) ||
    body instanceof Uint8Array ||
    body instanceof ArrayBuffer ||
    (typeof Blob !== "undefined" && body instanceof Blob)
  ) {
    return "bytes";
  }
  return "other";
}

test("15s-class dummy IMG_1504.MOV at 60MB and 80MB is not rejected", () => {
  assert.equal(CAPTURE_VIDEO_MAX_BYTES, 100_000_000);
  assert.equal(captureVideoTooLargeMessage(), CAPTURE_UPLOAD_FAILED_MESSAGE);
  assert.doesNotMatch(captureVideoTooLargeMessage(), /換一段短一點的/);
  assert.doesNotMatch(captureVideoTooLargeMessage(), /短一點/);
  assert.doesNotThrow(() => assertCaptureFileFits(videoFileWithSize(60_000_000, "IMG_1504.MOV")));
  assert.doesNotThrow(() => assertCaptureFileFits(videoFileWithSize(80_000_000, "IMG_1504.MOV")));
});

test("46MB-class dummy uses 16MiB hops not 1 PUT and not 175; 16MiB boundary", () => {
  assert.equal(CAPTURE_VIDEO_CHUNK_BYTES, 16 * 1024 * 1024);
  assert.equal(CAPTURE_VIDEO_CHUNK_BYTES, 16_777_216);
  assert.equal(CAPTURE_VIDEO_CHUNK_BYTES % (256 * 1024), 0);
  assert.equal(CAPTURE_VIDEO_CHUNK_BYTES % DRIVE_UPLOAD_CHUNK_BYTES, 0);
  assert.equal(CAPTURE_VIDEO_SINGLE_PUT_MAX_BYTES, 80_000_000);
  assert.equal(DRIVE_UPLOAD_SINGLE_PUT_MAX_BYTES, 80_000_000);

  assert.equal(captureVideoPutChunkBytes(1), 1);
  assert.equal(captureVideoPutChunkBytes(CAPTURE_VIDEO_CHUNK_BYTES), CAPTURE_VIDEO_CHUNK_BYTES);
  assert.equal(captureVideoPutChunkBytes(CAPTURE_VIDEO_CHUNK_BYTES + 1), CAPTURE_VIDEO_CHUNK_BYTES);
  assert.equal(captureVideoPutChunkBytes(IMG_1504_BYTES), CAPTURE_VIDEO_CHUNK_BYTES);
  assert.equal(captureVideoPutChunkBytes(80_000_000), CAPTURE_VIDEO_CHUNK_BYTES);
  assert.equal(captureVideoPutChunkBytes(NINETY_MB), CAPTURE_VIDEO_CHUNK_BYTES);

  assert.equal(expectedPutCount(IMG_1504_BYTES), Math.ceil(IMG_1504_BYTES / CAPTURE_VIDEO_CHUNK_BYTES));
  assert.equal(expectedPutCount(IMG_1504_BYTES), 3);
  assert.equal(captureVideoHopCount(10_000_000), 1);
  assert.equal(captureVideoHopCount(IMG_1504_BYTES), 3);
  assert.notEqual(expectedPutCount(IMG_1504_BYTES), 1);
  assert.notEqual(expectedPutCount(IMG_1504_BYTES), 175);
  assert.equal(expectedPutCount(CAPTURE_VIDEO_CHUNK_BYTES), 1);
  assert.equal(expectedPutCount(CAPTURE_VIDEO_CHUNK_BYTES + 1), 2);
  assert.equal(expectedPutCount(NINETY_MB), Math.ceil(NINETY_MB / CAPTURE_VIDEO_CHUNK_BYTES));
  assert.ok(expectedPutCount(NINETY_MB) > 1);
  assert.ok(expectedPutCount(NINETY_MB) < 20);

  const video = new File([new Uint8Array([0, 0, 1, 2])], "IMG_1504.MOV", { type: "video/quicktime" });
  const copied = copyCaptureFile(video);
  assert.equal(copied, video);
  assert.equal(sliceCaptureVideo(video).length, 1);
});

test("10MB and 46MB watchdogs cover one silent retry and hops stay 16MiB", () => {
  const oneHopPass =
    CAPTURE_VIDEO_INIT_TIMEOUT_MS + CAPTURE_VIDEO_HOP_TIMEOUT_MS + CAPTURE_VIDEO_COMPLETE_TIMEOUT_MS;
  assert.equal(captureVideoHopCount(10_000_000), 1);
  assert.equal(captureVideoHopCount(IMG_1504_BYTES), 3);
  assert.equal(captureUploadWatchdogMs(10_000_000), CAPTURE_MOMENT_FETCH_TIMEOUT_MS + oneHopPass * 2);
  assert.ok(captureUploadWatchdogMs(10_000_000) < 400_000);
  assert.ok(captureUploadWatchdogMs(IMG_1504_BYTES) < 800_000);
  assert.equal(CAPTURE_MOMENT_FETCH_TIMEOUT_MS, 30_000);
  assert.equal(CAPTURE_VIDEO_INIT_TIMEOUT_MS, 45_000);
  assert.equal(CAPTURE_VIDEO_COMPLETE_TIMEOUT_MS, 30_000);
  assert.equal(CAPTURE_VIDEO_HOP_TIMEOUT_MS, 90_000);
  assert.ok(CAPTURE_VIDEO_HOP_TIMEOUT_MS > 20_000);
  assert.equal(CAPTURE_PHOTO_FETCH_TIMEOUT_MS, 30_000);
});

test("materialized hops stay independent of the album File after reset", async () => {
  const bytes = new Uint8Array(64);
  bytes.fill(9);
  const file = new File([bytes], "clip.MOV", { type: "video/quicktime" });
  const views = sliceCaptureVideo(file);
  const durable = await materializeCaptureVideoHop(views[0]!);
  assert.notEqual(durable, views[0]);
  assert.equal(durable.size, bytes.byteLength);
  assert.deepEqual([...new Uint8Array(await durable.arrayBuffer())], [...bytes]);

  const copies = await materializeCaptureVideoSlices(file);
  assert.equal(copies[0]?.size, bytes.byteLength);
  const preview = captureVideoPreviewUrl(file);
  assert.ok(preview);
  assert.match(preview, /^blob:/);
  URL.revokeObjectURL(preview);
  const previewFn = (await readSource("lib/capture-upload.ts")).slice(
    (await readSource("lib/capture-upload.ts")).indexOf("export function captureVideoPreviewUrl"),
    (await readSource("lib/capture-upload.ts")).indexOf("export type CapturePhotoDraft"),
  );
  assert.match(previewFn, /createObjectURL\(file\)/);
  assert.doesNotMatch(previewFn, /slices\[0\]/);
});

test("a hop that takes 25s still succeeds because the phone timeout is 90s", async () => {
  assert.equal(CAPTURE_VIDEO_HOP_TIMEOUT_MS, 90_000);
  assert.ok(CAPTURE_VIDEO_HOP_TIMEOUT_MS > 20_000);
  const original = globalThis.fetch;
  globalThis.fetch = (async (_input, init) => {
    await new Promise((resolve) => setTimeout(resolve, 25_000));
    if (init?.signal?.aborted) {
      throw Object.assign(new Error("aborted"), { name: "AbortError" });
    }
    return new Response(JSON.stringify({ photo: { id: "p1", kind: "video" } }), {
      headers: { "content-type": "application/json" },
      status: 200,
    });
  }) as typeof fetch;
  const started = Date.now();
  try {
    const response = await captureFetch(
      "/api/moments/photos/video",
      { method: "PUT", body: new Uint8Array([1]) },
      CAPTURE_VIDEO_HOP_TIMEOUT_MS,
    );
    const elapsed = Date.now() - started;
    assert.equal(response.status, 200);
    assert.ok(elapsed >= 25_000, `hop returned too fast (${elapsed}ms)`);
    assert.ok(elapsed < CAPTURE_VIDEO_HOP_TIMEOUT_MS, `hop was aborted (${elapsed}ms)`);
  } finally {
    globalThis.fetch = original;
  }
});

test("hung capture fetch becomes 上傳失敗 and does not wait minutes", async () => {
  const original = globalThis.fetch;
  globalThis.fetch = ((input, init) =>
    new Promise((_, reject) => {
      init?.signal?.addEventListener(
        "abort",
        () => reject(Object.assign(new Error("The user aborted a request."), { name: "AbortError" })),
        { once: true },
      );
    })) as typeof fetch;
  const started = Date.now();
  try {
    await assert.rejects(
      () => captureFetch("/api/moments", { method: "POST" }, 80),
      (error: unknown) => error instanceof Error && error.message === CAPTURE_UPLOAD_FAILED_MESSAGE,
    );
    assert.ok(Date.now() - started < 1500, `hung fetch leaked (${Date.now() - started}ms)`);
  } finally {
    globalThis.fetch = original;
  }
});

test("AbortError and timeout errors become 上傳失敗。", () => {
  assert.equal(isCaptureUploadAbortError(new DOMException("The operation was aborted.", "AbortError")), true);
  assert.equal(isCaptureUploadAbortError(Object.assign(new Error("signal timed out"), { name: "TimeoutError" })), true);
  assert.equal(captureErrorMessage(new DOMException("The operation was aborted.", "AbortError"), CAPTURE_UPLOAD_FAILED_MESSAGE), CAPTURE_UPLOAD_FAILED_MESSAGE);
  assert.equal(captureErrorMessage(new Error("network stall timeout"), CAPTURE_UPLOAD_FAILED_MESSAGE), CAPTURE_UPLOAD_FAILED_MESSAGE);
  assert.doesNotMatch(captureErrorMessage(new Error("aborted"), CAPTURE_UPLOAD_FAILED_MESSAGE), /aborted/);
});

test("video ingest does not reset the album input before 8MiB hops start", async () => {
  let reset = false;
  const movie = new File([new Uint8Array([0, 0, 1, 2])], "IMG_1504.MOV", { type: "video/quicktime" });
  const jpeg = new File([new Uint8Array([1, 2, 3, 4])], "IMG_1505.JPG", { type: "image/jpeg" });
  await ingestCaptureFileList(fakeFileList([movie, jpeg]), {
    onCopied() {},
    resetInput() {
      reset = true;
    },
  });
  assert.equal(reset, false);

  reset = false;
  await ingestCaptureFileList(fakeFileList([jpeg]), {
    onCopied() {},
    resetInput() {
      reset = true;
    },
  });
  assert.equal(reset, true);
});

const DIRECT_DRIVE_UPLOAD_URL =
  "https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&upload_id=client-direct";

async function uploadVideoAndCollectPuts(file: File, options: { uploadUrl?: string | null } = {}) {
  const uploadUrl = options.uploadUrl === undefined ? DIRECT_DRIVE_UPLOAD_URL : options.uploadUrl;
  const calls: Array<{
    byteLength: number;
    contentRange: string | null;
    form: boolean;
    method: string;
    pin: string | null;
    session: string | null;
    url: string;
  }> = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = (init?.method ?? "POST").toUpperCase();
    const body = init?.body;
    const form = typeof FormData !== "undefined" && body instanceof FormData;
    const byteLength = form
      ? ((body.get("file") as File | null)?.size ?? 0)
      : (await bodyBytes(body as BodyInit)).byteLength;
    calls.push({
      byteLength,
      contentRange: headerValue(init?.headers, "content-range"),
      form,
      method,
      pin: headerValue(init?.headers, "x-travelos-admin-pin"),
      session: headerValue(init?.headers, "x-travelos-video-session"),
      url,
    });
    if (form && url.includes("/api/moments/photos") && !url.includes("/video")) {
      throw new Error("video must not POST whole-file FormData to /api/moments/photos");
    }
    if (url.includes("/api/moments/photos/video") && method === "POST") {
      const payload = JSON.parse(typeof body === "string" ? body : "{}") as {
        complete?: unknown;
        fileId?: unknown;
      };
      if (payload.complete === true || typeof payload.fileId === "string") {
        return jsonResponse({ photo: { id: "photo_mov", momentId: "moment_video", kind: "video" } });
      }
      return jsonResponse({
        session: "opaque-test-session",
        ...(uploadUrl ? { uploadUrl } : {}),
      });
    }
    if (url.includes("googleapis.com/upload/drive") && method === "PUT") {
      assert.equal(headerValue(init?.headers, "x-travelos-admin-pin"), null);
      assert.equal(headerValue(init?.headers, "x-travelos-video-session"), null);
      const range = headerValue(init?.headers, "content-range") ?? "";
      const total = file.size;
      if (range.endsWith(`/${total}`) && range.includes(`${total - 1}/`)) {
        return jsonResponse({ id: "file_mov" });
      }
      return new Response(null, { status: 308 });
    }
    if (url.includes("/api/moments/photos/video") && method === "PUT") {
      if (uploadUrl) {
        throw new Error("phone must not proxy hops through the Worker when uploadUrl is present");
      }
      const range = headerValue(init?.headers, "content-range") ?? "";
      const total = file.size;
      if (range.endsWith(`/${total}`) && range.includes(`${total - 1}/`)) {
        return jsonResponse({ photo: { id: "photo_mov", momentId: "moment_video", kind: "video" } });
      }
      return jsonResponse({ ok: true });
    }
    throw new Error(`unexpected fetch ${method} ${url}`);
  }) as typeof fetch;

  try {
    const uploaded = await uploadDisplayPhoto({
      coordinates: null,
      file,
      momentId: "moment_video",
      pin: "test-capture-pin",
      takenAt: "2026-09-03T01:10:00.000Z",
    });
    return { calls, uploaded };
  } finally {
    globalThis.fetch = originalFetch;
  }
}

test("video upload client does not send one multipart FormData of the whole .mov to /api/moments/photos", async () => {
  const { bytes } = threeChunkMovieBytes();
  const file = new File([bytes], "IMG_1504.MOV", { type: "video/quicktime" });
  const { calls, uploaded } = await uploadVideoAndCollectPuts(file);
  assert.equal(uploaded.photo.id, "photo_mov");
  assert.equal(
    calls.some((call) => call.form && call.url.includes("/api/moments/photos") && !call.url.includes("/video")),
    false,
  );
  assert.equal(
    calls.some((call) => call.url.includes("/api/moments/photos/video") && call.method === "POST"),
    true,
  );
  const puts = calls.filter((call) => call.method === "PUT");
  assert.equal(puts.length, 1);
  assert.equal(puts[0]?.contentRange, `bytes 0-${file.size - 1}/${file.size}`);
  assert.equal(puts[0]?.url.includes("googleapis.com/upload/drive") || puts[0]?.url === DIRECT_DRIVE_UPLOAD_URL, true);
  assert.equal(
    calls.some((call) => call.url.includes("/api/moments/photos/video") && call.method === "PUT"),
    false,
  );
  assert.equal(
    calls.some(
      (call) =>
        call.url.includes("/api/moments/photos/video") &&
        call.method === "POST" &&
        call.byteLength > 0 &&
        call.byteLength < 200,
    ),
    true,
  );
});

test("46MB IMG_1504-class dummy is 16MiB hops after init, not 1 PUT and not 175", async () => {
  const file = videoFileWithSize(IMG_1504_BYTES);
  const { calls, uploaded } = await uploadVideoAndCollectPuts(file);
  assert.equal(uploaded.photo.id, "photo_mov");
  const puts = calls.filter((call) => call.method === "PUT");
  const expected = expectedPutCount(IMG_1504_BYTES);
  assert.equal(puts.length, expected);
  assert.equal(puts.length, 3);
  assert.notEqual(puts.length, 1);
  assert.notEqual(puts.length, 175);
  assert.equal(puts[0]?.contentRange, `bytes 0-${CAPTURE_VIDEO_CHUNK_BYTES - 1}/${IMG_1504_BYTES}`);
  assert.equal(puts.at(-1)?.contentRange?.endsWith(`/${IMG_1504_BYTES}`), true);
  assert.match(puts.at(-1)?.contentRange ?? "", new RegExp(`${IMG_1504_BYTES - 1}/${IMG_1504_BYTES}$`));
  assert.equal(
    puts.every((call) => call.url === DIRECT_DRIVE_UPLOAD_URL && call.pin == null && call.session == null),
    true,
  );
  assert.equal(
    calls.some((call) => call.url.includes("/api/moments/photos/video") && call.method === "PUT"),
    false,
  );
  assert.equal(
    calls.filter((call) => call.url.includes("/api/moments/photos/video") && call.method === "POST").length,
    2,
  );
  assert.equal(
    calls.some((call) => call.form && call.url.includes("/api/moments/photos") && !call.url.includes("/video")),
    false,
  );
});

test("16MiB-and-under is one whole-file PUT; 90MB dummy uses 16MiB chunks", async () => {
  const eight = videoFileWithSize(CAPTURE_VIDEO_CHUNK_BYTES, "eight.MOV");
  const eightUploaded = await uploadVideoAndCollectPuts(eight);
  const eightPuts = eightUploaded.calls.filter((call) => call.method === "PUT");
  assert.equal(eightPuts.length, 1);
  assert.equal(eightPuts[0]?.contentRange, `bytes 0-${CAPTURE_VIDEO_CHUNK_BYTES - 1}/${CAPTURE_VIDEO_CHUNK_BYTES}`);

  const ninety = videoFileWithSize(NINETY_MB, "ninety.MOV");
  const ninetyUploaded = await uploadVideoAndCollectPuts(ninety);
  const ninetyPuts = ninetyUploaded.calls.filter((call) => call.method === "PUT");
  const expected = expectedPutCount(NINETY_MB);
  assert.equal(ninetyPuts.length, expected);
  assert.ok(ninetyPuts.length > 1);
  const lastIndex = ninetyPuts.length - 1;
  for (const [index, put] of ninetyPuts.entries()) {
    const match = put.contentRange?.match(/^bytes (\d+)-(\d+)\/(\d+)$/);
    assert.ok(match);
    const start = Number(match[1]);
    const end = Number(match[2]);
    const total = Number(match[3]);
    assert.equal(total, NINETY_MB);
    assert.equal(start, index * CAPTURE_VIDEO_CHUNK_BYTES);
    if (index < lastIndex) {
      assert.equal(end - start + 1, CAPTURE_VIDEO_CHUNK_BYTES);
    } else {
      assert.equal(end, NINETY_MB - 1);
      assert.ok(end - start + 1 <= CAPTURE_VIDEO_CHUNK_BYTES);
    }
  }
});

async function uploadVideoWithFetch(
  file: File,
  fetchImpl: typeof fetch,
  options: {
    onHopProgress?: (done: number, total: number) => void;
    startMoment?: () => Promise<string>;
    signal?: AbortSignal;
  } = {},
) {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = fetchImpl;
  try {
    return await uploadDisplayPhoto({
      coordinates: null,
      file,
      momentId: "moment_video",
      onHopProgress: options.onHopProgress,
      pin: "test-capture-pin",
      signal: options.signal,
      startMoment: options.startMoment,
      takenAt: "2026-09-04T05:22:13.535Z",
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
}

function driveVideoFetch(options: { failFirstInit?: boolean; events?: string[] } = {}) {
  let inits = 0;
  const events = options.events ?? [];
  const impl = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = (init?.method ?? "POST").toUpperCase();
    const body = init?.body;
    if (url.includes("/api/moments/photos/video") && method === "POST") {
      const payload = JSON.parse(typeof body === "string" ? body : "{}") as { complete?: unknown };
      if (payload.complete === true) {
        events.push("complete");
        return jsonResponse({ photo: { id: "photo_mov", momentId: "moment_video", kind: "video" } });
      }
      inits += 1;
      events.push("init");
      if (options.failFirstInit && inits === 1) {
        return jsonResponse({ error: "上傳失敗。" }, { status: 503 });
      }
      return jsonResponse({ session: "opaque-test-session", uploadUrl: DIRECT_DRIVE_UPLOAD_URL });
    }
    if (url.includes("googleapis.com/upload/drive") && method === "PUT") {
      events.push("hop");
      return jsonResponse({ id: "file_mov" });
    }
    throw new Error(`unexpected fetch ${method} ${url}`);
  }) as typeof fetch;
  return { events, getInits: () => inits, impl };
}

test("16MiB-and-under hop chip starts at 1/1, not 0/1", async () => {
  const file = videoFileWithSize(10_000_000, "IMG_1542.MOV");
  const hops: Array<[number, number]> = [];
  const { impl } = driveVideoFetch();
  const uploaded = await uploadVideoWithFetch(file, impl, {
    onHopProgress: (done, total) => hops.push([done, total]),
  });
  assert.equal(uploaded.photo.id, "photo_mov");
  assert.deepEqual(hops, [[1, 1]]);
  assert.notEqual(hops[0]?.[0], 0);
});

test("Drive init finishes before startMoment so warehouse work does not overlap", async () => {
  const file = videoFileWithSize(10_000_000, "IMG_1542.MOV");
  const events: string[] = [];
  const { impl } = driveVideoFetch({ events });
  const uploaded = await uploadVideoWithFetch(file, impl, {
    startMoment: async () => {
      events.push("moment");
      return "moment_video";
    },
  });
  assert.equal(uploaded.photo.id, "photo_mov");
  assert.ok(events.indexOf("init") < events.indexOf("moment"));
  assert.ok(events.indexOf("moment") < events.indexOf("hop") || events.indexOf("moment") < events.indexOf("complete"));
  assert.equal(events[0], "init");
});

test("first init 503 retries invisibly without throwing 上傳失敗", async () => {
  const file = videoFileWithSize(10_000_000, "IMG_1542.MOV");
  const events: string[] = [];
  let startMomentCalls = 0;
  const { getInits, impl } = driveVideoFetch({ events, failFirstInit: true });
  const uploaded = await uploadVideoWithFetch(file, impl, {
    startMoment: async () => {
      startMomentCalls += 1;
      events.push("moment");
      return "moment_video";
    },
  });
  assert.equal(uploaded.photo.id, "photo_mov");
  assert.equal(getInits(), 2);
  assert.equal(startMomentCalls, 1);
  assert.equal(events.filter((event) => event === "init").length, 2);
  assert.equal(events.includes("moment"), true);
  assert.ok(events.lastIndexOf("init") < events.indexOf("moment"));
});

test("rejected startMoment still completes the Drive file without surfacing 上傳失敗", async () => {
  const file = videoFileWithSize(4_000_000, "short.MOV");
  const { events, impl } = driveVideoFetch();
  const uploaded = await uploadVideoWithFetch(file, impl, {
    startMoment: async () => {
      throw new Error("Could not save this moment.");
    },
  });
  assert.equal(uploaded.photo.id, "photo_mov");
  assert.equal(events.includes("complete"), true);
});

test("aborted video upload does not silent-retry", async () => {
  const file = videoFileWithSize(4_000_000, "short.MOV");
  const controller = new AbortController();
  controller.abort();
  let inits = 0;
  await assert.rejects(
    () =>
      uploadVideoWithFetch(
        file,
        (async () => {
          inits += 1;
          return jsonResponse({ session: "opaque-test-session", uploadUrl: DIRECT_DRIVE_UPLOAD_URL });
        }) as typeof fetch,
        { signal: controller.signal },
      ),
    (error: unknown) => {
      assert.ok(error instanceof Error);
      assert.equal(error.message, CAPTURE_UPLOAD_FAILED_MESSAGE);
      return true;
    },
  );
  assert.equal(inits, 0);
});

test("direct Drive upload URL is https googleapis upload, not OAuth", () => {
  assert.equal(isDirectDriveUploadUrl(DIRECT_DRIVE_UPLOAD_URL), true);
  assert.equal(isDirectDriveUploadUrl("https://www.googleapis.com/upload/drive/v3/files?upload_id=x"), true);
  assert.equal(isDirectDriveUploadUrl("https://travelos2.chao-jason.workers.dev/api/moments/photos/video"), false);
  assert.equal(isDirectDriveUploadUrl("https://example.com/upload/drive/v3/files"), false);
  assert.equal(isDirectDriveUploadUrl("ya29.not-a-url"), false);
});

test("missing uploadUrl falls back to Worker hops", async () => {
  const file = new File([new Uint8Array([0, 0, 1, 2])], "clip.MOV", { type: "video/quicktime" });
  const { calls, uploaded } = await uploadVideoAndCollectPuts(file, { uploadUrl: null });
  assert.equal(uploaded.photo.id, "photo_mov");
  const workerPuts = calls.filter((call) => call.url.includes("/api/moments/photos/video") && call.method === "PUT");
  assert.equal(workerPuts.length, 1);
  assert.equal(
    calls.some((call) => call.url.includes("googleapis.com/upload/drive")),
    false,
  );
});

test("first-hop CORS TypeError falls back to Worker hops", async () => {
  const file = new File([new Uint8Array([9, 8, 7, 6])], "clip.MOV", { type: "video/quicktime" });
  const calls: string[] = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = (init?.method ?? "POST").toUpperCase();
    const body = init?.body;
    calls.push(`${method} ${url}`);
    if (url.includes("/api/moments/photos/video") && method === "POST") {
      const payload = JSON.parse(typeof body === "string" ? body : "{}") as { complete?: unknown };
      if (payload.complete === true) {
        throw new Error("complete should not run when falling back to Worker PUT");
      }
      return jsonResponse({ session: "opaque-test-session", uploadUrl: DIRECT_DRIVE_UPLOAD_URL });
    }
    if (url.includes("googleapis.com/upload/drive") && method === "PUT") {
      throw new TypeError("Failed to fetch");
    }
    if (url.includes("/api/moments/photos/video") && method === "PUT") {
      return jsonResponse({ photo: { id: "photo_fallback", momentId: "moment_video", kind: "video" } });
    }
    throw new Error(`unexpected fetch ${method} ${url}`);
  }) as typeof fetch;
  try {
    const uploaded = await uploadDisplayPhoto({
      coordinates: null,
      file,
      momentId: "moment_video",
      pin: "test-capture-pin",
      takenAt: "2026-09-03T01:10:00.000Z",
    });
    assert.equal(uploaded.photo.id, "photo_fallback");
    assert.equal(
      calls.some((call) => call.startsWith("PUT https://www.googleapis.com/upload/drive")),
      true,
    );
    assert.equal(
      calls.some((call) => call.includes("/api/moments/photos/video") && call.startsWith("PUT")),
      true,
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("queryDriveResumableStatus reads a finished Location without OAuth on the phone", async () => {
  const fakeFetch = (async (input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) => {
    const url = String(input);
    const method = (init?.method ?? "GET").toUpperCase();
    if (method === "PUT" && url.includes("upload_id=status1")) {
      assert.equal(headerValue(init?.headers as HeadersInit, "Content-Range"), "bytes */524288");
      assert.equal(headerValue(init?.headers as HeadersInit, "Authorization"), null);
      return jsonResponse({ id: "file_status", name: "clip.MOV" });
    }
    throw new Error(`unexpected fetch ${method} ${url}`);
  }) as typeof fetch;
  const result = await queryDriveResumableStatus(
    "https://www.googleapis.com/upload/drive/v3/files?upload_id=status1",
    524288,
    fakeFetch,
  );
  assert.equal("id" in result && result.id, "file_status");
});

test("init + raw Drive hops never json-base64 and never putBinary", async () => {
  assert.equal(DRIVE_UPLOAD_CHUNK_BYTES, 8 * 1024 * 1024);
  assert.equal(CAPTURE_VIDEO_CHUNK_BYTES % DRIVE_UPLOAD_CHUNK_BYTES, 0);
  const { bytes, chunk, last, total } = threeChunkMovieBytes();
  const calls: Array<{ bodyKind: string; byteLength: number; contentRange: string | null; method: string; url: string }> =
    [];

  const fakeFetch = (async (input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) => {
    const url = String(input);
    const method = (init?.method ?? "GET").toUpperCase();
    const body = init?.body as BodyInit | undefined;
    const kind = bodyKind(body);
    const chunkBytes = kind === "bytes" ? await bodyBytes(body) : new Uint8Array();
    calls.push({
      bodyKind: kind,
      byteLength: chunkBytes.byteLength,
      contentRange: headerValue(init?.headers as HeadersInit | undefined, "Content-Range") ?? headerValue(init?.headers as HeadersInit | undefined, "content-range"),
      method,
      url,
    });

    if (method === "GET" && url.includes("op=drive-access")) {
      return jsonResponse({ folderId: DRIVE_WAREHOUSE_FOLDER_ID, token: "ya29.fake-drive-token" });
    }
    if (method === "POST" && url.includes("uploadType=resumable")) {
      assert.doesNotMatch(typeof init?.body === "string" ? init.body : "", /base64/);
      assert.equal(headerValue(init?.headers as HeadersInit, "X-Upload-Content-Length"), String(total));
      return new Response(null, {
        headers: { location: "https://www.googleapis.com/upload/drive/v3/files?upload_id=mov15s" },
        status: 200,
      });
    }
    if (method === "PUT" && url.includes("upload_id=mov15s")) {
      const range = headerValue(init?.headers as HeadersInit, "Content-Range") ?? "";
      assert.match(range, /^bytes \d+-\d+\/\d+$/);
      assert.ok(chunkBytes.byteLength <= DRIVE_UPLOAD_SINGLE_PUT_MAX_BYTES);
      if (range.endsWith(`/${total}`) && range.includes(`${total - 1}/`)) {
        return jsonResponse({ id: "file_mov_15s", name: "IMG_1504.MOV" });
      }
      return new Response(null, { status: 308, headers: { range: `bytes=0-${range.split("-")[1]?.split("/")[0]}` } });
    }
    throw new Error(`unexpected fetch ${method} ${url}`);
  }) as typeof fetch;

  const started = await initDriveResumableUpload(
    { mimeType: "video/quicktime", name: "IMG_1504.MOV", size: total },
    fakeFetch,
  );
  assert.match(started.location, /upload_id=mov15s/);
  assert.doesNotMatch(started.location, /ya29/);
  assert.equal("token" in started, false);

  const first = await putDriveResumableChunk(
    {
      body: bytes.subarray(0, chunk),
      contentRange: `bytes 0-${chunk - 1}/${total}`,
      location: started.location,
      mimeType: "video/quicktime",
    },
    fakeFetch,
  );
  assert.equal("incomplete" in first && first.incomplete, true);

  const second = await putDriveResumableChunk(
    {
      body: bytes.subarray(chunk, chunk * 2),
      contentRange: `bytes ${chunk}-${chunk * 2 - 1}/${total}`,
      location: started.location,
      mimeType: "video/quicktime",
    },
    fakeFetch,
  );
  assert.equal("incomplete" in second && second.incomplete, true);

  const lastChunk = await putDriveResumableChunk(
    {
      body: bytes.subarray(chunk * 2),
      contentRange: `bytes ${chunk * 2}-${total - 1}/${total}`,
      location: started.location,
      mimeType: "video/quicktime",
    },
    fakeFetch,
  );
  assert.equal("id" in lastChunk && lastChunk.id, "file_mov_15s");

  const stored = await putVideoBinary({ bytes, mimeType: "video/quicktime", name: "IMG_1504.MOV" }, fakeFetch);
  assert.equal(stored.id, "file_mov_15s");

  const puts = calls.filter((call) => call.method === "PUT");
  assert.ok(puts.length >= 4);
  const wholeFilePuts = puts.filter((call) => call.contentRange === `bytes 0-${total - 1}/${total}`);
  assert.equal(wholeFilePuts.length >= 1, true);
  assert.equal(
    puts.every((call) => call.bodyKind === "bytes"),
    true,
  );
  assert.equal(
    calls.some((call) => call.bodyKind === "json-base64"),
    false,
  );

  const session = signDriveResumableSession({
    coordinates: null,
    filename: "IMG_1504.MOV",
    location: started.location,
    mimeType: "video/quicktime",
    momentId: "moment_video",
    name: "IMG_1504.MOV",
    size: total,
    takenAt: "2026-09-03T01:10:00.000Z",
  });
  const decoded = Buffer.from(session.split(".")[0] ?? "", "base64url").toString();
  assert.doesNotMatch(decoded, /ya29/);
  assert.doesNotMatch(decoded, /fake-drive-token/);
  const verified = verifyDriveResumableSession(session);
  assert.equal(verified.location, started.location);
  assert.equal(verified.size, total);

  resetDriveWarehouseForTests();
  setDriveWarehouseFetchForTests(null);
});

test("Worker video route accepts one whole-file PUT and 8MiB hops, returns a Drive file id", async () => {
  const { POST, PUT } = await import("../app/api/moments/photos/video/route.ts");
  const { bytes, total } = threeChunkMovieBytes();
  const drivePuts: number[] = [];
  const fakeFetch = (async (input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) => {
    const url = String(input);
    const method = (init?.method ?? "GET").toUpperCase();
    if (method === "GET" && url.includes("op=drive-access")) {
      return jsonResponse({ folderId: DRIVE_WAREHOUSE_FOLDER_ID, token: "ya29.must-not-leak" });
    }
    if (method === "GET" && url.includes("op=index")) {
      return jsonResponse({ jobs: [], moments: [], schemaVersion: 2, updatedAt: "2026-09-03T00:00:00.000Z" });
    }
    if (method === "POST" && url.includes("script.google.com")) {
      const payload = JSON.parse(typeof init?.body === "string" ? init.body : "{}") as { base64?: string; op?: string };
      assert.equal(payload.base64, undefined);
      return jsonResponse({ ok: true, name: "moments.json" });
    }
    if (method === "POST" && url.includes("uploadType=resumable")) {
      return new Response(null, {
        headers: { location: "https://www.googleapis.com/upload/drive/v3/files?upload_id=route15s" },
        status: 200,
      });
    }
    if (method === "PUT" && url.includes("upload_id=route15s")) {
      const range = headerValue(init?.headers as HeadersInit, "Content-Range") ?? "";
      if (range === `bytes */${total}` || range.startsWith("bytes */")) {
        return jsonResponse({ id: "file_route_complete", name: "IMG_1504.MOV" });
      }
      const chunkBytes = await bodyBytes(init?.body as BodyInit);
      drivePuts.push(chunkBytes.byteLength);
      assert.ok(chunkBytes.byteLength <= DRIVE_UPLOAD_SINGLE_PUT_MAX_BYTES);
      if (range.endsWith(`/${total}`) && range.includes(`${total - 1}/`)) {
        assert.equal(chunkBytes.byteLength, total);
        return jsonResponse({ id: "file_route_15s", name: "IMG_1504.MOV" });
      }
      return new Response(null, { status: 308 });
    }
    if (method === "GET" && url.includes("/drive/v3/files/") && !url.includes("alt=media")) {
      return jsonResponse({
        id: "file_route_complete",
        name: "IMG_1504.MOV",
        parents: [DRIVE_WAREHOUSE_FOLDER_ID],
        size: String(total),
      });
    }
    throw new Error(`unexpected fetch ${method} ${url}`);
  }) as typeof fetch;

  setDriveWarehouseFetchForTests(fakeFetch);
  try {
    const initResponse = await POST(
      new Request("https://travelos2.test/api/moments/photos/video", {
        body: JSON.stringify({
          filename: "IMG_1504.MOV",
          mimeType: "video/quicktime",
          momentId: "moment_route",
          size: total,
          takenAt: "2026-09-03T01:10:00.000Z",
        }),
        headers: { "content-type": "application/json", "x-travelos-admin-pin": "test-capture-pin" },
        method: "POST",
      }),
    );
    assert.equal(initResponse.ok, true);
    const initPayload = (await initResponse.json()) as {
      photo?: unknown;
      session?: string;
      token?: string;
      uploadUrl?: string;
    };
    assert.equal(typeof initPayload.session, "string");
    assert.equal(initPayload.token, undefined);
    assert.equal(initPayload.photo, undefined);
    assert.equal(isDirectDriveUploadUrl(initPayload.uploadUrl ?? ""), true);
    assert.match(initPayload.uploadUrl ?? "", /upload_id=route15s/);
    assert.doesNotMatch(JSON.stringify(initPayload), /ya29/);

    const done = await PUT(
      new Request("https://travelos2.test/api/moments/photos/video", {
        body: new Blob([bytes]),
        headers: {
          "content-range": `bytes 0-${total - 1}/${total}`,
          "content-type": "application/octet-stream",
          "x-travelos-admin-pin": "test-capture-pin",
          "x-travelos-video-session": initPayload.session ?? "",
        },
        method: "PUT",
      }),
    );
    assert.equal(done.ok, true);
    const payload = (await done.json()) as { photo?: { id?: string; kind?: string; storageKey?: string } };
    assert.equal(payload.photo?.kind, "video");
    assert.equal(payload.photo?.storageKey, "drive:file_route_15s");
    assert.deepEqual(drivePuts, [total]);

    const bigInit = await POST(
      new Request("https://travelos2.test/api/moments/photos/video", {
        body: JSON.stringify({
          filename: "IMG_1504.MOV",
          mimeType: "video/quicktime",
          momentId: "moment_route_90",
          size: NINETY_MB,
          takenAt: "2026-09-03T01:10:00.000Z",
        }),
        headers: { "content-type": "application/json", "x-travelos-admin-pin": "test-capture-pin" },
        method: "POST",
      }),
    );
    assert.equal(bigInit.ok, true);
    const bigSession = ((await bigInit.json()) as { session?: string }).session ?? "";
    const eight = new Uint8Array(DRIVE_UPLOAD_CHUNK_BYTES);
    eight.fill(3);
    const hop = await PUT(
      new Request("https://travelos2.test/api/moments/photos/video", {
        body: new Blob([eight]),
        headers: {
          "content-range": `bytes 0-${DRIVE_UPLOAD_CHUNK_BYTES - 1}/${NINETY_MB}`,
          "content-type": "application/octet-stream",
          "x-travelos-admin-pin": "test-capture-pin",
          "x-travelos-video-session": bigSession,
        },
        method: "PUT",
      }),
    );
    assert.equal(hop.ok, true);
    assert.equal((await hop.json() as { ok?: boolean }).ok, true);

    const complete = await POST(
      new Request("https://travelos2.test/api/moments/photos/video", {
        body: JSON.stringify({
          complete: true,
          fileId: "file_route_complete",
          session: initPayload.session,
        }),
        headers: {
          "content-type": "application/json",
          "x-travelos-admin-pin": "test-capture-pin",
          "x-travelos-video-session": initPayload.session ?? "",
        },
        method: "POST",
      }),
    );
    assert.equal(complete.ok, true);
    const completed = (await complete.json()) as { photo?: { kind?: string; storageKey?: string } };
    assert.equal(completed.photo?.kind, "video");
    assert.equal(completed.photo?.storageKey, "drive:file_route_complete");
    await new Promise((resolve) => setTimeout(resolve, 30));
  } finally {
    setDriveWarehouseFetchForTests(null);
    resetDriveWarehouseForTests();
  }
});

test("mixed 40-file dump still starts 40 photo POSTs; video chunks stay inside that file", async () => {
  const files = Array.from({ length: CAPTURE_DUMP_LIMIT }, (_, index) => {
    if (index % 5 === 0) {
      return new File([new Uint8Array([index, 9])], `IMG_${String(index).padStart(4, "0")}.MOV`, {
        type: "video/quicktime",
      });
    }
    return new File([new Uint8Array([index, 1, 2, 3])], `IMG_${String(index).padStart(4, "0")}.JPG`, {
      type: "image/jpeg",
    });
  });
  let photoPosts = 0;
  let videoInits = 0;
  const release: Array<() => void> = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = (init?.method ?? "POST").toUpperCase();
    const body = init?.body;
    if (typeof FormData !== "undefined" && body instanceof FormData) {
      const file = body.get("file");
      assert.ok(file instanceof File);
      assert.equal(isCaptureVideoFile(file), false, "videos must not use the JPEG FormData dump line");
      photoPosts += 1;
      await new Promise<void>((resolve) => {
        release.push(resolve);
      });
      return jsonResponse({ photo: { id: `photo_${photoPosts}`, momentId: "moment_mixed", kind: "photo" } });
    }
    if (url.includes("/api/moments/photos/video") && method === "POST") {
      const payload = JSON.parse(typeof body === "string" ? body : "{}") as {
        complete?: unknown;
        fileId?: unknown;
      };
      if (payload.complete === true || typeof payload.fileId === "string") {
        return jsonResponse({ photo: { id: "photo_video", momentId: "moment_mixed", kind: "video" } });
      }
      videoInits += 1;
      await new Promise<void>((resolve) => {
        release.push(resolve);
      });
      return jsonResponse({
        session: `sess_${videoInits}`,
        uploadUrl: `https://www.googleapis.com/upload/drive/v3/files?upload_id=mix_${videoInits}`,
      });
    }
    if (url.includes("googleapis.com/upload/drive") && method === "PUT") {
      assert.equal(body instanceof FormData, false);
      return jsonResponse({ id: "file_mix" });
    }
    if (url.includes("/api/moments/photos/video") && method === "PUT") {
      throw new Error("mixed dump must not proxy video hops through the Worker");
    }
    throw new Error(`unexpected fetch ${method} ${url}`);
  }) as typeof fetch;

  try {
    const jobs: Promise<unknown>[] = [];
    await ingestCaptureFileList(fakeFileList(files), {
      onCopied(file) {
        jobs.push(
          uploadDisplayPhoto({
            coordinates: null,
            file,
            momentId: "moment_mixed",
            pin: "test-capture-pin",
            takenAt: "2026-09-03T01:00:00.000Z",
          }),
        );
      },
    });
    const started = Date.now();
    while (photoPosts + videoInits < 40 && Date.now() - started < 500) {
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
    assert.equal(photoPosts + videoInits, 40);
    assert.equal(photoPosts, 32);
    assert.equal(videoInits, 8);
    assert.ok(photoPosts > CAPTURE_UPLOAD_CONCURRENCY);
    for (const resolve of release) {
      resolve();
    }
    await Promise.all(jobs);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("Capture card fallback and album accept stay family Chinese / one door", async () => {
  const [capture, upload, videoRoute, photosApi] = await Promise.all([
    readSource("app/family/capture/page.tsx"),
    readSource("lib/capture-upload.ts"),
    readSource("app/api/moments/photos/video/route.ts"),
    readSource("app/api/moments/photos/route.ts"),
  ]);

  assert.match(capture, /captureErrorMessage\(error, CAPTURE_UPLOAD_FAILED_MESSAGE\)/);
  assert.match(upload, /CAPTURE_UPLOAD_FAILED_MESSAGE = "上傳失敗。"/);
  assert.doesNotMatch(capture, /換一段短一點的/);
  assert.doesNotMatch(upload, /換一段短一點的/);
  assert.doesNotMatch(capture, /Photo upload failed/);
  assert.doesNotMatch(upload, /Photo upload failed/);
  assert.doesNotMatch(videoRoute, /換一段短一點的/);
  assert.doesNotMatch(videoRoute, /Photo upload failed/);
  assert.match(videoRoute, /上傳失敗。/);

  const albumBlock = capture.slice(capture.indexOf("選照片或影片"), capture.indexOf("加入之後"));
  assert.match(albumBlock, /accept="image\/\*,video\/\*,\.heic,\.heif,\.mov,\.mp4,\.m4v"/);
  assert.match(capture, /accept="image\/\*" capture="environment"/);
  assert.equal((capture.match(/type="file"/g) ?? []).length, 2);
  assert.doesNotMatch(capture, /createWorkQueue/);
  assert.doesNotMatch(capture, /photoQueue/);

  const addBlock = capture.slice(capture.indexOf("async function addIncomingFiles"), capture.indexOf("function onTakePhoto"));
  assert.doesNotMatch(addBlock, /materializeCaptureVideoSlices\(file\)/);
  assert.match(addBlock, /captureVideoPreviewUrl\(file\)/);
  assert.match(addBlock, /isCaptureVideoFile\(file\)/);
  assert.match(addBlock, /startBackgroundPhotoUpload\(photo\)/);
  assert.match(capture, /onError=/);
  assert.match(capture, /CaptureVideoThumb/);
  assert.match(capture, /controls/);
  assert.match(capture, />\s*播放\s*</);
  assert.match(capture, />\s*重拍\s*</);
  assert.match(capture, />\s*移除\s*</);
  assert.doesNotMatch(capture.slice(capture.indexOf("fam-thumb-actions"), capture.indexOf("一次選好")), />\s*Remove\s*</);
  assert.doesNotMatch(capture.slice(capture.indexOf("fam-thumb-actions"), capture.indexOf("一次選好")), />\s*Retake\s*</);
  assert.doesNotMatch(capture, /previewUrl: null \}/);

  const videoUpload = upload.slice(upload.indexOf("export async function uploadCaptureVideo"), upload.indexOf("export async function uploadDisplayPhoto"));
  assert.match(videoUpload, /startMoment/);
  assert.match(videoUpload, /uploadCaptureVideoOnce/);
  assert.doesNotMatch(videoUpload, /onHopProgress\?\.\(0,/);
  assert.match(capture, /hopTotal > 0 && photo\.hopDone > 0/);
  assert.match(capture, /startMoment: video \? \(\) => session\.ensure\(takenAt\)/);
  assert.match(videoUpload, /\/api\/moments\/photos\/video/);
  assert.doesNotMatch(videoUpload, /new FormData/);
  assert.doesNotMatch(videoUpload, /formData\.set\("file"/);
  assert.match(videoUpload, /captureVideoPutChunkBytes/);
  assert.match(videoUpload, /sliceCaptureVideo/);
  assert.match(videoUpload, /materializeCaptureVideoHop/);
  assert.match(videoUpload, /onHopProgress/);
  assert.match(videoUpload, /file\.slice\(|source\.slice\(/);
  assert.match(videoUpload, /content-range/i);
  assert.match(videoUpload, /captureFetch/);
  assert.match(videoUpload, /CAPTURE_VIDEO_HOP_TIMEOUT_MS/);
  assert.match(videoUpload, /CAPTURE_VIDEO_INIT_TIMEOUT_MS/);
  assert.match(videoUpload, /CAPTURE_VIDEO_COMPLETE_TIMEOUT_MS/);
  assert.match(videoUpload, /uploadUrl/);
  assert.match(videoUpload, /complete: true/);
  assert.match(videoUpload, /redirect: "manual"/);
  assert.match(videoUpload, /isDirectDriveUploadUrl/);
  assert.match(videoRoute, /uploadUrl: started\.location/);
  assert.match(videoRoute, /complete === true/);
  assert.match(videoRoute, /queryDriveResumableStatus/);
  assert.match(videoRoute, /safeBrowserOrigin/);
  assert.match(upload, /export function isDirectDriveUploadUrl/);
  assert.match(upload, /export async function captureFetch/);
  assert.match(upload, /setTimeout\(\(\) => controller\.abort\(\), timeoutMs\)/);
  assert.match(upload, /mergeAbortSignals\(signals: Array<AbortSignal \| null \| undefined>\)/);
  assert.match(upload, /mergeAbortSignals\(\[init\.signal \?\? undefined, controller\.signal\]\)/);
  assert.match(upload, /createCaptureMoment[\s\S]*CAPTURE_MOMENT_FETCH_TIMEOUT_MS/);
  assert.match(capture, /captureUploadWatchdogMs/);
  assert.match(capture, /CAPTURE_UPLOAD_FAILED_MESSAGE/);
  assert.match(capture, /watchdogFired/);
  const copyFn = upload.slice(upload.indexOf("export function copyCaptureFile"), upload.indexOf("export async function ingestCaptureFileList"));
  const videoCopy = copyFn.slice(copyFn.indexOf("isCaptureVideoFile"), copyFn.indexOf("const blob"));
  assert.match(copyFn, /isCaptureVideoFile\(file\)/);
  assert.match(copyFn, /sliceCaptureVideo\(file\)/);
  assert.match(videoCopy, /return file;/);
  assert.doesNotMatch(videoCopy, /new File\(/);
  assert.match(videoRoute, /VIDEO_CHUNK_MAX_BYTES = DRIVE_UPLOAD_SINGLE_PUT_MAX_BYTES/);

  assert.match(photosApi, /await request\.formData\(\)/);
  assert.doesNotMatch(videoRoute, /request\.formData\(/);
  assert.doesNotMatch(videoRoute, /putBinary\(/);
  assert.doesNotMatch(videoRoute, /storeMomentBinary/);
  assert.match(videoRoute, /rememberUploadedDisplayPhoto/);
  assert.match(videoRoute, /addPhotoToMoment/);
  assert.match(videoRoute, /kind: "video"/);
  assert.doesNotMatch(videoRoute, /ScriptApp\.getOAuthToken/);
});
