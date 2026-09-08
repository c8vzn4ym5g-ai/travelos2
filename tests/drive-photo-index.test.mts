import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";
import {
  countUniqueDisplayJpegs,
  countUniqueDriveDisplayJpegs,
  drivePhotoRecordId,
  findMomentPhoto,
  isDriveDisplayJpeg,
  photoFromDriveFileId,
  parseDriveAudioObjectName,
  parseDriveItemObjectName,
  parseDrivePhotoObjectName,
  rebuildMomentsFromDriveFiles,
} from "../lib/drive-photo-index.ts";
import { createTravelMoment, mergeMomentPhotos, mergeTravelMoment, uniqueMomentsById } from "../lib/moments.ts";
import { overlayMoments } from "../lib/moment-item.ts";
import type { MomentPhoto } from "../lib/types.ts";

const root = resolve(import.meta.dirname, "..");

async function readSource(path: string) {
  return readFile(resolve(root, path), "utf8");
}

function photo(momentId: string, id: string, filename: string, storageKey: string): MomentPhoto {
  return {
    coordinates: null,
    createdAt: "2026-08-28T14:16:00.000Z",
    id,
    momentId,
    originalFilename: filename,
    originalStorageKey: null,
    storageKey,
    takenAt: "2019-12-12T21:40:25.000Z",
  };
}

test("Drive photo object names parse moment id, display vs original, and filename", () => {
  const display = parseDrivePhotoObjectName(
    "travelos__moments__photos__moment_1787926570164_55omdg__1787926584151-IMG_1359.jpeg",
  );
  assert.equal(display?.momentId, "moment_1787926570164_55omdg");
  assert.equal(display?.filename, "IMG_1359.jpeg");
  assert.equal(display?.isOriginal, false);
  assert.equal(isDriveDisplayJpeg(display!), true);

  const original = parseDrivePhotoObjectName(
    "travelos__moments__photos__moment_1787926776683_lexvoy__original-1787926841230-IMG_1310.png",
  );
  assert.equal(original?.momentId, "moment_1787926776683_lexvoy");
  assert.equal(original?.filename, "IMG_1310.png");
  assert.equal(original?.isOriginal, true);
  assert.equal(isDriveDisplayJpeg(original!), false);

  assert.equal(
    parseDriveItemObjectName("travelos__moments__items__moment_1787926570164_55omdg.json"),
    "moment_1787926570164_55omdg",
  );
  assert.equal(
    parseDriveAudioObjectName("travelos__moments__audio__moment_1_abc__1787912285245-voice.m4a"),
    "moment_1_abc",
  );

  const movie = parseDrivePhotoObjectName(
    "travelos__moments__photos__moment_1787926570164_55omdg__1787926584151-IMG_2001.MOV",
  );
  assert.equal(movie?.momentId, "moment_1787926570164_55omdg");
  assert.equal(movie?.filename, "IMG_2001.MOV");
  assert.equal(movie?.isOriginal, false);
  assert.equal(isDriveDisplayJpeg(movie!), false);
});

test("partial moment records union photos instead of last-write-wins truncate", () => {
  const momentId = "moment_race_1";
  const left = createTravelMoment({ note: "", time: "2026-08-28T14:16:10.163Z" });
  left.id = momentId;
  left.photos = [photo(momentId, "photo_a", "IMG_1377.jpeg", "drive:aaa")];
  const right = { ...left, photos: [photo(momentId, "photo_b", "IMG_1359.jpeg", "drive:bbb")] };

  const merged = mergeTravelMoment(left, right);
  assert.deepEqual(
    merged.photos.map((item) => item.originalFilename).sort(),
    ["IMG_1359.jpeg", "IMG_1377.jpeg"],
  );

  const overlay = overlayMoments([left, left], [right]);
  assert.equal(overlay.length, 1);
  assert.equal(overlay[0]?.photos.length, 2);

  const unique = uniqueMomentsById([left, right, left]);
  assert.equal(unique.length, 1);
  assert.equal(unique[0]?.photos.length, 2);
});

