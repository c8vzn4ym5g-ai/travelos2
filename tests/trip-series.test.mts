import assert from "node:assert/strict";
import test from "node:test";
import { formatEditorTripPickerLabel } from "../lib/editor-trip-label.ts";
import {
  VANITY_CREW_SERIES,
  prepareFamilyEditorTrips,
  prepareReaderChinese,
  searchTripsBySeries,
  stripSeriesFromTitle,
  toTraditional,
} from "../lib/trip-series.ts";
import { compareTripsByStartDateDesc, isTripPublic } from "../lib/trip-visibility.ts";
import type { JournalEntry, Photo, TripDetail } from "../lib/types.ts";

function baseTrip(id: string, title: string): TripDetail {
  return {
    id,
    userId: "user_travelos_owner",
    title,
    slug: id.replace(/_/g, "-"),
    summary: `${title} summary`,
    country: "Japan",
    city: "Kyoto",
    startDate: "2022-11-15",
    endDate: "2022-11-16",
    coverPhotoId: null,
    visibility: "private",
    rating: null,
    totalCost: null,
    coordinates: null,
    createdAt: "2022-11-15T00:00:00.000Z",
    updatedAt: "2022-11-15T00:00:00.000Z",
    photos: [],
    journalEntries: [],
    places: [],
    travelRoute: [],
    costs: [],
    musicTracks: [],
  };
}

function ingestPhoto(driveId: string, filename: string): Photo {
  return {
    originalFilename: filename,
    storageKey: "",
    caption: filename,
    takenAt: null,
    coordinates: null,
    cameraMake: null,
    cameraModel: null,
    createdAt: "2022-11-15T00:00:00.000Z",
    id: "",
    tripId: "",
    date: "2022-11-15",
    sourceRecords: [{ driveId }],
  } as Photo & { date: string; sourceRecords: Array<{ driveId: string }> };
}

function journal(title: string, body: string): JournalEntry {
  return {
    id: "",
    tripId: "",
    title,
    body,
    entryDate: "2022-11-15",
    storyPhotoId: null,
    voiceNoteUrl: null,
    mood: null,
    weatherSummary: null,
    aiSummary: null,
    createdAt: "2022-11-15T00:00:00.000Z",
    updatedAt: "2022-11-15T00:00:00.000Z",
  };
}

