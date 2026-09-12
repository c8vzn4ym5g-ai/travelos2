import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { readOriginalCaptureMetadata, captureMetadataPhotoFields } from "../lib/original-capture-metadata.ts";
import { addMoment, addPhotoToMoment, setPhotoOriginal, readMoments, resetMomentStoreForTests } from "../lib/moment-store.ts";
import { createTravelMoment, mergeMomentPhoto } from "../lib/moments.ts";

test("original JPEG yields true GPS and local date without inventing a timezone", async () => {
  const original = await readFile(new URL("./fixtures/exif/capture.jpg", import.meta.url));
  const before = Buffer.from(original);
  const metadata = await readOriginalCaptureMetadata(new Blob([original]));
  assert.equal(metadata?.localTakenAt, "2018-07-25T16:34:23");
  assert.equal(metadata?.takenAt, null);
  assert.equal(metadata?.offset, null);
  assert.ok(Math.abs(metadata!.coordinates!.latitude - 50.29960277777778) < 0.000001);
  assert.deepEqual(original, before);
});

test("original iPhone HEIC preserves actual capture offset and GPS", async () => {
  const original = await readFile(new URL("./fixtures/exif/capture.heic", import.meta.url));
  const metadata = await readOriginalCaptureMetadata(new Blob([original], { type: "image/heic" }));
  assert.equal(metadata?.localTakenAt, "2019-10-20T18:34:30");
  assert.equal(metadata?.offset, "+02:00");
  assert.equal(metadata?.takenAt, "2019-10-20T16:34:30.000Z");
  assert.ok(Math.abs(metadata!.coordinates!.longitude - 12.994411111111111) < 0.000001);
  assert.equal(captureMetadataPhotoFields(metadata).captureMetadataStatus, "verified");
});

test("unknown or stripped display image is nonblocking and cannot verify a capture", async () => {
  const metadata = await readOriginalCaptureMetadata(new Blob(["no exif here"]));
  assert.equal(metadata, null);
  assert.deepEqual(captureMetadataPhotoFields(metadata), {});
});

test("later original enrichment persists verified capture without replacing family note or display", async () => {
  resetMomentStoreForTests();
  try {
    const moment = createTravelMoment({ id: "moment_exif_test", note: "家人剛寫的文字", time: null });
    await addMoment(moment);
    await addPhotoToMoment(moment.id, {
      id: "photo", momentId: moment.id, storageKey: "display-kept", originalStorageKey: null,
      originalFilename: "family.heic", takenAt: null, coordinates: null,
      uploadCoordinates: { latitude: 25, longitude: 121 }, fileModifiedAt: "2026-09-13T00:00:00Z",
      captureMetadataStatus: "unknown", createdAt: "2026-09-13T00:00:00Z",
    });
    const bytes = await readFile(new URL("./fixtures/exif/capture.heic", import.meta.url));
    const capture = await readOriginalCaptureMetadata(new Blob([bytes]));
    const saved = await setPhotoOriginal(moment.id, "photo", "original-kept", capture);
    assert.equal(saved?.photo.captureMetadataStatus, "verified");
    const restored = (await readMoments()).content.moments.find((item) => item.id === moment.id)!;
    assert.equal(restored.note, "家人剛寫的文字");
    assert.equal(restored.photos[0].storageKey, "display-kept");
    assert.equal(restored.photos[0].originalStorageKey, "original-kept");
    assert.equal(restored.photos[0].takenAt, "2019-10-20T16:34:30.000Z");
    assert.deepEqual(restored.photos[0].uploadCoordinates, { latitude: 25, longitude: 121 });
  } finally { resetMomentStoreForTests(); }
});

test("a delayed unverified display never downgrades original EXIF or fills its unknown timezone", () => {
  const base = { id: "photo", momentId: "moment", storageKey: "display", originalStorageKey: null, originalFilename: "one.jpg", createdAt: "2026-09-13T00:00:00Z", takenAt: "2026-09-13T00:00:00Z", coordinates: { latitude: 25, longitude: 121 } };
  const capture = { source: "exif" as const, localTakenAt: "2018-07-25T16:34:23", offset: null, takenAt: null, coordinates: null };
  const verified = { ...base, ...captureMetadataPhotoFields(capture), captureMetadataStatus: "verified" as const };
  const delayed = { ...base, captureMetadataStatus: "unknown" as const };
  for (const [left, right] of [[verified, delayed], [delayed, verified]]) {
    const merged = mergeMomentPhoto(left, right);
    assert.equal(merged.captureMetadataStatus, "verified");
    assert.equal(merged.takenAt, null);
    assert.equal(merged.coordinates, null);
    assert.deepEqual(merged.captureMetadata, capture);
  }
});

test("photo POST derives capture from actual HEIC bytes and ignores spoofed form capture values", async () => {
  resetMomentStoreForTests();
  const previousPin = process.env.TRAVELOS_ADMIN_PIN;
  delete process.env.TRAVELOS_ADMIN_PIN;
  try {
    const moment = createTravelMoment({ id: "moment_exif_api", note: "", time: null });
    await addMoment(moment);
    const { POST } = await import("../app/api/moments/photos/route.ts");
    const bytes = await readFile(new URL("./fixtures/exif/capture.heic", import.meta.url));
    const form = new FormData();
    form.set("momentId", moment.id);
    form.set("file", new File([bytes], "original.heic", { type: "image/heic" }));
    form.set("takenAt", "2026-09-13T00:00:00Z");
    form.set("latitude", "25"); form.set("longitude", "121");
    form.set("captureMetadataStatus", "verified");
    const response = await POST(new Request("http://travelos.local/api/moments/photos", { method: "POST", body: form }));
    assert.equal(response.status, 200);
    const result = await response.json();
    assert.equal(result.photo.captureMetadataStatus, "verified");
    assert.equal(result.photo.takenAt, "2019-10-20T16:34:30.000Z");
    assert.deepEqual(result.photo.uploadCoordinates, { latitude: 25, longitude: 121 });
    assert.ok(Math.abs(result.photo.coordinates.latitude - 38.046641666666666) < 0.000001);
    form.set("file", new File(["no-exif"], "unknown.jpg", { type: "image/jpeg" }));
    const unknown = await POST(new Request("http://travelos.local/api/moments/photos", { method: "POST", body: form }));
    assert.equal(unknown.status, 200);
    const unknownPhoto = (await unknown.json()).photo;
    assert.equal(unknownPhoto.captureMetadataStatus, "unknown");
    assert.equal(unknownPhoto.coordinates, null);
    assert.equal(unknownPhoto.takenAt, null);
  } finally {
    if (previousPin === undefined) delete process.env.TRAVELOS_ADMIN_PIN;
    else process.env.TRAVELOS_ADMIN_PIN = previousPin;
    resetMomentStoreForTests();
  }
});
