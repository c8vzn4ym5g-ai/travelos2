import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";
import {
  defaultTripDay,
  FAMILY_TRIP_DATES,
  FAMILY_TRIP_START,
  FAMILY_TRIP_TITLE,
  familyTripCarry,
  familyTripDays,
  formatTripMd,
  taipeiCalendarDate,
  tripDayFromCalendarDate,
} from "../lib/family-trip.ts";

const root = resolve(import.meta.dirname, "..");

async function readSource(path) {
  return readFile(resolve(root, path), "utf8");
}

function legsOf(day, kind) {
  return familyTripDays[day - 1].legs.filter((leg) => leg.kind === kind);
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

test("confirmed email fields fill the companion; remaining gaps stay blank", () => {
  const [day1, day2, day3, day4, day5, day6, day7, day8] = familyTripDays;

  assert.equal(FAMILY_TRIP_TITLE, "福岡 • 大分");
  assert.equal(familyTripCarry.title, "帶著走");
  assert.ok(familyTripCarry.flights.some((line) => line.includes("FCX2TD")));
  assert.ok(familyTripCarry.car.some((line) => line.includes("26082202410")));
  assert.ok(familyTripCarry.car.includes("有車，不用車站接送"));

  assert.equal(day1.stay, "Solaria");
  assert.equal(day1.breakfast, "no");
  assert.equal(day1.dinner, "no");
  assert.equal(day1.next, "熊本 18:15 落地，19:30 取車，開去天神。官網入住 15:00，這晚晚到。");
  const day1Flight = legsOf(1, "flight")[0];
  const day1Car = legsOf(1, "car")[0];
  const day1Hotel = legsOf(1, "hotel")[0];
  assert.equal(day1Flight.route, "台中 RMQ T2 → 熊本 KMJ");
  assert.equal(day1Flight.flight, "STARLUX JX316");
  assert.equal(day1Flight.time, "15:00–18:15");
  assert.equal(day1Flight.routeLabel, "去程");
  assert.equal(day1Flight.refs[0].value, "FCX2TD");
  assert.equal(day1Car.pickup, "熊本機場 19:30");
  assert.equal(day1Car.dropoff, "9/6 19:00 同店");
  assert.equal(day1Car.model, "(W4) SERENA");
  assert.equal(day1Car.refs[0].value, "26082202410");
  assert.equal(day1Hotel.name, "西鉄ホテル福岡 Solaria");
  assert.equal(day1Hotel.checkIn, "8/30");
  assert.equal(day1Hotel.checkOut, "8/31");
  assert.equal(day1Hotel.officialIn, "15:00");
  assert.equal(day1Hotel.officialOut, "11:00");
  assert.equal(day1Hotel.breakfast, "no");
  assert.equal(day1Hotel.dinner, "no");
  assert.equal(day1Hotel.note, "");
  assert.match(day1Hotel.extras, /明早含早餐/);
  assert.match(day1Hotel.extras, /7:00–10:30/);
  assert.doesNotMatch(day1Hotel.checkIn, /15:00/);
  assert.doesNotMatch(JSON.stringify(day1Hotel), /另外兩人|MISSING/);
  assert.ok(day1Hotel.refs.some((ref) => ref.value === "TF53AEFAC2A33"));
  assert.ok(day1Hotel.refs.some((ref) => /Moderate Twin/.test(ref.value)));
  assert.ok(day1Hotel.refs.some((ref) => ref.value === "Chih Mei Feng"));
  assert.ok(day1Hotel.refs.some((ref) => ref.value === "Tik Shan Sana Lai"));
  assert.ok(day1Hotel.refs.some((ref) => /含早餐/.test(ref.value)));
  assert.equal(day1.breakfast, "no");
  assert.doesNotMatch(JSON.stringify(day1Hotel), /T032CA29B451B/);
  assert.doesNotMatch(JSON.stringify(day1Hotel), /素泊り/);
  assert.doesNotMatch(JSON.stringify(day1Hotel), /スーペリアツイン/);

  assert.equal(day2.stay, "界 由布院");
  assert.equal(day2.breakfast, "yes");
  assert.equal(day2.dinner, "no");
  assert.equal(day2.next, "開車從福岡去界。14:30 入住。");
  const yufuin = legsOf(2, "hotel")[0];
  assert.equal(yufuin.checkIn, "8/31 14:30");
  assert.equal(yufuin.checkOut, "9/1 11:00");
  assert.equal(yufuin.breakfast, "yes");
  assert.equal(yufuin.dinner, "no");
  assert.match(yufuin.extras, /官網.*いろは/);
  assert.doesNotMatch(yufuin.extras, /接送|申請期限/);
  assert.ok(yufuin.refs.some((ref) => ref.value === "KYIBNF266359"));
  assert.ok(yufuin.refs.some((ref) => /兩間/.test(ref.value) && /4人/.test(ref.value)));
  assert.ok(yufuin.official.length > 0);
  assert.equal(legsOf(2, "flight").length, 0);
  assert.equal(legsOf(2, "car").length, 0);

  assert.equal(day3.stay, "奥日田温泉 うめひびき");
  assert.equal(day3.breakfast, "yes");
  assert.equal(day3.dinner, "no");
  assert.equal(legsOf(3, "hotel").length, 1);
  const ume = legsOf(3, "hotel")[0];
  assert.equal(day3.next, "開車去うめひびき。15:00 入住。");
  assert.equal(ume.checkIn, "9/1 15:00");
  assert.equal(ume.officialIn, "最晚 18:00");
  assert.equal(ume.breakfast, "yes");
  assert.equal(ume.dinner, "no");
  assert.equal(ume.note, "");
  assert.match(ume.extras, /官網.*試飲/);
  assert.doesNotMatch(ume.note, /另外兩人|MISSING/);
  assert.doesNotMatch(ume.extras, /接送|JR|日田站/);
  assert.ok(ume.refs.some((ref) => ref.value === "202608240003264.01"));

  assert.equal(day4.stay, "フリューゲル久住");
  assert.equal(day4.breakfast, "yes");
  assert.equal(day4.dinner, "yes");
  const kuju = legsOf(4, "hotel")[0];
  assert.equal(day4.next, "開車去フリューゲル。15:00 入住，最晚 18:00。這晚有晚餐。");
  assert.equal(kuju.dinner, "yes");
  assert.equal(kuju.checkIn, "9/2 15:00");
  assert.equal(kuju.officialIn, "15:00–18:00（更晚先打電話）");
  assert.match(kuju.extras, /官網.*レーゲンボーゲン/);
  assert.ok(kuju.refs.some((ref) => ref.value === "1252"));
  assert.ok(kuju.refs.some((ref) => ref.label === "交通" && ref.value === "車"));
  assert.ok(kuju.official.length > 0);
  assert.doesNotMatch(kuju.extras, /豊後竹田|接送/);

  assert.equal(day5.stay, "Solaria");
  assert.equal(day5.breakfast, "yes");
  assert.equal(day5.dinner, "no");
  assert.equal(day5.next, "フリューゲル 11:00 退房，開車回天神。15:00 入住。");
  const solaria = legsOf(5, "hotel")[0];
  assert.equal(solaria.checkIn, "9/3 15:00");
  assert.equal(solaria.checkOut, "9/5");
  assert.equal(solaria.officialOut, "11:00");
  assert.equal(solaria.breakfast, "yes");
  assert.equal(solaria.dinner, "no");
  assert.match(solaria.extras, /素泊り從明早算/);
  assert.doesNotMatch(solaria.extras, /今早素泊り/);
  assert.ok(solaria.refs.some((ref) => ref.value === "T032CA29B451B"));
  assert.ok(solaria.refs.some((ref) => /4人/.test(ref.value)));
  assert.doesNotMatch(JSON.stringify(solaria), /TF53AEFAC2A33/);
  assert.equal(solaria.compact, undefined);

  assert.equal(day6.stay, "Solaria 連泊");
  assert.equal(day6.breakfast, "no");
  assert.equal(day6.dinner, "no");
  assert.equal(day6.next, "福岡。");
  const stayOn = legsOf(6, "hotel")[0];
  assert.equal(stayOn.compact, true);
  assert.equal(stayOn.breakfast, "no");
  assert.match(stayOn.extras, /今早素泊り/);
  assert.equal(stayOn.refs.length, 0);
  assert.doesNotMatch(JSON.stringify(stayOn.refs), /T032CA29B451B/);

  assert.equal(day7.stay, "今晚未訂");
  assert.equal(day7.breakfast, "no");
  assert.equal(day7.dinner, "unknown");
  assert.equal(day7.next, "Solaria 官網 11:00 退房。今晚未訂。");
  assert.doesNotMatch(day7.stay, /熊本|福岡|Solaria/);
  const day7Hotel = legsOf(7, "hotel")[0];
  assert.equal(day7Hotel.compact, true);
  assert.equal(day7Hotel.checkOut, "9/5");
  assert.equal(day7Hotel.officialOut, "11:00");
  assert.equal(day7Hotel.breakfast, "no");
  assert.equal(day7Hotel.dinner, "unknown");
  assert.match(day7Hotel.extras, /今早素泊り/);
  assert.ok(day7Hotel.refs.some((ref) => ref.value === "T032CA29B451B"));
  assert.doesNotMatch(JSON.stringify(day7Hotel), /TF53AEFAC2A33/);
  assert.equal(legsOf(7, "flight").length, 0);

  assert.equal(day8.stay, "回家");
  assert.equal(day8.breakfast, "unknown");
  const day8Flight = legsOf(8, "flight")[0];
  assert.equal(day8Flight.flight, "STARLUX JX317");
  assert.equal(day8Flight.routeLabel, "回程");
  assert.equal(day8Flight.time, "19:15–20:45");
  assert.equal(day8Flight.refs[0].value, "FCX2TD");
  const day8Car = legsOf(8, "car")[0];
  assert.match(day8Car.dropoff, /19:00/);
  assert.equal(legsOf(8, "hotel").length, 0);

  for (const day of [2, 3, 4, 5, 6, 7]) {
    assert.equal(legsOf(day, "flight").length, 0, `day ${day} should not show a flight card`);
    assert.equal(legsOf(day, "car").length, 0, `day ${day} should not show a car card`);
  }
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
  assert.match(page, /familyTripCarry/);
  assert.match(data, /帶著走/);
  assert.match(page, /官網聯絡/);
  assert.match(page, /信 \{letter\}/);
  assert.match(page, /官網 \{official\}/);
  assert.match(page, /fam-extras-sticker/);
  assert.match(page, /先看這幾行/);
  assert.match(page, /<dt>今早<\/dt>/);
  assert.match(page, /<dt>今晚<\/dt>/);
  assert.doesNotMatch(page, /<dt>早餐<\/dt>/);
  assert.doesNotMatch(page, /<dt>晚餐<\/dt>/);
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
  assert.doesNotMatch(data, /望水/);
  assert.doesNotMatch(data, /玉翠/);
  assert.doesNotMatch(data, /GM 填/);
  assert.doesNotMatch(data, /DOB|出生|生年月日|date of birth/i);
  assert.doesNotMatch(data, /CHIH HUNG CHAO/);
  assert.doesNotMatch(data, /另外兩人/);
  assert.doesNotMatch(data, /MISSING/);
  assert.match(data, /フリューゲル久住/);
  assert.match(data, /Tik Shan Sana Lai/);
  assert.match(data, /TF53AEFAC2A33/);
  assert.match(data, /T032CA29B451B/);
  assert.match(data, /今晚未訂/);
  assert.match(data, /Solaria 連泊/);
  assert.doesNotMatch(data, /Solaria 續住/);
  assert.match(data, /有車，不用車站接送/);
  assert.match(data, /いろは/);
  assert.match(data, /試飲/);
  assert.doesNotMatch(data, /申請期限/);
  assert.doesNotMatch(data, /JR由布院接送/);
  assert.doesNotMatch(data, /JR日田站/);
  assert.doesNotMatch(data, /豊後竹田/);
  assert.doesNotMatch(data, /計程車招呼站接送/);
  assert.match(family, /href="\/family\/trip"/);
  assert.match(family, /福岡 • 大分/);
  assert.match(robots, /\/family\/trip/);
  assert.doesNotMatch(capture, /createWorkQueue/);
  assert.match(capture, /CAPTURE_DUMP_LIMIT/);
});
