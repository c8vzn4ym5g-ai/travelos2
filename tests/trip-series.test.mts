import assert from "node:assert/strict";
import test from "node:test";
import {
  VANITY_CREW_SERIES,
  prepareFamilyEditorTrips,
  searchTripsBySeries,
} from "../lib/trip-series.ts";
import { isTripPublic } from "../lib/trip-visibility.ts";
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

test("maple journals keep place-only Traditional titles; series stays 愛慕虛榮團", () => {
  const kyushu = baseTrip("trip_kyushu_family_2026", "九州家庭慢遊：福岡、小國町與阿蘇");
  const arashiyama = baseTrip("trip_kyoto_maple_arashiyama", "爱慕虚荣团 · 岚山翠嵐：温泉饭店里的枫叶禁区");
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
  const crew = baseTrip("trip_kyoto_maple_crew_notes", "爱慕虚荣团：四个人怎么一起把京都玩开心");
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
  assert.ok(maple.every((trip) => !trip.title.includes("爱慕虚荣团")));
  assert.ok(maple.every((trip) => !trip.title.includes("愛慕虛榮團")));
  assert.equal(prepared.find((trip) => trip.id === "trip_kyoto_maple_arashiyama")?.title, "嵐山翠嵐：溫泉飯店裡的楓葉禁區");
  assert.equal(prepared.find((trip) => trip.id === "trip_kyoto_maple_ginkaku")?.title, "銀閣寺線");
  assert.equal(prepared.find((trip) => trip.id === "trip_kyoto_maple_higashiyama")?.title, "東山朱色／清水候選");
  assert.equal(prepared.find((trip) => trip.id === "trip_kyoto_maple_ginkaku")?.startDate, "2022-11-17");
  assert.equal(prepared.find((trip) => trip.id === "trip_kyoto_maple_higashiyama")?.startDate, "2022-11-18");
  assert.ok(maple.every((trip) => !/Day\s*\d+/i.test(trip.title)));
  assert.equal(prepared.find((trip) => trip.id === "trip_kyoto_maple_crew_notes")?.title, "京都四人怎麼一起玩開心");
  assert.match(prepared.find((trip) => trip.id === "trip_kyoto_maple_arashiyama")?.journalEntries[0]?.body ?? "", /回顧紅楓西門，不寫東福寺/);
  assert.equal(prepared.find((trip) => trip.id === "trip_kyoto_maple_arashiyama")?.photos[0]?.storageKey, "/api/trips/media?id=drive_suiran");

  const doublePrefixed = prepareFamilyEditorTrips([
    baseTrip("trip_kyoto_maple_arashiyama", "爱慕虚荣团 · 愛慕虛榮團 · 嵐山翠嵐：溫泉飯店裡的楓葉禁區"),
  ]);
  assert.equal(doublePrefixed[0]?.title, "嵐山翠嵐：溫泉飯店裡的楓葉禁區");

  assert.equal(searchTripsBySeries(prepared, "").length, prepared.length);
  const found = searchTripsBySeries(prepared, VANITY_CREW_SERIES);
  assert.equal(found.length, 4);
  assert.equal(found.some((trip) => trip.id === "trip_kyushu_family_2026"), false);
  assert.equal(searchTripsBySeries(prepared, "爱慕虚荣团").length, 4);
});
