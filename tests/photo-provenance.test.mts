import assert from "node:assert/strict";
import test from "node:test";
import { decidePhotoGroup, provenanceFromMomentPhoto, type PhotoProvenance, type PhotoTrip } from "../lib/photo-provenance.ts";

const japan: PhotoTrip = { id: "japan", startDay: "2022-11-15", endDay: "2022-11-20", timeZone: "Asia/Tokyo", countryCodes: ["JP"] };
const photo: PhotoProvenance = {
  photoId: "original", capture: { source: "exif", takenAt: "2022-11-15T00:30:00+09:00", gps: { latitude: 35, longitude: 135 }, countryCode: "JP", placeId: "kyoto" },
  upload: { uploadedAt: "2026-09-13T12:00:00+08:00", gps: { latitude: 25, longitude: 121 }, countryCode: "TW" },
};

test("old Japan photo uploaded at home uses capture day/place, never upload location", () => {
  const before = JSON.stringify(photo);
  const result = decidePhotoGroup(photo, japan);
  assert.equal(result.status, "suggested");
  assert.equal(result.captureDay, "2022-11-15");
  assert.equal(result.placeId, "kyoto");
  assert.equal(result.tripId, "japan");
  assert.equal(JSON.stringify(photo), before);
});

test("France capture cannot join Japan even with a manually selected trip", () => {
  const result = decidePhotoGroup({ ...photo, capture: { ...photo.capture!, countryCode: "FR" }, manualTripId: "japan" }, japan);
  assert.equal(result.status, "review");
  assert.ok(result.reasons.includes("country-conflict"));
  assert.equal(result.tripId, null);
});

test("upload-only metadata and a nearby photo never establish a capture", () => {
  const result = decidePhotoGroup({ photoId: "unknown", upload: photo.upload, neighboringTripId: "japan" }, japan);
  assert.equal(result.status, "review");
  assert.equal(result.captureDay, null);
  assert.equal(result.tripId, null);
});

test("capture instant is evaluated in trip timezone at the date boundary", () => {
  assert.equal(decidePhotoGroup({ ...photo, capture: { ...photo.capture!, takenAt: "2022-11-14T15:30:00Z" } }, japan).captureDay, "2022-11-15");
  const result = decidePhotoGroup({ ...photo, capture: { ...photo.capture!, takenAt: "2022-11-14T14:30:00Z" } }, japan);
  assert.equal(result.status, "review");
  assert.ok(result.reasons.includes("date-conflict"));
});

test("timezone-less EXIF needs an explicit capture timezone", () => {
  const capture = { ...photo.capture!, takenAt: "2022:11:15 09:30:00" };
  assert.equal(decidePhotoGroup({ ...photo, capture }, japan).status, "review");
  assert.equal(decidePhotoGroup({ ...photo, capture: { ...capture, timeZone: "Asia/Tokyo" } }, japan).status, "suggested");
});

test("manual confirmation can assign missing metadata but cannot hide a date conflict", () => {
  assert.equal(decidePhotoGroup({ photoId: "scan", manualTripId: "japan" }, japan).status, "confirmed");
  assert.equal(decidePhotoGroup({ ...photo, manualTripId: "france" }, japan).status, "review");
  assert.equal(decidePhotoGroup({ ...photo, manualTripId: "japan", capture: { ...photo.capture!, takenAt: "2019-01-01T00:00:00Z" } }, japan).status, "review");
});

test("country text without capture GPS is insufficient; invalid dates never group", () => {
  assert.equal(decidePhotoGroup({ ...photo, capture: { ...photo.capture!, gps: undefined } }, japan).status, "review");
  assert.equal(decidePhotoGroup({ ...photo, capture: { ...photo.capture!, takenAt: "2022-02-30T00:00:00Z" } }, japan).status, "review");
});

test("stored photo adapter rejects legacy upload metadata and accepts only parsed capture evidence", () => {
  const stored = { id: "photo", momentId: "moment", storageKey: "original", originalFilename: "photo.jpg", originalStorageKey: null, createdAt: "2026-09-13T00:00:00Z", coordinates: { latitude: 35, longitude: 135 }, takenAt: "2022-11-15T00:30:00+09:00" };
  const labels = { countryCode: "JP", placeId: "kyoto", captureTimeZone: "Asia/Tokyo" };
  assert.equal(decidePhotoGroup(provenanceFromMomentPhoto(stored, labels), japan).status, "review");
  const verified = { ...stored, captureMetadataStatus: "verified" as const, captureMetadata: { source: "exif" as const, coordinates: stored.coordinates, takenAt: stored.takenAt, localTakenAt: "2022-11-15T00:30:00", offset: "+09:00" } };
  assert.equal(decidePhotoGroup(provenanceFromMomentPhoto(verified), japan).status, "review");
  assert.equal(decidePhotoGroup(provenanceFromMomentPhoto(verified, labels), japan).status, "suggested");
});
