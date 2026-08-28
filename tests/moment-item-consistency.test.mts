import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";
import {
  MOMENT_ITEM_GET_OPTIONS,
  MOMENT_ITEM_PUT_OPTIONS,
  loadMomentItemFromBlobGet,
  momentItemBlobPath,
  momentsFromListedItemBlobs,
  overlayMoments,
  putMomentItemRecord,
} from "../lib/moment-item.ts";
import {
  addMoment,
  addPhotoToMoment,
  momentExists,
  momentItemBlobPath as storeItemPath,
  readMoments,
  resetMomentStoreForTests,
  runMomentTranscript,
  setMomentAudio,
  setMomentBlobAdapterForTests,
  setPhotoOriginal,
  updateMoment,
} from "../lib/moment-store.ts";
import { setDriveWarehouseFetchForTests } from "../lib/drive-warehouse.ts";
import { MOMENTS_BLOB_PATH, createTravelMoment } from "../lib/moments.ts";
import type { MomentBlobAdapter, MomentBlobPutOptions } from "../lib/moment-blob.ts";
import type { MomentPhoto } from "../lib/types.ts";
import { loadWarehouseFromBlobGet, type WarehouseGet } from "../lib/warehouse-read.ts";

const root = resolve(import.meta.dirname, "..");

async function readSource(path: string) {
  return readFile(resolve(root, path), "utf8");
}

function jsonStream(value: unknown) {
  return { statusCode: 200, stream: new Blob([JSON.stringify(value)]).stream() };
}

function createStaleIndexBlob() {
  const origin = new Map<string, string>();
  const indexCdn = new Map<string, string>();
  const puts: Array<{ pathname: string; options: MomentBlobPutOptions }> = [];

  const get: WarehouseGet = async (pathname, options) => {
    if (pathname === MOMENTS_BLOB_PATH) {
      assert.equal(options.access, "private");
      const stale = indexCdn.get(pathname) ?? origin.get(pathname);
      if (!stale) {
        return null;
      }
      return { statusCode: 200, stream: new Blob([stale]).stream() };
    }

    const body = origin.get(pathname);
    if (!body) {
      return null;
    }
    return { statusCode: 200, stream: new Blob([body]).stream() };
  };

  const adapter: MomentBlobAdapter = {
    get,
    async put(pathname, body, options) {
      puts.push({ pathname, options });
      origin.set(pathname, body);
      // Index overwrite is origin-only. get(index) keeps returning the stale CDN snapshot.
      return { pathname, url: `https://blob.local/${pathname}` };
    },
  };

  indexCdn.set(
    MOMENTS_BLOB_PATH,
    JSON.stringify({ jobs: [], moments: [], updatedAt: "2026-08-24T00:00:00.000Z" }),
  );
  origin.set(MOMENTS_BLOB_PATH, indexCdn.get(MOMENTS_BLOB_PATH) ?? "");

  return { adapter, get, origin, indexCdn, puts };
}

function testPhoto(momentId: string, id = "moment_photo_park"): MomentPhoto {
  return {
    coordinates: null,
    createdAt: "2026-08-25T01:33:00.000Z",
    id,
    momentId,
    originalFilename: "park.jpg",
    originalStorageKey: null,
    storageKey: "https://blob.local/park.jpg",
    takenAt: "2026-08-25T01:33:00.000Z",
  };
}

function jpegWithExifThumbnail(thumb: Uint8Array) {
  const jpegAt = 44;
  const tiff = Buffer.alloc(jpegAt + thumb.length);
  tiff[0] = 0x4d;
  tiff[1] = 0x4d;
  tiff.writeUInt16BE(42, 2);
  tiff.writeUInt32BE(8, 4);
  tiff.writeUInt16BE(0, 8);
  tiff.writeUInt32BE(14, 10);
  tiff.writeUInt16BE(2, 14);
  tiff.writeUInt16BE(0x0201, 16);
  tiff.writeUInt16BE(4, 18);
  tiff.writeUInt32BE(1, 20);
  tiff.writeUInt32BE(jpegAt, 24);
  tiff.writeUInt16BE(0x0202, 28);
  tiff.writeUInt16BE(4, 30);
  tiff.writeUInt32BE(1, 32);
  tiff.writeUInt32BE(thumb.length, 36);
  tiff.writeUInt32BE(0, 40);
  Buffer.from(thumb).copy(tiff, jpegAt);

  const app1Payload = Buffer.concat([Buffer.from("Exif\0\0"), tiff]);
  const app1Length = app1Payload.length + 2;
  return Buffer.concat([
    Buffer.from([0xff, 0xd8, 0xff, 0xe1, (app1Length >> 8) & 0xff, app1Length & 0xff]),
    app1Payload,
    Buffer.from([0xff, 0xd9]),
  ]);
}

function withPinEnv(required: string | undefined, run: () => Promise<void>) {
  const previous = process.env.TRAVELOS_REQUIRE_FAMILY_PIN;
  if (required === undefined) {
    delete process.env.TRAVELOS_REQUIRE_FAMILY_PIN;
  } else {
    process.env.TRAVELOS_REQUIRE_FAMILY_PIN = required;
  }
  return run().finally(() => {
    if (previous === undefined) {
      delete process.env.TRAVELOS_REQUIRE_FAMILY_PIN;
    } else {
      process.env.TRAVELOS_REQUIRE_FAMILY_PIN = previous;
    }
  });
}

