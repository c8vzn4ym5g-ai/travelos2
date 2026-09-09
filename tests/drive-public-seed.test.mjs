import assert from "node:assert/strict";
import test from "node:test";
import { seedTripDetails, withMissingPublicSeedTrips } from "../lib/trips.ts";
import { isTripPublic } from "../lib/trip-visibility.ts";

test("Drive warehouse keeps public Lapland seed and drops private demo seeds", () => {
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
    title: "爱慕虚荣团 · 岚山翠嵐：温泉饭店里的枫叶禁区",
    slug: "kyoto-maple-arashiyama",
    visibility: "private",
    series: "爱慕虚荣团",
    startDate: "2022-11-15",
  };

  const merged = withMissingPublicSeedTrips([kyushu, maple]);
  const ids = merged.map((trip) => trip.id);

  assert.deepEqual(ids.filter((id) => id === "trip_lapland_2020"), ["trip_lapland_2020"]);
  assert.equal(merged.some((trip) => trip.id === "trip_hokkaido_2025"), false);
  assert.equal(merged.some((trip) => trip.id === "trip_bangkok_2025"), false);
  assert.equal(merged.some((trip) => trip.id === "trip_paris_2024"), false);
  assert.equal(merged.some((trip) => trip.id === "trip_london_2024"), false);
  assert.ok(merged.every((trip) => trip.id === "trip_lapland_2020" || trip.id === kyushu.id || trip.id === maple.id));
  assert.ok(isTripPublic(merged.find((trip) => trip.id === "trip_lapland_2020")));
});
