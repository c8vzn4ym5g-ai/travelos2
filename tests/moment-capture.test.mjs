import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";

const root = resolve(import.meta.dirname, "..");

async function readSource(path) {
  return readFile(resolve(root, path), "utf8");
}

test("capture does not create trips and photos append to a moment", async () => {
  const [capture, momentsApi, photosApi, helpers] = await Promise.all([
    readSource("app/family/capture/page.tsx"),
    readSource("app/api/moments/route.ts"),
    readSource("app/api/moments/photos/route.ts"),
    readSource("lib/moments.ts"),
  ]);

  assert.match(capture, /appendMomentPhotos\(current, incoming\)/);
  assert.match(capture, /fetch\("\/api\/moments"/);
  assert.match(capture, /\/api\/moments\/photos/);
  assert.match(capture, /Save as Moment/);
  assert.doesNotMatch(capture, /\/api\/trips/);
  assert.doesNotMatch(capture, /buildPrivateCaptureTrip/);
  assert.doesNotMatch(capture, /visibility: "private"/);
  assert.match(momentsApi, /createTravelMoment/);
  assert.match(photosApi, /addPhotoToMoment\(momentId, photo\)/);
  assert.match(photosApi, /storeMomentBinary/);
  assert.match(helpers, /MOMENTS_BLOB_PATH = "travelos\/moments.json"/);
});

test("capture keeps camera and library, with retake and remove", async () => {
  const capture = await readSource("app/family/capture/page.tsx");
  const takePhotoIndex = capture.indexOf("Take Photo");
  const choosePhotosIndex = capture.indexOf("Choose Photos");
  const photosListIndex = capture.indexOf("{photos.length > 0 ? (");

  assert.match(capture, /capture="environment"/);
  assert.match(capture, /\smultiple\s/);
  assert.match(capture, />\s*Retake\s*</);
  assert.match(capture, />\s*Remove\s*</);
  assert.match(capture, /function retakePhoto/);
  assert.match(capture, /function removePhoto/);
  assert.notEqual(takePhotoIndex, -1);
  assert.notEqual(choosePhotosIndex, -1);
  assert.ok(takePhotoIndex < photosListIndex);
  assert.ok(choosePhotosIndex < photosListIndex);
  assert.equal((capture.match(/type="file"/g) ?? []).length, 2);
});

test("capture has no tag form and is named Capture", async () => {
  const capture = await readSource("app/family/capture/page.tsx");

  assert.match(capture, /<h1 className="travel-display mt-2 text-4xl font-semibold">Capture<\/h1>/);
  assert.match(capture, /心情 \/ Mood/);
  assert.doesNotMatch(capture, />People</);
  assert.doesNotMatch(capture, />Place</);
  assert.doesNotMatch(capture, />Food</);
  assert.doesNotMatch(capture, />Scenery</);
  assert.doesNotMatch(capture, />Topics</);
  assert.doesNotMatch(capture, /htmlFor="people"/);
  assert.doesNotMatch(capture, /遊記/);
  assert.doesNotMatch(capture, /私人旅程/);
  assert.doesNotMatch(capture, /Travel admin/);
});

test("family session is required and capture does not add a PIN form", async () => {
  const [family, unlock, capture, write, travelAdmin, coffeeAdmin] = await Promise.all([
    readSource("app/family/page.tsx"),
    readSource("app/family/family-unlock-panel.tsx"),
    readSource("app/family/capture/page.tsx"),
    readSource("app/trips/write/page.tsx"),
    readSource("app/trips/admin/page.tsx"),
    readSource("app/coffee/admin/page.tsx"),
  ]);

  assert.match(family, /href="\/family\/capture"/);
  assert.match(unlock, /id="family-pin"/);
  assert.match(unlock, /unlock\("\/family\/capture"\)/);
  assert.match(unlock, />\s*Capture\s*</);
  assert.match(capture, /FAMILY_ADMIN_SESSION_KEY/);
  assert.match(capture, /router\.replace\("\/family"\)/);
  assert.match(write, /router\.replace\("\/family"\)/);
  assert.doesNotMatch(capture, /type="password"/);
  assert.doesNotMatch(capture, /id="family-pin"/);
  assert.doesNotMatch(write, /type="password"/);

  for (const editor of [travelAdmin, coffeeAdmin, capture, write]) {
    assert.match(editor, /router\.replace\("\/family"\)/);
    assert.doesNotMatch(editor, /type="password"/);
  }
});

test("sit-and-write has no generated story and lists warehouse photos", async () => {
  const write = await readSource("app/trips/write/page.tsx");

  assert.match(write, /Moment assets/);
  assert.match(write, /<h1 className="travel-display mt-2 text-4xl font-semibold">Write<\/h1>/);
  assert.match(write, /value=\{draft\}/);
  assert.match(write, /method: "PUT"/);
  assert.match(write, /\/api\/moments/);
  assert.match(write, /aiSummary: null/);
  assert.doesNotMatch(write, /Write the memory here/);
  assert.doesNotMatch(write, /Dear diary/);
  assert.doesNotMatch(write, /Once upon/);
  assert.doesNotMatch(write, /A winter journey/);
  assert.doesNotMatch(write, /generated/);
  assert.doesNotMatch(write, /placeholder=/);
});

test("existing trips API is unchanged and capture cannot use it", async () => {
  const [tripsContent, tripsPhotos, capture, coffeeContent] = await Promise.all([
    readSource("app/api/trips/content/route.ts"),
    readSource("app/api/trips/photos/route.ts"),
    readSource("app/family/capture/page.tsx"),
    readSource("app/api/coffee/content/route.ts"),
  ]);

  assert.match(tripsContent, /export async function GET\(request: Request\)/);
  assert.match(tripsContent, /export async function POST\(request: Request\)/);
  assert.match(tripsContent, /export async function PUT\(request: Request\)/);
  assert.match(tripsContent, /Trip draft payload is required/);
  assert.match(tripsContent, /A trip with this title\/address already exists/);
  assert.doesNotMatch(tripsContent, /moment-store/);
  assert.doesNotMatch(tripsContent, /TravelMoment/);
  assert.match(tripsPhotos, /addPhotoToTrip\(tripId, photo\)/);
  assert.doesNotMatch(capture, /\/api\/trips\/content/);
  assert.doesNotMatch(capture, /\/api\/trips\/photos/);
  assert.match(coffeeContent, /export async function GET\(\)/);
  assert.doesNotMatch(coffeeContent, /export async function GET\(request: Request\)/);
});

test("iPhone HEIC converts or is accepted without blocking the capture preview", async () => {
  const [prepare, helpers, capture] = await Promise.all([
    readSource("lib/prepare-photo.ts"),
    readSource("lib/moments.ts"),
    readSource("app/family/capture/page.tsx"),
  ]);

  assert.match(helpers, /image\/heic/);
  assert.match(helpers, /heicJpegFilename/);
  assert.match(prepare, /isHeicPhoto\(file\)/);
  assert.match(prepare, /convertPhonePhotoToJpeg/);
  assert.match(prepare, /canvas\.toBlob\(resolve, "image\/jpeg"/);
  assert.match(prepare, /maxUploadBytes = 4_500_000/);
  assert.match(capture, /image\/heic,image\/heif,\.heic,\.heif/);
  assert.match(capture, /preparePhotoForUpload/);
  assert.match(capture, /URL\.createObjectURL\(file\)/);
  const addIndex = capture.indexOf("function addIncomingFiles");
  const saveIndex = capture.indexOf("async function saveMoment");
  const prepareIndex = capture.indexOf("preparePhotoForUpload(");
  assert.ok(addIndex !== -1 && saveIndex !== -1 && prepareIndex !== -1);
  assert.ok(addIndex < saveIndex);
  assert.ok(prepareIndex > saveIndex);
});
