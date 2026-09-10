import assert from "node:assert/strict";
import test from "node:test";
import {
  isTravelosMediaKey,
  TRAVELOS_MEDIA_BINDING,
  TRAVELOS_MEDIA_BUCKET,
  TRAVELOS_MEDIA_PROBE_BODY,
  TRAVELOS_MEDIA_PROBE_KEY,
  travelosMediaUrl,
} from "../lib/r2-media.ts";

test("R2 media keys reject path escape and empty values", () => {
  assert.equal(isTravelosMediaKey(TRAVELOS_MEDIA_PROBE_KEY), true);
  assert.equal(isTravelosMediaKey("shorts/demo.mp4"), true);
  assert.equal(isTravelosMediaKey(""), false);
  assert.equal(isTravelosMediaKey("../secret"), false);
  assert.equal(isTravelosMediaKey("a/../b"), false);
  assert.equal(isTravelosMediaKey("trailing/"), false);
});

test("R2 media URL is the Worker GET /api/media helper, not r2.dev", () => {
  assert.equal(TRAVELOS_MEDIA_BINDING, "TRAVELOS_MEDIA");
  assert.equal(TRAVELOS_MEDIA_BUCKET, "travelos-media");
  assert.equal(
    travelosMediaUrl(TRAVELOS_MEDIA_PROBE_KEY, "https://travelos2.chao-jason.workers.dev"),
    "https://travelos2.chao-jason.workers.dev/api/media?key=probe%2Fok.txt",
  );
  assert.match(TRAVELOS_MEDIA_PROBE_BODY, /travelos-media ok/);
});
