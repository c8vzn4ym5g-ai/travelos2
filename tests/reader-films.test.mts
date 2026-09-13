import assert from "node:assert/strict";
import { stat } from "node:fs/promises";
import test from "node:test";
import { getTripPromoVideos } from "../lib/promo-videos.ts";

test("Higashiyama has the actual reviewed film and poster without a Drive round trip", async () => {
  const [film] = getTripPromoVideos("kyoto-maple-higashiyama");
  assert.equal(film.src, "/travelos/films/higashiyama-autumn.mp4");
  assert.equal(film.poster, "/travelos/films/higashiyama-autumn.jpg");
  for (const path of [film.src, film.poster!]) {
    assert.ok((await stat(new URL(`../public${path}`, import.meta.url))).size > 1000);
  }
  assert.match(film.credit!.href, /^https:\/\/opengameart.org\//);
});

test("existing journey films keep their stored media routes and selections are independent", () => {
  const films = getTripPromoVideos("kyushu-family-fukuoka-oguni-aso-2026");
  assert.equal(films.length, 2);
  assert.equal(films[0].src, "/api/trips/media?name=travelos__promo__kyushu-a.mp4");
  films[0].src = "changed";
  assert.notEqual(getTripPromoVideos("kyushu-family-fukuoka-oguni-aso-2026")[0].src, "changed");
  assert.deepEqual(getTripPromoVideos("missing-journey"), []);
});
