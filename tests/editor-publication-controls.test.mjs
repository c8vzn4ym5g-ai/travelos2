import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = await readFile(new URL("../app/trips/admin/page.tsx", import.meta.url), "utf8");
test("ordinary save and explicit publication have distinct request intentions", () => {
  const save = source.slice(source.indexOf("async function saveAllChanges"), source.indexOf("async function publishActiveTrip"));
  const publish = source.slice(source.indexOf("async function publishActiveTrip"), source.indexOf("async function uploadPhoto"));
  assert.match(source, /persistTrips\(drafts: TripDetail\[\], publish = false\)/);
  assert.match(save, /persistTrips\(drafts\)/);
  assert.doesNotMatch(save, /persistTrips\(drafts, true\)/);
  assert.match(publish, /persistTrips\(drafts, true\)/);
  assert.match(publish, /window.confirm/);
  assert.match(source, /onClick=\{\(\) => void publishActiveTrip\(\)\}/);
  assert.doesNotMatch(source, /type="password"|event.target.value as TravelVisibility/);
});

test("classification edits stored field without replacing original body", () => {
  assert.match(source, /value=\{journalEntryKind\(entry\)\}/);
  assert.match(source, /updateJournalEntry\(entry.id, \{ entryKind:/);
  assert.match(source, /value=\{entry.body\}/);
});

test("working preview uses current editor state and returns without saving or navigating", async () => {
  const preview = await readFile(new URL("../components/trip-draft-preview.tsx", import.meta.url), "utf8");
  assert.match(source, /<TripDraftPreview trip=\{activeTrip\}/);
  assert.match(source, /setDraftPreview\(false\)/);
  assert.match(source, /setDraftPreview\(true\)/);
  assert.match(preview, /onClick=\{onBack\}/);
  assert.match(preview, /entry.body.split/);
  assert.match(preview, /entry.storyPhotoId/);
  assert.doesNotMatch(preview, /fetch\(|router\.|window\.location|password|persistTrips/);
});
