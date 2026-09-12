import assert from "node:assert/strict";
import test from "node:test";
import { loadWriteMoments } from "../lib/write-moment-load.ts";

test("a supplied batch loads directly even when the warehouse catalog is empty", async () => {
  const calls: string[] = [];
  const loaded = await loadWriteMoments("japan batch", {}, async input => {
    calls.push(String(input));
    return String(input) === "/api/moments?id=japan%20batch"
      ? Response.json({ moment: { id: "japan batch", photos: [{ id: "heic-photo" }] } })
      : Response.json({ content: { moments: [], jobs: [] } });
  });
  assert.deepEqual(calls, ["/api/moments?id=japan%20batch"]);
  assert.equal(loaded.moments[0].photos[0].id, "heic-photo");
  assert.deepEqual(loaded.jobs, []);
});

test("no target retains the full warehouse and jobs", async () => {
  const result = await loadWriteMoments(null, {}, async input => {
    assert.equal(input, "/api/moments");
    return Response.json({ content: { moments: [{ id: "one" }], jobs: [{ id: "job" }] } });
  });
  assert.equal(result.moments[0].id, "one");
  assert.equal(result.jobs[0].id, "job");
});

test("missing or mismatched explicit target fails without opening another batch", async () => {
  let calls = 0;
  await assert.rejects(loadWriteMoments("missing", {}, async () => { calls += 1; return new Response(null, { status: 404 }); }), /找不到指定/);
  assert.equal(calls, 1);
  await assert.rejects(loadWriteMoments("japan", {}, async () => Response.json({ moment: { id: "france" } })), /回應不符/);
  await assert.rejects(loadWriteMoments("", {}, async () => { throw new Error("must not request catalog"); }), /連結不完整/);
  await assert.rejects(loadWriteMoments(null, {}, async () => Response.json({ error: "failed" })), /清單尚未讀取完成/);
});
