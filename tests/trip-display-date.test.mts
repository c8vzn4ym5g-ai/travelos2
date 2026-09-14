import assert from "node:assert/strict";
import test from "node:test";
import { tripDisplayDate } from "../lib/trip-display-date.ts";

test("legacy reader date shows year and month without changing exact travel dates", () => {
  const trip = { startDate: "2020-02-17", endDate: "2020-02-25" };
  assert.equal(tripDisplayDate(trip), "2020.02");
  assert.equal(trip.startDate, "2020-02-17");
  assert.equal(trip.endDate, "2020-02-25");
});

test("author can use free text or explicitly hide the public date", () => {
  assert.equal(tripDisplayDate({ startDate: "2020-02-17", publicDateLabel: "2020 冬天" }), "2020 冬天");
  assert.equal(tripDisplayDate({ startDate: "2020-02-17", publicDateLabel: "" }), "");
  assert.equal(tripDisplayDate({ startDate: "2020" }), "2020");
  assert.equal(tripDisplayDate({ startDate: "" }), "");
});