test("rebuild from Drive restores the hung 3-photo Capture dump onto an empty item", () => {
  const empty = createTravelMoment({ note: "", time: "2026-09-04T10:09:15.000Z" });
  empty.id = "moment_1788531986180_d3gvhs";
  empty.photos = [];
  const rebuilt = rebuildMomentsFromDriveFiles(
    [
      {
        id: "1bWgVOHC06JFeX-eyuqhQeJX-vdKxPOrO",
        mimeType: "image/jpeg",
        name: "travelos__moments__photos__moment_1788531986180_d3gvhs__1788531993999-IMG_1566.jpg",
      },
      {
        id: "1pi6YMPwDMvQcrjSeoYZ0jp6pQEQw12vI",
        mimeType: "image/jpeg",
        name: "travelos__moments__photos__moment_1788531986180_d3gvhs__1788531994261-IMG_1570.jpg",
      },
      {
        id: "1YUIAX5u3nXJJ5XJHthdYfaOsftYGFoSQ",
        mimeType: "image/jpeg",
        name: "travelos__moments__photos__moment_1788531986180_d3gvhs__1788531994298-IMG_1571.jpg",
      },
      {
        id: "18SzoWnok6Hjx8U_WI25CwjPzGwvtLnf3",
        mimeType: "image/jpeg",
        name: "travelos__moments__photos__moment_1788531986180_d3gvhs__original-1788531999848-IMG_1566.jpeg",
      },
      {
        id: "1gaw_yB-SCNDlvkC_rpLeynQPhm6nIU20",
        mimeType: "image/jpeg",
        name: "travelos__moments__photos__moment_1788531986180_d3gvhs__original-1788532000171-IMG_1570.jpeg",
      },
    ],
    [empty],
  );
  const photos = rebuilt.find((moment) => moment.id === empty.id)?.photos ?? [];
  assert.equal(photos.length, 3);
  assert.deepEqual(
    photos.map((photo) => photo.originalFilename).sort(),
    ["IMG_1566.jpg", "IMG_1570.jpg", "IMG_1571.jpg"],
  );
  assert.equal(
    photos.find((photo) => photo.originalFilename === "IMG_1566.jpg")?.originalStorageKey,
    "drive:18SzoWnok6Hjx8U_WI25CwjPzGwvtLnf3",
  );
});

test("rebuild from Drive photo files restores display jpegs dropped from moments.json", () => {
  const empty = createTravelMoment({ note: "", time: "2026-08-28T14:16:10.163Z" });
  empty.id = "moment_1787926570164_55omdg";
  empty.photos = [];
  const partial = createTravelMoment({ note: "", time: "2026-08-28T14:17:47.284Z" });
  partial.id = "moment_1787926667284_d93a8p";
  partial.photos = [photo(partial.id, "kept", "IMG_1384.jpeg", "drive:18s3TPPC_70NRJGYJEzFywbSSyS3Vh-XJ")];

  const files = [
    {
      id: "1dmzRKs9PvWrtAlq3E9F_R-8OKBruyyXe",
      name: "travelos__moments__photos__moment_1787926570164_55omdg__1787926584151-IMG_1359.jpeg",
    },
    {
      id: "13cD9NPzIXSdNkFfrxPdBmVAEYzARccFl",
      name: "travelos__moments__photos__moment_1787926570164_55omdg__1787926607393-IMG_1359.jpeg",
    },
    {
      id: "18s3TPPC_70NRJGYJEzFywbSSyS3Vh-XJ",
      name: "travelos__moments__photos__moment_1787926667284_d93a8p__1787926685183-IMG_1384.jpeg",
    },
    {
      id: "1N3nIdgQwrhZbxLMFxpbi3Z1SM_lC454T",
      name: "travelos__moments__photos__moment_1787926667284_d93a8p__1787926684842-IMG_1404.jpeg",
    },
    {
      id: "1KIjvSYu3hQpPCTWJHnqjmgx3f1EZBXcF",
      name: "travelos__moments__photos__moment_1787926776683_lexvoy__original-1787926841230-IMG_1310.png",
    },
    {
      id: "1oUq4vhZXBepWIGgL_6RVzwZSWKpKEpKJ",
      name: "travelos__moments__photos__moment_1787926776683_lexvoy__1787926795895-IMG_1310.jpg",
    },
  ];

  const rebuilt = rebuildMomentsFromDriveFiles(files, [empty, partial, empty]);
  const byId = new Map(rebuilt.map((moment) => [moment.id, moment]));
  assert.equal(byId.get(empty.id)?.photos.length, 1);
  assert.equal(byId.get(empty.id)?.photos[0]?.originalFilename, "IMG_1359.jpeg");
  assert.equal(byId.get(partial.id)?.photos.length, 2);
  const lexvoy = byId.get("moment_1787926776683_lexvoy");
  assert.equal(lexvoy?.photos.length, 1);
  assert.equal(lexvoy?.photos[0]?.originalStorageKey, "drive:1KIjvSYu3hQpPCTWJHnqjmgx3f1EZBXcF");
  assert.equal(countUniqueDisplayJpegs(rebuilt), 4);
  assert.equal(countUniqueDriveDisplayJpegs(files), 4);
});

test("rebuild from Drive keeps a dumped video on the same moment photos list", () => {
  const empty = createTravelMoment({ note: "", time: "2026-09-03T01:20:00.000Z" });
  empty.id = "moment_1787926570164_55omdg";
  const rebuilt = rebuildMomentsFromDriveFiles(
    [
      {
        id: "1videoFileIdFukuokaClip000000001",
        mimeType: "video/quicktime",
        name: "travelos__moments__photos__moment_1787926570164_55omdg__1787926589999-IMG_2001.MOV",
      },
      {
        id: "1dmzRKs9PvWrtAlq3E9F_R-8OKBruyyXe",
        name: "travelos__moments__photos__moment_1787926570164_55omdg__1787926584151-IMG_1359.jpeg",
      },
    ],
    [empty],
  );
  const photos = rebuilt[0]?.photos ?? [];
  assert.equal(photos.length, 2);
  assert.equal(photos.some((item) => item.originalFilename === "IMG_2001.MOV" && item.kind === "video"), true);
  assert.equal(photos.some((item) => item.originalFilename === "IMG_1359.jpeg"), true);
});

