import assert from 'node:assert/strict';
import test from 'node:test';
import { POST } from '../app/api/trips/photos/route.ts';
import { resetDriveWarehouseForTests } from '../lib/drive-warehouse.ts';
import { seedTripDetails } from '../lib/trips.ts';

for (const mimeType of ['image/jpeg', 'video/mp4']) test(`selected ${mimeType} upload retains newest story and public snapshot`, async () => {
  const original = globalThis.fetch;
  const context = process.env.NODE_TEST_CONTEXT;
  const id = 'trip_upload';
  const before = { ...seedTripDetails[0], id, title: 'Before upload', photos: [], visibility: 'public', publishedSnapshot: { ...seedTripDetails[0], title: 'Published story' } };
  let saved: typeof before | undefined;
  let mediaReads = 0;
  resetDriveWarehouseForTests();
  globalThis.fetch = async (input, init) => {
    const url = new URL(String(input));
    const body = typeof init?.body === 'string' ? JSON.parse(init.body) : null;
    const op = body?.op ?? url.searchParams.get('op');
    if (op === 'drive-access') return Response.json({ token: 'fixture-token', folderId: 'fixture-folder' });
    if (op === 'trip') { saved = JSON.parse(body.text); return Response.json({ ok: true }); }
    if (op === 'editor-catalog') return Response.json({ ok: true });
    if (url.searchParams.has('q')) {
      assert.match(url.searchParams.get('q')!, /name = 'travelos__trip__trip_upload.json'/);
      return Response.json({ files: [{ id: 'selected', name: 'travelos__trip__trip_upload.json' }] });
    }
    if (url.searchParams.get('alt') === 'media') { mediaReads++; return Response.json({ ...before, title: mediaReads === 1 ? before.title : 'Newer family edit' }); }
    if (url.searchParams.get('uploadType') === 'resumable') return new Response(null, { headers: { location: 'https://www.googleapis.com/upload/drive/fixture-session' } });
    if (init?.method === 'PUT') return Response.json({ id: 'uploaded-file', name: 'family-media' });
    throw new Error('Whole-library operation is forbidden');
  };
  delete process.env.NODE_TEST_CONTEXT;
  try {
    const form = new FormData();
    form.set('tripId', id);
    form.set('file', new File(['real supplied bytes fixture'], mimeType === 'video/mp4' ? 'family.mp4' : 'family.jpg', { type: mimeType }));
    const response = await POST(new Request('https://travelos.test/api/trips/photos', { method: 'POST', body: form }));
    assert.equal(response.status, 200, await response.clone().text());
    const result = await response.json();
    assert.equal(result.trip.title, 'Newer family edit');
    assert.equal(result.photo.mimeType, mimeType);
    assert.equal(result.photo.takenAt, null, 'upload time must not become an invented capture date');
    assert.equal(result.trip.photos[0].storageKey, '/api/trips/media?id=uploaded-file');
    assert.equal(result.trip.publishedSnapshot.title, 'Published story');
    assert.equal(result.content.trips.length, 1);
    assert.equal(saved?.title, 'Newer family edit');
  } finally {
    globalThis.fetch = original;
    if (context) process.env.NODE_TEST_CONTEXT = context;
    resetDriveWarehouseForTests();
  }
});
