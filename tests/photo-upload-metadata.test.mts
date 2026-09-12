import assert from "node:assert/strict";
import test from "node:test";
import { photoUploadMetadata } from "../lib/photo-upload-metadata.ts";
import { uploadDisplayPhoto } from "../lib/capture-upload.ts";

test("old clients' device GPS and file time are retained separately, never as capture", () => {
  const form = new FormData();
  form.set("latitude", "25.03"); form.set("longitude", "121.56");
  form.set("takenAt", "2022-11-15T08:00:00Z");
  assert.deepEqual(photoUploadMetadata(form), {
    takenAt: null, coordinates: null, captureMetadataStatus: "unknown",
    uploadCoordinates: { latitude: 25.03, longitude: 121.56 }, fileModifiedAt: "2022-11-15T08:00:00.000Z",
  });
});

test("missing or malformed metadata does not block a binary upload or become 0,0", () => {
  for (const form of [new FormData(), new FormData()]) {
    form.set("fileModifiedAt", "unknown");
    form.set("uploadLatitude", "");
    const result = photoUploadMetadata(form);
    assert.equal(result.uploadCoordinates, null);
    assert.equal(result.fileModifiedAt, null);
    assert.equal(result.takenAt, null);
  }
});

test("client sends device/file provenance explicitly and successfully uploads without EXIF", async () => {
  const originalFetch = globalThis.fetch;
  let sent = false;
  globalThis.fetch = async (_input, init) => {
    const form = init?.body as FormData;
    sent = true;
    assert.equal(form.get("takenAt"), null);
    assert.equal(form.get("latitude"), null);
    assert.equal(form.get("uploadLatitude"), "25");
    assert.equal(form.get("uploadLongitude"), "121");
    assert.equal(form.get("fileModifiedAt"), "2022-11-15T08:00:00Z");
    assert.ok(form.get("file") instanceof Blob);
    return Response.json({ photo: { id: "received", ...photoUploadMetadata(form) } });
  };
  try {
    const result = await uploadDisplayPhoto({
      file: new File(["small-original"], "photo.jpg", { type: "image/jpeg" }),
      momentId: "moment-existing", coordinates: { latitude: 25, longitude: 121 },
      takenAt: "2022-11-15T08:00:00Z", pin: "",
    });
    assert.equal(sent, true);
    assert.equal(result.photo.id, "received");
    assert.equal(result.photo.takenAt, null);
  } finally { globalThis.fetch = originalFetch; }
});
