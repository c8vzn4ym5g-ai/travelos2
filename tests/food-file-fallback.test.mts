import assert from 'node:assert/strict';
import test from 'node:test';
import { readCategoryFile } from '../lib/coffee-store.ts';

test('food primary exact-file read skips slow RPC and distinguishes absence from failed listing', async () => {
  for (const outcome of ['missing', 'failed', 'malformed', 'present']) {
    let mediaReads = 0;
    const request: typeof fetch = async input => {
      const url = new URL(String(input));
      assert.notEqual(url.searchParams.get('op'), 'item', 'food never waits for the slow item RPC');
      if (url.searchParams.get('op') === 'drive-access') return Response.json({ token: 'fixture', folderId: 'family' });
      if (url.searchParams.has('q')) {
        assert.equal(url.searchParams.get('q'), "'family' in parents and trashed = false and name = 'travelos__food.json'");
        assert.equal(url.searchParams.get('pageSize'), '1');
        assert.equal(url.searchParams.get('orderBy'), 'modifiedTime desc');
        return outcome === 'failed' ? new Response('', { status: 503 }) : Response.json(outcome === 'malformed' ? {} : { files: outcome === 'present' ? [{ id: 'selected-food', name: 'travelos__food.json' }] : [] });
      }
      assert.equal(url.pathname, '/drive/v3/files/selected-food');
      mediaReads++;
      return Response.json({ moment: { shops: [], updatedAt: 'current' } });
    };
    if (outcome === 'missing') assert.equal(await readCategoryFile('travelos__food.json', request), null);
    else if (outcome === 'present') assert.deepEqual(await readCategoryFile('travelos__food.json', request), { moment: { shops: [], updatedAt: 'current' } });
    else await assert.rejects(readCategoryFile('travelos__food.json', request));
    assert.equal(mediaReads, outcome === 'present' ? 1 : 0);
  }
});
