import assert from "node:assert/strict";
import test from "node:test";
import { journalEntryKind, projectJournalForReader } from "../lib/journal-entry-kind.ts";
import type { TripDetail } from "../lib/types.ts";

test("legacy entries remain unreviewed; dates cannot promote a plan to actual", () => {
  assert.equal(journalEntryKind({}), "unreviewed");
  assert.equal(journalEntryKind({ entryKind: "plan" }), "plan");
  assert.equal(journalEntryKind({ entryKind: "actual" }), "actual");
});

test("public projection excludes explicit plans and their linked route without mutating original", () => {
  const source = { journalEntries: [
    { id: "a", body: "original plan", entryKind: "plan" },
    { id: "b", body: "confirmed", entryKind: "actual" },
    { id: "c", body: "old source" },
  ], travelRoute: [
    { id: "r-plan", linkedJournalEntryId: "a" },
    { id: "r-actual", linkedJournalEntryId: "b" },
  ] } as TripDetail;
  const before = JSON.stringify(source);
  const projected = projectJournalForReader(source);
  assert.deepEqual(projected.journalEntries.map(entry => entry.id), ["b", "c"]);
  assert.deepEqual(projected.travelRoute.map(route => route.id), ["r-actual"]);
  assert.equal(JSON.stringify(source), before);
  assert.equal(projected.journalEntries[1].body, "old source");
});
