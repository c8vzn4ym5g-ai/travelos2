import assert from 'node:assert/strict';
import test from 'node:test';
import { GET, PUT } from '../app/api/coffee/content/route.ts';
import { readCoffeeContent, writeCoffeeContent } from '../lib/coffee-store.ts';
import { seedCoffeeShops } from '../lib/coffee.ts';
import { setDriveWarehouseFetchForTests, resetDriveWarehouseForTests } from '../lib/drive-warehouse.ts';

const draft = { ...seedCoffeeShops[0], id: 'coffee_from_capture', slug: 'coffee-from-capture', name: '台中七期咖啡館', comments: '藝妓專門店', photos: [{ id: 'photo-real', coffeeShopId: 'coffee_from_capture', storageKey: 'drive:original', originalFilename: 'original.jpg', caption: null, takenAt: null, createdAt: '2026-09-14' }] };

test('coffee draft saves to existing named warehouse, reopens, and preserves samples', async () => {
  let stored: unknown = null;
  const operations: string[] = [];
  setDriveWarehouseFetchForTests(async (input, init) => {
    const payload = typeof init?.body === 'string' ? JSON.parse(init.body) : null;
    const url = new URL(String(input));
    assert.equal(payload?.name ?? url.searchParams.get('name'), 'travelos__coffee.json');
    assert.equal(payload?.op ?? url.searchParams.get('op'), 'item');
    operations.push(init?.method ?? 'GET');
    if (payload) { stored = { moment: JSON.parse(payload.text), updatedAt: 'warehouse-write-time' }; return Response.json({ ok: true, name: payload.name }); }
    return Response.json(stored ?? { error: 'not found' });
  });
  try {
    const initial = await GET();
    const seed = await initial.json();
    assert.equal(seed.status.configured, true);
    assert.equal(seed.content.shops.length, 3);
    const response = await PUT(new Request('https://travelos.test/api/coffee/content', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ shops: [...seed.content.shops, draft] }) }));
    assert.equal(response.status, 200, await response.clone().text());
    const result = await readCoffeeContent();
    assert.equal(result.status.source, 'drive');
    assert.equal(result.content.shops.length, 4);
    assert.equal(result.content.shops.find(shop => shop.id === draft.id)?.visibility, 'private');
    assert.equal(result.content.shops.find(shop => shop.id === draft.id)?.photos[0].storageKey, 'drive:original');
    for (const sample of seedCoffeeShops) assert.deepEqual(result.content.shops.find(shop => shop.id === sample.id), sample);
    assert.equal(operations.filter(op => op === 'POST').length, 1);
  } finally { resetDriveWarehouseForTests(); }
});

test('unavailable coffee record cannot masquerade as sample-only content', async () => {
  setDriveWarehouseFetchForTests(async () => Response.json({ error: 'unavailable' }));
  try { await assert.rejects(readCoffeeContent()); } finally { resetDriveWarehouseForTests(); }
});

test('coffee save requires named-record readback, not only an optimistic acknowledgment', async () => {
  setDriveWarehouseFetchForTests(async (_input, init) => Response.json(init?.method === 'POST' ? { ok: true } : { error: 'not found' }));
  try { await assert.rejects(writeCoffeeContent([...seedCoffeeShops, { ...draft, visibility: 'private' }])); } finally { resetDriveWarehouseForTests(); }
});

test('coffee read falls back to the newest exact Drive file when warehouse item fails', async () => {
  const operations: string[] = [];
  const request: typeof fetch = async input => {
    const url = new URL(String(input));
    const op = url.searchParams.get('op'); operations.push(op ?? url.pathname);
    if (op === 'item') return Response.json({ error: 'unavailable' });
    if (op === 'drive-access') return Response.json({ token: 'fixture', folderId: 'family' });
    if (url.searchParams.has('q')) {
      assert.equal(url.searchParams.get('q'), "'family' in parents and trashed = false and name = 'travelos__coffee.json'");
      assert.equal(url.searchParams.get('orderBy'), 'modifiedTime desc');
      return Response.json({ files: [{ id: 'latest-coffee', name: 'travelos__coffee.json' }] });
    }
    assert.equal(url.pathname, '/drive/v3/files/latest-coffee');
    return Response.json({ moment: { schemaVersion: 1, shops: [...seedCoffeeShops, { ...draft, visibility: 'private' }], updatedAt: 'current' } });
  };
  const result = await readCoffeeContent(request);
  assert.equal(result.content.shops.length, 4);
  assert.equal(result.content.shops.find(shop => shop.id === draft.id)?.visibility, 'private');
  assert.equal(operations.length, 4);
});