test("duplicate filename photos collapse to one display jpeg", () => {
  const merged = mergeMomentPhotos(
    [photo("m", "one", "IMG_1359.jpeg", "drive:first")],
    [photo("m", "two", "IMG_1359.jpeg", "drive:second")],
  );
  assert.equal(merged.length, 1);
  assert.equal(merged[0]?.originalFilename, "IMG_1359.jpeg");
});

test("bench photo ids resolve by rebuilt Drive file id, not only the index photos[] id", () => {
  const fileId = "1dQ9zJGeuGtkMSDsnTPcvQrL4ac4IJhk6";
  const rebuiltId = drivePhotoRecordId(fileId);
  assert.equal(rebuiltId, "moment_photo_drive_1dQ9zJGeuGtkMSDsnTPcvQrL");

  const momentId = "moment_1787928443329_3823s1";
  const stale = createTravelMoment({ note: "edinburgh trip, write a travel blog", time: "2026-08-28T14:47:23.328Z" });
  stale.id = momentId;
  stale.photos = [photo(momentId, "moment_photo_old_upload", "IMG_0871.jpeg", `drive:${fileId}`)];

  assert.equal(findMomentPhoto(stale, "moment_photo_old_upload")?.storageKey, `drive:${fileId}`);
  assert.equal(findMomentPhoto(stale, rebuiltId)?.originalFilename, "IMG_0871.jpeg");
  assert.equal(findMomentPhoto(stale, "moment_photo_missing"), null);
  assert.equal(photoFromDriveFileId(momentId, rebuiltId, fileId)?.storageKey, `drive:${fileId}`);
  assert.equal(photoFromDriveFileId(momentId, rebuiltId, "other-file-id"), null);
  assert.equal(photoFromDriveFileId(momentId, "moment_photo_old_upload", fileId), null);
});

test("warehouse receiver and Capture store rebuild from Drive photo files, not Blob", async () => {
  const [store, drive, script, rebuildRoute, bench, benchPhoto, family, photosApi] = await Promise.all([
    readSource("lib/moment-store.ts"),
    readSource("lib/drive-warehouse.ts"),
    readSource("scripts/drive-warehouse-apps-script.js"),
    readSource("app/api/moments/rebuild/route.ts"),
    readSource("app/family/bench/page.tsx"),
    readSource("app/family/bench/bench-photo.tsx"),
    readSource("app/family/page.tsx"),
    readSource("app/api/moments/photos/route.ts"),
  ]);

  assert.match(drive, /export async function scanWarehouseFiles/);
  assert.match(drive, /op: "list"/);
  assert.match(store, /rebuildMomentsFromDriveFiles/);
  assert.match(store, /hydrateDriveMoments/);
  assert.match(store, /resolveMomentPhoto/);
  assert.match(store, /findMomentPhoto/);
  assert.match(store, /mergeMomentPhotos/);
  assert.match(store, /uniqueMomentsById/);
  assert.match(rebuildRoute, /rebuildDriveMomentIndex/);
  assert.match(rebuildRoute, /momentId/);
  assert.match(script, /LockService\.getScriptLock/);
  assert.match(script, /op === "list"/);
  assert.match(script, /op === "thumb"/);
  assert.match(script, /getThumbnail/);
  assert.match(script, /mergeMomentLists_/);
  assert.match(script, /travelos__moments__photos__/);
  assert.match(script, /if \(body\.op === "index"\) \{\s*return withLock_/);
  assert.match(script, /if \(body\.op === "item"\) \{\s*return withLock_/);
  assert.match(script, /return createBinaryFile_\(body\)/);
  assert.doesNotMatch(script, /var body = JSON\.parse\(e\.postData\.contents\);\s*return withLock_/);
  assert.doesNotMatch(bench, /drive-warehouse/);
  assert.doesNotMatch(bench, /scanWarehouseFiles/);
  assert.doesNotMatch(benchPhoto, /drive-warehouse/);
  assert.match(bench, /BenchPhotoThumb/);
  assert.match(benchPhoto, /variant: "thumb"/);
  assert.match(benchPhoto, /fileId/);
  assert.match(benchPhoto, /THUMB_CONCURRENCY = 2/);
  assert.doesNotMatch(family, /drive-warehouse/);
  assert.match(photosApi, /resolveMomentPhoto/);
  assert.match(photosApi, /photoFromDriveFileId/);
  assert.match(photosApi, /readMomentThumbBytes/);
  assert.match(photosApi, /variant === "thumb"/);
  assert.match(photosApi, /reason: "missing-photo"/);
  assert.match(photosApi, /reason: "binary-miss"/);
  assert.doesNotMatch(photosApi, /@vercel\/blob/);
  assert.doesNotMatch(store, /putWithStoreAccess/);
  assert.doesNotMatch(store, /isBlobConfigured\(\)/);
});
