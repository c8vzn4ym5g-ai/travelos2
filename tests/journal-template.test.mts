import test from "node:test";
import assert from "node:assert/strict";
import { arrangeJournal, createJournal, addJournalStory } from "../lib/journal-template.ts";
import type { Photo } from "../lib/types.ts";

const now = "2026-09-14T10:00:00.000Z";

function photo(id: string, originalFilename: string, caption: string | null, takenAt: string | null): Photo {
  return { id, tripId: "trip_example", storageKey: `/media/${originalFilename}`, originalFilename,
    caption, takenAt, coordinates: null, cameraMake: null, cameraModel: null, createdAt: now };
}

test("a title alone opens a private journal with empty content and no invented trip dates", () => {
  const journal = createJournal("  一起去旅行  ", "trip_example", now);
  assert.equal(journal.title, "一起去旅行");
  assert.equal(journal.visibility, "private");
  assert.equal(journal.startDate, "");
  assert.equal(journal.endDate, "");
  assert.equal(journal.publicDateLabel, "");
  assert.equal(journal.showEntryDates, false);
  assert.equal(journal.summary, "");
  assert.equal(journal.closingNote, "");
  assert.equal(journal.coverPhotoId, null);
  assert.deepEqual(journal.journalEntries, []);
  assert.deepEqual(journal.photos, []);
  assert.deepEqual(journal.musicTracks, []);
  assert.equal(journal.publishedSnapshot, undefined);
});

test("arrangement preserves written stories, published reader version and every original asset", () => {
  const journal = addJournalStory(createJournal("旅行", "trip_example", now), "authored", now);
  journal.journalEntries[0] = { ...journal.journalEntries[0], title: "我寫的故事", body: "這段內容必須保留。", storyPhotoId: "used", entryDate: "2020-02-17" };
  journal.photos = [photo("used", "used.jpg", "已有故事的照片", "2020-02-17T09:00:00Z"), photo("new", "new.jpg", "照片原有說明", "2020-02-18T10:00:00Z")];
  journal.musicTracks = [{id:"music",tripId:journal.id,title:"原有配樂",audioUrl:"/song.mp3",triggerLabel:"",volume:0.5,enabled:true,createdAt:now}];
  journal.publishedSnapshot = { ...createJournal("公開版原文", journal.id, now), visibility: "public" };
  const original = structuredClone(journal);
  const arranged = arrangeJournal(journal, now);
  assert.deepEqual(arranged.journalEntries[0], original.journalEntries[0]);
  assert.deepEqual(arranged.publishedSnapshot, original.publishedSnapshot);
  for (const key of ["photos", "places", "travelRoute", "costs", "musicTracks"] as const) assert.deepEqual(arranged[key], original[key]);
  assert.equal(arranged.journalEntries.length, 2);
  assert.equal(arranged.journalEntries[1].body, "照片原有說明");
  assert.equal(arranged.journalEntries[1].entryDate, "2020-02-18");
  assert.equal(arranged.journalEntries[1].entryKind, "unreviewed");
  assert.deepEqual(journal, original);
  assert.deepEqual(arrangeJournal(arranged, now).journalEntries, arranged.journalEntries);
});

test("videos stay in assets but never become photo story chapters or the automatic cover", () => {
  const journal = createJournal("旅行", "trip_example", now);
  journal.photos = [photo("film", "movie.MP4", "影片說明", "2020-02-17T09:00:00Z"), photo("still", "still.jpg", null, null)];
  const arranged = arrangeJournal(journal, now);
  assert.deepEqual(arranged.photos, journal.photos);
  assert.deepEqual(arranged.journalEntries.map(entry => entry.storyPhotoId), ["still"]);
  assert.equal(arranged.coverPhotoId, "still");
  assert.equal(arranged.journalEntries[0].body, "");
  assert.equal(arranged.journalEntries[0].entryDate, "");
});

test("empty arrangement and adding a blank story do not manufacture memories", () => {
  const journal = createJournal("旅行", "trip_example", now);
  assert.deepEqual(arrangeJournal(journal, now), journal);
  const withStory = addJournalStory(journal, "new_story", now);
  assert.equal(withStory.journalEntries.length, 1);
  assert.equal(withStory.journalEntries[0].body, "");
  assert.equal(withStory.journalEntries[0].entryDate, "");
  assert.equal(withStory.journalEntries[0].storyPhotoId, null);
  assert.deepEqual(journal.journalEntries, []);
});

test("a large photo album gets at most six initial stories while retaining every asset", () => {
  const journal = createJournal("旅行", "trip_example", now);
  journal.photos = Array.from({length: 40}, (_, index) => photo(`photo_${index}`, `${index}.jpg`, `照片 ${index}`, null));
  const arranged = arrangeJournal(journal, now);
  assert.equal(arranged.journalEntries.length, 6);
  assert.equal(new Set(arranged.journalEntries.map(entry => entry.storyPhotoId)).size, 6);
  assert.deepEqual(arranged.photos, journal.photos);
  assert.deepEqual(arrangeJournal(arranged, now).journalEntries, arranged.journalEntries);
  assert.equal(journal.journalEntries.length, 0);
});