test("unique moment item path is the id and does not add a random suffix", () => {
  assert.equal(momentItemBlobPath("moment_123_abc"), "travelos/moments/items/moment_123_abc.json");
  assert.equal(storeItemPath("moment_123_abc"), "travelos/moments/items/moment_123_abc.json");
  assert.equal(MOMENTS_BLOB_PATH, "travelos/moments.json");
  assert.equal(MOMENT_ITEM_PUT_OPTIONS.addRandomSuffix, false);
  assert.equal(MOMENT_ITEM_PUT_OPTIONS.allowOverwrite, true);
  assert.equal(MOMENT_ITEM_PUT_OPTIONS.access, "private");
  assert.equal(MOMENT_ITEM_GET_OPTIONS.access, "private");
});

test("unique-path get/put is readable immediately while index overwrite stays stale", async () => {
  const origin = new Map<string, string>();
  const staleIndex = JSON.stringify({ jobs: [], moments: [], updatedAt: "2026-08-24T00:00:00.000Z" });
  origin.set(MOMENTS_BLOB_PATH, staleIndex);

  const get: WarehouseGet = async (pathname) => {
    if (pathname === MOMENTS_BLOB_PATH) {
      return jsonStream(JSON.parse(staleIndex));
    }
    const body = origin.get(pathname);
    return body ? { statusCode: 200, stream: new Blob([body]).stream() } : null;
  };

  const put = async (pathname: string, body: string, options: { addRandomSuffix: boolean }) => {
    assert.equal(options.addRandomSuffix, false);
    origin.set(pathname, body);
    return { pathname, url: `https://blob.local/${pathname}` };
  };

  const moment = createTravelMoment({ note: "park", time: "2026-08-25T01:33:00.000Z" });
  await putMomentItemRecord(put, moment);

  const loadedItem = await loadMomentItemFromBlobGet(get, moment.id);
  assert.equal(loadedItem?.id, moment.id);
  assert.equal(loadedItem?.note, "park");

  const loadedIndex = await loadWarehouseFromBlobGet(get);
  assert.equal(
    loadedIndex.content.moments.some((item) => item.id === moment.id),
    false,
  );
});

