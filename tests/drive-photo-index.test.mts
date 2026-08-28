import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";
import {
  countUniqueDisplayJpegs,
  countUniqueDriveDisplayJpegs,
  isDriveDisplayJpeg,
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

test("duplicate filename photos collapse to one display jpeg", () => {
  const merged = mergeMomentPhotos(
    [photo("m", "one", "IMG_1359.jpeg", "drive:first")],
    [photo("m", "two", "IMG_1359.jpeg", "drive:second")],
  );
  assert.equal(merged.length, 1);
  assert.equal(merged[0]?.originalFilename, "IMG_1359.jpeg");
});

test("warehouse receiver and Capture store rebuild from Drive photo files, not Blob", async () => {
  const [store, drive, script, rebuildRoute, bench, family, photosApi] = await Promise.all([
    readSource("lib/moment-store.ts"),
    readSource("lib/drive-warehouse.ts"),
    readSource("scripts/drive-warehouse-apps-script.js"),
    readSource("app/api/moments/rebuild/route.ts"),
    readSource("app/family/bench/page.tsx"),
    readSource("app/family/page.tsx"),
    readSource("app/api/moments/photos/route.ts"),
  ]);

  assert.match(drive, /export async function scanWarehouseFiles/);
  assert.match(drive, /op: "list"/);
  assert.match(store, /rebuildMomentsFromDriveFiles/);
  assert.match(store, /hydrateDriveMoments/);
  assert.match(store, /mergeMomentPhotos/);
  assert.match(store, /uniqueMomentsById/);
  assert.match(rebuildRoute, /rebuildDriveMomentIndex/);
  assert.match(script, /LockService\.getScriptLock/);
  assert.match(script, /op === "list"/);
  assert.match(script, /mergeMomentLists_/);
  assert.match(script, /travelos__moments__photos__/);
  assert.doesNotMatch(bench, /drive-warehouse/);
  assert.doesNotMatch(bench, /scanWarehouseFiles/);
  assert.doesNotMatch(family, /drive-warehouse/);
  assert.doesNotMatch(photosApi, /@vercel\/blob/);
  assert.doesNotMatch(store, /putWithStoreAccess/);
  assert.doesNotMatch(store, /isBlobConfigured\(\)/);
});
