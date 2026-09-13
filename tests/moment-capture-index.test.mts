import assert from "node:assert/strict";
import test from "node:test";
import { createTravelMoment } from "../lib/moments.ts";
import { momentCalendarDay, momentCalendarDayLabel, momentCapturedAt, momentCoordinates, momentPlaceLabels, indexTravelMoment, warehouseDays, filterMomentsByDayAndPlace } from "../lib/moment-index.ts";
import type { MomentPhoto } from "../lib/types.ts";

function photo(localTakenAt = "2019-10-20T18:34:00"): MomentPhoto {
  return { id: "old-heic", momentId: "batch", storageKey: "photo.heic", originalStorageKey: null, originalFilename: "photo.heic", takenAt: "2019-10-20T17:34:00Z", createdAt: "2026-09-13T01:00:00Z", coordinates: null, captureMetadataStatus: "verified", captureMetadata: { source: "exif", localTakenAt, takenAt: "2019-10-20T17:34:00Z", offset: "+01:00", coordinates: { latitude: 48.8566, longitude: 2.3522 } } };
}

test("old HEIC capture day and GPS outrank upload moment time and location", () => {
  const moment = createTravelMoment({ time: "2026-09-13T01:00:00Z", coordinates: { latitude: 22.308, longitude: 113.9185 } });
  moment.place = ["Hong Kong"];
  moment.photos = [photo()];
  assert.equal(momentCalendarDay(moment), "2019-10-20");
  assert.equal(momentCapturedAt(moment), "2019-10-20T17:34:00Z");
  assert.deepEqual(momentCoordinates(moment), { latitude: 48.8566, longitude: 2.3522 });
  assert.deepEqual(momentPlaceLabels(moment), ["Paris"]);
  const indexed = indexTravelMoment(moment);
  assert.equal(indexed.time, "2019-10-20T17:34:00Z");
  assert.deepEqual(indexed.place, ["Paris"]);
});

test("local EXIF without offset remains its camera day instead of a Taipei-converted instant", () => {
  const moment = createTravelMoment({ time: "2026-09-13T01:00:00Z" });
  const local = photo("2019-10-20T23:34:00");
  local.takenAt = null;
  local.captureMetadata!.takenAt = null;
  local.captureMetadata!.offset = null;
  moment.photos = [local];
  assert.equal(momentCapturedAt(moment), "2019-10-20T23:34:00");
  assert.equal(momentCalendarDay(moment), "2019-10-20");
  assert.equal(momentCalendarDayLabel(moment), "2019-10-20");
});

test("mixed capture days stay a mixed batch rather than claim every photo was taken on the first day", () => {
  const moment = createTravelMoment({ time: "2026-09-13T01:00:00Z" });
  moment.photos = [photo(), { ...photo("2019-10-21T12:00:00"), id: "day-two" }];
  assert.equal(momentCalendarDay(moment), "多個拍攝日期");
  assert.deepEqual(warehouseDays([moment]), ["多個拍攝日期"]);
  assert.deepEqual(filterMomentsByDayAndPlace([moment], { day: "2019-10-20" }), []);
  assert.equal(indexTravelMoment(moment).time, "2026-09-13T01:00:00Z");
});

test("unverified legacy timestamps remain marked as fallback, not promoted to capture evidence", () => {
  const moment = createTravelMoment({ time: "2026-09-13T01:00:00Z" });
  moment.photos = [{ ...photo(), captureMetadataStatus: "unknown" }];
  assert.equal(momentCalendarDay(moment), "2026-09-13");
  assert.match(momentCalendarDayLabel(moment), /拍攝日未確認/);
  const instantOnly = photo();
  instantOnly.captureMetadata!.localTakenAt = null;
  moment.photos = [instantOnly];
  assert.equal(momentCalendarDay(moment), "拍攝日期待確認");
});
