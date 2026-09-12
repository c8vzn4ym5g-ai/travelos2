import assert from "node:assert/strict";
import test from "node:test";
import { photoProvenanceDisplay } from "../lib/photo-provenance-display.ts";

const photo = { id: "one", momentId: "moment", storageKey: "image", originalFilename: "one.jpg", originalStorageKey: null, createdAt: "2026-09-13T00:00:00Z", takenAt: "2022-11-15T00:00:00Z", coordinates: { latitude: 35, longitude: 135 } };
test("legacy date and GPS are not presented as known capture facts", () => {
  const display = photoProvenanceDisplay(photo);
  assert.equal(display.location, "拍攝地點待確認");
  assert.equal(display.captureTime, "拍攝時間待確認");
  assert.ok(display.uploadTime?.includes("2026"));
});
test("actual source date is shown separately from later upload; GPS does not invent a place name", () => {
  const display = photoProvenanceDisplay({ ...photo, captureMetadataStatus: "verified", captureMetadata: { source: "exif", localTakenAt: "2022-11-15T09:00:00", takenAt: null, offset: null, coordinates: photo.coordinates } });
  assert.equal(display.captureTime, "拍攝 2022-11-15 09:00");
  assert.equal(display.location, "拍攝位置已保留");
  assert.ok(display.uploadTime?.includes("2026"));
});
