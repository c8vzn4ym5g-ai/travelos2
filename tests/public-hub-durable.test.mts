import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
import { setDriveWarehouseFetchForTests } from '../lib/drive-warehouse.ts';
import * as hub from '../lib/public-hub.ts';

test('cold public hub reads one durable projection, including an authoritative empty library', async () => {
  const calls: string[] = [];
  setDriveWarehouseFetchForTests(async input => {
    const op = new URL(String(input)).searchParams.get('op')!; calls.push(op);
    assert.equal(op, 'public-hub');
    return Response.json({ trips: [], at: Date.now() });
  });
  hub.resetPublicHubCacheForTests();
  try {
    assert.equal(typeof hub.readPublicHubState, 'function');
    assert.deepEqual(await hub.readPublicHubState(), { trips: [], ready: true });
    assert.deepEqual(calls, ['public-hub']);
  } finally { setDriveWarehouseFetchForTests(null); hub.resetPublicHubCacheForTests(); }
});

test('durable projection keeps published text on draft edits and removes unpublished trips under lock', async () => {
  const source = await readFile(new URL('../scripts/drive-warehouse-apps-script.js', import.meta.url), 'utf8');
  const files = new Map<string,string>(); let locked = false;
  const ctx = vm.createContext({ LockService: { getScriptLock: () => ({ waitLock: () => { locked = true; }, releaseLock: () => { locked = false; } }) } });
  vm.runInContext(source, ctx);
  ctx.upsertNamed_ = (name: string,text: string) => { assert.ok(locked); files.set(name,text); }; ctx.tokenOk_ = () => true; ctx.json_ = (v: unknown) => JSON.parse(JSON.stringify(v));
  const file = (name: string) => ({ getBlob: () => ({ getDataAsString: () => files.get(name) }), setContent: (text: string) => { assert.ok(locked); files.set(name,text); } });
  ctx.folder_ = () => ({ getFilesByName: (name: string) => { let found = files.has(name); return { hasNext: () => found, next: () => { found = false; return file(name); } }; }, createFile: (name: string,text: string) => { assert.ok(locked); files.set(name,text); return file(name); } });
  const published = { id: 'trip_one', title: '公開文字', visibility: 'public', photos: [] };
  ctx.listTrips_ = () => [{ trip: published }];
  const post = (body: unknown) => ctx.doPost({ postData: { contents: JSON.stringify(body) } });
  assert.equal(post({op:'public-hub-init',expectedTripCount:1}).ok,true);
  const read = () => ctx.doGet({parameter:{op:'public-hub'}});
  assert.equal(read().trips[0].title, '公開文字');
  post({op:'trip',name:'travelos__trip__trip_one.json',text:JSON.stringify({...published,title:'未公開草稿',publishedSnapshot:published})});
  assert.equal(read().trips[0].title,'公開文字');
  post({op:'trip',name:'travelos__trip__trip_one.json',text:JSON.stringify({...published,visibility:'private',publishedSnapshot:published})});
  assert.deepEqual(read().trips,[]);
  assert.equal(locked,false);
});
