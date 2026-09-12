import assert from 'node:assert/strict';
import test from 'node:test';
import { readMoments, resetMomentStoreForTests } from '../lib/moment-store.ts';
import { getIndex, setDriveWarehouseFetchForTests } from '../lib/drive-warehouse.ts';

test('catalog reader reports a network failure instead of a successful empty warehouse', async () => {
  resetMomentStoreForTests();
  setDriveWarehouseFetchForTests(async () => { throw new Error('offline'); });
  try { await assert.rejects(readMoments({ requireCatalog: true })); }
  finally { resetMomentStoreForTests(); }
});

test('catalog error payload is not parsed as an empty family library', async () => {
  await assert.rejects(getIndex(async () => Response.json({ error: 'busy' })));
});

test('a genuinely empty catalog remains a valid empty library', async () => {
  const content = await getIndex(async () => Response.json({ moments: [], jobs: [] }));
  assert.deepEqual(content.moments, []);
});
