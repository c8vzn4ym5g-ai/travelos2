import assert from "node:assert/strict";
import test from "node:test";
import { reconcileSavedTrips, reconcileUploadedPhoto } from "../lib/editor-save.ts";
import type { TripDetail } from "../lib/types.ts";
const trip = (id: string, title: string) => ({id,title,updatedAt:'old'} as TripDetail);
test('save acknowledgement preserves edits typed during the request and unrelated trips', () => {
  const sent=trip('one','sent');
  const typed=trip('one','new words');
  const other=trip('two','wife edits');
  const result=reconcileSavedTrips([typed,other],[sent],[{...sent,updatedAt:'saved'}]);
  assert.deepEqual(result.trips,[typed,other]);
  assert.deepEqual(result.acknowledged,[]);
});

test('upload completion adds the new photo without discarding concurrent text or photo edits', () => {
  const oldPhoto = { id: 'p1', caption: 'old' };
  const uploaded = { id: 'p2', caption: 'new photo' };
  const submitted = { ...trip('one', 'sent'), photos: [oldPhoto] } as TripDetail;
  const current = { ...submitted, title: 'typed while uploading', photos: [{ ...oldPhoto, caption: 'edited' }] } as TripDetail;
  const remote = { ...submitted, updatedAt: 'server', photos: [oldPhoto, uploaded] } as TripDetail;
  const result = reconcileUploadedPhoto([current], [submitted], [remote], 'one', 'p2');
  assert.equal(result.trips[0].title, 'typed while uploading');
  assert.deepEqual(result.trips[0].photos, [{ ...oldPhoto, caption: 'edited' }, uploaded]);
  assert.deepEqual(result.acknowledged, []);
});
test('only unchanged submitted revisions are acknowledged', () => {
  const sent=trip('one','sent');
  const saved={...sent,updatedAt:'saved'};
  assert.deepEqual(reconcileSavedTrips([sent],[sent],[saved]),{trips:[saved],acknowledged:['one']});
});
