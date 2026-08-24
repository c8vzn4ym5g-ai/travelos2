import assert from "node:assert/strict";
import test from "node:test";
import {
  appendCapturePhotos,
  attachCaptureJournal,
  buildPrivateCaptureTrip,
  heicJpegFilename,
  isHeicPhoto,
  isProtectedPublicLaplandTrip,
  PUBLIC_LAPLAND_SLUG,
  PUBLIC_LAPLAND_TRIP_ID,
} from "../lib/family-capture.ts";

test("capture photos accumulate instead of replacing previous ones", () => {
  const first = [{ id: "one" }];
  const next = appendCapturePhotos(first, [{ id: "two" }, { id: "three" }]);

  assert.deepEqual(
    next.map((item) => item.id),
    ["one", "two", "three"],
  );
  assert.deepEqual(
    first.map((item) => item.id),
    ["one"],
  );
});

test("a new capture trip is private and is not the public Lapland trip", () => {
  const trip = buildPrivateCaptureTrip({
    journalBody: "snow quiet",
    now: new Date("2026-08-24T12:00:00.000Z"),
  });

  assert.equal(trip.visibility, "private");
  assert.equal(trip.id.startsWith("trip_moment_"), true);
  assert.match(trip.slug, /^family-moment-2026-08-24-/);
  assert.notEqual(trip.id, PUBLIC_LAPLAND_TRIP_ID);
  assert.notEqual(trip.slug, PUBLIC_LAPLAND_SLUG);
  assert.equal(isProtectedPublicLaplandTrip(trip), false);
  assert.equal(isProtectedPublicLaplandTrip({ id: PUBLIC_LAPLAND_TRIP_ID, slug: "other" }), true);
  assert.equal(isProtectedPublicLaplandTrip({ id: "other", slug: PUBLIC_LAPLAND_SLUG }), true);
});

test("HEIC files are accepted by name or type and renamed to JPEG", () => {
  assert.equal(isHeicPhoto({ name: "IMG_1001.HEIC", type: "" }), true);
  assert.equal(isHeicPhoto({ name: "walk.heif", type: "image/heif" }), true);
  assert.equal(isHeicPhoto({ name: "cafe.jpg", type: "image/jpeg" }), false);
  assert.equal(heicJpegFilename("IMG_1001.HEIC"), "IMG_1001.jpg");
});

test("journal attachment keeps the private capture trip identity", () => {
  const trip = buildPrivateCaptureTrip();
  const withJournal = attachCaptureJournal(trip, "campfire");

  assert.equal(withJournal.visibility, "private");
  assert.equal(withJournal.id, trip.id);
  assert.equal(withJournal.journalEntries[0]?.body, "campfire");
  assert.equal(isProtectedPublicLaplandTrip(withJournal), false);
});
