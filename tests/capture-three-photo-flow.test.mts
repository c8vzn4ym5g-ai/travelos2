import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";
import { setDriveWarehouseFetchForTests } from "../lib/drive-warehouse.ts";
import { resetMomentStoreForTests } from "../lib/moment-store.ts";
import type { TravelMoment } from "../lib/types.ts";

test("three photo uploads and audio survive finalize on another isolate and a fresh bench GET", async () => {
  resetMomentStoreForTests();
  const source = await readFile(new URL("../scripts/drive-warehouse-apps-script.js", import.meta.url), "utf8");
  const merge = vm.runInNewContext(`${source}\nmergeMoment_`) as
    (base: Partial<TravelMoment>, next: Partial<TravelMoment>) => TravelMoment;
  const files = new Map<string, { base64: string; mimeType: string; name: string }>();
  const items = new Map<string, { moment: TravelMoment }>();
  const index = { jobs: [], moments: [] as TravelMoment[], schemaVersion: 2, updatedAt: new Date().toISOString() };
  const pending: Promise<unknown>[] = [];
  const contextKey = Symbol.for("@next/request-context");
  const globals = globalThis as typeof globalThis & Record<symbol, unknown>;
  const previousContext = globals[contextKey];
  globals[contextKey] = { get: () => ({ waitUntil: (promise: Promise<unknown>) => pending.push(promise) }) };
  const drain = async () => {
    while (pending.length) await Promise.all(pending.splice(0));
  };
  const fakeFetch = (async (input, init) => {
    if ((init?.method ?? "GET") === "GET") {
      const url = new URL(String(input));
      if (url.searchParams.get("op") === "index") return Response.json(index);
      if (url.searchParams.get("op") === "list") {
        return Response.json({ files: [...files].map(([id, file]) => ({ id, name: file.name, mimeType: file.mimeType })) });
      }
      const id = url.searchParams.get("id") ?? "";
      const file = files.get(id);
      return file ? Response.json({ id, ...file }) : new Response("not found", { status: 404 });
    }
    const body = JSON.parse(String(init?.body));
    if (body.op === "item") {
      const incoming = JSON.parse(body.text);
      items.set(body.name, { moment: merge(items.get(body.name)?.moment ?? {}, incoming.moment) });
      return Response.json({ ok: true, name: body.name });
    }
    if (body.op === "index") {
      const incoming = JSON.parse(body.text);
      for (const moment of incoming.moments) {
        const position = index.moments.findIndex((entry) => entry.id === moment.id);
        if (position < 0) index.moments.push(moment);
        else index.moments[position] = merge(index.moments[position], moment);
      }
      return Response.json({ ok: true, name: "moments.json" });
    }
    const id = `fixture_file_${files.size + 1}`;
    files.set(id, { base64: body.base64, mimeType: body.mimeType, name: body.name });
    return Response.json({ id, name: body.name });
  }) as typeof fetch;
  setDriveWarehouseFetchForTests(fakeFetch);
  const previousPin = process.env.TRAVELOS_ADMIN_PIN;
  delete process.env.TRAVELOS_ADMIN_PIN;
  try {
    const [moments, photos, audio] = await Promise.all([
      import("../app/api/moments/route.ts"),
      import("../app/api/moments/photos/route.ts"),
      import("../app/api/moments/audio/route.ts"),
    ]);
    const created = await moments.POST(new Request("http://local/api/moments", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ note: "trip memory", time: "2026-09-08T01:00:00.000Z" }),
    }));
    assert.equal(created.status, 200);
    const { moment } = await created.json() as { moment: TravelMoment };
    const photoKeys = await Promise.all([1, 2, 3].map(async (number) => {
      const data = new FormData();
      data.set("momentId", moment.id);
      data.set("file", new File([new Uint8Array([0xff, 0xd8, number, 0xff, 0xd9])], `photo${number}.jpg`, { type: "image/jpeg" }));
      const response = await photos.POST(new Request("http://local/api/moments/photos", { method: "POST", body: data }));
      assert.equal(response.status, 200);
      return (await response.json() as { photo: { storageKey: string } }).photo.storageKey;
    }));
    const voice = new FormData();
    voice.set("momentId", moment.id);
    voice.set("file", new File([new Uint8Array([1, 2, 3])], "voice.webm", { type: "audio/webm" }));
    const audioResponse = await audio.POST(new Request("http://local/api/moments/audio", { method: "POST", body: voice }));
    assert.equal(audioResponse.status, 200);
    const audioUrl = (await audioResponse.json() as { moment: { originalAudioUrl: string } }).moment.originalAudioUrl;
    await drain();
    // A different isolate has none of Capture's in-memory item state.
    resetMomentStoreForTests();
    setDriveWarehouseFetchForTests(fakeFetch);
    const finalized = await moments.PUT(new Request("http://local/api/moments", {
      method: "PUT", headers: { "content-type": "application/json" },
      body: JSON.stringify({ moment: { id: moment.id, note: "saved memory", originalAudioUrl: audioUrl } }),
    }));
    assert.equal(finalized.status, 200);
    await drain();
    const durable = [...items.values()].find((item) => item.moment.id === moment.id)?.moment;
    assert.equal(durable?.photos.length, 3);
    assert.equal(durable?.originalAudioUrl, audioUrl);
    resetMomentStoreForTests();
    setDriveWarehouseFetchForTests(fakeFetch);
    const listed = await moments.GET(new Request("http://local/api/moments"));
    assert.equal(listed.status, 200);
    const body = await listed.json() as { content: { moments: TravelMoment[] } };
    const displayed = body.content.moments.find((entry) => entry.id === moment.id);
    assert.equal(displayed?.note, "saved memory");
    assert.deepEqual(displayed?.photos.map((photo) => photo.storageKey).sort(), photoKeys.sort());
    assert.equal(displayed?.originalAudioUrl, audioUrl);
    await drain();
  } finally {
    globals[contextKey] = previousContext;
    if (previousPin === undefined) delete process.env.TRAVELOS_ADMIN_PIN;
    else process.env.TRAVELOS_ADMIN_PIN = previousPin;
    resetMomentStoreForTests();
  }
});
