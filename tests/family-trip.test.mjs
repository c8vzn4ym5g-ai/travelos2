import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";
import {
  defaultTripDay,
  FAMILY_TRIP_DATES,
  FAMILY_TRIP_START,
  FAMILY_TRIP_TITLE,
  familyTripDays,
  formatTripMd,
  taipeiCalendarDate,
  tripDayFromCalendarDate,
} from "../lib/family-trip.ts";

const root = resolve(import.meta.dirname, "..");

async function readSource(path) {
  return readFile(resolve(root, path), "utf8");
}

test("family trip window is eight Taipei days from 2026-08-30", () => {
  assert.equal(FAMILY_TRIP_START, "2026-08-30");
  assert.deepEqual([...FAMILY_TRIP_DATES], [
    "2026-08-30",
    "2026-08-31",
    "2026-09-01",
    "2026-09-02",
    "2026-09-03",
    "2026-09-04",
    "2026-09-05",
    "2026-09-06",
  ]);
  assert.equal(familyTripDays.length, 8);
  assert.equal(formatTripMd("2026-08-30"), "8/30");
  assert.equal(tripDayFromCalendarDate("2026-08-31"), 2);
  assert.equal(tripDayFromCalendarDate("2026-08-28"), null);
  assert.equal(defaultTripDay(new Date("2026-08-28T12:00:00+08:00")), 1);
  assert.equal(defaultTripDay(new Date("2026-09-03T08:00:00+08:00")), 5);
  assert.equal(taipeiCalendarDate(new Date("2026-08-30T02:00:00+08:00")), "2026-08-30");
});

test("confirmed email fields fill the companion; blanks stay blank", () => {
  const [day1, day2, day3, day4, day5, day6, day7, day8] = familyTripDays;

  assert.equal(FAMILY_TRIP_TITLE, "福岡 • 大分");
  assert.equal(day1.stay, "");
  assert.equal(day1.breakfast, "unknown");
  assert.equal(day1.next, "");
  assert.equal(day1.legs.length, 2);
  assert.equal(day1.legs[0].kind, "flight");
  assert.equal(day1.legs[0].flight, "STARLUX JX316");
  assert.equal(day1.legs[0].route, "台中 RMQ →");
  assert.equal(day1.legs[0].time, "");
  assert.deepEqual(day1.legs[0].refs.map((ref) => ref.value), ["FCX2TD", "CHIH HUNG CHAO"]);
  assert.equal(day1.legs[1].kind, "car");
  assert.equal(day1.legs[1].pickup, "");
  assert.equal(day1.legs[1].dropoff, "");
  assert.equal(day1.legs[1].model, "");
  assert.equal(day1.legs[1].refs[0].value, "26082202410");
  assert.equal(
    day1.legs.some((leg) => leg.kind === "hotel"),
    false,
  );
  assert.doesNotMatch(JSON.stringify(day1), /Solaria/);

  assert.equal(day2.stay, "界 由布院");
  assert.equal(day2.breakfast, "yes");
  assert.equal(day2.legs[0].kind, "hotel");
  assert.equal(day2.legs[0].checkIn, "2026-08-31 14:30");
  assert.equal(day2.legs[0].checkOut, "2026-09-01 11:00");
  assert.equal(day2.legs[0].breakfast, "yes");

  assert.equal(day3.stay, "");
  assert.equal(day3.breakfast, "unknown");
  assert.equal(day3.legs.length, 0);
  assert.equal(day4.stay, "");
  assert.equal(day4.legs.length, 0);

  assert.equal(day5.stay, "西鉄ホテル福岡 Solaria");
  assert.equal(day5.breakfast, "no");
  assert.equal(day5.legs[0].checkIn, "2026-09-03 15:00");
  assert.equal(day5.legs[0].checkOut, "2026-09-05");
  assert.equal(day5.legs[0].breakfast, "no");
  assert.ok(day5.legs[0].refs.some((ref) => ref.value === "T032CA29B451B"));

  assert.equal(day6.stay, day5.stay);
  assert.equal(day6.breakfast, "no");
  assert.equal(day7.stay, "");
  assert.equal(day7.legs.length, 0);
  assert.equal(day8.stay, "");
  assert.equal(day8.legs.length, 0);
});

test("companion page is family-only, uses the workshop surface, and does not invent copy", async () => {
  const [page, data, family, layout, robots, capture] = await Promise.all([
    readSource("app/family/trip/page.tsx"),
    readSource("lib/family-trip.ts"),
    readSource("app/family/page.tsx"),
    readSource("app/family/layout.tsx"),
    readSource("app/robots.ts"),
    readSource("app/family/capture/page.tsx"),
  ]);

  assert.match(layout, /data-surface="family"/);
  assert.match(layout, /themeColor: "#FFF4EC"/);
  assert.match(page, /today-card/);
  assert.match(page, /data-kind="flight"/);
  assert.match(page, /data-kind="car"/);
  assert.match(page, /data-kind="hotel"/);
  assert.match(page, /fam-day-strip/);
  assert.match(page, /八天總表/);
  assert.match(page, /fam-doll/);
  assert.match(page, /resolveFamilySession/);
  assert.match(page, /router\.replace\("\/family"\)/);
  assert.doesNotMatch(page, /type="password"/);
  assert.doesNotMatch(page, /id="family-pin"/);
  assert.doesNotMatch(page, /GM 填/);
  assert.doesNotMatch(page, /日期待填/);
  assert.doesNotMatch(page, /從郵件填/);
  assert.doesNotMatch(page, /travel-display/);
  assert.doesNotMatch(page, /BookingBand/);
  assert.doesNotMatch(page, /travelpayouts/i);
  assert.doesNotMatch(data, /26042203868/);
  assert.doesNotMatch(data, /A79820/);
  assert.doesNotMatch(data, /箱根/);
  assert.doesNotMatch(data, /フリューゲル/);
  assert.doesNotMatch(data, /望水/);
  assert.doesNotMatch(data, /玉翠/);
  assert.doesNotMatch(data, /GM 填/);
  assert.match(family, /href="\/family\/trip"/);
  assert.match(family, /福岡 • 大分/);
  assert.match(robots, /\/family\/trip/);
  assert.doesNotMatch(capture, /createWorkQueue/);
  assert.match(capture, /CAPTURE_DUMP_LIMIT/);
});
