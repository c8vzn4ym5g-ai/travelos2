import assert from "node:assert/strict";
import test from "node:test";
import { DriveWarehouseError, getIndex, putItem, setDriveWarehouseFetchForTests, setDriveWarehouseRpcTimeoutForTests } from "../lib/drive-warehouse.ts";
import { resetMomentStoreForTests, setMomentAudio } from "../lib/moment-store.ts";
import { createTravelMoment } from "../lib/moments.ts";

const never = () => new Promise<Response>(() => {});
const timeoutError = (error: unknown) => error instanceof DriveWarehouseError && /timed out/.test(error.message);

for (const phase of ["request", "redirect", "body"] as const) {
  test(`RPC deadline includes ${phase} even when the transport ignores abort`, { timeout: 500 }, async () => {
    resetMomentStoreForTests();
    setDriveWarehouseRpcTimeoutForTests(20);
    const signals: AbortSignal[] = [];
    let calls = 0;
    setDriveWarehouseFetchForTests(async (_input, init) => {
      if (init?.signal) signals.push(init.signal);
      calls++;
      if (phase === "request" || (phase === "redirect" && calls > 1)) return never();
      if (phase === "redirect") return new Response(null, { status: 302, headers: { location: "https://script.googleusercontent.com/result" } });
      return new Response(new ReadableStream({ start() {} }), { headers: { "content-type": "application/json" } });
    });
    try {
      await assert.rejects(phase === "body" ? putItem("item.json", "{}") : getIndex(), timeoutError);
      assert.ok(signals.length > 0);
      assert.ok(signals.every((signal) => signal.aborted));
    } finally { resetMomentStoreForTests(); }
  });
}

test("a timed out item POST releases the store queue for the next audio save", { timeout: 500 }, async () => {
  resetMomentStoreForTests();
  setDriveWarehouseRpcTimeoutForTests(20);
  let shard = JSON.stringify({ moment: createTravelMoment({ id: "moment_timeout", note: "family note" }) });
  let writes = 0;
  setDriveWarehouseFetchForTests(async (_input, init) => {
    if ((init?.method ?? "GET") === "GET") return new Response(shard, { headers: { "content-type": "application/json" } });
    const payload = JSON.parse(String(init?.body));
    if (payload.op === "item") {
      writes++;
      if (writes === 1) return never();
      shard = payload.text;
    }
    return Response.json({ ok: true });
  });
  try {
    const first = setMomentAudio("moment_timeout", "drive:stalled");
    const second = setMomentAudio("moment_timeout", "drive:saved", { transcript: "actual voice" });
    await assert.rejects(first, timeoutError);
    assert.equal((await second)?.moment.originalAudioUrl, "drive:saved");
    assert.equal(JSON.parse(shard).moment.transcript, "actual voice");
    assert.equal(writes, 2, "uncertain writes must not be automatically retried");
  } finally { resetMomentStoreForTests(); }
});
