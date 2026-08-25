import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";
import {
  captureErrorMessage,
  createMomentSession,
  isRetryableUploadStatus,
  sendWithMomentRetry,
  uploadDisplayPhoto,
} from "../lib/capture-upload.ts";
import { isUploadBlob, uploadFilename } from "../lib/form-upload.ts";
import { prepareDisplayPhoto } from "../lib/prepare-photo.ts";
import {
  MOMENTS_BLOB_PATH,
  MomentWarehouseUnavailableError,
  loadWarehouseFromBlobGet,
  type WarehouseGet,
} from "../lib/warehouse-read.ts";

const root = resolve(import.meta.dirname, "..");

async function readSource(path: string) {
  return readFile(resolve(root, path), "utf8");
}

test("rejected ensureMoment is retried on the next upload", async () => {
  let creates = 0;
  const session = createMomentSession(async () => {
    creates += 1;
    if (creates === 1) {
      throw new Error("Could not save this moment.");
    }
    return { moment: { id: `moment_retry_${creates}` } };
  });

  await assert.rejects(() => session.ensure("2026-08-25T01:00:00.000Z"), /Could not save this moment/);
  assert.equal(session.momentId, null);

  const momentId = await session.ensure("2026-08-25T01:01:00.000Z");
  assert.equal(momentId, "moment_retry_2");
  assert.equal(session.momentId, "moment_retry_2");
  assert.equal(creates, 2);

  const same = await session.ensure("2026-08-25T01:02:00.000Z");
  assert.equal(same, "moment_retry_2");
  assert.equal(creates, 2);
});