test("maple journals keep Traditional titles from PUT; series stays 愛慕虛榮團", () => {
  const kyushu = baseTrip("trip_kyushu_family_2026", "九州家庭慢遊：福岡、小國町與阿蘇");
  const arashiyama = baseTrip("trip_kyoto_maple_arashiyama", "嵐山翠嵐");
  arashiyama.photos = [ingestPhoto("drive_suiran", "IMG_2718.jpg")];
  arashiyama.journalEntries = [journal("住进枫叶区里面的饭店", "翠嵐禁区竹林。回顾红枫西门，不写东福寺。")];
  const ginkaku = baseTrip("trip_kyoto_maple_ginkaku", "爱慕虚荣团 · 银阁寺线（Day17）");
  ginkaku.startDate = "2022-11-17";
  ginkaku.endDate = "2022-11-17";
  ginkaku.journalEntries = [journal("银阁寺确认：池中「北斗石」", "北斗石。")];
  const higashiyama = baseTrip("trip_kyoto_maple_higashiyama", "爱慕虚荣团 · 东山朱色／清水候选（Day18）");
  higashiyama.startDate = "2022-11-18";
  higashiyama.endDate = "2022-11-18";
  higashiyama.journalEntries = [journal("朱红与蓝天", "东山。")];
  const crew = baseTrip("trip_kyoto_maple_crew_notes", "愛慕虛榮團：四個人怎麼一起把京都玩開心");
  crew.journalEntries = [journal("团名、分工、开心配额", "三位姐妹。")];
  const tofukuji = baseTrip("trip_kyoto_maple_tofukuji_path", "红叶参道候选篇：是否东福寺，待确认");
  const mega = baseTrip("trip_kyoto_maple", "爱慕虚荣团 · 京都枫叶");

  const prepared = prepareFamilyEditorTrips([kyushu, arashiyama, ginkaku, higashiyama, crew, tofukuji, mega]);
  assert.equal(prepared.some((trip) => trip.id === "trip_kyushu_family_2026"), true);
  assert.equal(prepared.some((trip) => trip.id === "trip_kyoto_maple_arashiyama"), true);
  assert.equal(prepared.some((trip) => trip.id === "trip_kyoto_maple_ginkaku"), true);
  assert.equal(prepared.some((trip) => trip.id === "trip_kyoto_maple_higashiyama"), true);
  assert.equal(prepared.some((trip) => trip.id === "trip_kyoto_maple_crew_notes"), true);
  assert.equal(prepared.some((trip) => trip.id === "trip_kyoto_maple_tofukuji_path"), false);
  assert.equal(prepared.some((trip) => trip.id === "trip_kyoto_maple"), false);

  const maple = prepared.filter((trip) => trip.series === VANITY_CREW_SERIES);
  assert.equal(maple.length, 4);
  assert.ok(maple.every((trip) => trip.visibility === "private"));
  assert.ok(maple.every((trip) => !isTripPublic(trip)));
  assert.ok(maple.every((trip) => trip.series === "愛慕虛榮團"));
  assert.equal(prepared.find((trip) => trip.id === "trip_kyoto_maple_arashiyama")?.title, "嵐山翠嵐");
  assert.equal(prepared.find((trip) => trip.id === "trip_kyoto_maple_ginkaku")?.title, "銀閣寺線");
  assert.equal(prepared.find((trip) => trip.id === "trip_kyoto_maple_higashiyama")?.title, "東山朱色");
  assert.equal(prepared.find((trip) => trip.id === "trip_kyoto_maple_ginkaku")?.startDate, "2022-11-17");
  assert.equal(prepared.find((trip) => trip.id === "trip_kyoto_maple_higashiyama")?.startDate, "2022-11-18");
  assert.ok(maple.every((trip) => !/Day\s*\d+/i.test(trip.title)));
  assert.ok(maple.every((trip) => !trip.title.includes("候選")));
  assert.equal(prepared.find((trip) => trip.id === "trip_kyoto_maple_crew_notes")?.title, "愛慕虛榮團：四個人怎麼一起把京都玩開心");
  assert.match(prepared.find((trip) => trip.id === "trip_kyoto_maple_arashiyama")?.journalEntries[0]?.body ?? "", /回顧紅楓西門，不寫東福寺/);
  assert.equal(prepared.find((trip) => trip.id === "trip_kyoto_maple_arashiyama")?.photos[0]?.storageKey, "/api/trips/media?id=drive_suiran");

  const doublePrefixed = prepareFamilyEditorTrips([
    baseTrip("trip_kyoto_maple_arashiyama", "爱慕虚荣团 · 愛慕虛榮團 · 嵐山翠嵐：溫泉飯店裡的楓葉禁區"),
  ]);
  assert.equal(doublePrefixed[0]?.title, "嵐山翠嵐：溫泉飯店裡的楓葉禁區");

  const forcedLong = prepareFamilyEditorTrips([
    baseTrip("trip_kyoto_maple_arashiyama", "嵐山翠嵐"),
  ]);
  assert.equal(forcedLong[0]?.title, "嵐山翠嵐");

  assert.equal(searchTripsBySeries(prepared, "").length, prepared.length);
  const found = searchTripsBySeries(prepared, VANITY_CREW_SERIES);
  assert.equal(found.length, 4);
  assert.equal(found.some((trip) => trip.id === "trip_kyushu_family_2026"), false);
  assert.equal(searchTripsBySeries(prepared, "爱慕虚荣团").length, 4);
});

test("reader Chinese converts Simplified to Taiwan Traditional without 朱色/亞得里亞 over-conversion", () => {
  assert.equal(toTraditional("东山朱色／清水候选"), "東山朱色／清水候選");
  assert.equal(toTraditional("朱红与蓝天"), "朱紅與藍天");
  assert.equal(toTraditional("哲学之道一带"), "哲學之道一帶");
  assert.equal(toTraditional("饭店里的枫叶"), "飯店裡的楓葉");
  assert.equal(toTraditional("亞得里亞海兩日"), "亞得里亞海兩日");
  assert.equal(toTraditional("小鹿田燒之里"), "小鹿田燒之里");
  assert.equal(toTraditional("性價比很高"), "性價比很高");
  assert.equal(toTraditional("局部：護具"), "局部：護具");
  assert.equal(toTraditional("二月的台南鹽水"), "二月的臺南鹽水");

  const kyushu = baseTrip("trip_kyushu_family_2026", "九州家庭慢遊：福岡、小國町與阿蘇");
  kyushu.journalEntries = [journal("竹庵", "性價比很高。局部風景。")];
  kyushu.places = [{
    id: "place_1",
    tripId: kyushu.id,
    type: "restaurant",
    name: "竹庵",
    country: "Japan",
    city: "Kumamoto",
    address: null,
    coordinates: null,
    rating: null,
    notes: "一带很挤",
    createdAt: "2022-11-15T00:00:00.000Z",
    updatedAt: "2022-11-15T00:00:00.000Z",
  }];
  const converted = prepareReaderChinese(kyushu);
  assert.equal(converted.places[0]?.notes, "一帶很擠");
  assert.equal(converted.places[0]?.city, "Kumamoto");
  assert.match(converted.journalEntries[0]?.body ?? "", /性價比很高/);
  assert.match(converted.journalEntries[0]?.body ?? "", /局部風景/);

  const higashiyama = baseTrip("trip_kyoto_maple_higashiyama", "东山朱色／清水候选（Day18）");
  higashiyama.journalEntries = [journal("朱红与蓝天", "东山。")];
  (higashiyama as TripDetail & { crew?: { note: string } }).crew = { note: "嵐山→銀閣→東山朱色，同一團。" };
  const maple = prepareFamilyEditorTrips([higashiyama])[0];
  assert.equal(maple?.title, "東山朱色");
  assert.equal(maple?.journalEntries[0]?.title, "朱紅與藍天");
  assert.equal((maple as TripDetail & { crew?: { note: string } }).crew?.note, "嵐山→銀閣→東山朱色，同一團。");
});

