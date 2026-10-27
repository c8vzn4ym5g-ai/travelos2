import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { saveWritingTrip } from '../lib/save-writing-trip.ts';
import { createJournal } from '../lib/journal-template.ts';

const trip = createJournal('Isolated handoff', 'trip_11111111-2222-4333-8444-555555555555', '2026-10-27T00:00:00Z');

test('Write accepts the selected-record save ACK and can save again with its new version', async () => {
  let stored = structuredClone(trip);
  const request: typeof fetch = async (_url, init) => {
    const body = JSON.parse(String(init?.body));
    assert.equal(body.baseUpdatedAt, stored.updatedAt);
    stored = { ...body.trip, updatedAt: '2026-10-27T01:00:00Z' };
    return Response.json({ trip: stored });
  };
  const first = await saveWritingTrip(trip, trip.updatedAt, {}, request);
  assert.equal(first.trip.id, trip.id);
  assert.equal(first.trip.updatedAt, '2026-10-27T01:00:00Z');
  const second = await saveWritingTrip({ ...first.trip, summary: 'Continue on laptop' }, first.trip.updatedAt, {}, request);
  assert.equal(second.trip.summary, 'Continue on laptop');
});

test('save failure is not acknowledged as successful handoff', async () => {
  await assert.rejects(saveWritingTrip(trip, trip.updatedAt, {}, async () => Response.json({ error: '版本已更新' }, { status: 409 })), /版本已更新/);
});

test('Bench forwards the chosen batch to Write, and Write uses the tested save seam', async () => {
  const bench = await readFile(new URL('../app/family/bench/page.tsx', import.meta.url), 'utf8');
  const write = await readFile(new URL('../app/trips/write/page.tsx', import.meta.url), 'utf8');
  assert.ok(bench.includes('href={`/trips/write?moment=${encodeURIComponent(moment.id)}`}'));
  assert.match(write, /await saveWritingTrip\(/);
  assert.doesNotMatch(write, /setTrips\(tripData.content.trips\)/);
});
