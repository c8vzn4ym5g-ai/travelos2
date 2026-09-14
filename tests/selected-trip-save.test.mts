import assert from 'node:assert/strict';
import test from 'node:test';
import { POST, PUT } from '../app/api/trips/content/route.ts';
import { readDriveTrip } from '../lib/drive-trips.ts';
import { resetDriveWarehouseForTests } from '../lib/drive-warehouse.ts';
import { seedTripDetails } from '../lib/trips.ts';

const id = 'trip_11111111-2222-4333-8444-555555555555';
const draft = { ...seedTripDetails[0], id, slug: id.replaceAll('_', '-'), title: 'Working story', visibility: 'public' as const, updatedAt: '2026-09-13T10:00:00Z', publishedSnapshot: { ...seedTripDetails[0], title: 'Published story' } };

async function storage(run: (writes: typeof draft[], operations: string[]) => Promise<void>, exists = true, accessAvailable = true) {
  const original = globalThis.fetch;
  const testContext = process.env.NODE_TEST_CONTEXT;
  const writes: typeof draft[] = [];
  const operations: string[] = [];
  resetDriveWarehouseForTests();
  globalThis.fetch = async (input, init) => {
    const url = new URL(String(input));
    const body = init?.body && typeof init.body === 'string' ? JSON.parse(init.body) : null;
    const op = body?.op ?? url.searchParams.get('op');
    operations.push(op ?? url.pathname);
    if (op === 'drive-access') return Response.json(accessAvailable ? { token: 'fixture-token', folderId: 'fixture-folder' } : { error: 'temporarily unavailable' });
    if (op === 'item') { assert.equal(url.searchParams.get('name'), `travelos__trip__${id}.json`); return Response.json(exists ? draft : { error: 'not found' }); }
    if (op === 'editor-catalog') return Response.json(body ? { ok: true } : { trips: exists ? [draft] : [] });
    if (op === 'trip') { writes.push(JSON.parse(body.text)); return Response.json({ ok: true }); }
    if (url.searchParams.has('q')) {
      assert.match(url.searchParams.get('q')!, /name = 'travelos__trip__/,'ordinary writes must select one file');
      return Response.json({ files: exists ? [{ id: 'selected-file', name: `travelos__trip__${id}.json` }] : [] });
    }
    if (url.searchParams.get('alt') === 'media') return Response.json(draft);
    throw new Error(`Unexpected whole-library/index operation: ${op ?? url.pathname}`);
  };
  delete process.env.NODE_TEST_CONTEXT;
  try { await run(writes, operations); } finally { globalThis.fetch = original; if (testContext) process.env.NODE_TEST_CONTEXT = testContext; resetDriveWarehouseForTests(); }
}
const request = (method: string, body: unknown) => new Request('https://travelos.test/api/trips/content', { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

test('selected save bypasses unrelated library reads and preserves published snapshot', async () => storage(async (writes, ops) => {
  const response = await PUT(request('PUT', { trip: { ...draft, title: 'New working story' }, baseUpdatedAt: draft.updatedAt }));
  assert.equal(response.status, 200, await response.clone().text());
  const result = await response.json();
  assert.equal(result.trip.title, 'New working story');
  assert.equal(result.trip.publishedSnapshot.title, 'Published story');
  assert.equal(result.content, undefined);
  assert.equal(writes.length, 1);
  assert.equal(ops.includes('trips'), false);
}));

test('selected save rejects stale version before writing', async () => storage(async writes => {
  const response = await PUT(request('PUT', { trip: draft, baseUpdatedAt: 'stale' }));
  assert.equal(response.status, 409);
  assert.equal(writes.length, 0);
}));

test('new generated-address trip saves privately without reading unrelated trip bodies', async () => storage(async writes => {
  const response = await POST(request('POST', { trip: draft }));
  assert.equal(response.status, 200, await response.clone().text());
  const result = await response.json();
  assert.equal(result.trip.visibility, 'private');
  assert.equal(result.trip.publishedSnapshot, undefined);
  assert.equal(writes.length, 1);
}, false));

test('ordinary selected reads reuse access within the existing token lifetime', async () => storage(async (_writes, ops) => {
  await readDriveTrip(id);
  await readDriveTrip(id);
  assert.equal(ops.filter(op => op === 'drive-access').length, 1);
}));


test('explicit publish updates the selected public snapshot', async () => storage(async writes => {
  const response = await PUT(request('PUT', { trip: { ...draft, title: 'Ready story' }, baseUpdatedAt: draft.updatedAt, publish: true }));
  assert.equal(response.status, 200);
  assert.equal(writes[0].publishedSnapshot?.title, 'Ready story');
}));

test('known duplicate address is rejected without a save', async () => storage(async writes => {
  const response = await PUT(request('PUT', { trip: { ...draft, slug: seedTripDetails[1].slug } }));
  assert.equal(response.status, 409);
  assert.equal(writes.length, 0);
}));

test('missing selected trip cannot be saved', async () => storage(async writes => {
  const response = await PUT(request('PUT', { trip: draft }));
  assert.equal(response.status, 404);
  assert.equal(writes.length, 0);
}, false));


test('new trip reaches existing warehouse writer when direct access is unavailable', async () => storage(async (writes, ops) => {
  const response = await POST(request('POST', { trip: draft }));
  assert.equal(response.status, 200, await response.clone().text());
  assert.equal(writes.length, 1);
  assert.equal(ops.includes('drive-access'), false, 'creating a draft needs no exposed Drive access token');
}, false, false));

test('selected save falls back to named warehouse record when direct access is unavailable', async () => storage(async writes => {
  const response = await PUT(request('PUT', { trip: { ...draft, title: 'Saved with warehouse' }, baseUpdatedAt: draft.updatedAt }));
  assert.equal(response.status, 200, await response.clone().text());
  assert.equal(writes[0].title, 'Saved with warehouse');
  assert.equal(writes[0].publishedSnapshot.title, 'Published story');
}, true, false));
