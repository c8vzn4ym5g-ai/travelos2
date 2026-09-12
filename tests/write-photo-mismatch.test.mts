import assert from "node:assert/strict";
import test from "node:test";
import { reviewPhotoDistance } from "../lib/write-photo-mismatch.ts";
import type { MomentPhoto } from "../lib/types.ts";
const photo = (latitude: number, longitude: number, verified = true) => ({ id: "one", coordinates: { latitude, longitude }, captureMetadataStatus: verified ? "verified" : "unknown", captureMetadata: verified ? { source: "exif", coordinates: { latitude, longitude }, takenAt: null, localTakenAt: null, offset: null } : null }) as MomentPhoto;
test("verified France-position photo warns for Japan, while Kyushu nearby position does not", () => {
  const far = reviewPhotoDistance([photo(48.85, 2.35)], { latitude: 35.68, longitude: 139.69 });
  assert.equal(far.length, 1);
  assert.ok(far[0].distanceKm > 9000 && far[0].distanceKm < 11000);
  assert.equal(reviewPhotoDistance([photo(33.59, 130.4)], { latitude: 33, longitude: 131 }).length, 0);
});
test("unknown GPS never borrows legacy/upload positions; missing trip marker does not create a conflict", () => {
  assert.deepEqual(reviewPhotoDistance([photo(48.85, 2.35, false)], { latitude: 35.68, longitude: 139.69 }), []);
  assert.deepEqual(reviewPhotoDistance([photo(48.85, 2.35)], null), []);
});