test.describe("in-process and stale-index capture appends", { concurrency: false }, () => {
  test.beforeEach(() => {
    resetMomentStoreForTests();
  });

  test.afterEach(() => {
    resetMomentStoreForTests();
  });

  test("in-process store: create then immediate photo and audio attach", async () => {
    const moment = createTravelMoment({ note: "memory", time: "2026-08-25T01:33:00.000Z" });
    const created = await addMoment(moment);
    assert.equal(created.conflict, false);
    if (created.conflict) {
      return;
    }

    assert.equal(await momentExists(created.moment.id), true);

    const photo = testPhoto(created.moment.id);
    const withPhoto = await addPhotoToMoment(created.moment.id, photo);
    assert.ok(withPhoto);
    assert.equal(
      withPhoto.moments.find((item) => item.id === created.moment.id)?.photos[0]?.id,
      photo.id,
    );

    const withAudio = await setMomentAudio(created.moment.id, "https://blob.local/audio.webm");
    assert.ok(withAudio);
    assert.equal(withAudio.moment.originalAudioUrl, "https://blob.local/audio.webm");
    assert.equal(withAudio.moment.photos[0]?.id, photo.id);

    const labeled = await updateMoment({
      id: created.moment.id,
      transcript: "舊的聲音",
    });
    assert.equal(labeled?.moment.transcript, "舊的聲音");
    assert.equal(labeled?.moment.originalAudioUrl, "https://blob.local/audio.webm");

    const savedNote = await updateMoment({
      id: created.moment.id,
      note: "心情",
    });
    assert.equal(savedNote?.moment.note, "心情");
    assert.equal(savedNote?.moment.transcript, "舊的聲音");

    const spokenUpload = await setMomentAudio(created.moment.id, "https://blob.local/audio-spoken.webm", {
      transcript: "今天的咖哩很好吃",
    });
    assert.equal(spokenUpload?.moment.transcript, "今天的咖哩很好吃");

    const replaced = await setMomentAudio(created.moment.id, "https://blob.local/audio-2.webm");
    assert.equal(replaced?.moment.originalAudioUrl, "https://blob.local/audio-2.webm");
    assert.equal(replaced?.moment.transcript, null);

    const original = await setPhotoOriginal(created.moment.id, photo.id, "https://blob.local/original.heic");
    assert.equal(original?.photo.originalStorageKey, "https://blob.local/original.heic");
  });

  test("existing audio with empty transcript is filled and persisted without a spinner", async () => {
    const moment = createTravelMoment({ note: "", time: "2026-08-27T12:09:56.986Z" });
    const created = await addMoment(moment);
    assert.equal(created.conflict, false);
    if (created.conflict) {
      return;
    }

    await setMomentAudio(
      created.moment.id,
      "https://abc.public.blob.vercel-storage.com/travelos/moments/audio/x.m4a",
    );

    const originalFetch = globalThis.fetch;
    const previousKey = process.env.AI_GATEWAY_API_KEY;
    process.env.AI_GATEWAY_API_KEY = "test-key";
    globalThis.fetch = (async (input: Parameters<typeof fetch>[0]) => {
      const url = String(input);
      if (url.includes("blob.vercel-storage.com")) {
        const bytes = new Uint8Array(24);
        bytes.set([0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6f, 0x35], 4);
        return new Response(bytes, { headers: { "content-type": "audio/mp4" } });
      }
      if (url.includes("transcription-model")) {
        return Response.json({ text: "今天的咖哩很好吃" });
      }
      throw new Error(`unexpected fetch ${url}`);
    }) as typeof fetch;

    try {
      const filled = await runMomentTranscript(created.moment.id);
      assert.equal(filled?.transcript, "今天的咖哩很好吃");
      const listed = await readMoments();
      assert.equal(
        listed.content.moments.find((item) => item.id === created.moment.id)?.transcript,
        "今天的咖哩很好吃",
      );
    } finally {
      globalThis.fetch = originalFetch;
      if (previousKey === undefined) {
        delete process.env.AI_GATEWAY_API_KEY;
      } else {
        process.env.AI_GATEWAY_API_KEY = previousKey;
      }
    }
  });

  test("stale index get still lets immediate photo and audio attach via the item file", async () => {
    const blob = createStaleIndexBlob();
    setMomentBlobAdapterForTests(blob.adapter);

    const moment = createTravelMoment({ note: "cdn-stale", time: "2026-08-25T01:33:00.000Z" });
    const created = await addMoment(moment);
    assert.equal(created.conflict, false);
    if (created.conflict) {
      return;
    }

    const indexBody = blob.indexCdn.get(MOMENTS_BLOB_PATH);
    assert.ok(indexBody);
    const staleIndex = JSON.parse(indexBody) as { moments: Array<{ id: string }> };
    assert.equal(
      staleIndex.moments.some((item) => item.id === created.moment.id),
      false,
    );

    const originIndex = JSON.parse(blob.origin.get(MOMENTS_BLOB_PATH) ?? "{}") as { moments?: Array<{ id: string }> };
    assert.equal(originIndex.moments?.some((item) => item.id === created.moment.id), true);

    const itemPath = momentItemBlobPath(created.moment.id);
    assert.ok(blob.origin.get(itemPath));
    assert.equal(
      blob.puts.some(
        (entry) => entry.pathname === itemPath && entry.options.addRandomSuffix === false,
      ),
      true,
    );

    const loadedItem = await loadMomentItemFromBlobGet(blob.get, created.moment.id);
    assert.equal(loadedItem?.id, created.moment.id);

    const loadedIndex = await loadWarehouseFromBlobGet(blob.get);
    assert.equal(
      loadedIndex.content.moments.some((item) => item.id === created.moment.id),
      false,
    );

    assert.equal(await momentExists(created.moment.id), true);

    const photo = testPhoto(created.moment.id);
    const withPhoto = await addPhotoToMoment(created.moment.id, photo);
    assert.ok(withPhoto);
    const attached = withPhoto.moments.find((item) => item.id === created.moment.id);
    assert.equal(attached?.photos[0]?.id, photo.id);

    const withAudio = await setMomentAudio(created.moment.id, "https://blob.local/voice.webm");
    assert.ok(withAudio);
    assert.equal(withAudio.moment.originalAudioUrl, "https://blob.local/voice.webm");
    assert.equal(withAudio.moment.photos[0]?.id, photo.id);

    const listed = await readMoments();
    const listedMoment = listed.content.moments.find((item) => item.id === created.moment.id);
    assert.equal(listedMoment?.photos[0]?.id, photo.id);
    assert.equal(listedMoment?.originalAudioUrl, "https://blob.local/voice.webm");
  });

  test("POST moment then immediate POST photo and audio against in-process APIs", async () => {
    await withPinEnv(undefined, async () => {
      const [{ POST }, photos, audio] = await Promise.all([
        import("../app/api/moments/route.ts"),
        import("../app/api/moments/photos/route.ts"),
        import("../app/api/moments/audio/route.ts"),
      ]);

      const createdResponse = await POST(
        new Request("http://travelos.local/api/moments", {
          body: JSON.stringify({ note: "api-memory", time: "2026-08-25T01:33:00.000Z" }),
          headers: { "content-type": "application/json" },
          method: "POST",
        }),
      );
      assert.equal(createdResponse.status, 200);
      const created = (await createdResponse.json()) as { moment: { id: string } };

      const photoData = new FormData();
      photoData.set("momentId", created.moment.id);
      photoData.set("file", new File([Uint8Array.from([1, 2, 3, 4])], "park.jpg", { type: "image/jpeg" }));
      const photoResponse = await photos.POST(
        new Request("http://travelos.local/api/moments/photos", { body: photoData, method: "POST" }),
      );
      assert.equal(photoResponse.status, 200);

      const audioData = new FormData();
      audioData.set("momentId", created.moment.id);
      audioData.set("file", new File([Uint8Array.from([5, 6, 7, 8])], "voice.webm", { type: "audio/webm" }));
      const audioResponse = await audio.POST(
        new Request("http://travelos.local/api/moments/audio", { body: audioData, method: "POST" }),
      );
      assert.equal(audioResponse.status, 200);
    });
  });

  test("POST /api/moments/transcript awaits fill and persists speech text", async () => {
    await withPinEnv(undefined, async () => {
      const [{ POST }, audio, transcript] = await Promise.all([
        import("../app/api/moments/route.ts"),
        import("../app/api/moments/audio/route.ts"),
        import("../app/api/moments/transcript/route.ts"),
      ]);

      const originalFetch = globalThis.fetch;
      const previousKey = process.env.AI_GATEWAY_API_KEY;
      process.env.AI_GATEWAY_API_KEY = "test-key";
      globalThis.fetch = (async (input: Parameters<typeof fetch>[0]) => {
        const url = String(input);
        if (url.startsWith("data:") || url.includes("blob.vercel-storage.com") || url.includes("blob.local")) {
          const bytes = new Uint8Array(24);
          bytes.set([0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6f, 0x35], 4);
          return new Response(bytes, { headers: { "content-type": "audio/mp4" } });
        }
        if (url.includes("transcription-model")) {
          return Response.json({ text: "今天的咖哩很好吃" });
        }
        throw new Error(`unexpected fetch ${url}`);
      }) as typeof fetch;

      try {
        const createdResponse = await POST(
          new Request("http://travelos.local/api/moments", {
            body: JSON.stringify({ note: "", time: "2026-08-27T12:09:56.986Z" }),
            headers: { "content-type": "application/json" },
            method: "POST",
          }),
        );
        const created = (await createdResponse.json()) as { moment: { id: string } };

        const audioData = new FormData();
        audioData.set("momentId", created.moment.id);
        audioData.set(
          "file",
          new File([Uint8Array.from([0, 0, 0, 32, 102, 116, 121, 112, 105, 115, 111, 53])], "moment-audio.m4a", {
            type: "audio/mp4",
          }),
        );
        assert.equal(
          (
            await audio.POST(
              new Request("http://travelos.local/api/moments/audio", { body: audioData, method: "POST" }),
            )
          ).status,
          200,
        );

        const filledResponse = await transcript.POST(
          new Request("http://travelos.local/api/moments/transcript", {
            body: JSON.stringify({ momentId: created.moment.id }),
            headers: { "content-type": "application/json" },
            method: "POST",
          }),
        );
        assert.equal(filledResponse.status, 200);
        const filled = (await filledResponse.json()) as { moment: { transcript: string | null } };
        assert.equal(filled.moment.transcript, "今天的咖哩很好吃");
      } finally {
        globalThis.fetch = originalFetch;
        if (previousKey === undefined) {
          delete process.env.AI_GATEWAY_API_KEY;
        } else {
          process.env.AI_GATEWAY_API_KEY = previousKey;
        }
      }
    });
  });

  test("POST moment then immediate POST photo and audio while index get is stale", async () => {
    await withPinEnv(undefined, async () => {
      const blob = createStaleIndexBlob();
      setMomentBlobAdapterForTests(blob.adapter);

      const [{ POST }, photos, audio] = await Promise.all([
        import("../app/api/moments/route.ts"),
        import("../app/api/moments/photos/route.ts"),
        import("../app/api/moments/audio/route.ts"),
      ]);

      const createdResponse = await POST(
        new Request("http://travelos.local/api/moments", {
          body: JSON.stringify({ note: "api-stale", time: "2026-08-25T01:33:00.000Z" }),
          headers: { "content-type": "application/json" },
          method: "POST",
        }),
      );
      assert.equal(createdResponse.status, 200);
      const created = (await createdResponse.json()) as { moment: { id: string } };

      const stale = JSON.parse(blob.indexCdn.get(MOMENTS_BLOB_PATH) ?? "{}") as { moments?: Array<{ id: string }> };
      assert.equal(stale.moments?.some((item) => item.id === created.moment.id) ?? false, false);
      assert.ok(blob.origin.get(momentItemBlobPath(created.moment.id)));

      const photoData = new FormData();
      photoData.set("momentId", created.moment.id);
      photoData.set("file", new File([Uint8Array.from([9, 8, 7, 6])], "lake.jpg", { type: "image/jpeg" }));
      const photoResponse = await photos.POST(
        new Request("http://travelos.local/api/moments/photos", { body: photoData, method: "POST" }),
      );
      assert.equal(photoResponse.status, 200);

      const audioData = new FormData();
      audioData.set("momentId", created.moment.id);
      audioData.set("file", new File([Uint8Array.from([2, 2, 2, 2])], "lake.webm", { type: "audio/webm" }));
      const audioResponse = await audio.POST(
        new Request("http://travelos.local/api/moments/audio", { body: audioData, method: "POST" }),
      );
      assert.equal(audioResponse.status, 200);

      const photoJson = (await photoResponse.json()) as { photo: { id: string; momentId: string } };
      assert.equal(photoJson.photo.momentId, created.moment.id);
    });
  });

  test("PIN-off unauthenticated POST still works", async () => {
    await withPinEnv(undefined, async () => {
      const { POST } = await import("../app/api/moments/route.ts");
      const response = await POST(
        new Request("http://travelos.local/api/moments", {
          body: JSON.stringify({ note: "no-pin", time: "2026-08-25T01:33:00.000Z" }),
          headers: { "content-type": "application/json" },
          method: "POST",
        }),
      );
      assert.equal(response.status, 200);
    });
  });

  test("index 403 still returns GET 200 and POST still writes the item file", async () => {
    await withPinEnv(undefined, async () => {
      const puts: string[] = [];
      setMomentBlobAdapterForTests({
        get: async () => ({ statusCode: 403, stream: null }),
        async put(pathname) {
          puts.push(pathname);
          return { pathname, url: `https://blob.local/${pathname}` };
        },
      });

      const { GET, POST } = await import("../app/api/moments/route.ts");
      const listed = await GET(new Request("http://travelos.local/api/moments"));
      assert.equal(listed.status, 200);
      const listedBody = (await listed.json()) as { content: { moments: unknown[] } };
      assert.deepEqual(listedBody.content.moments, []);
      assert.equal(puts.length, 0);

      const createdResponse = await POST(
        new Request("http://travelos.local/api/moments", {
          body: JSON.stringify({ note: "cdn-403", time: "2026-08-28T07:00:00.000Z" }),
          headers: { "content-type": "application/json" },
          method: "POST",
        }),
      );
      assert.equal(createdResponse.status, 200);
      const created = (await createdResponse.json()) as { moment: { id: string } };
      assert.ok(puts.some((pathname) => pathname === `travelos/moments/items/${created.moment.id}.json`));
    });
  });

  test("Drive warehouse POST creates a moment and stores photo/audio as drive: keys", async () => {
    await withPinEnv(undefined, async () => {
      const files = new Map<string, { base64: string; mimeType: string; name: string }>();
      const items = new Map<string, string>();
      let indexText = JSON.stringify({
        jobs: [],
        moments: [],
        schemaVersion: 1,
        updatedAt: "2026-08-28T00:00:00.000Z",
      });
      let fileSeq = 0;
      const urls: string[] = [];

      setDriveWarehouseFetchForTests((async (input, init) => {
        const url = String(input);
        urls.push(url);
        assert.doesNotMatch(url, /blob\.vercel-storage\.com/);
        const method = (init?.method ?? "GET").toUpperCase();
        if (method === "GET") {
          const parsed = new URL(url);
          if (parsed.searchParams.get("op") === "index") {
            return new Response(indexText, { headers: { "content-type": "application/json" } });
          }
          if (parsed.searchParams.get("op") === "list") {
            return Response.json({
              files: [...files.entries()].map(([id, file]) => ({
                id,
                mimeType: file.mimeType,
                name: file.name,
              })),
            });
          }
          const id = parsed.searchParams.get("id") ?? "";
          const file = files.get(id);
          if (!file) {
            return new Response("not found", { status: 404 });
          }
          return Response.json({ id, ...file });
        }

        const payload = JSON.parse(String(init?.body ?? "{}")) as {
          base64?: string;
          mimeType?: string;
          name?: string;
          op?: string;
          text?: string;
        };
        if (payload.op === "index") {
          indexText = payload.text ?? indexText;
          return Response.json({ ok: true, name: "moments.json" });
        }
        if (payload.op === "item") {
          items.set(payload.name ?? "", payload.text ?? "");
          return Response.json({ ok: true, name: payload.name });
        }
        fileSeq += 1;
        const id = `drivefile_${fileSeq}`;
        files.set(id, {
          base64: payload.base64 ?? "",
          mimeType: payload.mimeType ?? "application/octet-stream",
          name: payload.name ?? "file.bin",
        });
        return Response.json({ id, name: payload.name });
      }) as typeof fetch);

      const [{ GET, POST }, photos, audio] = await Promise.all([
        import("../app/api/moments/route.ts"),
        import("../app/api/moments/photos/route.ts"),
        import("../app/api/moments/audio/route.ts"),
      ]);

      const listed = await GET(new Request("http://travelos.local/api/moments"));
      assert.equal(listed.status, 200);
      const listedBody = (await listed.json()) as { status: { configured: boolean; source: string } };
      assert.equal(listedBody.status.source, "drive");
      assert.equal(listedBody.status.configured, true);

      const createdResponse = await POST(
        new Request("http://travelos.local/api/moments", {
          body: JSON.stringify({ note: "drive-dump", time: "2026-08-28T09:00:00.000Z" }),
          headers: { "content-type": "application/json" },
          method: "POST",
        }),
      );
      assert.equal(createdResponse.status, 200);
      const created = (await createdResponse.json()) as { moment: { id: string } };
      assert.ok([...items.keys()].some((name) => name.includes(created.moment.id)));

      const photoData = new FormData();
      photoData.set("momentId", created.moment.id);
      photoData.set("file", new File([Uint8Array.from([9, 8, 7, 6])], "lake.jpg", { type: "image/jpeg" }));
      const photoResponse = await photos.POST(
        new Request("http://travelos.local/api/moments/photos", { body: photoData, method: "POST" }),
      );
      assert.equal(photoResponse.status, 200);
      const photoJson = (await photoResponse.json()) as { photo: { id: string; storageKey: string } };
      assert.match(photoJson.photo.storageKey, /^drive:/);

      const photoGet = await photos.GET(
        new Request(
          `http://travelos.local/api/moments/photos?momentId=${created.moment.id}&photoId=${photoJson.photo.id}`,
        ),
      );
      assert.equal(photoGet.status, 200);
      assert.deepEqual([...new Uint8Array(await photoGet.arrayBuffer())], [9, 8, 7, 6]);

      const audioData = new FormData();
      audioData.set("momentId", created.moment.id);
      audioData.set("file", new File([Uint8Array.from([2, 2, 2, 2])], "lake.webm", { type: "audio/webm" }));
      const audioResponse = await audio.POST(
        new Request("http://travelos.local/api/moments/audio", { body: audioData, method: "POST" }),
      );
      assert.equal(audioResponse.status, 200);
      const audioJson = (await audioResponse.json()) as { moment: { originalAudioUrl: string } };
      assert.match(audioJson.moment.originalAudioUrl, /^drive:/);

      const audioGet = await audio.GET(
        new Request(`http://travelos.local/api/moments/audio?momentId=${created.moment.id}`),
      );
      assert.equal(audioGet.status, 200);
      assert.equal(urls.some((url) => url.includes("blob.vercel-storage.com")), false);
    });
  });

  test("photo GET hydrates Drive files so rebuilt photo ids are not 404", async () => {
    await withPinEnv(undefined, async () => {
      const momentId = "moment_1787928443329_3823s1";
      const fileId = "1dQ9zJGeuGtkMSDsnTPcvQrL4ac4IJhk6";
      const rebuiltId = `moment_photo_drive_${fileId.replace(/[^A-Za-z0-9]/g, "").slice(0, 24)}`;
      const jpeg = Uint8Array.from([0xff, 0xd8, 0xff, 0xd9, 0x11, 0x22, 0x33, 0x44]);
      const nestedThumb = Uint8Array.from([0xff, 0xd8, 0xff, 0xd9, 0xde, 0xad]);
      const files = new Map<string, { base64: string; mimeType: string; name: string }>([
        [
          fileId,
          {
            base64: Buffer.from(jpeg).toString("base64"),
            mimeType: "image/jpeg",
            name: `travelos__moments__photos__${momentId}__1787928457686-IMG_0871.jpeg`,
          },
        ],
      ]);
      const thumbs = new Map<string, Uint8Array>([[fileId, nestedThumb]]);

      const staleMoment = createTravelMoment({
        note: "edinburgh trip, write a travel blog",
        time: "2026-08-28T14:47:23.328Z",
      });
      staleMoment.id = momentId;
      staleMoment.photos = [
        {
          coordinates: null,
          createdAt: staleMoment.createdAt,
          id: "moment_photo_old_upload",
          momentId,
          originalFilename: "IMG_0871.jpeg",
          originalStorageKey: null,
          storageKey: "drive:stale-old-id",
          takenAt: staleMoment.createdAt,
        },
      ];
      const indexText = JSON.stringify({
        jobs: [],
        moments: [staleMoment],
        schemaVersion: 2,
        updatedAt: "2026-08-28T14:47:23.328Z",
      });

      setDriveWarehouseFetchForTests((async (input, init) => {
        const url = String(input);
        const method = (init?.method ?? "GET").toUpperCase();
        if (method === "GET") {
          const parsed = new URL(url);
          if (parsed.searchParams.get("op") === "index") {
            return new Response(indexText, { headers: { "content-type": "application/json" } });
          }
          if (parsed.searchParams.get("op") === "list") {
            return Response.json({
              files: [...files.entries()].map(([id, file]) => ({
                id,
                mimeType: file.mimeType,
                name: file.name,
              })),
            });
          }
          const id = parsed.searchParams.get("id") ?? "";
          if (parsed.searchParams.get("op") === "thumb") {
            const thumb = thumbs.get(id);
            if (!thumb) {
              return Response.json({ error: "no thumbnail", id });
            }
            return Response.json({
              id,
              mimeType: "image/jpeg",
              name: files.get(id)?.name ?? id,
              base64: Buffer.from(thumb).toString("base64"),
            });
          }
          const file = files.get(id);
          if (!file) {
            return new Response("not found", { status: 404 });
          }
          return Response.json({ id, ...file });
        }
        return Response.json({ ok: true, name: "ignored" });
      }) as typeof fetch);

      const photos = await import("../app/api/moments/photos/route.ts");
      const missing = await photos.GET(
        new Request(`http://travelos.local/api/moments/photos?momentId=${momentId}&photoId=moment_photo_missing`),
      );
      assert.equal(missing.status, 404);
      assert.deepEqual(await missing.json(), { error: "Photo not found", reason: "missing-photo" });

      const photoGet = await photos.GET(
        new Request(`http://travelos.local/api/moments/photos?momentId=${momentId}&photoId=${rebuiltId}`),
      );
      assert.equal(photoGet.status, 200);
      assert.equal(photoGet.headers.get("content-type"), "image/jpeg");
      assert.deepEqual([...new Uint8Array(await photoGet.arrayBuffer())], [...jpeg]);

      const thumbGet = await photos.GET(
        new Request(
          `http://travelos.local/api/moments/photos?momentId=${momentId}&photoId=${rebuiltId}&variant=thumb`,
        ),
      );
      assert.equal(thumbGet.status, 200);
      assert.equal(thumbGet.headers.get("content-type"), "image/jpeg");
      const thumbBytes = new Uint8Array(await thumbGet.arrayBuffer());
      assert.deepEqual([...thumbBytes], [...nestedThumb]);
      assert.ok(thumbBytes.length < jpeg.length);
    });
  });

  test("photo GET uses listing file id when index and Drive list are stale, and splits missing-photo from binary-miss", async () => {
    await withPinEnv(undefined, async () => {
      const momentId = "moment_1787928443329_3823s1";
      const fileId = "1dQ9zJGeuGtkMSDsnTPcvQrL4ac4IJhk6";
      const rebuiltId = `moment_photo_drive_${fileId.replace(/[^A-Za-z0-9]/g, "").slice(0, 24)}`;
      const jpeg = Uint8Array.from([0xff, 0xd8, 0xff, 0xd9, 0x11, 0x22, 0x33, 0x44]);
      const files = new Map<string, { base64: string; mimeType: string; name: string }>([
        [
          fileId,
          {
            base64: Buffer.from(jpeg).toString("base64"),
            mimeType: "image/jpeg",
            name: `travelos__moments__photos__${momentId}__1787928457686-IMG_0871.jpeg`,
          },
        ],
      ]);

      const staleMoment = createTravelMoment({
        note: "edinburgh trip, write a travel blog",
        time: "2026-08-28T14:47:23.328Z",
      });
      staleMoment.id = momentId;
      staleMoment.photos = [
        {
          coordinates: null,
          createdAt: staleMoment.createdAt,
          id: "moment_photo_old_upload",
          momentId,
          originalFilename: "IMG_0871.jpeg",
          originalStorageKey: null,
          storageKey: "drive:stale-old-id",
          takenAt: staleMoment.createdAt,
        },
      ];
      const indexText = JSON.stringify({
        jobs: [],
        moments: [staleMoment],
        schemaVersion: 2,
        updatedAt: "2026-08-28T15:02:28.959Z",
      });

      setDriveWarehouseFetchForTests((async (input, init) => {
        const url = String(input);
        const method = (init?.method ?? "GET").toUpperCase();
        if (method === "GET") {
          const parsed = new URL(url);
          if (parsed.searchParams.get("op") === "index") {
            return new Response(indexText, { headers: { "content-type": "application/json" } });
          }
          if (parsed.searchParams.get("op") === "list") {
            return Response.json({ files: [] });
          }
          const id = parsed.searchParams.get("id") ?? "";
          const file = files.get(id);
          if (!file) {
            return new Response("not found", { status: 404 });
          }
          return Response.json({ id, ...file });
        }
        return Response.json({ ok: true, name: "ignored" });
      }) as typeof fetch);

      const photos = await import("../app/api/moments/photos/route.ts");
      const withoutFile = await photos.GET(
        new Request(`http://travelos.local/api/moments/photos?momentId=${momentId}&photoId=${rebuiltId}`),
      );
      assert.equal(withoutFile.status, 404);
      assert.deepEqual(await withoutFile.json(), { error: "Photo not found", reason: "missing-photo" });

      const mismatchedFile = await photos.GET(
        new Request(
          `http://travelos.local/api/moments/photos?momentId=${momentId}&photoId=${rebuiltId}&file=other-file-id`,
        ),
      );
      assert.equal(mismatchedFile.status, 404);
      assert.deepEqual(await mismatchedFile.json(), { error: "Photo not found", reason: "missing-photo" });

      const withFile = await photos.GET(
        new Request(
          `http://travelos.local/api/moments/photos?momentId=${momentId}&photoId=${rebuiltId}&file=${fileId}`,
        ),
      );
      assert.equal(withFile.status, 200);
      assert.equal(withFile.headers.get("content-type"), "image/jpeg");
      assert.deepEqual([...new Uint8Array(await withFile.arrayBuffer())], [...jpeg]);

      files.delete(fileId);
      const binaryMiss = await photos.GET(
        new Request(
          `http://travelos.local/api/moments/photos?momentId=${momentId}&photoId=${rebuiltId}&file=${fileId}`,
        ),
      );
      assert.equal(binaryMiss.status, 503);
      assert.deepEqual(await binaryMiss.json(), { error: "Could not read photo bytes", reason: "binary-miss" });
    });
  });

  test("thumb GET reuses a full Drive JPEG when op=thumb is ignored and returns the EXIF nested JPEG", async () => {
    await withPinEnv(undefined, async () => {
      const momentId = "moment_1787928443329_3823s1";
      const fileId = "1dQ9zJGeuGtkMSDsnTPcvQrL4ac4IJhk6";
      const rebuiltId = `moment_photo_drive_${fileId.replace(/[^A-Za-z0-9]/g, "").slice(0, 24)}`;
      const nestedThumb = Uint8Array.from([0xff, 0xd8, 0xff, 0xd9, 0xde, 0xad]);
      const jpeg = jpegWithExifThumbnail(nestedThumb);
      let binaryGets = 0;

      const staleMoment = createTravelMoment({
        note: "edinburgh trip, write a travel blog",
        time: "2026-08-28T14:47:23.328Z",
      });
      staleMoment.id = momentId;
      const indexText = JSON.stringify({
        jobs: [],
        moments: [staleMoment],
        schemaVersion: 2,
        updatedAt: "2026-08-28T15:02:28.959Z",
      });

      setDriveWarehouseFetchForTests((async (input, init) => {
        const url = String(input);
        const method = (init?.method ?? "GET").toUpperCase();
        if (method === "GET") {
          const parsed = new URL(url);
          if (parsed.searchParams.get("op") === "index") {
            return new Response(indexText, { headers: { "content-type": "application/json" } });
          }
          if (parsed.searchParams.get("op") === "list") {
            return Response.json({ files: [] });
          }
          const id = parsed.searchParams.get("id") ?? "";
          if (id !== fileId) {
            return new Response("not found", { status: 404 });
          }
          binaryGets += 1;
          return Response.json({
            id,
            mimeType: "image/jpeg",
            name: `travelos__moments__photos__${momentId}__1787928457686-IMG_0871.jpeg`,
            base64: Buffer.from(jpeg).toString("base64"),
          });
        }
        return Response.json({ ok: true, name: "ignored" });
      }) as typeof fetch);

      const photos = await import("../app/api/moments/photos/route.ts");
      const thumbGet = await photos.GET(
        new Request(
          `http://travelos.local/api/moments/photos?momentId=${momentId}&photoId=${rebuiltId}&variant=thumb&file=${fileId}`,
        ),
      );
      assert.equal(thumbGet.status, 200);
      assert.equal(thumbGet.headers.get("content-type"), "image/jpeg");
      const thumbBytes = new Uint8Array(await thumbGet.arrayBuffer());
      assert.deepEqual([...thumbBytes], [...nestedThumb]);
      assert.ok(thumbBytes.length < jpeg.length);
      assert.equal(binaryGets, 1);
    });
  });
});

