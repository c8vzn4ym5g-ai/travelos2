import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";
import {
  MOMENT_ITEM_GET_OPTIONS,
  MOMENT_ITEM_PUT_OPTIONS,
  loadMomentItemFromBlobGet,
  momentItemBlobPath,
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
  setMomentAudio,
  setMomentBlobAdapterForTests,
  setPhotoOriginal,
} from "../lib/moment-store.ts";
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
      assert.equal(options.access, "public");
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
  assert.equal(MOMENT_ITEM_GET_OPTIONS.access, "public");
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

    const original = await setPhotoOriginal(created.moment.id, photo.id, "https://blob.local/original.heic");
    assert.equal(original?.photo.originalStorageKey, "https://blob.local/original.heic");
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
});

test("overlay prefers item-file photos when the index is missing the moment", () => {
  const item = createTravelMoment({ note: "item", time: "2026-08-25T01:33:00.000Z" });
  item.photos = [testPhoto(item.id)];
  const merged = overlayMoments([], [item]);
  assert.equal(merged[0]?.id, item.id);
  assert.equal(merged[0]?.photos[0]?.id, "moment_photo_park");
});

test("public Lapland stays untouched by per-moment item files", async () => {
  const [item, blob, store, capture, laplandPage, seed, poster] = await Promise.all([
    readSource("lib/moment-item.ts"),
    readSource("lib/moment-blob.ts"),
    readSource("lib/moment-store.ts"),
    readSource("app/family/capture/page.tsx"),
    readSource("app/trips/[slug]/page.tsx"),
    readSource("lib/trips.ts"),
    readSource("scripts/generate-lapland-poster.mjs"),
  ]);

  for (const source of [item, blob, store, capture]) {
    assert.doesNotMatch(source, /trip_lapland_2020/);
    assert.doesNotMatch(source, /generate-lapland-poster/);
    assert.doesNotMatch(source, /travelpayouts/i);
    assert.doesNotMatch(source, /emrldtp/);
    assert.doesNotMatch(source, /TRAVELOS_REQUIRE_FAMILY_PIN/);
  }
  assert.doesNotMatch(laplandPage, /moment-store/);
  assert.doesNotMatch(laplandPage, /moment-item/);
  assert.doesNotMatch(laplandPage, /family\/capture/);
  assert.match(seed, /trip_lapland_2020/);
  assert.match(seed, /laplandTitle: "北極圈上的十二月"/);
  assert.match(seed, /finland-lapland-winter-journal"/);
  assert.match(poster, /basemaps.cartocdn.com\/rastertiles\/voyager/);
});
