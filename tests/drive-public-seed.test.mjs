import assert from "node:assert/strict";
import test from "node:test";
import { seedTripDetails, withMissingSeedTrips } from "../lib/trips.ts";

test("Drive warehouse keeps leftover seed journals Owner still edits", () => {
  const kyushu = {
    ...seedTripDetails[0],
    id: "trip_kyushu_family_2026",
    title: "九州家庭慢遊：福岡、小國町與阿蘇",
    slug: "kyushu-family-2026",
    visibility: "private",
    startDate: "2026-09-01",
  };
  const maple = {
    ...seedTripDetails[0],
    id: "trip_kyoto_maple_arashiyama",
    title: "嵐山翠嵐：溫泉飯店裡的楓葉禁區",
    slug: "kyoto-maple-arashiyama",
    visibility: "private",
    series: "愛慕虛榮團",
    startDate: "2022-11-15",
  };

  const merged = withMissingSeedTrips([kyushu, maple]);
  const ids = merged.map((trip) => trip.id);

  assert.equal(ids.includes("trip_hokkaido_2025"), true);
  assert.equal(ids.includes("trip_bangkok_2025"), true);
  assert.equal(ids.includes("trip_paris_2024"), true);
  assert.equal(ids.includes("trip_london_2024"), true);
  assert.equal(ids.includes("trip_lapland_2020"), true);
  assert.equal(merged.filter((trip) => trip.id === "trip_kyushu_family_2026").length, 1);
});
