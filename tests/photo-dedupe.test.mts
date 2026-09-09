import assert from "node:assert/strict";
import test from "node:test";
import { createTravelMoment } from "../lib/moments.ts";
import {
  dropUnreferencedDuplicatePhotos,
  findPhotoByContentHash,
  groupDuplicatePhotoRecords,
  hashPhotoBytes,
  journalLinkedPhotoIds,
  normalizePhotoContentHash,
  storageKeysToHashForDedupe,
} from "../lib/photo-dedupe.ts";
import type { MomentPhoto, TravelMoment } from "../lib/types.ts";

function photo(partial: Partial<MomentPhoto> & Pick<MomentPhoto, "id" | "momentId">): MomentPhoto {
  return {
    coordinates: null,
    contentHash: null,
    createdAt: "2026-09-01T00:00:00.000Z",
    originalFilename: `${partial.id}.jpg`,
    originalStorageKey: null,
    storageKey: `drive:${partial.id}`,
    takenAt: "2026-09-01T00:00:00.000Z",
    ...partial,
  };
}

function momentWithPhotos(id: string, photos: MomentPhoto[]): TravelMoment {
  return {
    ...createTravelMoment({ id, note: id, time: "2026-09-01T00:00:00.000Z" }),
    photos,
  };
}

test("hashPhotoBytes is a stable sha256 hex of the bytes", () => {
  assert.equal(hashPhotoBytes(Buffer.from("abc")), "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  assert.equal(hashPhotoBytes(Buffer.from("abc")), hashPhotoBytes(new Uint8Array(Buffer.from("abc"))));
  assert.notEqual(hashPhotoBytes(Buffer.from("abc")), hashPhotoBytes(Buffer.from("abd")));
});

test("findPhotoByContentHash reuses the earliest warehouse photo", () => {
  const hash = hashPhotoBytes(Buffer.from("same-bytes"));
  const first = photo({
    contentHash: hash,
    createdAt: "2026-09-01T10:00:00.000Z",
    id: "photo_first",
    momentId: "moment_a",
  });
  const later = photo({
    contentHash: hash,
    createdAt: "2026-09-02T10:00:00.000Z",
    id: "photo_later",
    momentId: "moment_b",
  });
  const found = findPhotoByContentHash(
    [momentWithPhotos("moment_b", [later]), momentWithPhotos("moment_a", [first])],
    hash,
  );
  assert.equal(found?.id, "photo_first");
  assert.equal(findPhotoByContentHash([momentWithPhotos("moment_a", [first])], "nope"), null);
});

test("journal-linked photos are never dropped when merging remaining dups", () => {
  const hash = hashPhotoBytes(Buffer.from("dump-dup"));
  const linked = photo({
    contentHash: hash,
    createdAt: "2026-09-02T00:00:00.000Z",
    id: "photo_journal",
    momentId: "moment_new",
    storageKey: "drive:dup-b",
  });
  const extra = photo({
    contentHash: hash,
    createdAt: "2026-09-01T00:00:00.000Z",
    id: "photo_extra",
    momentId: "moment_old",
    storageKey: "drive:dup-a",
  });
  const cleaned = dropUnreferencedDuplicatePhotos(
    [momentWithPhotos("moment_old", [extra]), momentWithPhotos("moment_new", [linked])],
    journalLinkedPhotoIds([
      {
        coverPhotoId: null,
        journalEntries: [{ storyPhotoId: "photo_journal" }],
        photos: [],
        travelRoute: [{ linkedPhotoId: null }],
      },
    ]),
  );

  assert.deepEqual(
    cleaned.moments.flatMap((moment) => moment.photos.map((item) => item.id)),
    ["photo_journal"],
  );
  assert.deepEqual(cleaned.droppedIds, ["photo_extra"]);
});

test("unreferenced same-hash copies collapse to the earliest photo", () => {
  const hash = hashPhotoBytes(Buffer.from("second-dump"));
  const first = photo({
    contentHash: hash,
    createdAt: "2026-09-01T00:00:00.000Z",
    id: "photo_keep",
    momentId: "moment_1",
  });
  const copy = photo({
    contentHash: hash,
    createdAt: "2026-09-02T00:00:00.000Z",
    id: "photo_drop",
    momentId: "moment_2",
    storageKey: "drive:copy",
  });
  const cleaned = dropUnreferencedDuplicatePhotos(
    [momentWithPhotos("moment_1", [first]), momentWithPhotos("moment_2", [copy, photo({ id: "photo_unique", momentId: "moment_2" })])],
    [],
  );

  assert.deepEqual(
    cleaned.moments.map((moment) => moment.photos.map((item) => item.id)),
    [["photo_keep"], ["photo_unique"]],
  );
  assert.deepEqual(cleaned.droppedIds, ["photo_drop"]);
});

test("same Drive storageKey groups as a duplicate even without a stored hash", () => {
  const first = photo({ id: "photo_a", momentId: "moment_1", storageKey: "drive:shared" });
  const copy = photo({ id: "photo_b", momentId: "moment_2", storageKey: "drive:shared" });
  const groups = groupDuplicatePhotoRecords([
    momentWithPhotos("moment_1", [first]),
    momentWithPhotos("moment_2", [copy]),
  ]);
  assert.equal(groups.length, 1);
  assert.equal(groups[0]?.length, 2);
});

test("normalizePhotoContentHash rejects short or empty values", () => {
  assert.equal(normalizePhotoContentHash("  "), "");
  assert.equal(normalizePhotoContentHash("abc"), "");
  assert.equal(
    normalizePhotoContentHash("BA7816BF8F01CFEA414140DE5DAE2223B00361A396177A9CB410FF61F20015AD"),
    "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
  );
});

test("later hash pass only reads colliding filenames that are missing a hash", () => {
  const unique = photo({ id: "photo_unique", momentId: "moment_1", originalFilename: "solo.jpg", storageKey: "drive:solo" });
  const first = photo({ id: "photo_a", momentId: "moment_1", originalFilename: "IMG_1001.jpg", storageKey: "drive:a" });
  const copy = photo({ id: "photo_b", momentId: "moment_2", originalFilename: "IMG_1001.jpg", storageKey: "drive:b" });
  const hashed = photo({
    contentHash: "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    id: "photo_c",
    momentId: "moment_3",
    originalFilename: "IMG_1001.jpg",
    storageKey: "drive:c",
  });
  const video = photo({
    id: "photo_vid",
    kind: "video",
    momentId: "moment_1",
    originalFilename: "IMG_1001.mov",
    storageKey: "drive:vid",
  });
  assert.deepEqual(
    storageKeysToHashForDedupe([
      momentWithPhotos("moment_1", [unique, first, video]),
      momentWithPhotos("moment_2", [copy]),
      momentWithPhotos("moment_3", [hashed]),
    ]).sort(),
    ["drive:a", "drive:b"],
  );
});
