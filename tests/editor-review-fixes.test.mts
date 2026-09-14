import assert from 'node:assert/strict';
import test from 'node:test';
import {seedTripDetails} from '../lib/trips.ts';
import {tripCover, setTripCover} from '../lib/trip-cover.ts';
import {readEditorTripRecord} from '../lib/editor-trip-read.ts';

test('editor reads one named draft, retains its published snapshot, rejects wrong record', async () => {
  const base = seedTripDetails[0];
  const draft = {...base, id:'trip_review', title:'Working title', publishedSnapshot:{...base,title:'Published title'}};
  const urls: URL[] = [];
  const request: typeof fetch = async input => {urls.push(new URL(String(input))); return Response.json({moment:draft});};
  const result = await readEditorTripRecord('trip_review',request);
  assert.equal(result?.id,'trip_review');
  assert.equal(result?.title,'Working title');
  assert.equal(result?.publishedSnapshot?.title,'Published title');
  assert.equal(urls.length,1);
  assert.equal(urls[0].searchParams.get('op'),'item');
  assert.equal(urls[0].searchParams.get('name'),'travelos__trip__trip_review.json');
  await assert.rejects(readEditorTripRecord('trip_wrong',request));
});

test('cover fallback is visible and a published-only cover can be edited without changing published state', () => {
  const base = seedTripDetails.find(trip => trip.photos.length)!;
  const first = {...base.photos[0], id:'first',storageKey:'/first.jpg',mimeType:'image/jpeg'};
  const published = {...first,id:'published',storageKey:'/published.jpg'};
  const draft = {...base,photos:[first],coverPhotoId:null,publishedSnapshot:{...base,photos:[published],coverPhotoId:published.id}};
  assert.equal(tripCover(draft)?.id,'first');
  const updated = setTripCover(draft,published);
  assert.equal(tripCover(updated)?.id,'published');
  assert.equal(updated.photos.length,2);
  assert.equal(draft.photos.length,1);
  assert.equal(updated.publishedSnapshot,draft.publishedSnapshot);
});
