import assert from 'node:assert/strict';
import test from 'node:test';
import { POST as capture, GET as momentsGet } from '../app/api/moments/route.ts';
import { GET as tripGet, PUT as tripPut } from '../app/api/trips/content/route.ts';
import { addPhotoToMoment, resetMomentStoreForTests, setMomentBlobAdapterForTests } from '../lib/moment-store.ts';
import { resetDriveWarehouseForTests } from '../lib/drive-warehouse.ts';
import { loadWriteMoments } from '../lib/write-moment-load.ts';
import { transferWritingToTrip } from '../lib/write-photo-transfer.ts';
import { saveWritingTrip } from '../lib/save-writing-trip.ts';
import { createJournal } from '../lib/journal-template.ts';
import type { TripDetail } from '../lib/types.ts';

test('isolated Capture record → Bench read → exact batch → selected work save → fresh laptop read', async () => {
  const files = new Map<string, string>();
  const target = createJournal('Synthetic target', 'trip_11111111-2222-4333-8444-555555555555', '2026-10-27T00:00:00Z');
  const unrelated = createJournal('Untouched work', 'trip_aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee', '2026-10-27T00:00:00Z');
  const trips = new Map<string, TripDetail>([[target.id, target], [unrelated.id, unrelated]]);
  const originalFetch = globalThis.fetch;
  const context = process.env.NODE_TEST_CONTEXT;
  resetMomentStoreForTests();
  const attachStorage = () => setMomentBlobAdapterForTests({
    async get(path) {
      const value = files.get(path);
      return value ? { statusCode: 200, stream: new Blob([value]).stream() } : null;
    },
    async put(path, text) { files.set(path, text); return { pathname: path, url: `https://fixture.test/${path}` }; },
  });
  attachStorage();
  globalThis.fetch = async (input, init) => {
    const url = new URL(String(input));
    const payload = typeof init?.body === 'string' ? JSON.parse(init.body) : null;
    const op = payload?.op ?? url.searchParams.get('op');
    if (op === 'drive-access') return Response.json({ token: 'fixture', folderId: 'fixture' });
    if (op === 'editor-catalog') return Response.json(payload ? { ok: true } : { trips: [...trips.values()] });
    if (op === 'trip') { const saved = JSON.parse(payload.text); trips.set(saved.id, saved); return Response.json({ ok: true }); }
    if (op === 'item') {
      const name = url.searchParams.get('name') ?? '';
      const id = name.slice('travelos__trip__'.length, -5);
      return Response.json(trips.get(id) ?? { error: 'not found' });
    }
    if (url.searchParams.has('q')) {
      assert.match(url.searchParams.get('q')!, /name = 'travelos__trip__/);
      return Response.json({ files: [{ id: target.id, name: `travelos__trip__${target.id}.json` }] });
    }
    if (url.searchParams.get('alt') === 'media') return Response.json(trips.get(target.id));
    throw new Error(`External network forbidden in fixture: ${url.origin} ${op}`);
  };
  try {
    const created = await capture(new Request('https://fixture.test/api/moments', { method: 'POST', body: JSON.stringify({ id: 'moment_handoff_fixture', note: 'Synthetic material' }) }));
    assert.equal(created.status, 200);
    const { moment } = await created.json();
    await addPhotoToMoment(moment.id, { id: 'fixture-photo', momentId: moment.id, storageKey: 'https://fixture.test/photo.jpg', originalStorageKey: 'https://fixture.test/original.heic', originalFilename: 'fixture.heic', createdAt: moment.createdAt, takenAt: null, coordinates: null });
    resetMomentStoreForTests(); attachStorage();
    const bench = await momentsGet(new Request('https://fixture.test/api/moments'));
    assert.equal(bench.status, 200);
    assert.equal((await bench.json()).content.moments[0].id, moment.id);
    const selected = await loadWriteMoments(moment.id, {}, async (path) => momentsGet(new Request(`https://fixture.test${path}`)));
    const source = structuredClone(selected.moments[0]);
    const updated = transferWritingToTrip({ trip: target, photos: source.photos, draft: 'Fixture prose for laptop', sourceKey: `moment:${moment.id}`, now: '2026-10-27T01:00:00Z' });
    delete process.env.NODE_TEST_CONTEXT;
    const saved = await saveWritingTrip(updated, target.updatedAt, {}, async (_path, init) => tripPut(new Request('https://fixture.test/api/trips/content', init)));
    resetDriveWarehouseForTests();
    const reopened = await tripGet(new Request(`https://fixture.test/api/trips/content?id=${target.id}`));
    assert.equal(reopened.status, 200);
    const laptop = (await reopened.json()).trip;
    assert.equal(laptop.id, target.id);
    assert.equal(laptop.journalEntries[0].body, 'Fixture prose for laptop');
    assert.equal(laptop.photos[0].sourceMomentId, moment.id);
    assert.equal(laptop.photos[0].originalStorageKey, 'https://fixture.test/original.heic');
    assert.equal(laptop.updatedAt, saved.trip.updatedAt);
    assert.equal(laptop.visibility, 'private');
    assert.deepEqual(trips.get(unrelated.id), unrelated);
    assert.deepEqual(selected.moments[0], source);
  } finally {
    globalThis.fetch = originalFetch;
    if (context === undefined) delete process.env.NODE_TEST_CONTEXT; else process.env.NODE_TEST_CONTEXT = context;
    resetMomentStoreForTests();
  }
});
