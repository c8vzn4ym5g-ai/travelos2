import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";
import { POST as postMomentAudio } from "../app/api/moments/audio/route.ts";
import { GET as getMoments, POST as postMoment } from "../app/api/moments/route.ts";
import { POST as postMomentPhoto } from "../app/api/moments/photos/route.ts";
import {
  captureErrorMessage,
  createMomentSession,
  isRetryableUploadStatus,
  sendWithMomentRetry,
  uploadDisplayPhoto,
} from "../lib/capture-upload.ts";
import { isUploadBlob, uploadFilename } from "../lib/form-upload.ts";
import {
  MOMENTS_BLOB_PATH,
  MomentWarehouseUnavailableError,
  loadWarehouseFromBlobGet,
  type WarehouseGet,
} from "../lib/moment-store.ts";
import { prepareDisplayPhoto } from "../lib/prepare-photo.ts";

const root = resolve(import.meta.dirname, "..");
const pin = "test-capture-pin";
const previousPin = process.env.TRAVELOS_ADMIN_PIN;
const previousBlobToken = process.env.BLOB_READ_WRITE_TOKEN;
const previousBlobStore = process.env.BLOB_STORE_ID;

process.env.TRAVELOS_ADMIN_PIN = pin;
delete process.env.BLOB_READ_WRITE_TOKEN;
delete process.env.BLOB_STORE_ID;

test.after(() => {
  if (previousPin === undefined) {
    delete process.env.TRAVELOS_ADMIN_PIN;
  } else {
    process.env.TRAVELOS_ADMIN_PIN = previousPin;
  }
  if (previousBlobToken === undefined) {
    delete process.env.BLOB_READ_WRITE_TOKEN;
  } else {
    process.env.BLOB_READ_WRITE_TOKEN = previousBlobToken;
  }
  if (previousBlobStore === undefined) {
    delete process.env.BLOB_STORE_ID;
  } else {
    process.env.BLOB_STORE_ID = previousBlobStore;
  }
});

function pinHeaders(value = pin) {
  return { "x-travelos-admin-pin": value };
}

function jsonRequest(url: string, method: string, body?: unknown, headers: HeadersInit = {}) {
  return new Request(url, {
    body: body === undefined ? undefined : JSON.stringify(body),
    headers: { "content-type": "application/json", ...headers },
    method,
  });
}

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
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const request = input instanceof Request ? input : new Request(input, init);
    const form = await request.formData();
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
      pin,
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

test("Blob-not-File photo and audio uploads are accepted", async () => {
  assert.equal(isUploadBlob(new Blob([new Uint8Array([1, 2, 3])], { type: "image/jpeg" })), true);
  assert.equal(isUploadBlob(new File([new Uint8Array([1, 2, 3])], "park.jpg", { type: "image/jpeg" })), true);
  assert.equal(isUploadBlob(new Blob([])), false);
  assert.equal(isUploadBlob("park.jpg"), false);
  assert.equal(uploadFilename(new Blob([new Uint8Array([1])], { type: "audio/webm" }), "moment-audio.webm"), "moment-audio.webm");

  const created = await postMoment(
    jsonRequest("http://travelos.local/api/moments", "POST", { note: "park", time: "2026-08-25T01:00:00.000Z" }, pinHeaders()),
  );
  assert.equal(created.status, 200);
  const payload = (await created.json()) as { moment: { id: string } };

  const photoData = new FormData();
  photoData.set("momentId", payload.moment.id);
  photoData.set("file", new Blob([new Uint8Array([137, 80, 78, 71])], { type: "image/jpeg" }), "park.jpg");
  const photoResponse = await postMomentPhoto(
    new Request("http://travelos.local/api/moments/photos", {
      body: photoData,
      headers: pinHeaders(),
      method: "POST",
    }),
  );
  assert.equal(photoResponse.status, 200);
  const photoPayload = (await photoResponse.json()) as { photo: { originalFilename: string } };
  assert.equal(photoPayload.photo.originalFilename, "park.jpg");

  const audioData = new FormData();
  audioData.set("momentId", payload.moment.id);
  audioData.set("file", new Blob([new Uint8Array([1, 2, 3, 4])], { type: "audio/webm" }), "moment-audio.webm");
  const audioResponse = await postMomentAudio(
    new Request("http://travelos.local/api/moments/audio", {
      body: audioData,
      headers: pinHeaders(),
      method: "POST",
    }),
  );
  assert.equal(audioResponse.status, 200);
});

test("write then immediate uncached blob get sees the new moment", async () => {
  const origin = new Map<string, string>();
  const staleCdn = new Map<string, string>([
    [
      MOMENTS_BLOB_PATH,
      JSON.stringify({ jobs: [], moments: [], updatedAt: "2026-08-24T00:00:00.000Z" }),
    ],
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
  const readFn = store.slice(store.indexOf("export async function readMoments"), store.indexOf("export async function writeWarehouse"));
  assert.match(store, /get\(pathname, options\)/);
  assert.match(store, /useCache: false/);
  assert.match(store, /cacheControlMaxAge: 60/);
  assert.match(readFn, /loadWarehouseFromBlobGet/);
  assert.doesNotMatch(store, /import \{[^}]*\blist\b/);
  assert.doesNotMatch(readFn, /dataBlob\.url/);
  assert.doesNotMatch(readFn, /\?v=/);
  assert.doesNotMatch(readFn, /fetch\(/);
});

test("PIN is still required without the admin header", async () => {
  const get = await getMoments(new Request("http://travelos.local/api/moments"));
  assert.equal(get.status, 401);
  assert.equal(((await get.json()) as { error: string }).error, "Invalid admin PIN");

  const create = await postMoment(jsonRequest("http://travelos.local/api/moments", "POST", { note: "no pin" }));
  assert.equal(create.status, 401);

  const photoData = new FormData();
  photoData.set("momentId", "moment_x");
  photoData.set("file", new Blob([new Uint8Array([1])], { type: "image/jpeg" }), "park.jpg");
  const photo = await postMomentPhoto(
    new Request("http://travelos.local/api/moments/photos", { body: photoData, method: "POST" }),
  );
  assert.equal(photo.status, 401);

  const audioData = new FormData();
  audioData.set("momentId", "moment_x");
  audioData.set("file", new Blob([new Uint8Array([1])], { type: "audio/webm" }), "moment-audio.webm");
  const audio = await postMomentAudio(
    new Request("http://travelos.local/api/moments/audio", { body: audioData, method: "POST" }),
  );
  assert.equal(audio.status, 401);
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
  const [capture, upload, photosApi, audioApi, store, laplandPage, seed, poster] = await Promise.all([
    readSource("app/family/capture/page.tsx"),
    readSource("lib/capture-upload.ts"),
    readSource("app/api/moments/photos/route.ts"),
    readSource("app/api/moments/audio/route.ts"),
    readSource("lib/moment-store.ts"),
    readSource("app/trips/[slug]/page.tsx"),
    readSource("lib/trips.ts"),
    readSource("scripts/generate-lapland-poster.mjs"),
  ]);

  for (const source of [capture, upload, photosApi, audioApi, store]) {
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
