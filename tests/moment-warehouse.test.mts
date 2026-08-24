import assert from "node:assert/strict";
import test from "node:test";
import {
  MOMENTS_BLOB_PATH,
  appendMomentPhotos,
  classifyCaptureNote,
  createTravelJob,
  createTravelMoment,
  emptyMomentLabels,
  heicJpegFilename,
  isHeicPhoto,
  looksLikeSystemCommand,
  selectMomentIdsForCommand,
} from "../lib/moments.ts";

test("warehouse moments live at travelos/moments.json", () => {
  assert.equal(MOMENTS_BLOB_PATH, "travelos/moments.json");
});

test("capture photos accumulate instead of replacing previous ones", () => {
  const first = [{ id: "one" }];
  const next = appendMomentPhotos(first, [{ id: "two" }, { id: "three" }]);

  assert.deepEqual(
    next.map((item) => item.id),
    ["one", "two", "three"],
  );
  assert.deepEqual(
    first.map((item) => item.id),
    ["one"],
  );
});

test("a new moment is a warehouse asset and not a trip", () => {
  const moment = createTravelMoment({
    note: "cold air",
    time: "2026-08-24T12:00:00.000Z",
  });
  const labels = emptyMomentLabels();

  assert.equal(moment.id.startsWith("moment_"), true);
  assert.equal(moment.note, "cold air");
  assert.equal(moment.command, null);
  assert.equal(moment.tripId, null);
  assert.deepEqual(moment.place, labels.place);
  assert.deepEqual(moment.people, labels.people);
  assert.deepEqual(moment.food, labels.food);
  assert.deepEqual(moment.scenery, labels.scenery);
  assert.deepEqual(moment.topics, labels.topics);
  assert.deepEqual(moment.photos, []);
  assert.equal("slug" in moment, false);
  assert.equal("visibility" in moment, false);
  assert.equal("title" in moment, false);
  assert.equal("journalEntries" in moment, false);
});

test("HEIC files are accepted by name or type and renamed to JPEG", () => {
  assert.equal(isHeicPhoto({ name: "IMG_1001.HEIC", type: "" }), true);
  assert.equal(isHeicPhoto({ name: "walk.heif", type: "image/heif" }), true);
  assert.equal(isHeicPhoto({ name: "cafe.jpg", type: "image/jpeg" }), false);
  assert.equal(heicJpegFilename("IMG_1001.HEIC"), "IMG_1001.jpg");
});

test("text is mood unless it clearly starts as a system instruction", () => {
  assert.deepEqual(classifyCaptureNote("cold air today"), { command: null, note: "cold air today" });
  assert.deepEqual(classifyCaptureNote("please remember how quiet it felt"), {
    command: null,
    note: "please remember how quiet it felt",
  });
  assert.equal(looksLikeSystemCommand("please add this to the Hokkaido trip"), true);
  assert.deepEqual(classifyCaptureNote("/save to hokkaido"), {
    command: "/save to hokkaido",
    note: "",
  });
  assert.deepEqual(classifyCaptureNote("please add this to the Hokkaido trip"), {
    command: "please add this to the Hokkaido trip",
    note: "",
  });
});

test("owner capture examples are jobs, not diary prose", () => {
  const eightDay = "put all my 8-day travel photos into TravelOS and write an exciting travel log";
  const meal = "write a meal log for my restaurant today.";

  assert.deepEqual(classifyCaptureNote(eightDay), { command: eightDay, note: "" });
  assert.deepEqual(classifyCaptureNote(meal), { command: meal, note: "" });
  assert.equal(looksLikeSystemCommand("I loved that quiet lunch"), false);
});

test("a job points at relevant moments and keeps an empty draft", () => {
  const now = new Date("2026-08-24T18:00:00.000Z");
  const today = createTravelMoment({ note: "today", time: "2026-08-24T12:00:00.000Z" });
  const lastWeek = createTravelMoment({ note: "week", time: "2026-08-17T12:00:00.000Z" });
  const older = createTravelMoment({ note: "old", time: "2026-07-01T12:00:00.000Z" });
  const moments = [today, lastWeek, older];

  const eightDayIds = selectMomentIdsForCommand(
    "put all my 8-day travel photos into TravelOS and write an exciting travel log",
    moments,
    today.id,
    now,
  );
  const todayIds = selectMomentIdsForCommand("write a meal log for my restaurant today.", moments, today.id, now);
  const job = createTravelJob({
    command: "write a meal log for my restaurant today.",
    momentIds: todayIds,
    sourceMomentId: today.id,
  });

  assert.deepEqual(eightDayIds.sort(), [today.id, lastWeek.id].sort());
  assert.deepEqual(todayIds, [today.id]);
  assert.ok(!eightDayIds.includes(older.id));
  assert.equal(job.draft, "");
  assert.notEqual(job.draft, job.command);
  assert.ok(job.momentIds.includes(today.id));
  assert.equal(job.id.startsWith("job_"), true);
});
