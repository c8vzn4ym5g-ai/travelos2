import assert from "node:assert/strict";
import test from "node:test";
import * as upload from "../lib/capture-upload.ts";

function input(index: number) {
  return { display: new File(["d"], "display.jpg"), original: new File(["original"], "original.jpg"), momentId: `m${Math.floor(index / 40)}`, photoId: `p${index}`, pin: "" };
}

test("three 40-photo rounds share at most three original transfers and all completion promises settle", async () => {
  const previous = globalThis.fetch;
  let active = 0, maximum = 0;
  const release: Array<() => void> = [];
  globalThis.fetch = async () => new Promise<Response>(resolve => {
    active += 1; maximum = Math.max(maximum, active);
    release.push(() => { active -= 1; resolve(Response.json({ ok: true })); });
  });
  try {
    const results = Array.from({ length: 120 }, (_, index) => upload.uploadOriginalPhotoInBackground(input(index)));
    await new Promise(resolve => setImmediate(resolve));
    assert.ok(maximum <= 3, `observed ${maximum} simultaneous original transfers`);
    for (let round = 0; round < 40; round++) {
      release.splice(0).forEach(done => done());
      await new Promise(resolve => setImmediate(resolve));
    }
    const completed = await Promise.all(results);
    assert.equal(completed.length, 120);
    assert.ok(completed.every(result => result?.status === "uploaded"));
  } finally { globalThis.fetch = previous; }
});

test("stalled original rounds expire, reject overflow and release the queue for a later retry", async () => {
  const previous = globalThis.fetch;
  let active = 0, maximum = 0;
  globalThis.fetch = async (_url, init) => {
    active += 1; maximum = Math.max(maximum, active);
    init?.signal?.addEventListener("abort", () => { active -= 1; }, { once: true });
    return new Promise<Response>(() => {});
  };
  const send = upload.createOriginalPhotoUploader({ timeoutMs: 15 });
  try {
    const pending = Array.from({ length: 120 }, (_, index) => send(input(index)));
    const overflow = await send(input(121));
    assert.equal(overflow.status, "failed");
    assert.match(overflow.status === "failed" ? overflow.error : "", /佇列已滿/);
    const results = await Promise.all(pending);
    assert.ok(results.every(result => result.status === "failed"));
    assert.ok(maximum <= 3, "stalls cannot accumulate unbounded active requests");
    assert.equal(active, 0, "all started requests have been aborted");
    globalThis.fetch = async () => Response.json({ ok: true });
    assert.equal((await send(input(122))).status, "uploaded");
  } finally { globalThis.fetch = previous; }
});

test("awaitable original API rejects HTTP errors and cancellation; identical file skips network", async () => {
  const previous = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => { calls += 1; return new Response("failure", { status: 503 }); };
  try {
    await assert.rejects(upload.uploadOriginalPhoto(input(1)), /503/);
    const abort = new AbortController(); abort.abort();
    await assert.rejects(upload.uploadOriginalPhoto({ ...input(2), signal: abort.signal }), /取消|逾時/);
    const file = new File(["original"], "original.jpg");
    assert.equal((await upload.uploadOriginalPhoto({ ...input(3), original: file, display: file })).status, "skipped");
    assert.equal(calls, 1);
  } finally { globalThis.fetch = previous; }
});

test("audio network stalls and error-body stalls both terminate", async () => {
  const previous = globalThis.fetch;
  const args = { blob: new Blob(["audio"], { type: "audio/webm" }), momentId: "m-audio", pin: "", timeoutMs: 10 };
  try {
    globalThis.fetch = async () => new Promise<Response>(() => {});
    await assert.rejects(upload.uploadMomentAudio(args));
    globalThis.fetch = async () => ({ ok: false, status: 400, json: () => new Promise(() => {}) }) as Response;
    await assert.rejects(upload.uploadMomentAudio(args));
    globalThis.fetch = async () => Response.json({ error: "audio rejected" }, { status: 400 });
    await assert.rejects(upload.uploadMomentAudio(args), /audio rejected/);
  } finally { globalThis.fetch = previous; }
});