test("HEIC convert failure still uploads the original file", async () => {
  const heic = new File([new Uint8Array([0, 1, 2, 3, 4])], "IMG_1001.HEIC", { type: "image/heic" });
  const display = await prepareDisplayPhoto(heic);
  assert.equal(display, heic);
  assert.equal(display.type, "image/heic");

  const posted: Array<{ file: FormDataEntryValue | null; momentId: string }> = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
    const form = init?.body as FormData;
    posted.push({ file: form.get("file"), momentId: String(form.get("momentId")) });
    return Response.json({
      photo: { id: "moment_photo_heic", momentId: String(form.get("momentId")) },
    });
  }) as typeof fetch;

  try {
    const uploaded = await uploadDisplayPhoto({
      coordinates: null,
      file: heic,
      momentId: "moment_heic",
      pin: "test-capture-pin",
      takenAt: "2026-08-25T01:00:00.000Z",
    });
    assert.equal(uploaded.display, heic);
    assert.equal(posted.length, 1);
    assert.equal(posted[0]?.file, heic);
    assert.equal(posted[0]?.momentId, "moment_heic");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("Blob-not-File uploads are accepted", async () => {
  const blob = new Blob([new Uint8Array([1, 2, 3])], { type: "image/jpeg" });
  assert.equal(blob instanceof File, false);
  assert.equal(isUploadBlob(blob), true);
  assert.equal(isUploadBlob(new File([new Uint8Array([1, 2, 3])], "park.jpg", { type: "image/jpeg" })), true);
  assert.equal(isUploadBlob(new Blob([])), false);
  assert.equal(isUploadBlob("park.jpg"), false);
  assert.equal(uploadFilename(blob, "moment-audio.webm"), "moment-audio.webm");

  const [photosApi, audioApi] = await Promise.all([
    readSource("app/api/moments/photos/route.ts"),
    readSource("app/api/moments/audio/route.ts"),
  ]);
  assert.match(photosApi, /isUploadBlob\(file\)/);
  assert.match(photosApi, /isUploadBlob\(original\)/);
  assert.match(audioApi, /isUploadBlob\(file\)/);
  assert.doesNotMatch(photosApi, /file instanceof File/);
  assert.doesNotMatch(audioApi, /file instanceof File/);
});

test("write then immediate uncached blob get sees the new moment", async () => {
  const origin = new Map<string, string>();
  const staleCdn = new Map<string, string>([
    [MOMENTS_BLOB_PATH, JSON.stringify({ jobs: [], moments: [], updatedAt: "2026-08-24T00:00:00.000Z" })],
  ]);
  const calls: Array<{ access: string; pathname: string; useCache?: boolean }> = [];

  const getWarehouse: WarehouseGet = async (pathname, options) => {
    calls.push({ access: options.access, pathname, useCache: options.useCache });
    assert.equal(pathname, MOMENTS_BLOB_PATH);
    assert.equal(options.access, "public");
    assert.equal(options.useCache, false);
    const body = origin.get(pathname);
    if (!body) {
      return null;
    }
    return { statusCode: 200, stream: new Blob([body]).stream() };
  };

  origin.set(
    MOMENTS_BLOB_PATH,
    JSON.stringify({
      jobs: [],
      moments: [
        {
          id: "moment_iphone_park",
          createdAt: "2026-08-25T00:49:00.000Z",
          originalAudioUrl: null,
          photos: [],
        },
      ],
      updatedAt: "2026-08-25T00:49:00.000Z",
    }),
  );

  const loaded = await loadWarehouseFromBlobGet(getWarehouse);
  assert.equal(loaded.createdEmpty, false);
  assert.equal(loaded.content.moments[0]?.id, "moment_iphone_park");
  assert.equal(loaded.content.moments[0]?.photos.length, 0);
  assert.notEqual(staleCdn.get(MOMENTS_BLOB_PATH), origin.get(MOMENTS_BLOB_PATH));
  assert.equal(calls.length > 0, true);
  assert.equal(
    calls.every((call) => call.useCache === false && call.access === "public"),
    true,
  );

  await assert.rejects(
    () =>
      loadWarehouseFromBlobGet(async () => {
        throw new Error("origin down");
      }),
    (error: unknown) => {
      assert.ok(error instanceof MomentWarehouseUnavailableError);
      assert.equal(error.status, 503);
      assert.match(error.message, /origin down|warehouse/);
      return true;
    },
  );

  const store = await readSource("lib/moment-store.ts");
  const blob = await readSource("lib/moment-blob.ts");
  const readFn = store.slice(store.indexOf("export async function readMoments"), store.indexOf("export async function writeWarehouse"));
  assert.match(blob, /get\(pathname, options\)/);
  assert.match(store, /cacheControlMaxAge: 60/);
  assert.match(store, /momentItemBlobPath|writeMomentItem|readMomentItem/);
  assert.match(readFn, /loadWarehouseFromBlobGet|readIndexRaw/);
  assert.doesNotMatch(store, /import \{[^}]*\blist\b/);
  assert.doesNotMatch(readFn, /dataBlob\.url/);
  assert.doesNotMatch(readFn, /\?v=/);
  assert.doesNotMatch(readFn, /fetch\(/);

  const warehouseRead = await readSource("lib/warehouse-read.ts");
  assert.match(warehouseRead, /useCache: false/);
  assert.doesNotMatch(warehouseRead, /fetch\(/);
});

test("PIN is still required without the admin header", async () => {
  const [momentsApi, photosApi, audioApi] = await Promise.all([
    readSource("app/api/moments/route.ts"),
    readSource("app/api/moments/photos/route.ts"),
    readSource("app/api/moments/audio/route.ts"),
  ]);

  for (const source of [momentsApi, photosApi, audioApi]) {
    assert.match(source, /isAdminPinValid/);
    assert.match(source, /Invalid admin PIN/);
    assert.match(source, /status: 401/);
  }

  const postFn = photosApi.slice(photosApi.indexOf("export async function POST"));
  const pinCheckIndex = postFn.indexOf("isAdminPinValid");
  const blobIndex = postFn.indexOf("isUploadBlob");
  assert.ok(pinCheckIndex !== -1 && blobIndex !== -1);
  assert.ok(pinCheckIndex < blobIndex);
});

test("photo and audio POST retry once on 404 after a consistent re-read", async () => {
  assert.equal(isRetryableUploadStatus(404), true);
  assert.equal(isRetryableUploadStatus(503), true);
  assert.equal(isRetryableUploadStatus(401), false);
  assert.equal(captureErrorMessage(new Error("Moment not found"), "fallback"), "Moment not found");

  const sent: string[] = [];
  let sawMoment = false;
  const retried = await sendWithMomentRetry(
    async (momentId) => {
      sent.push(momentId);
      if (!sawMoment) {
        sawMoment = true;
        return new Response(JSON.stringify({ error: "Moment not found" }), { status: 404 });
      }
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    },
    "moment_iphone_park",
    async (status) => {
      assert.equal(status, 404);
      return "moment_iphone_park";
    },
  );
  assert.deepEqual(sent, ["moment_iphone_park", "moment_iphone_park"]);
  assert.equal(retried.momentId, "moment_iphone_park");
  assert.equal(retried.response.ok, true);

  const once = await sendWithMomentRetry(async (momentId) => {
    sent.push(momentId);
    return new Response("no", { status: 401 });
  }, "moment_pin");
  assert.equal(once.response.status, 401);
  assert.deepEqual(sent, ["moment_iphone_park", "moment_iphone_park", "moment_pin"]);
});

test("public Lapland poster and copy stay untouched by the capture retry slice", async () => {
  const [capture, upload, photosApi, audioApi, store, warehouseRead, laplandPage, seed, poster] = await Promise.all([
    readSource("app/family/capture/page.tsx"),
    readSource("lib/capture-upload.ts"),
    readSource("app/api/moments/photos/route.ts"),
    readSource("app/api/moments/audio/route.ts"),
    readSource("lib/moment-store.ts"),
    readSource("lib/warehouse-read.ts"),
    readSource("app/trips/[slug]/page.tsx"),
    readSource("lib/trips.ts"),
    readSource("scripts/generate-lapland-poster.mjs"),
  ]);

  for (const source of [capture, upload, photosApi, audioApi, store, warehouseRead]) {
    assert.doesNotMatch(source, /trip_lapland_2020/);
    assert.doesNotMatch(source, /generate-lapland-poster/);
    assert.doesNotMatch(source, /travelpayouts/i);
    assert.doesNotMatch(source, /emrldtp/);
  }
  assert.doesNotMatch(laplandPage, /moment-store/);
  assert.doesNotMatch(laplandPage, /family\/capture/);
  assert.match(seed, /trip_lapland_2020/);
  assert.match(seed, /laplandTitle: "拉普蘭冬日記憶"/);
  assert.match(poster, /basemaps.cartocdn.com\/rastertiles\/voyager/);
});
