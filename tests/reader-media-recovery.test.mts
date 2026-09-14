import assert from 'node:assert/strict';
import test from 'node:test';
import {GET} from '../app/api/trips/media/route.ts';
import {setDriveWarehouseFetchForTests, resetDriveWarehouseForTests} from '../lib/drive-warehouse.ts';

test('expired photo access refreshes once and returns image; failures are not cached', async () => {
  const original = globalThis.fetch;
  let accessCalls = 0, imageCalls = 0;
  setDriveWarehouseFetchForTests(async () => Response.json({token: 'test-token-' + (++accessCalls)}));
  globalThis.fetch = async (_input, init) => {
    imageCalls++;
    if (imageCalls === 1) return new Response(null,{status:401});
    assert.equal(new Headers(init?.headers).get('Authorization'),'Bearer test-token-2');
    return new Response(new Uint8Array([255,216,255]),{headers:{'content-type':'image/jpeg'}});
  };
  try {
    const response = await GET(new Request('http://localhost/api/trips/media?id=test_photo'));
    assert.equal(response.status,200);
    assert.equal(response.headers.get('content-type'),'image/jpeg');
    assert.equal(accessCalls,2);
    assert.equal(imageCalls,2);
    globalThis.fetch = async () => new Response(null,{status:502});
    const failed = await GET(new Request('http://localhost/api/trips/media?id=test_photo'));
    assert.equal(failed.status,502);
    assert.equal(failed.headers.get('cache-control'),'no-store');
  } finally { globalThis.fetch=original; resetDriveWarehouseForTests(); }
});
