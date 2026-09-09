import assert from "node:assert/strict";
import test from "node:test";
import {
  applyTripLocalDrafts,
  clearTripLocalDraft,
  clearWriteLocalDraft,
  readTripLocalDraft,
  readWriteLocalDraft,
  tripFingerprint,
  tripLocalDraftKey,
  writeDraftIdentity,
  writeDraftNeedsRestore,
  writeLocalDraftStorageKey,
  writeTripLocalDraft,
  writeWriteLocalDraft,
} from "../lib/editor-local-draft.ts";

class MemoryStorage {
  #map = new Map();

  getItem(key) {
    return this.#map.has(key) ? this.#map.get(key) : null;
  }

  setItem(key, value) {
    this.#map.set(key, String(value));
  }

  removeItem(key) {
    this.#map.delete(key);
  }
}

function sampleTrip(overrides = {}) {
  const now = "2026-09-09T00:00:00.000Z";
  return {
    city: "Fukuoka",
    coordinates: null,
    costs: [],
    country: "Japan",
    coverPhotoId: null,
    createdAt: now,
    endDate: "2026-09-05",
    id: "trip_kyushu_family_2026",
    journalEntries: [
      {
        aiSummary: null,
        body: "原稿",
        createdAt: now,
        entryDate: "2026-08-30",
        id: "journal_1",
        mood: null,
        storyPhotoId: null,
        title: "第一段",
        tripId: "trip_kyushu_family_2026",
        updatedAt: now,
        weatherSummary: null,
      },
    ],
    musicTracks: [],
    photos: [],
    places: [],
    rating: null,
    slug: "kyushu-family",
    startDate: "2026-08-30",
    summary: "開場",
    title: "九州家庭慢遊：福岡、小國町與阿蘇",
    totalCost: null,
    travelRoute: [],
    updatedAt: now,
    userId: "family",
    visibility: "private",
    ...overrides,
  };
}

test("trip local draft round-trips by trip id and restores a newer fingerprint", () => {
  const storage = new MemoryStorage();
  const server = sampleTrip();
  const local = sampleTrip({
    journalEntries: [
      {
        ...server.journalEntries[0],
        body: "電話上改過的句子",
      },
    ],
    summary: "電話上改過的開場",
  });

  assert.equal(writeTripLocalDraft(local, storage), true);
  assert.equal(tripLocalDraftKey(local.id), "travelos-trip-draft:trip_kyushu_family_2026");
  assert.equal(readTripLocalDraft(local.id, storage)?.trip.summary, "電話上改過的開場");
  assert.notEqual(tripFingerprint(local), tripFingerprint(server));

  const applied = applyTripLocalDrafts([server], storage);
  assert.deepEqual(applied.restoredIds, ["trip_kyushu_family_2026"]);
  assert.equal(applied.trips[0].summary, "電話上改過的開場");
  assert.equal(applied.trips[0].journalEntries[0].body, "電話上改過的句子");
});

test("matching local trip draft is treated as already saved and cleared", () => {
  const storage = new MemoryStorage();
  const trip = sampleTrip();
  writeTripLocalDraft(trip, storage);
  const applied = applyTripLocalDrafts([trip], storage);
  assert.deepEqual(applied.restoredIds, []);
  assert.equal(readTripLocalDraft(trip.id, storage), null);
});

test("null storage is a no-op so private Safari still edits in memory", () => {
  const trip = sampleTrip();
  assert.equal(writeTripLocalDraft(trip, null), false);
  assert.equal(readTripLocalDraft(trip.id, null), null);
  clearTripLocalDraft(trip.id, null);
  const applied = applyTripLocalDrafts([trip], null);
  assert.deepEqual(applied.restoredIds, []);
});

test("write local draft restores when the textarea differs", () => {
  const storage = new MemoryStorage();
  const key = writeDraftIdentity({ momentId: "moment_1" });
  assert.equal(key, "moment:moment_1");
  assert.equal(writeLocalDraftStorageKey(key), "travelos-write-draft:moment:moment_1");
  writeWriteLocalDraft(
    {
      attachTripId: "trip_kyushu_family_2026",
      draft: "還沒按儲存的字",
      hiddenPhotoIds: ["p1"],
      key,
    },
    storage,
  );
  const local = readWriteLocalDraft(key, storage);
  assert.ok(local);
  assert.equal(local.draft, "還沒按儲存的字");
  assert.equal(
    writeDraftNeedsRestore(local, { attachTripId: "", draft: "", hiddenPhotoIds: [] }),
    true,
  );
  clearWriteLocalDraft(key, storage);
  assert.equal(readWriteLocalDraft(key, storage), null);
});
