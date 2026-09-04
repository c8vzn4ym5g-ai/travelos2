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
  assert.match(photosApi, /kind: momentMediaKindFromFile/);
  assert.match(photosApi, /mimeType: file.type/);
  assert.match(photosApi, /afterResponse\(async \(\) => \{/);
  assert.doesNotMatch(photosApi, /createWorkQueue/);
  assert.match(helpers, /MOMENTS_BLOB_PATH = "travelos\/moments.json"/);
  assert.match(helpers, /travelos\/moments\/items/);
});

test("capture keeps camera and library, with retake and remove", async () => {
  const capture = await readSource("app/family/capture/page.tsx");
  const takePhotoIndex = capture.indexOf("Take Photo");
  const choosePhotosIndex = capture.indexOf("Choose from album");
  const photosListIndex = capture.indexOf("{photos.length > 0 ? (");

  assert.match(capture, /capture="environment"/);
  assert.match(capture, /\smultiple\s/);
  assert.match(capture, />\s*Retake\s*</);
  assert.match(capture, />\s*移除\s*</);
  assert.doesNotMatch(capture.slice(capture.indexOf("fam-thumb-actions"), capture.indexOf("一次選好")), />\s*Remove\s*</);
  assert.match(capture, /function retakePhoto/);
  assert.match(capture, /function removePhoto/);
  assert.notEqual(takePhotoIndex, -1);
  assert.notEqual(choosePhotosIndex, -1);
  assert.ok(takePhotoIndex < photosListIndex);
  assert.ok(choosePhotosIndex < photosListIndex);
  assert.equal((capture.match(/type="file"/g) ?? []).length, 2);
  assert.equal((capture.match(/capture="environment"/g) ?? []).length, 1);
  assert.match(capture, /選照片或影片/);
  assert.match(capture, /Choose from album/);
  const albumBlock = capture.slice(capture.indexOf("選照片或影片"), capture.indexOf("加入之後"));
  assert.doesNotMatch(albumBlock, /capture=/);
  assert.doesNotMatch(capture, /加视频/);
  assert.doesNotMatch(capture, />\s*加影片\s*</);
  const emptyBlock = capture.slice(capture.indexOf("{photos.length > 0 ? ("), capture.indexOf("fam-audio"));
  assert.match(emptyBlock, /預覽/);
  assert.match(emptyBlock, /Preview/);
  assert.match(emptyBlock, /剛拍的會出現在這裡。/);
  assert.doesNotMatch(emptyBlock, /FamIconWell/);
  assert.doesNotMatch(emptyBlock, /name="camera"/);
  assert.doesNotMatch(emptyBlock, /fam-empty-take/);
  assert.doesNotMatch(emptyBlock, /onChange=\{onTakePhoto\}/);
  assert.doesNotMatch(emptyBlock, /<label className="fam-empty/);
  assert.match(emptyBlock, /<div className="fam-empty mt-5">/);
});

test("capture has no tag form and is named Capture", async () => {
  const capture = await readSource("app/family/capture/page.tsx");

  assert.match(capture, /<h1 className="fam-title">Capture<\/h1>/);
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
  assert.match(family, />入口</);
  assert.match(family, />工作台</);
  assert.match(family, />編輯</);
  assert.match(family, /旅行遊記/);
  assert.match(family, /咖啡記憶/);
  assert.match(family, /href="\/family\/capture"/);
  assert.match(family, /href="\/trips\/write"/);
  assert.match(family, /href="\/family\/trip"/);
  assert.match(family, />行程</);
  assert.match(family, /href="\/family\/bench"/);
  assert.match(family, /安裝到 iPhone/);
  assert.equal((family.match(/工作台/g) ?? []).length, 1);
  assert.doesNotMatch(family, /去工作台看看/);
  assert.doesNotMatch(family, /Sit and write/);
  assert.match(unlock, /id="family-pin"/);
  assert.match(unlock, /開啟家庭入口/);
  assert.doesNotMatch(unlock, /href="\/family\/capture"/);
  assert.doesNotMatch(unlock, /href="\/family\/bench"/);
  assert.doesNotMatch(unlock, />\s*工作台\s*</);
  assert.match(capture, /<h1 className="fam-title">Capture<\/h1>/);
  assert.match(capture, /去工作台看看/);
  assert.doesNotMatch(family, /JDB Capture/);
  assert.doesNotMatch(family, /打開 Capture/);
  assert.doesNotMatch(family, /Capture 門/);
  assert.doesNotMatch(family, /請 JDB 幫忙/);
  assert.doesNotMatch(family, /開啟 JDB Sana/);
  assert.doesNotMatch(family, /chatgpt\.site/);
  assert.doesNotMatch(family, /jdb-family-entry/);
  assert.doesNotMatch(family, /橱窗/);
  assert.doesNotMatch(capture, /JDB Capture/);
  assert.doesNotMatch(unlock, /JDB Capture/);
  assert.doesNotMatch(unlock, /chatgpt\.site/);
});

test("family session is required and capture does not add a PIN form", async () => {
  const [family, unlock, capture, bench, write, travelAdmin, coffeeAdmin] = await Promise.all([
    readSource("app/family/page.tsx"),
    readSource("app/family/family-unlock-panel.tsx"),
    readSource("app/family/capture/page.tsx"),
    readSource("app/family/bench/page.tsx"),
    readSource("app/trips/write/page.tsx"),
    readSource("app/trips/admin/page.tsx"),
    readSource("app/coffee/admin/page.tsx"),
  ]);

  assert.match(unlock, /id="family-pin"/);
  assert.match(unlock, /開啟家庭入口/);
  assert.match(unlock, /fetchFamilyGate/);
  assert.doesNotMatch(unlock, /href="\/family\/capture"/);
  assert.doesNotMatch(unlock, /unlock\("\/family\/capture"\)/);
  assert.doesNotMatch(unlock, /unlock\("\/family\/bench"\)/);
  assert.match(family, /href="\/family\/capture"/);
  assert.match(family, /href="\/trips\/write"/);
  assert.match(family, /href="\/family\/bench"/);
  assert.match(capture, /FAMILY_ADMIN_SESSION_KEY/);
  assert.match(capture, /resolveFamilySession/);
  assert.match(capture, /router\.replace\("\/family"\)/);
  assert.match(bench, /resolveFamilySession/);
  assert.match(bench, /router\.replace\("\/family"\)/);
  assert.match(write, /resolveFamilySession/);
  assert.match(write, /router\.replace\("\/family"\)/);
  assert.doesNotMatch(capture, /type="password"/);
  assert.doesNotMatch(capture, /id="family-pin"/);
  assert.doesNotMatch(bench, /type="password"/);
  assert.doesNotMatch(write, /type="password"/);

  for (const editor of [travelAdmin, coffeeAdmin, capture, bench, write]) {
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
  assert.match(capture, /accept="image\/\*,video\/\*,\.heic,\.heif,\.mov,\.mp4,\.m4v"/);
  assert.match(capture, /accept="image\/\*" capture="environment"/);
  assert.match(upload, /CAPTURE_DUMP_LIMIT = 40/);
  assert.match(upload, /createTinyPreviewUrl/);
  assert.match(upload, /prepareDisplayPhoto/);
  assert.match(upload, /uploadOriginalPhotoInBackground/);
  assert.match(prepare, /skipCanvasMaxBytes = 400_000/);
  assert.match(prepare, /file\.type === "image\/jpeg" && file\.size <= skipCanvasMaxBytes/);
  const displayUpload = upload.slice(
    upload.indexOf("export async function uploadDisplayPhoto"),
    upload.indexOf("export function uploadOriginalPhotoInBackground"),
  );
  assert.match(displayUpload, /await prepareDisplayPhoto\(source\)/);
  assert.match(prepare, /return file;/);
  assert.doesNotMatch(prepare, /Could not prepare this photo for upload/);
  assert.doesNotMatch(prepare, /supportedUploadTypes/);
  const addIndex = capture.indexOf("async function addIncomingFiles");
  const saveIndex = capture.indexOf("async function saveMoment");
  const addBlock = capture.slice(addIndex, capture.indexOf("function onTakePhoto"));
  assert.ok(addIndex !== -1 && saveIndex !== -1);
  assert.ok(addIndex < saveIndex);
  assert.match(addBlock, /URL\.createObjectURL\(file\.slice\(0\)\)/);
  assert.match(addBlock, /ingestCaptureFileList/);
  assert.match(capture, /createTinyPreviewUrl\(display\)/);
  assert.match(capture, /isCaptureVideoFile\(photo.file\)/);
  assert.match(capture, /<video muted playsInline/);
  assert.match(upload, /isCaptureDumpFile/);
  assert.match(upload, /CAPTURE_VIDEO_MAX_BYTES = 100_000_000/);
  assert.match(upload, /CAPTURE_VIDEO_CHUNK_BYTES = 8 \* 1024 \* 1024/);
  assert.match(upload, /CAPTURE_VIDEO_SINGLE_PUT_MAX_BYTES = 80_000_000/);
  assert.match(upload, /captureVideoPutChunkBytes/);
  assert.match(upload, /assertCaptureFileFits/);
  assert.match(upload, /uploadCaptureVideo/);
  assert.match(upload, /\/api\/moments\/photos\/video/);
  assert.match(upload, /CAPTURE_UPLOAD_FAILED_MESSAGE = "上傳失敗。"/);
  assert.doesNotMatch(upload, /換一段短一點的/);
  assert.doesNotMatch(capture, /換一段短一點的/);
  assert.doesNotMatch(capture, /Photo upload failed/);
  assert.doesNotMatch(upload, /Photo upload failed/);
  assert.match(capture, /captureErrorMessage\(error, CAPTURE_UPLOAD_FAILED_MESSAGE\)/);
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

  assert.match(addBlock, /startBackgroundPhotoUpload\(photo\)/);
  assert.match(addBlock, /ingestCaptureFileList\(fileList/);
  assert.match(addBlock, /limit: CAPTURE_DUMP_LIMIT/);
  assert.match(addBlock, /createStagedCapturePhotos\(\[file\]\)/);
  assert.match(capture, /void startBackgroundAudioUpload\(staged\)/);
  assert.match(capture, /ensureMoment/);
  assert.match(capture, /createMomentSession/);
  assert.doesNotMatch(capture, /createWorkQueue/);
  assert.doesNotMatch(capture, /photoQueue/);
  assert.match(capture, /retryMoment/);
  assert.match(capture, /captureErrorMessage/);
  assert.match(capture, /captureDumpProgressMessage/);
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
  assert.match(displayUpload, /await prepareDisplayPhoto\(source\)/);
  assert.doesNotMatch(displayUpload, /formData\.set\("original"/);
  assert.match(upload, /void fetch\("\/api\/moments\/photos"/);
  assert.match(upload, /Originals are durable when they land; they must never block Capture/);
  assert.match(displayPost, /originalStorageKey: null/);
  assert.doesNotMatch(displayPost, /setPhotoOriginal/);
  assert.doesNotMatch(displayPost, /formData\.get\("original"\)/);
  assert.match(displayPost, /afterResponse\(async \(\) => \{/);
  assert.match(displayPost, /addPhotoToMoment\(momentId, photo\)/);
  assert.doesNotMatch(displayPost, /if \(!content\) \{\s*return Response\.json\(\{ error: "Moment not found" \}/);
  assert.match(displayPost, /return Response\.json\(\{ photo \}\)/);
  assert.ok(displayPost.indexOf("storeMomentBinary") < displayPost.indexOf("return Response.json({ photo })"));
  assert.ok(displayPost.indexOf("afterResponse") < displayPost.indexOf("return Response.json({ photo })"));
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
  assert.doesNotMatch(laplandPage, /family\/bench/);
  assert.match(seed, /trip_lapland_2020/);
  assert.match(seed, /laplandTitle: "北極圈上的十二月"/);
  assert.match(seed, /finland-lapland-winter-journal"/);
  assert.match(poster, /tile\.opentopomap\.org/);
});

test("capture and save paths are not blocked by indexing, geocoding, or transcripts", async () => {
  const [capture, momentsApi, photosApi, audioApi, store] = await Promise.all([
    readSource("app/family/capture/page.tsx"),
    readSource("app/api/moments/route.ts"),
    readSource("app/api/moments/photos/route.ts"),
    readSource("app/api/moments/audio/route.ts"),
    readSource("lib/moment-store.ts"),
  ]);

  assert.match(store, /export function scheduleMomentIndex\(momentId: string\)/);
  assert.match(store, /void indexSavedMoment\(momentId\)/);
  assert.doesNotMatch(store, /await indexSavedMoment/);
  assert.match(store, /export function scheduleMomentTranscript\(/);
  assert.match(store, /afterResponse\(\(\) => runMomentTranscript\(momentId\)\)/);
  assert.match(store, /export function runMomentTranscript\(/);
  assert.match(store, /fillMomentTranscript\(momentId\)/);
  assert.match(store, /transcriptInFlight.add\(momentId\)/);
  assert.ok(store.indexOf("afterResponse(() => runMomentTranscript") < store.indexOf("fillMomentTranscript(momentId)"));
  assert.doesNotMatch(store, /await scheduleMomentIndex/);
  assert.match(momentsApi, /scheduleMomentIndex\(saved\.moment\.id\)/);
  assert.doesNotMatch(momentsApi, /await scheduleMomentIndex/);
  assert.match(momentsApi, /scheduleMissingMomentTranscripts\(content\.moments\)/);
  assert.doesNotMatch(momentsApi, /await scheduleMissingMomentTranscripts/);
  const transcriptApi = await readSource("app/api/moments/transcript/route.ts");
  assert.match(transcriptApi, /await runMomentTranscript/);
  assert.match(transcriptApi, /maxDuration = 60/);
  assert.match(photosApi, /scheduleMomentIndex\(momentId\)/);
  assert.doesNotMatch(photosApi, /await scheduleMomentIndex/);
  assert.match(photosApi, /afterResponse\(async \(\) => \{/);
  assert.doesNotMatch(capture, /createWorkQueue/);
  assert.match(audioApi, /scheduleMomentTranscript\(momentId\)/);
  assert.doesNotMatch(audioApi, /await scheduleMomentTranscript/);
  assert.match(audioApi, /formData\.get\("transcript"\)/);
  assert.doesNotMatch(capture, /scheduleMomentIndex/);
  assert.doesNotMatch(capture, /indexTravelMoment/);
  assert.doesNotMatch(capture, /transcribeAudioUrl/);
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

test("capture voice line is editable and language chips sit by the mic", async () => {
  const [capture, speech, chips, spoken, upload, layout, lapland] = await Promise.all([
    readSource("app/family/capture/page.tsx"),
    readSource("lib/capture-speech.ts"),
    readSource("app/family/capture-speech-lang.tsx"),
    readSource("app/family/spoken-line.tsx"),
    readSource("lib/capture-upload.ts"),
    readSource("app/family/layout.tsx"),
    readSource("app/trips/[slug]/page.tsx"),
  ]);

  const addBlock = capture.slice(
    capture.indexOf("async function addIncomingFiles"),
    capture.indexOf("function onTakePhoto"),
  );
  const audioBlock = capture.slice(capture.indexOf("聲音 / Audio"), capture.indexOf("心情或交代"));

  assert.match(spoken, /textarea/);
  assert.match(spoken, /點這行就能改/);
  assert.match(capture, /SpokenLine/);
  assert.match(capture, /applySpokenEdit/);
  assert.match(capture, /commitSpokenEdit/);
  assert.match(capture, /transcript: spokenRef\.current \|\| audioRef\.current\?\.transcript \|\| null/);
  assert.match(upload, /export async function updateMomentTranscript/);
  assert.match(upload, /method: "PUT"/);
  assert.match(speech, /chip: "粵"/);
  assert.match(speech, /chip: "国"/);
  assert.match(speech, /chip: "EN"/);
  assert.match(chips, /option\.chip/);
  assert.match(capture, /CaptureSpeechLangChips/);
  assert.ok(audioBlock.indexOf("CaptureSpeechLangChips") < audioBlock.indexOf("Record"));
  assert.match(speech, /CAPTURE_SPEECH_LANG_KEY/);
  assert.match(speech, /recognition\.lang = options\?\.lang/);
  assert.match(speech, /zh-HK/);
  assert.match(speech, /yue-Hant-HK/);
  assert.match(speech, /en-US/);
  assert.match(speech, /return "zh-TW"/);
  assert.doesNotMatch(speech, /recognition\.lang = "zh-TW"/);
  assert.doesNotMatch(speech, /lang = ""/);
  assert.doesNotMatch(speech, /lang = "auto"/);
  assert.match(layout, /data-surface="family"/);
  assert.match(layout, /M_PLUS_Rounded_1c/);
  assert.match(layout, /Nunito/);
  assert.doesNotMatch(capture, /htmlFor="people"/);
  assert.doesNotMatch(capture, /settings page/i);
  assert.match(addBlock, /ingestCaptureFileList/);
  assert.match(addBlock, /startBackgroundPhotoUpload\(photo\)/);
  assert.doesNotMatch(addBlock, /classifyCaptureNote/);
  assert.doesNotMatch(addBlock, /createWorkQueue/);
  assert.doesNotMatch(capture, /createWorkQueue/);
  assert.match(upload, /CAPTURE_DUMP_LIMIT = 40/);
  assert.doesNotMatch(lapland, /SpokenLine/);
  assert.doesNotMatch(lapland, /CaptureSpeechLangChips/);
  assert.doesNotMatch(lapland, /capture-speech/);
});
