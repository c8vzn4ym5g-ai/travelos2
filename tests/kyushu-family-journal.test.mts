import assert from "node:assert/strict";
import test from "node:test";
import {
  KYUSHU_FAMILY_END,
  KYUSHU_FAMILY_START,
  KYUSHU_FAMILY_TITLE,
  KYUSHU_UMEHIBIKI_ENTRY_ID,
  KYUSHU_UMEHIBIKI_OWNER_BODY,
  enrichKyushuFamilyTrip,
} from "../lib/kyushu-family-journal.ts";
import type { TripDetail } from "../lib/types.ts";

function stubTrip(overrides: Partial<TripDetail> = {}): TripDetail {
  return {
    id: "trip_kyushu_family_2026",
    userId: "user_travelos_owner",
    title: "九州家庭慢遊：福岡、小國町與阿蘇",
    slug: "kyushu-family-fukuoka-oguni-aso-2026",
    summary: "stub",
    country: "Japan",
    city: "Fukuoka",
    startDate: "2026-09-01",
    endDate: "2026-09-06",
    coverPhotoId: null,
    visibility: "private",
    rating: null,
    totalCost: null,
    coordinates: null,
    createdAt: "2026-09-09T10:00:00.000Z",
    updatedAt: "2026-09-09T10:00:00.000Z",
    photos: [],
    journalEntries: [
      {
        id: KYUSHU_UMEHIBIKI_ENTRY_ID,
        tripId: "trip_kyushu_family_2026",
        title: "大分 奧日田 梅響 溫泉酒店",
        body: KYUSHU_UMEHIBIKI_OWNER_BODY,
        entryDate: "2026-09-01",
        storyPhotoId: "trip_kyushu_family_2026_img_1423_jpg",
        voiceNoteUrl: null,
        mood: "期待",
        weatherSummary: "初秋暖晴",
        aiSummary: null,
        createdAt: "2026-09-09T10:00:00.000Z",
        updatedAt: "2026-09-09T12:55:03.972Z",
      },
    ],
    places: [],
    travelRoute: [],
    costs: [],
    musicTracks: [],
    ...overrides,
  };
}

test("Kyushu journal uses the 8-day stay spine and keeps Owner 梅響 words", () => {
  const enriched = enrichKyushuFamilyTrip(stubTrip());
  assert.equal(enriched.startDate, KYUSHU_FAMILY_START);
  assert.equal(enriched.endDate, KYUSHU_FAMILY_END);
  assert.equal(enriched.title, KYUSHU_FAMILY_TITLE);
  assert.ok(enriched.journalEntries.length >= 14);

  const ume = enriched.journalEntries.find((entry) => entry.id === KYUSHU_UMEHIBIKI_ENTRY_ID);
  assert.equal(ume?.body, KYUSHU_UMEHIBIKI_OWNER_BODY);
  assert.equal(ume?.title, "大分 奧日田 梅響 溫泉酒店");

  const titles = enriched.journalEntries.map((entry) => entry.title);
  assert.ok(titles.every((title) => !/Day\s*\d+/i.test(title)));
  assert.ok(titles.every((title) => !title.includes("愛慕虛榮團") && !title.includes("爱慕虚荣团")));
  assert.ok(titles.some((title) => title.includes("糸島")));
  assert.ok(titles.some((title) => title.includes("豆田町")));
  assert.ok(titles.some((title) => title.includes("長者原")));
  assert.ok(titles.some((title) => title.includes("筋湯")));
  assert.ok(titles.some((title) => title.includes("Flügel") || title.includes("久住")));
  assert.ok(titles.some((title) => title.includes("西川")));
  assert.ok(titles.some((title) => title.includes("還車")));

  const placeNames = enriched.places.map((place) => place.name).join(" ");
  assert.match(placeNames, /糸島/);
  assert.ok(enriched.places.some((place) => place.name === "小鹿田燒之里"));
  assert.match(placeNames, /豆田町/);
  assert.match(placeNames, /岡城跡/);
  assert.match(placeNames, /長湯/);
  assert.match(placeNames, /TF53AEFAC2A33|Solaria/);
  assert.ok(enriched.places.some((place) => (place.notes ?? "").includes("TF53AEFAC2A33")));
  assert.ok(enriched.places.some((place) => (place.notes ?? "").includes("T032CA29B451B")));
  assert.ok(enriched.places.some((place) => (place.notes ?? "").includes("KYIBNF266359")));
  assert.ok(enriched.places.some((place) => (place.notes ?? "").includes("202608240003264.01")));
  assert.ok(enriched.places.some((place) => (place.notes ?? "").includes("1252")));
  assert.equal(enriched.travelRoute.length >= 6, true);
  assert.ok(enriched.travelRoute.every((segment) => segment.fromLabel && segment.toLabel));
});
