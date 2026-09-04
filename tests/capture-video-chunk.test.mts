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
  CAPTURE_VIDEO_HOP_TIMEOUT_MS,
  CAPTURE_VIDEO_INIT_TIMEOUT_MS,
  CAPTURE_VIDEO_MAX_BYTES,
  CAPTURE_VIDEO_SINGLE_PUT_MAX_BYTES,
  assertCaptureFileFits,
  captureErrorMessage,
  captureFetch,
  captureUploadWatchdogMs,
  captureVideoHopCount,
  captureVideoPutChunkBytes,
  captureVideoTooLargeMessage,
  copyCaptureFile,
  isCaptureUploadAbortError,
  sliceCaptureVideo,
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

test("46MB-class dummy uses 8MiB hops not 1 PUT and not 175; 8MiB boundary", () => {
  assert.equal(CAPTURE_VIDEO_CHUNK_BYTES, 8 * 1024 * 1024);
  assert.equal(CAPTURE_VIDEO_CHUNK_BYTES, 8_388_608);
  assert.equal(CAPTURE_VIDEO_CHUNK_BYTES % (256 * 1024), 0);
  assert.equal(DRIVE_UPLOAD_CHUNK_BYTES, CAPTURE_VIDEO_CHUNK_BYTES);
  assert.equal(CAPTURE_VIDEO_SINGLE_PUT_MAX_BYTES, 80_000_000);
  assert.equal(DRIVE_UPLOAD_SINGLE_PUT_MAX_BYTES, 80_000_000);

  assert.equal(captureVideoPutChunkBytes(1), 1);
  assert.equal(captureVideoPutChunkBytes(CAPTURE_VIDEO_CHUNK_BYTES), CAPTURE_VIDEO_CHUNK_BYTES);
  assert.equal(captureVideoPutChunkBytes(CAPTURE_VIDEO_CHUNK_BYTES + 1), CAPTURE_VIDEO_CHUNK_BYTES);
  assert.equal(captureVideoPutChunkBytes(IMG_1504_BYTES), CAPTURE_VIDEO_CHUNK_BYTES);
  assert.equal(captureVideoPutChunkBytes(80_000_000), CAPTURE_VIDEO_CHUNK_BYTES);
  assert.equal(captureVideoPutChunkBytes(NINETY_MB), CAPTURE_VIDEO_CHUNK_BYTES);

  assert.equal(expectedPutCount(IMG_1504_BYTES), Math.ceil(IMG_1504_BYTES / CAPTURE_VIDEO_CHUNK_BYTES));
  assert.equal(expectedPutCount(IMG_1504_BYTES), 6);
  assert.equal(captureVideoHopCount(10_000_000), 2);
  assert.equal(captureVideoHopCount(IMG_1504_BYTES), 6);
  assert.equal(
    captureUploadWatchdogMs(10_000_000),
    CAPTURE_MOMENT_FETCH_TIMEOUT_MS + CAPTURE_VIDEO_INIT_TIMEOUT_MS + 2 * CAPTURE_VIDEO_HOP_TIMEOUT_MS,
  );
  assert.ok(captureUploadWatchdogMs(10_000_000) < 90_000);
  assert.ok(captureUploadWatchdogMs(IMG_1504_BYTES) < 180_000);
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

test("10MB and 46MB watchdogs stay under minutes and hops stay 8MiB", () => {
  assert.equal(captureVideoHopCount(10_000_000), 2);
  assert.equal(captureVideoHopCount(IMG_1504_BYTES), 6);
  assert.equal(
    captureUploadWatchdogMs(10_000_000),
    CAPTURE_MOMENT_FETCH_TIMEOUT_MS + CAPTURE_VIDEO_INIT_TIMEOUT_MS + 2 * CAPTURE_VIDEO_HOP_TIMEOUT_MS,
  );
  assert.ok(captureUploadWatchdogMs(10_000_000) < 90_000);
  assert.ok(captureUploadWatchdogMs(IMG_1504_BYTES) < 180_000);
  assert.equal(CAPTURE_MOMENT_FETCH_TIMEOUT_MS, 15_000);
  assert.equal(CAPTURE_VIDEO_INIT_TIMEOUT_MS, 15_000);
  assert.equal(CAPTURE_VIDEO_HOP_TIMEOUT_MS, 20_000);
  assert.equal(CAPTURE_PHOTO_FETCH_TIMEOUT_MS, 20_000);
});

test("hung capture fetch becomes 上傳失敗 and does not wait minutes", async () => {
  const original = globalThis.fetch;
  globalThis.fetch = (() => new Promise(() => {})) as typeof fetch;
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

async function uploadVideoAndCollectPuts(file: File) {
  const calls: Array<{
    byteLength: number;
    contentRange: string | null;
    form: boolean;
    method: string;
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
      url,
    });
    if (form && url.includes("/api/moments/photos") && !url.includes("/video")) {
      throw new Error("video must not POST whole-file FormData to /api/moments/photos");
    }
    if (url.includes("/api/moments/photos/video") && method === "POST") {
      return jsonResponse({ session: "opaque-test-session" });
    }
    if (url.includes("/api/moments/photos/video") && method === "PUT") {
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
});

test("46MB IMG_1504-class dummy is 8MiB hops after init, not 1 PUT and not 175", async () => {
  const file = videoFileWithSize(IMG_1504_BYTES);
  const { calls, uploaded } = await uploadVideoAndCollectPuts(file);
  assert.equal(uploaded.photo.id, "photo_mov");
  const puts = calls.filter((call) => call.method === "PUT");
  const expected = expectedPutCount(IMG_1504_BYTES);
  assert.equal(puts.length, expected);
  assert.equal(puts.length, 6);
  assert.notEqual(puts.length, 1);
  assert.notEqual(puts.length, 175);
  assert.equal(puts[0]?.contentRange, `bytes 0-${CAPTURE_VIDEO_CHUNK_BYTES - 1}/${IMG_1504_BYTES}`);
  assert.equal(puts.at(-1)?.contentRange?.endsWith(`/${IMG_1504_BYTES}`), true);
  assert.match(puts.at(-1)?.contentRange ?? "", new RegExp(`${IMG_1504_BYTES - 1}/${IMG_1504_BYTES}$`));
  assert.equal(
    calls.some((call) => call.form && call.url.includes("/api/moments/photos") && !call.url.includes("/video")),
    false,
  );
});

test("8MiB boundary is one whole-file PUT; 90MB dummy uses 8MiB chunks", async () => {
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

test("init + raw Drive hops never json-base64 and never putBinary", async () => {
  assert.equal(DRIVE_UPLOAD_CHUNK_BYTES, 8 * 1024 * 1024);
  assert.equal(CAPTURE_VIDEO_CHUNK_BYTES, DRIVE_UPLOAD_CHUNK_BYTES);
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
      const chunkBytes = await bodyBytes(init?.body as BodyInit);
      drivePuts.push(chunkBytes.byteLength);
      assert.ok(chunkBytes.byteLength <= DRIVE_UPLOAD_SINGLE_PUT_MAX_BYTES);
      const range = headerValue(init?.headers as HeadersInit, "Content-Range") ?? "";
      if (range.endsWith(`/${total}`) && range.includes(`${total - 1}/`)) {
        assert.equal(chunkBytes.byteLength, total);
        return jsonResponse({ id: "file_route_15s", name: "IMG_1504.MOV" });
      }
      return new Response(null, { status: 308 });
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
    const initPayload = (await initResponse.json()) as { photo?: unknown; session?: string; token?: string };
    assert.equal(typeof initPayload.session, "string");
    assert.equal(initPayload.token, undefined);
    assert.equal(initPayload.photo, undefined);
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
      videoInits += 1;
      await new Promise<void>((resolve) => {
        release.push(resolve);
      });
      return jsonResponse({ session: `sess_${videoInits}` });
    }
    if (url.includes("/api/moments/photos/video") && method === "PUT") {
      assert.equal(body instanceof FormData, false);
      return jsonResponse({ photo: { id: "photo_video", momentId: "moment_mixed", kind: "video" } });
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
    await Promise.resolve();
    await Promise.resolve();
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
  assert.match(addBlock, /URL\.createObjectURL\(file\.slice\(0\)\)/);
  assert.match(addBlock, /isCaptureVideoFile\(file\)/);
  assert.match(addBlock, /startBackgroundPhotoUpload\(photo\)/);
  assert.match(addBlock, /videoUploads/);
  assert.match(capture, />\s*移除\s*</);
  assert.doesNotMatch(capture.slice(capture.indexOf("fam-thumb-actions"), capture.indexOf("一次選好")), />\s*Remove\s*</);

  const videoUpload = upload.slice(upload.indexOf("export async function uploadCaptureVideo"), upload.indexOf("export async function uploadDisplayPhoto"));
  assert.match(videoUpload, /\/api\/moments\/photos\/video/);
  assert.doesNotMatch(videoUpload, /new FormData/);
  assert.doesNotMatch(videoUpload, /formData\.set\("file"/);
  assert.match(videoUpload, /captureVideoPutChunkBytes/);
  assert.match(videoUpload, /sliceCaptureVideo/);
  assert.match(videoUpload, /file\.slice\(|source\.slice\(/);
  assert.match(videoUpload, /content-range/i);
  assert.match(videoUpload, /captureFetch/);
  assert.match(videoUpload, /CAPTURE_VIDEO_HOP_TIMEOUT_MS/);
  assert.match(videoUpload, /CAPTURE_VIDEO_INIT_TIMEOUT_MS/);
  assert.match(upload, /export async function captureFetch/);
  assert.match(upload, /AbortSignal\.timeout/);
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
