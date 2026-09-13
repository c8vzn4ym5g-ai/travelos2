import assert from "node:assert/strict";
import test from "node:test";
import { formatJournalDate, formatPhotoDate } from "../lib/editor-calendar-date.ts";

const photo = { takenAt: "2019-10-20T18:34:00.000Z", captureMetadata: { source: "exif" as const, localTakenAt: "2019-10-20T18:34:00", takenAt: "2019-10-20T18:34:00.000Z", offset: null, coordinates: null } };

test("journal and photo show capture calendar day without converting UTC into next Taipei day", () => {
  const before = structuredClone(photo);
  assert.equal(formatJournalDate("2019-10-20", photo), "2019年10月20日");
  assert.equal(formatPhotoDate(photo), "2019年10月20日");
  assert.deepEqual(photo, before);
  assert.equal(formatJournalDate("2019-10-19", photo), "2019年10月19日");
});

test("journal fallback uses the known photo day, while missing dates remain unknown", () => {
  assert.equal(formatJournalDate(null, photo), "2019年10月20日");
  assert.equal(formatJournalDate(null, null), "時間尚未整理");
  assert.equal(formatPhotoDate({ takenAt: null }), "時間尚未整理");
});
