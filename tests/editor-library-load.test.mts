import assert from 'node:assert/strict';
import test from 'node:test';
import { loadEditorLibrary, loadSelectedEditorTrip } from '../lib/editor-library-load.ts';

test('a failed editor read retries and returns the real trip library', async () => {
  let calls = 0;
  const result = await loadEditorLibrary({}, async () => ++calls === 1
    ? Response.json({error:'temporary'}, {status:500})
    : Response.json({trips:[{id:'trip_existing'}]}));
  assert.equal(calls, 2);
  assert.equal(result.trips[0].id, 'trip_existing');
});

test('opening the editor requests only the catalog and never a trip body', async () => {
  const urls: string[] = [];
  await loadEditorLibrary({}, async url => { urls.push(String(url)); return Response.json({trips:[]}); });
  assert.deepEqual(urls, ['/api/trips/catalog']);
});

test('choosing one catalog entry reads only that trip', async () => {
  const urls: string[] = [];
  const result = await loadSelectedEditorTrip('trip_kyushu', {}, new AbortController().signal, async url => {
    urls.push(String(url)); return Response.json({trip:{id:'trip_kyushu',title:'九州'}});
  });
  assert.deepEqual(urls, ['/api/trips/content?id=trip_kyushu']);
  assert.equal(result.title, '九州');
});

test('a mismatched trip response fails rather than opening another trip', async () => {
  await assert.rejects(loadSelectedEditorTrip('trip_kyushu', {}, new AbortController().signal, async () => Response.json({trip:{id:'trip_other'}})));
});

test('persistent editor failure rejects instead of supplying an empty library', async () => {
  let calls = 0;
  await assert.rejects(loadEditorLibrary({}, async () => { calls++; return Response.json({}, {status:503}); }));
  assert.equal(calls, 2);
});

test('a stalled editor request is aborted within a bounded interval', async () => {
  let aborts = 0;
  const keepAlive = setInterval(() => {}, 100);
  try {
    await assert.rejects(loadEditorLibrary({}, async (_url, init) => new Promise((_resolve, reject) => {
      init!.signal!.addEventListener('abort', () => { aborts++; reject(new Error('aborted')); });
    }), 20));
    assert.equal(aborts, 2);
  } finally { clearInterval(keepAlive); }
});
