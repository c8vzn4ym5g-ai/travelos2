import assert from "node:assert/strict";
import test from "node:test";
import { addPhotoToMoment, getMomentById, setPhotoOriginal, updateMoment, setMomentAudio, resetMomentStoreForTests } from "../lib/moment-store.ts";
import { setDriveWarehouseFetchForTests } from "../lib/drive-warehouse.ts";
import { createTravelMoment } from "../lib/moments.ts";
import type { MomentPhoto } from "../lib/types.ts";

test("an unfinished half-batch survives a fresh store through its moment id without catalog writes", async () => {
  resetMomentStoreForTests();
  const moment = createTravelMoment({ id: "moment_interrupted", time: null, note: "original family note" });
  let shard = JSON.stringify({ moment });
  const request: typeof fetch = async (input, init) => {
    if ((init?.method ?? "GET") === "GET") {
      assert.equal(new URL(String(input)).searchParams.get("op"), "item");
      return new Response(shard, { headers: { "content-type": "application/json" } });
    }
    const payload = JSON.parse(String(init?.body));
    assert.equal(payload.op, "item", "unfinished photos do not rewrite the catalog");
    shard = payload.text;
    return Response.json({ ok: true });
  };
  setDriveWarehouseFetchForTests(request);
  try {
    for (let n = 0; n < 20; n++) {
      await addPhotoToMoment(moment.id, {
        id: `interrupted_${n}`, momentId: moment.id, storageKey: `drive:half_${n}`,
        originalFilename: `${n}.jpg`, originalStorageKey: null, kind: "photo",
        takenAt: null, coordinates: null, createdAt: "2026-09-13T00:00:00Z",
      });
    }
    await setPhotoOriginal(moment.id, "interrupted_0", "drive:original_half_0");
    resetMomentStoreForTests();
    setDriveWarehouseFetchForTests(request);
    const recovered = await getMomentById(moment.id);
    assert.equal(recovered?.photos.length, 20);
    assert.equal(recovered?.photos[0]?.originalStorageKey, "drive:original_half_0");
    assert.equal(recovered?.note, "original family note");
  } finally {
    resetMomentStoreForTests();
  }
});

for (const registrySize of [20, 2000]) test(`three 40-file rounds plus audio persist independently of a slow ${registrySize}-entry catalog`, async (t) => {
  resetMomentStoreForTests();
  const items = new Map<string, string>();
  const catalog = new Map(Array.from({ length: registrySize }, (_, n) => [`legacy_${n}`, { id: `legacy_${n}` }]));
  for (let round = 0; round < 3; round++) {
    const moment = createTravelMoment({ id: `moment_round_${round}`, time: null, note: `round ${round}` });
    items.set(`travelos__moments__items__${moment.id}.json`, JSON.stringify({ moment }));
  }
  let releaseIndex!: () => void;
  const blockedIndex = new Promise<void>((resolve) => { releaseIndex = resolve; });
  let catalogWrites = 0, catalogReads = 0, itemReads = 0;
  const tasks: Promise<unknown>[] = [];
  const contextKey = Symbol.for("__cloudflare-context__");
  const previous = (globalThis as Record<symbol, unknown>)[contextKey];
  (globalThis as Record<symbol, unknown>)[contextKey] = { ctx: { waitUntil: (promise: Promise<unknown>) => tasks.push(promise) } };
  setDriveWarehouseFetchForTests(async (input, init) => {
    const url = new URL(String(input));
    if ((init?.method ?? "GET") === "GET") {
      if (url.searchParams.get("op") === "item") {
        itemReads++;
        const text = items.get(url.searchParams.get("name") ?? "");
        return text ? new Response(text, { headers: { "content-type": "application/json" } }) : Response.json({ error: "not found" });
      }
      catalogReads++;
      throw new Error("capture must not read catalog/list");
    }
    const payload = JSON.parse(String(init?.body));
    if (payload.op === "item") { items.set(payload.name, payload.text); return Response.json({ ok: true }); }
    if (payload.op === "index") {
      catalogWrites++;
      await blockedIndex;
      for (const moment of JSON.parse(payload.text).moments) catalog.set(moment.id, moment);
      return Response.json({ ok: true });
    }
    throw new Error(`unexpected op ${payload.op}`);
  });
  const rounds = (async () => {
    for (let round = 0; round < 3; round++) {
      const id = `moment_round_${round}`;
      const writesBeforePhotos = catalogWrites;
      for (let start = 0; start < 40; start += 3) {
        await Promise.all(Array.from({ length: Math.min(3, 40 - start) }, async (_, offset) => {
          const n = start + offset;
          const photo: MomentPhoto = { id: `${id}_photo_${n}`, momentId: id, storageKey: `drive:${id}_${n}`, originalFilename: n % 20 ? `${n}.jpg` : `${n}.mov`, originalStorageKey: null, kind: n % 20 ? "photo" : "video", takenAt: null, coordinates: null, createdAt: "2026-09-13T00:00:00Z" };
          await addPhotoToMoment(id, photo);
          await setPhotoOriginal(id, photo.id, `drive:original_${id}_${n}`);
        }));
      }
      assert.equal(catalogWrites, writesBeforePhotos, "40 photo and original appends must not schedule catalog RMW");
      await updateMoment({ id, note: `finalized ${round}`, topics: ["family"] });
      await setMomentAudio(id, `drive:${id}_voice`, { transcript: `round ${round} voice` });
    }
  })();
  try {
    const result = await Promise.race([rounds.then(() => "complete"), new Promise<string>((resolve) => setTimeout(() => resolve("blocked-on-catalog"), 800))]);
    assert.equal(result, "complete", "a slow catalog must not hold the global item-write queue");
  } finally {
    releaseIndex();
    await rounds;
    for (let index = 0; index < tasks.length; index++) await tasks[index];
    (globalThis as Record<symbol, unknown>)[contextKey] = previous;
    resetMomentStoreForTests();
  }
  assert.equal(catalogReads, 0);
  assert.ok(catalogWrites <= 2, `expected one current + one coalesced catalog patch, got ${catalogWrites}`);
  for (let round = 0; round < 3; round++) {
    const moment = JSON.parse(items.get(`travelos__moments__items__moment_round_${round}.json`)!).moment;
    assert.equal(moment.photos.length, 40);
    assert.equal(moment.photos.filter((photo: MomentPhoto) => photo.kind === "video").length, 2);
    assert.equal(moment.originalAudioUrl, `drive:moment_round_${round}_voice`);
    assert.equal(moment.transcript, `round ${round} voice`);
    assert.equal(moment.note, `finalized ${round}`);
    assert.deepEqual(moment.topics, ["family"]);
    assert.ok(moment.photos.every((photo: MomentPhoto) => photo.originalStorageKey?.startsWith("drive:original_")));
    assert.equal((catalog.get(moment.id) as typeof moment).photos.length, 40);
    assert.deepEqual((catalog.get(moment.id) as typeof moment).topics, ["family"]);
  }
  assert.ok(itemReads < 200, `index schedules must coalesce rather than each re-reading twice: ${itemReads}`);
  t.diagnostic(`registry=${registrySize}; itemReads=${itemReads}; catalogReads=${catalogReads}; catalogWrites=${catalogWrites}; persisted=120 media + 3 audio`);
});