test("Kyushu locked 梅響 and 竹庵 journals keep Owner bodies through editor prepare", () => {
  const kyushu = baseTrip("trip_kyushu_family_2026", "九州家庭慢遊：福岡、大分與阿蘇");
  kyushu.journalEntries = [
    {
      ...journal("大分 奧日田 梅響 溫泉酒店", "梅酒廠 經營的溫泉旅館。價效比算高。"),
      id: "kyushu_arrival",
    },
    {
      ...journal("小國町附近：竹庵的驚人份量", "到了熊本小國町附近，公路旁的餐廳：竹庵。份量大到極度誇張。"),
      id: "kyushu_chikuan",
    },
  ];
  const prepared = prepareFamilyEditorTrips([kyushu])[0];
  assert.equal(prepared?.journalEntries[0]?.title, "大分 奧日田 梅響 溫泉酒店");
  assert.equal(prepared?.journalEntries[1]?.title, "小國町附近：竹庵的驚人份量");
  assert.match(prepared?.journalEntries[0]?.body ?? "", /梅酒廠 經營的溫泉旅館/);
  assert.match(prepared?.journalEntries[0]?.body ?? "", /價效比算高/);
  assert.match(prepared?.journalEntries[1]?.body ?? "", /公路旁的餐廳：竹庵/);
});

test("family editor prepare does not throw when Drive omitted a title", () => {
  const broken = baseTrip("trip_tainan-yanshui-fireworks_2020", "鹽水蜂炮");
  (broken as { title?: string }).title = undefined;
  assert.doesNotThrow(() => prepareFamilyEditorTrips([broken]));
});

test("trip startDate sort treats null dates as empty", () => {
  const withDate = { startDate: "2019-12-11" };
  const missing = { startDate: null };
  const ordered = [withDate, missing].sort(compareTripsByStartDateDesc);
  assert.equal(ordered[0], withDate);
  assert.doesNotThrow(() => [missing, missing].sort(compareTripsByStartDateDesc));
});

test("editor trip picker keeps Lapland title and omits trailing pipe when date is empty", () => {
  assert.equal(stripSeriesFromTitle("北極圈上的十二月"), "北極圈上的十二月");
  const lapland = baseTrip("trip_lapland_2020", "北極圈上的十二月");
  lapland.startDate = "2019-12-11";
  const prepared = prepareFamilyEditorTrips([lapland])[0];
  assert.equal(prepared?.title, "北極圈上的十二月");
  assert.equal(
    formatEditorTripPickerLabel(prepared?.title, prepared?.startDate),
    "北極圈上的十二月 | 2019-12-11",
  );
  assert.equal(formatEditorTripPickerLabel("北極圈上的十二月", "2019-12-11"), "北極圈上的十二月 | 2019-12-11");
  assert.equal(formatEditorTripPickerLabel("東京走走", ""), "東京走走");
  assert.equal(formatEditorTripPickerLabel("瑞士山水", null), "瑞士山水");
  assert.equal(formatEditorTripPickerLabel("西班牙陽光", "   "), "西班牙陽光");
  assert.doesNotMatch(formatEditorTripPickerLabel("東京走走", ""), /\s*\|\s*$/);
  assert.equal(formatEditorTripPickerLabel("  ", "2019-12-11"), "2019-12-11");
});
