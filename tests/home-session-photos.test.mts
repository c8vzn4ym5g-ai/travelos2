import assert from "node:assert/strict";
import test from "node:test";
import {
  getCoffeeSessionPhotos,
  getTravelSessionPhotos,
  HOME_SESSION_PHOTO_LIMIT,
  pickHomeSessionPhotos,
} from "../lib/home-session-photos.ts";
import type { CoffeeShop, TripDetail } from "../lib/types.ts";

function photo(id: string, storageKey: string, caption = `${id} caption`) {
  return {
    cameraMake: null,
    cameraModel: null,
    caption,
    coordinates: null,
    createdAt: "2026-09-01T00:00:00.000Z",
    id,
    originalFilename: `${id}.jpg`,
    storageKey,
    takenAt: "2026-09-01T00:00:00.000Z",
    tripId: "trip_demo",
  };
}

function trip(id: string, photoCount: number, coverIndex = 0, visibility: TripDetail["visibility"] = "shared"): TripDetail {
  const photos = Array.from({ length: photoCount }, (_, index) =>
    photo(`${id}_p${index}`, `/api/trips/media?id=${id}-${index}`, `${id} ${index}`),
  );
  return {
    city: "Fukuoka",
    coordinates: null,
    costs: [],
    country: "Japan",
    coverPhotoId: photos[coverIndex]?.id ?? null,
    createdAt: "2026-09-01T00:00:00.000Z",
    endDate: "2026-09-08",
    id,
    journalEntries: [],
    musicTracks: [],
    photos,
    places: [],
    rating: null,
    slug: id.replace(/_/g, "-"),
    startDate: "2026-09-01",
    summary: "Family trip",
    title: id,
    totalCost: null,
    travelRoute: [],
    updatedAt: "2026-09-01T00:00:00.000Z",
    userId: "family",
    visibility,
  };
}

test("home session photo strip caps far below a full shared-trip dump", () => {
  const kyushu = trip("trip_kyushu_family_2026", 80);
  const paris = trip("trip_paris_louvre_summer_2023", 20);
  const tainan = trip("trip_tainan_beehive", 15);
  const photos = getTravelSessionPhotos([kyushu, paris, tainan]);

  assert.equal(photos.length, HOME_SESSION_PHOTO_LIMIT);
  assert.ok(photos.length < 111);
  assert.deepEqual(
    photos.slice(0, 3).map((item) => item.src),
    [
      "/api/trips/media?id=trip_kyushu_family_2026-0",
      "/api/trips/media?id=trip_paris_louvre_summer_2023-0",
      "/api/trips/media?id=trip_tainan_beehive-0",
    ],
  );
  assert.equal(new Set(photos.map((item) => item.src)).size, photos.length);
});

test("home session photos prefer covers then round-robin extras without duplicates", () => {
  const photos = pickHomeSessionPhotos(
    [
      {
        coverId: "a-cover",
        label: "A",
        photos: [photo("a1", "/a/1"), photo("a-cover", "/a/cover"), photo("a2", "/a/2")],
      },
      {
        coverId: "b-cover",
        label: "B",
        photos: [photo("b-cover", "/b/cover"), photo("b1", "/b/1")],
      },
    ],
    4,
  );

  assert.deepEqual(
    photos.map((item) => item.src),
    ["/a/cover", "/b/cover", "/a/1", "/b/1"],
  );
});

test("coffee home strip is also capped", () => {
  const shops = Array.from({ length: 12 }, (_, shopIndex) => ({
    address: "Paris",
    city: "Paris",
    coffeeOrdered: "Espresso",
    comments: "",
    coordinates: null,
    country: "France",
    createdAt: "2024-01-01T00:00:00.000Z",
    id: `coffee_${shopIndex}`,
    lifeNote: "note",
    linkedTripId: null,
    mapUrl: null,
    mood: "quiet",
    name: `Shop ${shopIndex}`,
    photos: Array.from({ length: 9 }, (_, photoIndex) => ({
      caption: `cup ${photoIndex}`,
      coffeeShopId: `coffee_${shopIndex}`,
      createdAt: "2024-01-01T00:00:00.000Z",
      id: `coffee_${shopIndex}_p${photoIndex}`,
      originalFilename: "cup.jpg",
      storageKey: `/coffee/${shopIndex}/${photoIndex}.jpg`,
      takenAt: null,
    })),
    rating: 5,
    slug: `shop-${shopIndex}`,
    tags: [],
    updatedAt: "2024-01-01T00:00:00.000Z",
    userId: "family",
    visitedAt: "2024-01-01",
    websiteUrl: null,
  })) as CoffeeShop[];

  const photos = getCoffeeSessionPhotos(shops);
  assert.equal(photos.length, HOME_SESSION_PHOTO_LIMIT);
});

test("unrenderable placeholders are skipped", () => {
  const photos = pickHomeSessionPhotos([
    {
      coverId: "blob",
      label: "Pending",
      photos: [photo("blob", "placeholder/not-ready.jpg"), photo("ok", "/api/trips/media?id=ok")],
    },
  ]);
  assert.deepEqual(photos.map((item) => item.src), ["/api/trips/media?id=ok"]);
});
