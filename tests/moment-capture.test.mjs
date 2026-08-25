import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";

const root = resolve(import.meta.dirname, "..");

async function readSource(path) {
  return readFile(resolve(root, path), "utf8");
}

test("capture does not create trips and photos append to a moment", async () => {
  const [capture, upload, momentsApi, photosApi, helpers] = await Promise.all([
    readSource("app/family/capture/page.tsx"),
    readSource("lib/capture-upload.ts"),
    readSource("app/api/moments/route.ts"),
    readSource("app/api/moments/photos/route.ts"),
    readSource("lib/moments.ts"),
  ]);

  assert.match(capture, /appendMomentPhotos\(current, incoming\)/);
  assert.match(upload, /fetch\("\/api\/moments"/);
  assert.match(upload, /\/api\/moments\/photos/);
  assert.match(capture, /Save as Moment/);
  assert.doesNotMatch(capture, /\/api\/trips/);
  assert.doesNotMatch(capture, /buildPrivateCaptureTrip/);
  assert.doesNotMatch(capture, /visibility: "private"/);
  assert.match(momentsApi, /createTravelJob/);
  assert.match(momentsApi, /selectMomentIdsForCommand/);
  assert.match(capture, /trips\/write\?job=/);
  assert.match(photosApi, /addPhotoToMoment\(momentId, photo\)/);
  assert.match(photosApi, /storeMomentBinary/);
  assert.match(helpers, /MOMENTS_BLOB_PATH = "travelos\/moments.json"/);
  assert.match(helpers, /travelos\/moments\/items/);
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
  assert.match(capture, /心情或交代 \/ Mood or a job/);
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

test("family home has one Capture door and no retired second-app cards", async () => {
  const [family, capture, unlock] = await Promise.all([
    readSource("app/family/page.tsx"),
    readSource("app/family/capture/page.tsx"),
    readSource("app/family/family-unlock-panel.tsx"),
  ]);

  assert.match(family, /FamilyUnlockPanel/);
  assert.match(family, /旅行遊記/);
  assert.match(family, /咖啡記憶/);
  assert.match(family, /安裝到 iPhone/);
  assert.match(unlock, /href="\/family\/capture"/);
  assert.match(unlock, />\s*Capture\s*</);
  assert.match(unlock, /href="\/trips\/write"/);
  assert.match(unlock, />\s*Write\s*</);
  assert.match(unlock, /前往旅行編輯/);
  assert.match(unlock, /前往咖啡編輯/);
  assert.match(capture, /<h1 className="travel-display mt-2 text-4xl font-semibold">Capture<\/h1>/);
  assert.doesNotMatch(family, /JDB Capture/);
  assert.doesNotMatch(family, /打開 Capture/);
  assert.doesNotMatch(family, /Capture 門/);
  assert.doesNotMatch(family, /請 JDB 幫忙/);
  assert.doesNotMatch(family, /開啟 JDB Sana/);
  assert.doesNotMatch(family, /chatgpt\.site/);
  assert.doesNotMatch(family, /jdb-family-entry/);
  assert.doesNotMatch(family, /href="\/family\/capture"/);
  assert.doesNotMatch(capture, /JDB Capture/);
  assert.doesNotMatch(unlock, /JDB Capture/);
  assert.doesNotMatch(unlock, /chatgpt\.site/);
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

  assert.match(unlock, /href="\/family\/capture"/);
  assert.match(unlock, /id="family-pin"/);
  assert.match(unlock, /unlock\("\/family\/capture"\)/);
  assert.match(unlock, />\s*Capture\s*</);
  assert.match(unlock, /fetchFamilyGate/);
  assert.match(capture, /FAMILY_ADMIN_SESSION_KEY/);
  assert.match(capture, /resolveFamilySession/);
  assert.match(capture, /router\.replace\("\/family"\)/);
  assert.match(write, /resolveFamilySession/);
  assert.match(write, /router\.replace\("\/family"\)/);
  assert.doesNotMatch(capture, /type="password"/);
  assert.doesNotMatch(capture, /id="family-pin"/);
  assert.doesNotMatch(write, /type="password"/);

  for (const editor of [travelAdmin, coffeeAdmin, capture, write]) {
    assert.match(editor, /router\.replace\("\/family"\)/);
    assert.match(editor, /resolveFamilySession/);
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
  assert.match(write, /get\("job"\)/);
  assert.match(write, /photosFromMoments\(writingMoments\)/);
  assert.match(write, /usingFoundSet/);
  assert.match(write, /visibleWarehouseMoments/);
  assert.match(write, /setDraft\(activeJob.draft\)/);
  assert.match(write, /filterMomentsByDayAndPlace/);
  assert.match(write, />Day</);
  assert.match(write, />Place</);
  assert.match(write, /All days/);
  assert.match(write, /All places/);
  assert.match(write, /Found set/);
  assert.match(write, /setDraft\(foundSetJob\?\.draft \?\? ""\)/);
  assert.match(write, /createTravelJob/);
  assert.match(write, /JSON.stringify\(\{ job: nextJob \}\)/);
  assert.doesNotMatch(write, /foundSetDraftsRef/);
  assert.doesNotMatch(write, /setDraft\(foundSetJob.command\)/);
  assert.doesNotMatch(write, /setDraft\(dayFilter\)/);
  assert.doesNotMatch(write, /setDraft\(placeFilter\)/);
  assert.doesNotMatch(write, /setDraft\(activeJob.command\)/);
  assert.doesNotMatch(write, /setDraft\(`\$\{dayFilter/);
  assert.doesNotMatch(write, /exciting travel log/);
  assert.doesNotMatch(write, /meal log/);
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
  const [prepare, helpers, capture, upload] = await Promise.all([
    readSource("lib/prepare-photo.ts"),
    readSource("lib/moments.ts"),
    readSource("app/family/capture/page.tsx"),
    readSource("lib/capture-upload.ts"),
  ]);

  assert.match(helpers, /image\/heic/);
  assert.match(helpers, /heicJpegFilename/);
  assert.match(prepare, /isHeicPhoto\(original\)/);
  assert.match(prepare, /convertPhonePhotoToJpeg/);
  assert.match(prepare, /canvas\.toBlob\(resolve, "image\/jpeg"/);
  assert.match(prepare, /displayMaxEdge = 1600/);
  assert.match(prepare, /displayJpegQuality = 0.72/);
  assert.match(prepare, /maxUploadBytes = 4_500_000/);
  assert.doesNotMatch(prepare, /POSITIVE_INFINITY/);
  assert.match(capture, /image\/heic,image\/heif,\.heic,\.heif/);
  assert.match(upload, /CAPTURE_DUMP_LIMIT = 40/);
  assert.match(upload, /createTinyPreviewUrl/);
  assert.match(upload, /uploadOriginalPhotoInBackground/);
  const displayUpload = upload.slice(
    upload.indexOf("export async function uploadDisplayPhoto"),
    upload.indexOf("export function uploadOriginalPhotoInBackground"),
  );
  assert.match(displayUpload, /const display = input\.file/);
  assert.doesNotMatch(displayUpload, /prepareDisplayPhoto/);
  assert.doesNotMatch(displayUpload, /await prepareDisplayPhoto/);
  assert.match(prepare, /return file;/);
  assert.doesNotMatch(prepare, /Could not prepare this photo for upload/);
  assert.doesNotMatch(prepare, /supportedUploadTypes/);
  const addIndex = capture.indexOf("async function addIncomingFiles");
  const saveIndex = capture.indexOf("async function saveMoment");
  const addBlock = capture.slice(addIndex, capture.indexOf("function onTakePhoto"));
  assert.ok(addIndex !== -1 && saveIndex !== -1);
  assert.ok(addIndex < saveIndex);
  assert.doesNotMatch(addBlock, /URL\.createObjectURL/);
  assert.match(addBlock, /ingestCaptureFileList/);
  assert.match(capture, /createTinyPreviewUrl\(display\)/);
});

test("background upload starts on add and Save does not wait on originals", async () => {
  const [capture, upload, photosApi, prepare, store, warehouseRead] = await Promise.all([
    readSource("app/family/capture/page.tsx"),
    readSource("lib/capture-upload.ts"),
    readSource("app/api/moments/photos/route.ts"),
    readSource("lib/prepare-photo.ts"),
    readSource("lib/moment-store.ts"),
    readSource("lib/warehouse-read.ts"),
  ]);

  const addBlock = capture.slice(
    capture.indexOf("async function addIncomingFiles"),
    capture.indexOf("function onTakePhoto"),
  );
  const saveBlock = capture.slice(capture.indexOf("async function saveMoment"));
  const displayPost = photosApi.slice(
    photosApi.indexOf("if (!isUploadBlob(file))"),
    photosApi.indexOf("export async function DELETE"),
  );
  const displayUpload = upload.slice(
    upload.indexOf("export async function uploadDisplayPhoto"),
    upload.indexOf("export function uploadOriginalPhotoInBackground"),
  );

  assert.match(addBlock, /void startBackgroundPhotoUpload\(photo\)/);
  assert.match(addBlock, /ingestCaptureFileList\(fileList/);
  assert.match(addBlock, /limit: CAPTURE_DUMP_LIMIT/);
  assert.match(addBlock, /createStagedCapturePhotos\(\[file\]\)/);
  assert.match(capture, /void startBackgroundAudioUpload\(staged\)/);
  assert.match(capture, /ensureMoment/);
  assert.match(capture, /createMomentSession/);
  assert.match(capture, /createWorkQueue\(\)/);
  assert.match(capture, /photoQueue\(\)\.enqueue/);
  assert.match(capture, /retryMoment/);
  assert.match(capture, /captureErrorMessage/);
  assert.match(capture, /captureBatchMessage/);
  assert.match(capture, /排隊中/);
  assert.match(capture, /上傳中/);
  assert.match(capture, /已上傳/);
  assert.match(capture, /photo\.errorMessage/);
  assert.match(capture, /audio\.errorMessage/);
  assert.match(capture, /disabled=\{!hasCapture\}/);
  assert.doesNotMatch(saveBlock, /preparePhotoForUpload/);
  assert.doesNotMatch(saveBlock, /prepareDisplayPhoto/);
  assert.doesNotMatch(saveBlock, /formData\.set\("original"/);
  assert.doesNotMatch(saveBlock, /for \(const \[index, staged\] of photos\.entries\(\)\)/);
  assert.match(saveBlock, /Promise\.all\(\[\.\.\.photoUploadsRef\.current\.values\(\)\]\)/);
  assert.doesNotMatch(saveBlock, /uploadOriginalPhotoInBackground/);
  assert.match(displayUpload, /formData\.set\("file", display\)/);
  assert.match(displayUpload, /const display = input\.file/);
  assert.doesNotMatch(displayUpload, /prepareDisplayPhoto/);
  assert.doesNotMatch(displayUpload, /formData\.set\("original"/);
  assert.match(upload, /void fetch\("\/api\/moments\/photos"/);
  assert.match(upload, /Originals are durable when they land; they must never block Capture/);
  assert.match(displayPost, /originalStorageKey: null/);
  assert.doesNotMatch(displayPost, /setPhotoOriginal/);
  assert.doesNotMatch(displayPost, /formData\.get\("original"\)/);
  assert.match(photosApi, /setPhotoOriginal/);
  assert.match(store, /withWarehouseLock/);
  assert.match(store, /flushPhotoAppends/);
  assert.match(store, /applyMomentPhotoAppends/);
  assert.match(store, /writeMomentItem/);
  assert.match(store, /readMomentItem/);
  assert.match(store, /momentItemBlobPath/);
  assert.match(prepare, /prepareDisplayPhoto/);
  assert.match(upload, /createMomentSession/);
  assert.match(upload, /sendWithMomentRetry/);
  assert.match(store, /loadWarehouseFromBlobGet/);
  assert.match(warehouseRead, /useCache: false/);
  assert.match(store, /cacheControlMaxAge: 60/);
  assert.match(store, /MomentWarehouseUnavailableError/);
  assert.doesNotMatch(store, /list\(/);
  assert.doesNotMatch(store, /dataBlob\.url/);
  assert.doesNotMatch(store, /\?v=/);
  assert.doesNotMatch(warehouseRead, /fetch\(/);
});

test("capture speed path does not touch public Lapland", async () => {
  const [capture, upload, photosApi, laplandPage, seed, poster] = await Promise.all([
    readSource("app/family/capture/page.tsx"),
    readSource("lib/capture-upload.ts"),
    readSource("app/api/moments/photos/route.ts"),
    readSource("app/trips/[slug]/page.tsx"),
    readSource("lib/trips.ts"),
    readSource("scripts/generate-lapland-poster.mjs"),
  ]);

  assert.doesNotMatch(capture, /from "@\/lib\/trips"/);
  assert.doesNotMatch(capture, /trip_lapland_2020/);
  assert.doesNotMatch(capture, /generate-lapland-poster/);
  assert.doesNotMatch(capture, /Travel admin/);
  assert.doesNotMatch(capture, /travelpayouts/i);
  assert.doesNotMatch(capture, /emrldtp/);
  assert.doesNotMatch(upload, /trip_lapland_2020/);
  assert.doesNotMatch(photosApi, /trip_lapland_2020/);
  assert.doesNotMatch(laplandPage, /moment-store/);
  assert.doesNotMatch(laplandPage, /family\/capture/);
  assert.match(seed, /trip_lapland_2020/);
  assert.match(seed, /laplandTitle: "拉普蘭冬日記憶"/);
  assert.match(poster, /basemaps\.cartocdn\.com\/rastertiles\/voyager/);
});

test("capture and save paths are not blocked by indexing or geocoding", async () => {
  const [capture, momentsApi, photosApi, store] = await Promise.all([
    readSource("app/family/capture/page.tsx"),
    readSource("app/api/moments/route.ts"),
    readSource("app/api/moments/photos/route.ts"),
    readSource("lib/moment-store.ts"),
  ]);

  assert.match(store, /export function scheduleMomentIndex\(momentId: string\)/);
  assert.match(store, /void indexSavedMoment\(momentId\)/);
  assert.doesNotMatch(store, /await indexSavedMoment/);
  assert.match(momentsApi, /scheduleMomentIndex\(saved\.moment\.id\)/);
  assert.doesNotMatch(momentsApi, /await scheduleMomentIndex/);
  assert.match(photosApi, /scheduleMomentIndex\(momentId\)/);
  assert.doesNotMatch(photosApi, /await scheduleMomentIndex/);
  assert.doesNotMatch(capture, /scheduleMomentIndex/);
  assert.doesNotMatch(capture, /indexTravelMoment/);
  assert.doesNotMatch(capture, /nominatim/i);
  assert.doesNotMatch(capture, /geocod/i);
  assert.doesNotMatch(capture, /\/api\/moments\/index/);
  const saveIndex = capture.indexOf("async function saveMoment");
  const geolocationIndex = capture.indexOf("navigator.geolocation.getCurrentPosition");
  assert.ok(saveIndex !== -1 && geolocationIndex !== -1);
  assert.ok(geolocationIndex < saveIndex);
});

test("write uses a found set for photos and does not fill the writing area", async () => {
  const [write, capture, momentsApi, photosApi] = await Promise.all([
    readSource("app/trips/write/page.tsx"),
    readSource("app/family/capture/page.tsx"),
    readSource("app/api/moments/route.ts"),
    readSource("app/api/moments/photos/route.ts"),
  ]);

  assert.match(write, /writingMoments = activeJob \? jobMoments : usingFoundSet \? visibleWarehouseMoments/);
  assert.match(write, /photosFromMoments\(writingMoments\)/);
  assert.match(write, /setDraft\(foundSetJob\?\.draft \?\? ""\)/);
  assert.match(write, /createTravelJob\(\{/);
  assert.match(write, /JSON.stringify\(\{ job: nextJob \}\)/);
  assert.match(write, /method: "PUT"/);
  assert.match(momentsApi, /const created = await addJob\(nextJob\)/);
  assert.doesNotMatch(write, /foundSetDraftsRef/);
  assert.doesNotMatch(write, /setDraft\(foundSetJob.command\)/);
  assert.doesNotMatch(write, /setDraft\(foundSetCommand/);
  assert.doesNotMatch(write, /\/api\/trips\/photos/);
  assert.doesNotMatch(write, /method: "POST"/);
  assert.doesNotMatch(write, /placeholder=/);
  assert.doesNotMatch(write, /\/api\/trips\/content[\s\S]*method: "POST"/);
  assert.doesNotMatch(capture, /usingFoundSet/);
  assert.doesNotMatch(capture, /photosFromMoments/);
  assert.doesNotMatch(momentsApi, /await scheduleMomentIndex/);
  assert.doesNotMatch(photosApi, /await scheduleMomentIndex/);
});
