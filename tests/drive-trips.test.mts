import assert from "node:assert/strict";
import test from "node:test";
import {
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
});
