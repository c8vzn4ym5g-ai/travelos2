import assert from "node:assert/strict";
import test from "node:test";
import {
  KYOTO_MAPLE_CHAPTER_IDS,
  KYOTO_MAPLE_SLUG,
  KYOTO_MAPLE_TITLE,
  KYOTO_MAPLE_TRIP_ID,
  foldKyotoMapleTrips,
} from "../lib/kyoto-maple-merge.ts";
import { selectDriveTripFilesForRead } from "../lib/drive-trips.ts";
import { isTripPublic } from "../lib/trip-visibility.ts";
import type { JournalEntry, Photo, Place, TripDetail } from "../lib/types.ts";

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

function journal(id: string, tripId: string, title: string, body: string): JournalEntry {
  return {
    id,
    tripId,
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

function ingestPhoto(driveId: string, filename: string, caption: string): Photo {
  return {
    originalFilename: filename,
    storageKey: "",
    caption,
    takenAt: null,
    coordinates: null,
    cameraMake: null,
    cameraModel: null,
    createdAt: "2022-11-15T00:00:00.000Z",
    id: "",
    tripId: "",
    date: "2022-11-15",
    sourceTime: "04:36:00",
    sourceRecords: [{ driveId }],
  } as Photo & { date: string; sourceTime: string; sourceRecords: Array<{ driveId: string }> };
}

test("maple chapters fold into one private Kyoto maple journey", () => {
  const kyushu = baseTrip("trip_kyushu_family_2026", "九州家庭慢遊：福岡、小國町與阿蘇");
  kyushu.startDate = "2026-09-01";
  const scotland = baseTrip("trip_scotland_edinburgh_2019", "蘇格蘭冬日：愛丁堡與威士忌酒鄉");
  const arashiyama = baseTrip("trip_kyoto_maple_arashiyama", "爱慕虚荣团 · 岚山翠嵐：温泉饭店里的枫叶禁区");
  arashiyama.summary = "翠嵐禁区竹林与茶寮。";
  arashiyama.photos = [ingestPhoto("drive_suiran", "IMG_2718.jpg", "岚山远景")];
  arashiyama.journalEntries = [journal("suiran_arrive", arashiyama.id, "住进枫叶区里面的饭店", "翠嵐嵌在枫叶带里。")];
  arashiyama.places = [{
    id: "",
    tripId: arashiyama.id,
    type: "hotel",
    name: "岚山",
    country: "Japan",
    city: "Kyoto",
    address: null,
    coordinates: null,
    rating: null,
    notes: "翠嵐",
    createdAt: "2022-11-15T00:00:00.000Z",
    updatedAt: "2022-11-15T00:00:00.000Z",
  } satisfies Place];

  const ginkaku = baseTrip("trip_kyoto_maple_ginkaku", "爱慕虚荣团 · 银阁寺线（Day17）");
  ginkaku.startDate = "2022-11-17";
  ginkaku.endDate = "2022-11-17";
  ginkaku.photos = [ingestPhoto("drive_ginkaku", "IMG_3014.jpg", "银阁")];
  ginkaku.journalEntries = [journal("ginkaku_stone", ginkaku.id, "银阁寺确认：池中「北斗石」", "北斗石。")];

  const higashiyama = baseTrip("trip_kyoto_maple_higashiyama", "爱慕虚荣团 · 东山朱色／清水候选（Day18）");
  higashiyama.startDate = "2022-11-18";
  higashiyama.endDate = "2022-11-18";
  higashiyama.journalEntries = [journal("higashi_red", higashiyama.id, "朱红与蓝天：东山打卡日", "朱色。")];

  const crew = baseTrip("trip_kyoto_maple_crew_notes", "爱慕虚荣团：四个人怎么一起把京都玩开心");
  crew.endDate = "2022-11-18";
  crew.photos = [ingestPhoto("drive_suiran", "IMG_2718.jpg", "重复的岚山照片")];
  crew.journalEntries = [journal("crew_name", crew.id, "团名、分工、开心配额", "三位姐妹加 Owner。")];

  const tofukuji = baseTrip("trip_kyoto_maple_tofukuji_path", "红叶参道候选篇：是否东福寺，待确认");
  tofukuji.startDate = "2022-11-17";
  tofukuji.endDate = "2022-11-18";
  tofukuji.journalEntries = [journal("tofuku_path", tofukuji.id, "这一页，先叫红叶参道", "待确认。")];

  const folded = foldKyotoMapleTrips([kyushu, scotland, arashiyama, ginkaku, higashiyama, crew, tofukuji]);
  assert.equal(folded.length, 3);
  assert.ok(folded.some((trip) => trip.id === "trip_kyushu_family_2026"));
  assert.ok(folded.some((trip) => trip.id === "trip_scotland_edinburgh_2019"));
  const maple = folded.find((trip) => trip.id === KYOTO_MAPLE_TRIP_ID);
  assert.ok(maple);
  assert.equal(maple.title, KYOTO_MAPLE_TITLE);
  assert.equal(maple.slug, KYOTO_MAPLE_SLUG);
  assert.equal(maple.visibility, "private");
  assert.equal(isTripPublic(maple), false);
  assert.equal(maple.startDate, "2022-11-15");
  assert.equal(maple.endDate, "2022-11-18");
  for (const chapterId of KYOTO_MAPLE_CHAPTER_IDS) {
    assert.equal(folded.some((trip) => trip.id === chapterId), false);
  }
  assert.equal(maple.photos.length, 2);
  assert.equal(maple.photos[0]?.storageKey, "/api/trips/media?id=drive_suiran");
  assert.ok(maple.journalEntries.some((entry) => entry.title.includes("岚山")));
  assert.ok(maple.journalEntries.some((entry) => entry.body.includes("北斗石") || entry.title.includes("银阁")));
  assert.ok(maple.journalEntries.some((entry) => entry.title.includes("东山") || entry.body.includes("朱色")));
  assert.ok(maple.journalEntries.some((entry) => entry.body.includes("姐妹") || entry.title.includes("团名")));
  assert.ok(maple.journalEntries.some((entry) => entry.title.includes("红叶参道") || entry.body.includes("待确认")));
  assert.match(maple.summary, /翠嵐|禁区|茶寮|银阁|东山/);
});

test("a saved canonical maple trip wins over leftover chapter files", () => {
  const canonical = baseTrip(KYOTO_MAPLE_TRIP_ID, KYOTO_MAPLE_TITLE);
  canonical.summary = "家人已改过的一版。";
  canonical.journalEntries = [journal("edited", KYOTO_MAPLE_TRIP_ID, "手改段落", "不要被章节覆盖。")];
  const leftover = baseTrip("trip_kyoto_maple_arashiyama", "旧岚山章");
  leftover.journalEntries = [journal("old", leftover.id, "旧稿", "应被丢掉。")];

  const folded = foldKyotoMapleTrips([canonical, leftover]);
  assert.equal(folded.length, 1);
  assert.equal(folded[0]?.id, KYOTO_MAPLE_TRIP_ID);
  assert.equal(folded[0]?.journalEntries[0]?.body, "不要被章节覆盖。");
  assert.equal(folded[0]?.visibility, "private");
});

test("Drive listing skips maple chapter files once the canonical trip exists", () => {
  const files = selectDriveTripFilesForRead([
    { id: "canonical", name: "travelos__trip__trip_kyoto_maple.json", modifiedTime: "2026-09-09T12:00:00.000Z" },
    { id: "old-ara", name: "travelos__trip__trip_kyoto_maple_arashiyama.json", modifiedTime: "2026-09-09T10:12:00.000Z" },
    { id: "kyushu", name: "travelos__trip__trip_kyushu_family_2026.json", modifiedTime: "2026-09-09T10:00:00.000Z" },
  ]);
  assert.deepEqual(
    files.map((file) => file.id).sort(),
    ["canonical", "kyushu"],
  );
});
