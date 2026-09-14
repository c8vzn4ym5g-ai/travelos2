import assert from "node:assert/strict";
import test from "node:test";
import {editingReturn, pageFailure} from "../lib/page-failure.ts";
import {POST} from "../app/api/page-failure/route.ts";
test("page failures identify the affected area without including URL keys or private content", async () => {
  assert.equal(editingReturn("?returnTo=" + encodeURIComponent("/trips/kyushu?id=trip_kyushu")), "/trips/kyushu?id=trip_kyushu");
  assert.equal(editingReturn("?returnTo=https://example.com"), "/trips");
  assert.equal(editingReturn("?returnTo=/trips/admin"), "/trips");
  assert.deepEqual(pageFailure({message:"Loading chunk 123 failed",digest:"42"},"/trips/admin?preview=secret"),{kind:"page-update",area:"editor",digest:"42"});
  assert.equal(pageFailure({message:"讀取遊記逾時"},"/trips/private-title").kind,"read-timeout");
  const lines: unknown[][] = [];
  const previous = console.error;
  console.error = (...args) => {lines.push(args);};
  try {
    const response = await POST(new Request("http://localhost/api/page-failure",{method:"POST",body:JSON.stringify({
      id:"12345678-1234-1234-1234-123456789abc",area:"editor",kind:"render-failed",message:"private text",url:"?preview=secret"
    })}));
    assert.equal(response.status,204);
    assert.equal(lines.length,1);
    assert.doesNotMatch(JSON.stringify(lines),/private text|preview=secret/);
  } finally {console.error=previous;}
});
