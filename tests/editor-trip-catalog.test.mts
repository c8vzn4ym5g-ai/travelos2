import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import test from "node:test";
import { readEditorTripCatalog, patchEditorTripCatalog } from "../lib/editor-trip-catalog.ts";
import { resetDriveWarehouseForTests, setDriveWarehouseFetchForTests } from "../lib/drive-warehouse.ts";
import { GET } from "../app/api/trips/catalog/route.ts";
import { saveDriveTripWithCatalog } from "../lib/drive-trips.ts";
import type { TripDetail } from "../lib/types.ts";

const row = { id: "trip_family", title: "家人的新標題", startDate: "2026-01-01", endDate: "2026-01-02", updatedAt: "2026-09-13T10:00:00Z" };

test("public projection repair preserves a saved trip and retries sync by id only", async () => {
  let writes = 0; let repairs = 0;
  setDriveWarehouseFetchForTests(async (_input, init) => {
    const payload = JSON.parse(String(init?.body));
    if (payload.op === "trip") { writes++; return Response.json({ ok: true, publicHubWarning: true }); }
    if (payload.op === "public-hub-sync") {
      repairs++;
      assert.equal(payload.id, row.id);
      assert.equal(payload.text, undefined, "repair rereads the saved trip, not an old client payload");
      return Response.json({ error: "temporarily unavailable" });
    }
    assert.equal(payload.op, "editor-catalog");
    return Response.json({ ok: true });
  });
  try {
    const result = await saveDriveTripWithCatalog({ ...row, photos: [], journalEntries: [] } as unknown as TripDetail);
    assert.equal(result.trip.updatedAt, row.updatedAt);
    assert.match(result.warning ?? "", /已儲存.*公開/);
    await new Promise(resolve => setTimeout(resolve, 10));
    assert.equal(writes, 1);
    assert.equal(repairs, 2);
  } finally { resetDriveWarehouseForTests(); }
});

test("durable trip save keeps its ACK and version when the derived catalog fails", async () => {
  let saved: unknown;
  let catalogCalls = 0;
  setDriveWarehouseFetchForTests(async (_input, init) => {
    const payload = JSON.parse(String(init?.body));
    if (payload.op === "trip") { saved = JSON.parse(payload.text); return Response.json({ ok: true }); }
    assert.equal(payload.op, "editor-catalog");
    catalogCalls++;
    return Response.json({ error: "temporarily unavailable" });
  });
  try {
    const result = await saveDriveTripWithCatalog({ ...row, photos: [], journalEntries: [] } as unknown as TripDetail);
    assert.equal(result.trip.updatedAt, row.updatedAt);
    assert.equal((saved as typeof row).title, row.title);
    assert.match(result.warning ?? "", /已儲存/);
    await new Promise((resolve) => setTimeout(resolve, 10));
    assert.equal(catalogCalls, 2, "one initial patch and one repair only");
  } finally { resetDriveWarehouseForTests(); }
});

test("catalog route reads one small persisted catalog and returns only the five header fields", async () => {
  let calls = 0;
  setDriveWarehouseFetchForTests(async (input) => {
    calls++;
    assert.equal(new URL(String(input)).searchParams.get("op"), "editor-catalog");
    return Response.json({ trips: [{ ...row, photos: [{ id: "secret-bulk" }], journalEntries: ["large"], publishedSnapshot: {} }] });
  });
  try {
    const response = await GET(new Request("https://travelos.test/api/trips/catalog"));
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { trips: [row] });
    assert.equal(calls, 1, "must not read trip media, full shelf, or seed bodies");
  } finally { resetDriveWarehouseForTests(); }
});

test("missing catalog is explicit failure and save patch contains no story or photo payload", async () => {
  let body: Record<string, unknown> | undefined;
  const request: typeof fetch = async (_input, init) => {
    if (init?.method === "POST") { body = JSON.parse(String(init.body)); return Response.json({ ok: true }); }
    return Response.json({ error: "editor catalog not initialized" });
  };
  await assert.rejects(readEditorTripCatalog(request), /目錄/);
  await patchEditorTripCatalog([{ ...row, photos: ["not sent"] } as typeof row], request);
  assert.equal(body?.op, "editor-catalog");
  assert.deepEqual(body?.trips, [row]);
});

test("Apps Script catalog patches share lock, preserve unrelated rows, and ignore delayed old titles", async () => {
  const source = await readFile(new URL("../scripts/drive-warehouse-apps-script.js", import.meta.url), "utf8");
  let stored: string | null = null;
  let locked = false;
  const writes: string[] = [];
  const file = { getBlob: () => ({ getDataAsString: () => stored }), setContent: (text: string) => { assert.equal(locked, true); stored = text; writes.push(text); } };
  const context = vm.createContext({ LockService: { getScriptLock: () => ({ waitLock: () => { locked = true; }, releaseLock: () => { locked = false; } }) } });
  vm.runInContext(source, context);
  context.tokenOk_ = () => true;
  context.json_ = (value: unknown) => JSON.parse(JSON.stringify(value));
  context.folder_ = () => ({
    getFilesByName: (name: string) => { assert.equal(name, "travelos__editor_catalog.json"); let available = stored !== null; return { hasNext: () => available, next: () => { available = false; return file; } }; },
    createFile: (_name: string, text: string) => { assert.equal(locked, true); stored = text; writes.push(text); },
  });
  const patch = (trips: unknown[]) => context.doPost({ postData: { contents: JSON.stringify({ op: "editor-catalog", trips }) } });
  patch([{ ...row, photos: ["not stored"] }]);
  patch([{ ...row, id: "trip_other", title: "另一趟" }]);
  patch([{ ...row, title: "outdated", updatedAt: "2020-01-01T00:00:00Z" }]);
  const loaded = context.doGet({ parameter: { op: "editor-catalog" } });
  assert.deepEqual(loaded.trips, [row, { ...row, id: "trip_other", title: "另一趟" }]);
  assert.equal(writes.length, 3);
  assert.equal(locked, false);
});
