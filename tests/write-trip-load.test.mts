import assert from 'node:assert/strict';
import test from 'node:test';
import { loadWritingTrips } from '../lib/write-trip-load.ts';
test('a transient destination-list failure retries without changing the writing draft', async () => {
  let calls = 0;
  const trips = await loadWritingTrips({}, async () => ++calls === 1 ? Response.json({}, {status:503}) : Response.json({content:{trips:[{id:'chosen'}]}}));
  assert.deepEqual(trips, [{id:'chosen'}]); assert.equal(calls,2);
});
test('persistent destination-list failure stops after two reads', async () => {
  let calls=0;
  await assert.rejects(loadWritingTrips({}, async () => { calls++; throw new Error('offline'); }));
  assert.equal(calls,2);
});
