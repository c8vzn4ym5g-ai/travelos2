import assert from "node:assert/strict";
import test from "node:test";
import * as trips from "../lib/drive-trips.ts";

const id = "trip_family_actual";
const name = `travelos__trip__${id}.json`;
const saved = {
  id, title: "最後兩晚的新飯店", slug: "family-actual", summary: "我們最後只去了 E。",
  visibility: "private", updatedAt: "2026-09-13T12:00:00Z",
  photos: [{ id: "photo", storageKey: "original-family-photo" }],
  journalEntries: [{ id: "entry", body: "家人今天剛修改的回憶。" }],
};

for (const phase of ["access", "listing", "media-body"]) test(`single trip eight-second budget also bounds stalled ${phase}`, { timeout: 1000 }, async () => {
  const signals: AbortSignal[] = [];
  const request: typeof fetch = async (input, init) => {
    if (init?.signal) signals.push(init.signal);
    const url = new URL(String(input));
    if (url.searchParams.get("op") === "drive-access") return phase === "access" ? new Promise<Response>((_, reject) => { init?.signal?.addEventListener("abort", () => reject(new Error("aborted")), { once: true }); }) : Response.json({ token: "test", folderId: "family" });
    if (url.searchParams.has("q")) return phase === "listing" ? new Promise<Response>(() => {}) : Response.json({ files: [{ id: "file", name }] });
    return new Response(new ReadableStream({ start() {} }), { headers: { "content-type": "application/json" } });
  };
  await assert.rejects(trips.readDriveTrip(id, request, 20), /逾時/);
  assert.ok(signals.every((signal) => signal.aborted));
});

test("library opens from parallel file reads without waiting for the whole-library script", async () => {
  const operations: string[] = [];
  const request: typeof fetch = async input => {
    const url = new URL(String(input));
    operations.push(url.searchParams.get('op') ?? url.pathname);
    if (url.searchParams.get('op') === 'drive-access') return Response.json({token:'test',folderId:'family'});
    if (url.searchParams.get('op') === 'trips') throw new Error('slow whole-library script must not run');
    if (url.searchParams.has('q')) return Response.json({files:[{id:'one',name,modifiedTime:'2026-09-13'}]});
    return Response.json(saved);
  };
  const result = await trips.readDriveTrips(request);
  assert.equal(result.length, 1);
  assert.equal(result[0].title, saved.title);
  assert.equal(operations.includes('trips'), false);
});

test("single trip reads the exact filename, newest paginated duplicate, and preserves family edits", async () => {
  const requests: URL[] = [];
  const request: typeof fetch = async (input) => {
    const url = new URL(String(input));
    requests.push(url);
    if (url.searchParams.get("op") === "drive-access") return Response.json({ token: "test", folderId: "family" });
    if (url.searchParams.has("q")) {
      assert.equal(url.searchParams.get("q"), `'family' in parents and trashed = false and name = '${name}'`);
      assert.equal(url.searchParams.get("fields"), "nextPageToken,files(id,name,modifiedTime)");
      return Response.json(url.searchParams.has("pageToken") ? {
        files: [{ id: "new", name, modifiedTime: "2026-09-13" }],
      } : { files: [{ id: "old", name, modifiedTime: "2026-09-12" }], nextPageToken: "next" });
    }
    assert.equal(url.pathname, "/drive/v3/files/new");
    assert.equal(url.searchParams.get("alt"), "media");
    return Response.json({ moment: saved });
  };
  const result = await trips.readDriveTrip(id, request);
  assert.equal(result?.title, saved.title);
  assert.equal(result?.summary, saved.summary);
  assert.equal(result?.updatedAt, saved.updatedAt);
  assert.equal(result?.photos.length, 1);
  assert.equal(result?.photos[0].storageKey, "original-family-photo");
  assert.equal(result?.journalEntries.length, 1);
  assert.equal(result?.journalEntries[0].body, "家人今天剛修改的回憶。");
  assert.equal(requests.length, 4);
  assert.ok(requests.every((url) => !["trips", "list"].includes(url.searchParams.get("op") ?? "")));
});

test("missing trip returns null; transport failure cannot masquerade as missing", async () => {
  let failure = false;
  const request: typeof fetch = async (input) => {
    if (new URL(String(input)).searchParams.get("op") === "drive-access") return Response.json({ token: "test", folderId: "family" });
    return failure ? new Response("unavailable", { status: 503 }) : Response.json({ files: [] });
  };
  assert.equal(await trips.readDriveTrip(id, request), null);
  failure = true;
  await assert.rejects(trips.readDriveTrip(id, request));
});

test("invalid and held ids do not request storage; mismatched file content throws", async () => {
  const never: typeof fetch = async () => { throw new Error("storage must not be called"); };
  assert.equal(await trips.readDriveTrip("trip_../elsewhere", never), null);
  assert.equal(await trips.readDriveTrip("trip_kyoto_maple", never), null);
  const request: typeof fetch = async (input) => {
    const url = new URL(String(input));
    if (url.searchParams.get("op") === "drive-access") return Response.json({ token: "test", folderId: "family" });
    if (url.searchParams.has("q")) return Response.json({ files: [{ id: "wrong", name }] });
    return Response.json({ ...saved, id: "trip_other" });
  };
  await assert.rejects(trips.readDriveTrip(id, request));
});