test("overlay prefers item-file photos when the index is missing the moment", () => {
  const item = createTravelMoment({ note: "item", time: "2026-08-25T01:33:00.000Z" });
  item.photos = [testPhoto(item.id)];
  const merged = overlayMoments([], [item]);
  assert.equal(merged[0]?.id, item.id);
  assert.equal(merged[0]?.photos[0]?.id, "moment_photo_park");
});

test("overlay unions sibling photos from a stale index copy and a later item write", () => {
  const moment = createTravelMoment({ note: "race", time: "2026-08-28T14:16:10.163Z" });
  const first = testPhoto(moment.id, "moment_photo_one");
  first.originalFilename = "IMG_1377.jpeg";
  first.storageKey = "drive:one";
  const second = testPhoto(moment.id, "moment_photo_two");
  second.originalFilename = "IMG_1359.jpeg";
  second.storageKey = "drive:two";
  const indexCopy = { ...moment, photos: [first] };
  const itemCopy = { ...moment, photos: [second] };
  const merged = overlayMoments([indexCopy], [itemCopy]);
  assert.equal(merged.length, 1);
  assert.deepEqual(
    merged[0]?.photos.map((photo) => photo.originalFilename).sort(),
    ["IMG_1359.jpeg", "IMG_1377.jpeg"],
  );
});

