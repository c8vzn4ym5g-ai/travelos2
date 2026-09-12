import assert from "node:assert/strict";
import test from "node:test";
import { selectWriteMoment } from "../lib/write-moment-target.ts";
test("bench link opens the exact batch, not the most recent unrelated batch", () => {
  const moments = [{ id: "france" }, { id: "japan" }];
  assert.equal(selectWriteMoment(moments, "japan")?.id, "japan");
  assert.equal(selectWriteMoment(moments, "missing"), null);
  assert.equal(selectWriteMoment(moments, ""), null);
  assert.equal(selectWriteMoment(moments, null)?.id, "france");
});
