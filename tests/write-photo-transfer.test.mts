import assert from "node:assert/strict";
import test from "node:test";
import { transferWritingToTrip } from "../lib/write-photo-transfer.ts";
import type { MomentPhoto, TripDetail } from "../lib/types.ts";

const trip = { id: "trip_japan", photos: [], journalEntries: [], updatedAt: "old" } as unknown as TripDetail;
const photo: MomentPhoto = { id: "source", momentId: "batch", storageKey: "display", originalStorageKey: "original.heic", originalFilename: "one.heic", createdAt: "2026-09-13T00:00:00Z", takenAt: "2026-09-13T00:00:00Z", coordinates: { latitude: 25, longitude: 121 } };
const input = { trip, photos: [photo], draft: "只去了 E", sourceKey: "moment:batch", now: "2026-09-13T10:00:00Z" };
test("selected photo and original reference transfer with writing, without inventing event date or place", () => {
  const result = transferWritingToTrip(input);
  assert.equal(result.photos.length, 1);
  assert.equal(result.photos[0].originalStorageKey, "original.heic");
  assert.equal(result.photos[0].storageKey, "display");
  assert.equal(result.photos[0].coordinates, null);
  assert.equal(result.photos[0].takenAt, null);
  assert.equal(result.journalEntries[0].entryDate, "");
  assert.equal(result.journalEntries[0].body, "只去了 E");
  assert.equal(result.journalEntries[0].storyPhotoId, result.photos[0].id);
  assert.deepEqual(trip.photos, []);
});
test("capture local date survives late upload; saving the same source again updates without duplicates", () => {
  const capture = { source: "exif" as const, localTakenAt: "2022-11-15T09:00:00", takenAt: "2022-11-15T00:00:00Z", offset: "+09:00", coordinates: { latitude: 35, longitude: 135 } };
  const first = transferWritingToTrip({ ...input, photos: [{ ...photo, captureMetadataStatus: "verified", captureMetadata: capture }] });
  assert.equal(first.journalEntries[0].entryDate, "2022-11-15");
  const second = transferWritingToTrip({ ...input, trip: first, photos: [{ ...photo, captureMetadataStatus: "verified", captureMetadata: capture }], draft: "更新的家人文字" });
  assert.equal(second.photos.length, 1);
  assert.equal(second.journalEntries.length, 1);
  assert.equal(second.journalEntries[0].body, "更新的家人文字");
});
test("multiple capture days or missing capture evidence leave event date undecided", () => {
  const known = { ...photo, captureMetadataStatus: "verified" as const, captureMetadata: { source: "exif" as const, localTakenAt: "2022-11-15T09:00:00", takenAt: null, offset: null, coordinates: null } };
  const result = transferWritingToTrip({ ...input, photos: [known, { ...photo, id: "unknown", storageKey: "other" }] });
  assert.equal(result.journalEntries[0].entryDate, "");
  assert.equal(result.photos.length, 2);
});