test("listed item files hydrate GET when the index body 403s", async () => {
  const moment = createTravelMoment({ note: "from-item", time: "2026-08-28T07:00:00.000Z" });
  const record = { moment, updatedAt: moment.createdAt };
  const loaded = await momentsFromListedItemBlobs(
    [
      { pathname: momentItemBlobPath(moment.id), url: "https://cdn.example/item.json" },
      { pathname: "travelos/moments/items/moment_blocked.json", url: "https://cdn.example/blocked.json" },
    ],
    async (url) => {
      if (url.endsWith("blocked.json")) {
        return { statusCode: 403, stream: null };
      }
      return { statusCode: 200, stream: new Blob([JSON.stringify(record)]).stream() };
    },
  );

  assert.equal(loaded[0]?.id, moment.id);
  assert.equal(loaded[0]?.note, "from-item");
  assert.equal(loaded[1]?.id, "moment_blocked");
  assert.equal(loaded[1]?.note, "");
});

test("public Lapland stays untouched by per-moment item files", async () => {
  const [item, blob, store, capture, laplandPage, seed, poster, drive] = await Promise.all([
    readSource("lib/moment-item.ts"),
    readSource("lib/moment-blob.ts"),
    readSource("lib/moment-store.ts"),
    readSource("app/family/capture/page.tsx"),
    readSource("app/trips/[slug]/page.tsx"),
    readSource("lib/trips.ts"),
    readSource("scripts/generate-lapland-poster.mjs"),
    readSource("lib/drive-warehouse.ts"),
  ]);

  for (const source of [item, blob, store, capture, drive]) {
    assert.doesNotMatch(source, /trip_lapland_2020/);
    assert.doesNotMatch(source, /generate-lapland-poster/);
    assert.doesNotMatch(source, /travelpayouts/i);
    assert.doesNotMatch(source, /emrldtp/);
    assert.doesNotMatch(source, /TRAVELOS_REQUIRE_FAMILY_PIN/);
  }
  assert.doesNotMatch(laplandPage, /moment-store/);
  assert.doesNotMatch(laplandPage, /moment-item/);
  assert.doesNotMatch(laplandPage, /family\/capture/);
  assert.doesNotMatch(laplandPage, /family\/bench/);
  assert.match(seed, /trip_lapland_2020/);
  assert.match(seed, /laplandTitle: "北極圈上的十二月"/);
  assert.match(seed, /finland-lapland-winter-journal"/);
  assert.match(poster, /tile\.opentopomap\.org/);
});
