import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";
import {
  defaultTripDay,
  FAMILY_TRIP_DATES,
  FAMILY_TRIP_FOOTER,
  FAMILY_TRIP_KMJ_MAP_SRC,
  FAMILY_TRIP_SERENA_SRC,
  FAMILY_TRIP_START,
  FAMILY_TRIP_TITLE,
  familyTripDay1,
  familyTripDays,
  formatTripMd,
  NISSAN_RESERVATION,
  SOLARIA_ARRIVAL_BOOKING,
  SOLARIA_RETURN_BOOKING,
  STARLUX_PNR,
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

test("day-1 companion matches the passed mock: 飛 → 車 → 住", () => {
  assert.equal(FAMILY_TRIP_TITLE, "福岡・大分");
  assert.equal(familyTripDay1.next, "去搭飛機");
  assert.equal(familyTripDay1.nextDetail, "JX316 15:00 RMQ→KMJ");
  assert.equal(familyTripDay1.flight.number, "JX316");
  assert.equal(familyTripDay1.flight.route, "RMQ → KMJ");
  assert.equal(familyTripDay1.flight.time, "15:00 → 18:15");
  assert.equal(familyTripDay1.flight.pnr, STARLUX_PNR);
  assert.equal(familyTripDay1.car.name, "Nissan Serena");
  assert.equal(familyTripDay1.car.pickup, "8/30 19:30 熊本機場");
  assert.equal(familyTripDay1.car.dropoff, "9/6 19:00 同店");
  assert.equal(familyTripDay1.car.access, "訪客中心・走路3分・不用接駁");
  assert.equal(familyTripDay1.car.accessDetail, "D出口往左・08:00–20:00");
  assert.equal(familyTripDay1.car.reservation, NISSAN_RESERVATION);
  assert.equal(familyTripDay1.car.photoSrc, FAMILY_TRIP_SERENA_SRC);
  assert.equal(familyTripDay1.car.mapSrc, FAMILY_TRIP_KMJ_MAP_SRC);
  assert.equal(familyTripDay1.hotel.nameZh, "Solaria福岡");
  assert.equal(familyTripDay1.hotel.nameJa, "ソラリア西鉄ホテル福岡");
  assert.equal(familyTripDay1.hotel.checkIn, "預計車程 熊本機場→福岡 約1小時15分");
  assert.equal(familyTripDay1.hotel.checkOut, "11:00 官網");
  assert.equal(familyTripDay1.hotel.breakfast, "yes");
  assert.equal(familyTripDay1.hotel.dinner, "no");
  assert.equal(familyTripDay1.hotel.pay, "已付 ¥43,580 信用卡・不可退");
  assert.equal(familyTripDay1.hotel.booking, SOLARIA_ARRIVAL_BOOKING);
  assert.notEqual(SOLARIA_ARRIVAL_BOOKING, SOLARIA_RETURN_BOOKING);
});

test("week rows keep hotel-plan meals, pay, and the two Solaria bookings", () => {
  const [day1, day2, day3, day4, day5, day6, day7, day8] = familyTripDays;

  assert.equal(day1.nameZh, "Solaria福岡");
  assert.equal(day1.breakfast, "yes");
  assert.equal(day1.dinner, "no");
  assert.equal(day1.pay, "已付 ¥43,580");
  assert.deepEqual(day1.icons, ["hotel", "plane"]);
  assert.equal(day1.tone, "honey");

  assert.equal(day2.nameZh, "星野 界・由布院");
  assert.equal(day2.nameJa, "界 由布院");
  assert.equal(day2.breakfast, "yes");
  assert.equal(day2.breakfastNote, "8:45");
  assert.equal(day2.dinner, "no");
  assert.ok(day2.extra.includes("14:30入界"));
  assert.ok(day2.extra.includes("温泉小課 いろは 16:10"));
  assert.equal(day2.pay, "已付 ¥141,000");
  assert.equal(day2.tone, "mint");

  assert.equal(day3.nameZh, "奧日田溫泉 梅響");
  assert.equal(day3.nameJa, "うめひびき");
  assert.equal(day3.breakfast, "yes");
  assert.equal(day3.dinner, "no");
  assert.ok(day3.extra.includes("15:00入"));
  assert.ok(day3.extra.includes("梅酒試飲・酒吧 20:00"));
  assert.equal(day3.pay, "到店付 ¥55,800");

  assert.equal(day4.nameZh, "Flügel 久住");
  assert.equal(day4.nameJa, "フリューゲル久住");
  assert.equal(day4.breakfast, "yes");
  assert.equal(day4.dinner, "yes");
  assert.equal(day4.pay, "到店付 ¥149,600・入湯稅另計");

  assert.equal(day5.nameZh, "Solaria福岡");
  assert.equal(day5.breakfast, "no");
  assert.equal(day5.dinner, "no");
  assert.ok(day5.extra.includes("15:00入天神"));
  assert.equal(day5.pay, "到店付 ¥156,868");
  assert.equal(SOLARIA_RETURN_BOOKING, "T032CA29B451B");

  assert.equal(day6.nameZh, "Solaria福岡");
  assert.equal(day6.pay, "同一筆（兩晚）");
  assert.doesNotMatch(day6.pay, /¥/);
  assert.equal(day6.breakfast, "no");
  assert.equal(day6.dinner, "no");

  assert.equal(day7.nameZh, "還沒訂");
  assert.equal(day7.breakfast, "no");
  assert.equal(day7.dinner, null);
  assert.ok(day7.extra.includes("Solaria 11:00退"));
  assert.equal(day7.pay, "");

  assert.equal(day8.nameZh, "回程");
  assert.equal(day8.breakfast, null);
  assert.equal(day8.dinner, null);
  assert.ok(day8.extra.includes("還車 19:00 ・ JX317 19:15"));
  assert.equal(day8.tone, "sky");
  assert.equal(FAMILY_TRIP_FOOTER, "沒有接駁車。9/5 還沒訂。");
});

test("companion page is family-only, matches the mock chrome, and keeps dump/Lapland untouched", async () => {
  const [page, data, css, family, layout, robots, capture] = await Promise.all([
    readSource("app/family/trip/page.tsx"),
    readSource("lib/family-trip.ts"),
    readSource("app/family/family.css"),
    readSource("app/family/page.tsx"),
    readSource("app/family/layout.tsx"),
    readSource("app/robots.ts"),
    readSource("app/family/capture/page.tsx"),
  ]);

  assert.match(layout, /data-surface="family"/);
  assert.match(layout, /themeColor: "#F0F6E4"/);
  assert.match(page, /today-card/);
  assert.match(page, /data-kind="flight"/);
  assert.match(page, /data-kind="car"/);
  assert.match(page, /data-kind="hotel"/);
  assert.match(page, /fam-day-strip/);
  assert.match(page, /fam-day-wk/);
  assert.match(page, />早餐</);
  assert.match(page, />晚餐</);
  assert.match(page, /fam-mark-yes/);
  assert.match(page, /fam-mark-no/);
  assert.match(page, /familyTripDay1\.next/);
  assert.match(page, /fam-car-photo/);
  assert.match(page, /fam-kmj-map/);
  assert.match(page, /object-contain/);
  assert.match(css, /object-fit: contain/);
  assert.match(page, /FAMILY_TRIP_FOOTER/);
  assert.match(data, /去搭飛機/);
  assert.match(data, /沒有接駁車/);
  assert.match(page, /fam-doll/);
  assert.match(page, /resolveFamilySession/);
  assert.match(page, /router\.replace\("\/family"\)/);
  assert.match(page, /const \[authenticated, setAuthenticated\] = useState\(true\)/);
  assert.doesNotMatch(page, /type="password"/);
  assert.doesNotMatch(page, /id="family-pin"/);
  assert.doesNotMatch(page, /familyTripCarry/);
  assert.doesNotMatch(page, /帶著走/);
  assert.doesNotMatch(page, /今早/);
  assert.doesNotMatch(page, /今晚/);
  assert.doesNotMatch(page, /明早/);
  assert.doesNotMatch(page, /有<\/span>/);
  assert.doesNotMatch(page, /沒有<\/span>/);
  assert.doesNotMatch(page, /官網聯絡/);
  assert.doesNotMatch(page, /信 \{letter\}/);
  assert.doesNotMatch(page, /GM 填/);
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
  assert.doesNotMatch(data, /今早/);
  assert.doesNotMatch(data, /明早/);
  assert.doesNotMatch(data, /今晚未訂/);
  assert.doesNotMatch(data, /帶著走/);
  assert.doesNotMatch(data, /申請期限/);
  assert.doesNotMatch(data, /JR由布院接送/);
  assert.doesNotMatch(data, /JR日田站/);
  assert.doesNotMatch(data, /豊後竹田/);
  assert.doesNotMatch(data, /計程車招呼站接送/);
  assert.match(data, /梅響/);
  assert.match(data, /うめひびき/);
  assert.match(data, /星野 界・由布院/);
  assert.match(data, /Flügel 久住/);
  assert.match(data, /フリューゲル久住/);
  assert.match(data, /TF53AEFAC2A33/);
  assert.match(data, /T032CA29B451B/);
  assert.match(data, /同一筆（兩晚）/);
  assert.match(data, /還沒訂/);
  assert.match(family, /href="\/family\/trip"/);
  assert.match(family, /福岡・大分/);
  assert.match(robots, /\/family\/trip/);
  assert.doesNotMatch(capture, /createWorkQueue/);
  assert.match(capture, /CAPTURE_DUMP_LIMIT/);
});

test("Serena photo and KMJ map are copied image bytes, not redrawn substitutes", async () => {
  const serena = await readFile(resolve(root, "public/family/trip/serena.png"));
  const map = await readFile(resolve(root, "public/family/trip/kmj-map.jpg"));
  assert.equal(serena[0], 0x89);
  assert.equal(serena[1], 0x50);
  assert.equal(serena[2], 0x4e);
  assert.equal(serena[3], 0x47);
  assert.ok(serena.byteLength > 20_000);
  assert.equal(map[0], 0xff);
  assert.equal(map[1], 0xd8);
  assert.ok(map.byteLength > 20_000);
});
