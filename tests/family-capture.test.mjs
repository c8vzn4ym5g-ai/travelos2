import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";

const root = resolve(import.meta.dirname, "..");

async function readSource(path) {
  return readFile(resolve(root, path), "utf8");
}

test("capture controls remain after adding a photo", async () => {
  const capture = await readSource("app/family/capture/page.tsx");
  const takePhotoIndex = capture.indexOf("Take Photo");
  const choosePhotosIndex = capture.indexOf("Choose Photos");
  const photosListIndex = capture.indexOf("{photos.length > 0 ? (");

  assert.match(capture, /appendCapturePhotos\(current, incoming\)/);
  assert.match(capture, /capture="environment"/);
  assert.match(capture, /\smultiple\s/);
  assert.notEqual(takePhotoIndex, -1);
  assert.notEqual(choosePhotosIndex, -1);
  assert.ok(takePhotoIndex < photosListIndex);
  assert.ok(choosePhotosIndex < photosListIndex);
  assert.equal((capture.match(/type="file"/g) ?? []).length, 2);
});

test("new capture trips are private and leave the public Lapland trip untouched", async () => {
  const [helpers, capture, photosApi] = await Promise.all([
    readSource("lib/family-capture.ts"),
    readSource("app/family/capture/page.tsx"),
    readSource("app/api/trips/photos/route.ts"),
  ]);

  assert.match(helpers, /visibility: "private"/);
  assert.match(helpers, /trip_moment/);
  assert.match(helpers, /family-moment-/);
  assert.match(helpers, /PUBLIC_LAPLAND_TRIP_ID = "trip_lapland_2020"/);
  assert.match(helpers, /PUBLIC_LAPLAND_SLUG = "finland-lapland-winter-journal-2020"/);
  assert.match(capture, /isProtectedPublicLaplandTrip/);
  assert.match(capture, /method: "POST"/);
  assert.match(capture, /\/api\/trips\/photos/);
  assert.match(capture, /method: "PUT"/);
  assert.match(capture, /attachCaptureJournal/);
  assert.doesNotMatch(capture, /trip_lapland_2020/);
  assert.doesNotMatch(capture, /finland-lapland-winter-journal-2020/);
  assert.match(photosApi, /addPhotoToTrip\(tripId, photo\)/);
});

test("family capture reuses the family PIN session and does not add a department PIN form", async () => {
  const [family, unlock, capture, travelAdmin, coffeeAdmin] = await Promise.all([
    readSource("app/family/page.tsx"),
    readSource("app/family/family-unlock-panel.tsx"),
    readSource("app/family/capture/page.tsx"),
    readSource("app/trips/admin/page.tsx"),
    readSource("app/coffee/admin/page.tsx"),
  ]);

  assert.match(family, /href="\/family\/capture"/);
  assert.match(unlock, /id="family-pin"/);
  assert.match(unlock, /unlock\("\/family\/capture"\)/);
  assert.match(capture, /router\.replace\("\/family"\)/);
  assert.match(capture, /FAMILY_ADMIN_SESSION_KEY/);
  assert.doesNotMatch(capture, /type="password"/);
  assert.doesNotMatch(capture, /id="family-pin"/);
  assert.doesNotMatch(capture, /function verifyPin/);

  for (const editor of [travelAdmin, coffeeAdmin, capture]) {
    assert.match(editor, /router\.replace\("\/family"\)/);
    assert.doesNotMatch(editor, /type="password"/);
  }
});

test("iPhone HEIC photos convert to JPEG before the existing 4.5MB compression path", async () => {
  const [prepare, helpers, capture, travelAdmin] = await Promise.all([
    readSource("lib/prepare-photo.ts"),
    readSource("lib/family-capture.ts"),
    readSource("app/family/capture/page.tsx"),
    readSource("app/trips/admin/page.tsx"),
  ]);

  assert.match(helpers, /image\/heic/);
  assert.match(helpers, /image\/heif/);
  assert.match(helpers, /heicJpegFilename/);
  assert.match(prepare, /isHeicPhoto\(file\)/);
  assert.match(prepare, /convertPhonePhotoToJpeg/);
  assert.match(prepare, /canvas\.toBlob\(resolve, "image\/jpeg"/);
  assert.match(prepare, /maxUploadBytes = 4_500_000/);
  assert.match(prepare, /resizeJpegPngWebp/);
  assert.match(capture, /image\/heic,image\/heif,\.heic,\.heif/);
  assert.match(capture, /preparePhotoForUpload/);
  assert.match(travelAdmin, /Please use JPG, PNG, or WebP\. Phone HEIC photos need to be converted before upload\./);
  assert.doesNotMatch(travelAdmin, /capture=/);
  assert.doesNotMatch(travelAdmin, /\smultiple\s/);
});

test("coffee content GET requires the same admin PIN as trips GET", async () => {
  const [coffee, trips, coffeeAdmin] = await Promise.all([
    readSource("app/api/coffee/content/route.ts"),
    readSource("app/api/trips/content/route.ts"),
    readSource("app/coffee/admin/page.tsx"),
  ]);

  assert.match(coffee, /export async function GET\(request: Request\)/);
  assert.match(coffee, /x-travelos-admin-pin/);
  assert.match(coffee, /Invalid admin PIN/);
  assert.match(trips, /export async function GET\(request: Request\)/);
  assert.match(coffeeAdmin, /"x-travelos-admin-pin": sessionPin/);
});
