import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const page = await readFile(new URL("../app/trips/[slug]/page.tsx", import.meta.url), "utf8");
const mobile = await readFile(new URL("../components/lapland-mobile-storefront.tsx", import.meta.url), "utf8");
const media = await readFile(new URL("../components/reader-media.tsx", import.meta.url), "utf8");

test("reader retains complete story once and gives chapter links actual targets", () => {
  assert.equal((page.match(/<NarrativeBody body=\{entry.body\}/g) ?? []).length, 1);
  assert.doesNotMatch(page, /Narrative notes|StoryMomentCard|getBestStoryPhoto/);
  for (const source of [page, mobile]) {
    assert.match(source, /href=\{`#story-\$\{entry.id\}`\}/);
    assert.match(source, /id=\{`story-\$\{entry.id\}`\}/);
    assert.match(source, /entry.storyPhotoId/);
    assert.doesNotMatch(source, /usedStoryPhotoIds/);
  }
  assert.equal((mobile.match(/entry.body.split/g) ?? []).length, 1);
});

test("both readers defer full albums and media loading", () => {
  for (const source of [page, mobile]) assert.match(source, /<ReaderAlbum photos=/);
  assert.match(media, /useState\(0\)/);
  assert.match(media, /photos.slice\(0, visible\)/);
  assert.match(media, /setVisible\(count => count \+ 8\)/);
  assert.match(media, /setVisible\(0\)/);
  assert.match(media, /loading=\{priority \? "eager" : "lazy"\}/);
});

test("video files use a controlled player; a film opening preserves existing Lapland cut", () => {
  assert.match(media, /return isTripPhotoVideo\(photo\) \? \(\s*<video/);
  assert.match(media, /controls playsInline preload="none"/);
  assert.match(page, /<LaplandPublicCut \/> : <ReaderFilm videos=\{getTripPromoVideos\(trip.slug\)\}/);
});
