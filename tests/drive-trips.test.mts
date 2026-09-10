import assert from "node:assert/strict";
import test from "node:test";
import {
  duplicateDriveTripFileIds,
  parseDriveTripRecord,
  preferLatestDriveTrips,
  selectDriveTripFilesForRead,
  selectLatestDriveTripFiles,
} from "../lib/drive-trips.ts";
import type { TripDetail } from "../lib/types.ts";

function trip(id: string, title: string): TripDetail {
  return {
    id,
    userId: "family",
    title,
    slug: id.replace(/_/g, "-"),
    summary: "",
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

test("Drive trip listing keeps the latest file per name", () => {
  const files = selectLatestDriveTripFiles([
    {
      id: "old-arashiyama",
      name: "travelos__trip__trip_kyoto_maple_arashiyama.json",
      modifiedTime: "2026-09-09T10:08:46.737Z",
    },
    {
      id: "new-arashiyama",
      name: "travelos__trip__trip_kyoto_maple_arashiyama.json",
      modifiedTime: "2026-09-09T10:12:57.472Z",
    },
    {
      id: "ginkaku",
      name: "travelos__trip__trip_kyoto_maple_ginkaku.json",
      modifiedTime: "2026-09-09T10:08:49.496Z",
    },
    {
      id: "notes",
      name: "readme.txt",
      modifiedTime: "2026-09-09T12:00:00.000Z",
    },
  ]);
  assert.deepEqual(
    files.map((file) => file.id).sort(),
    ["ginkaku", "new-arashiyama"],
  );
});

test("parsed Drive trips keep the latest copy per trip id", () => {
  const trips = preferLatestDriveTrips([
    {
      modifiedTime: "2026-09-09T10:08:46.737Z",
      trip: trip("trip_kyoto_maple_arashiyama", "爱慕虚荣团 · 岚山：翠嵐·竹林·渡月桥"),
    },
    {
      modifiedTime: "2026-09-09T10:12:57.472Z",
      trip: trip("trip_kyoto_maple_arashiyama", "爱慕虚荣团 · 岚山翠嵐：温泉饭店里的枫叶禁区"),
    },
    {
      modifiedTime: "2026-09-09T10:07:51.810Z",
      trip: trip("trip_kyoto_maple_crew_notes", "爱慕虚荣团：四个人怎么一起把京都玩开心"),
    },
  ]);
  assert.equal(trips.length, 2);
  assert.equal(trips[0]?.title, "爱慕虚荣团 · 岚山翠嵐：温泉饭店里的枫叶禁区");
  assert.equal(trips[0]?.visibility, "private");
});

test("Drive listing holds the mega maple trip and unconfirmed tofukuji candidate", () => {
  const files = selectDriveTripFilesForRead([
    { id: "canonical", name: "travelos__trip__trip_kyoto_maple.json", modifiedTime: "2026-09-09T12:00:00.000Z" },
    { id: "tofuku", name: "travelos__trip__trip_kyoto_maple_tofukuji_path.json", modifiedTime: "2026-09-09T10:08:00.000Z" },
    { id: "ara", name: "travelos__trip__trip_kyoto_maple_arashiyama.json", modifiedTime: "2026-09-09T10:12:00.000Z" },
    { id: "kyushu", name: "travelos__trip__trip_kyushu_family_2026.json", modifiedTime: "2026-09-09T10:00:00.000Z" },
  ]);
  assert.deepEqual(
    files.map((file) => file.id).sort(),
    ["ara", "kyushu"],
  );
});

test("Drive trip reader holds unconfirmed maple files and prepares the series", async () => {
  const source = await import("node:fs/promises").then((fs) =>
    fs.readFile(new URL("../lib/drive-trips.ts", import.meta.url), "utf8"),
  );
  assert.match(source, /prepareFamilyEditorTrips/);
  assert.match(source, /selectDriveTripFilesForRead/);
  assert.match(source, /VANITY_CREW_HELD_TRIP_IDS/);
  assert.match(source, /duplicateDriveTripFileIds/);
  assert.match(source, /trashed: true/);
  assert.match(source, /parseDriveTripRecord/);
  assert.match(source, /getWarehouseTripBundle/);
  assert.match(source, /putWarehouseTrip/);
});

test("older same-name Drive trip files are marked for trash", () => {
  assert.deepEqual(
    duplicateDriveTripFileIds(
      [
        { id: "keep", name: "travelos__trip__trip_kyoto_maple_ginkaku.json", modifiedTime: "2026-09-09T12:00:00.000Z" },
        { id: "old", name: "travelos__trip__trip_kyoto_maple_ginkaku.json", modifiedTime: "2026-09-09T10:00:00.000Z" },
      ],
      "keep",
    ),
    ["old"],
  );
});

test("Drive trip JSON wrapped as Apps Script moment still parses", () => {
  const wrapped = parseDriveTripRecord({
    updatedAt: "2026-09-10T12:19:42.247Z",
    moment: {
      id: "trip_kyoto_maple_arashiyama",
      title: "嵐山翠嵐",
      slug: "kyoto-maple-arashiyama",
      journalEntries: [{ id: "j1", title: "渡月橋", body: "竹林。" }],
      photos: [{ id: "p1", storageKey: "/api/trips/media?id=x" }],
    },
  });
  assert.equal(wrapped?.id, "trip_kyoto_maple_arashiyama");
  assert.equal(wrapped?.title, "嵐山翠嵐");
  assert.equal(wrapped?.photos.length, 1);
  assert.equal(wrapped?.journalEntries.length, 1);

  const raw = parseDriveTripRecord({
    id: "trip_kyushu_family_2026",
    title: "九州家庭慢遊：福岡、大分與阿蘇",
    slug: "kyushu-family",
    journalEntries: [
      { id: "kyushu_arrival", title: "大分 奧日田 梅響 溫泉酒店", body: "梅酒廠 經營的溫泉旅館。" },
      { id: "kyushu_chikuan", title: "小國町附近：竹庵的驚人份量", body: "到了熊本小國町附近，公路旁的餐廳：竹庵。" },
    ],
  });
  assert.equal(raw?.journalEntries[0]?.title, "大分 奧日田 梅響 溫泉酒店");
  assert.equal(raw?.journalEntries[1]?.title, "小國町附近：竹庵的驚人份量");

  assert.equal(parseDriveTripRecord({ moment: { trips: ["trip_tokyo_crew"], photos: [] } }), null);
  assert.equal(parseDriveTripRecord({ id: "trip_kyoto_maple", title: "mega" }), null);
});

test("wrapped maple files without a top-level title do not collapse into one trip", () => {
  const trips = preferLatestDriveTrips([
    {
      modifiedTime: "2026-09-10T12:19:42.247Z",
      trip: parseDriveTripRecord({
        moment: { id: "trip_kyoto_maple_arashiyama", title: "嵐山翠嵐" },
      })!,
    },
    {
      modifiedTime: "2026-09-10T12:19:51.106Z",
      trip: parseDriveTripRecord({
        moment: { id: "trip_kyoto_maple_crew_notes", title: "愛慕虛榮團：四個人怎麼一起把京都玩開心" },
      })!,
    },
  ]);
  assert.equal(trips.length, 2);
  assert.equal(trips.find((item) => item.id === "trip_kyoto_maple_arashiyama")?.title, "嵐山翠嵐");
  assert.equal(
    trips.find((item) => item.id === "trip_kyoto_maple_crew_notes")?.title,
    "愛慕虛榮團：四個人怎麼一起把京都玩開心",
  );
});
