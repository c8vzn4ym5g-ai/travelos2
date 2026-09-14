import assert from 'node:assert/strict';
import test, {beforeEach} from 'node:test';
import {resetPublicHubCacheForTests} from '../lib/public-hub.ts';
beforeEach(()=>resetPublicHubCacheForTests());
import { readPublicTripBySlug } from '../lib/public-trip.ts';
const publicTrip = {id:'trip_selected',slug:'selected',title:'已公開內容',visibility:'public',photos:[],journalEntries:[],places:[]};
function transport(options: {private?:boolean; missing?:boolean; fail?:boolean; renamed?:boolean} = {}) {
  const urls: URL[]=[];
  const request: typeof fetch = async input => {
    const url = new URL(String(input)); urls.push(url);
    const op=url.searchParams.get('op');
    assert.ok(!['trips','list','editor-catalog'].includes(op ?? ''),'never read full catalog');
    if(op==='public-hub') {if(options.fail)throw new Error('offline'); return Response.json({trips:options.missing?[]:[publicTrip]});}
    if(op==='item'){assert.equal(url.searchParams.get('name'),'travelos__trip__trip_selected.json');return Response.json({...publicTrip,title:'不能公開的修改',visibility:options.private?'private':'public',publishedSnapshot:{...publicTrip,slug:options.renamed?'renamed':'selected'}});}
    if(op==='drive-access')return Response.json({token:'test',folderId:'family'});
    if(url.searchParams.has('q')) {assert.match(url.searchParams.get('q')!,/name = 'travelos__trip__trip_selected.json'/);return Response.json({files:[{id:'only-file',name:'travelos__trip__trip_selected.json'}]});}
    assert.equal(url.pathname,'/drive/v3/files/only-file');
    return Response.json({...publicTrip,title:'不能公開的修改',visibility:options.private?'private':'public',publishedSnapshot:{...publicTrip,slug:options.renamed?'renamed':'selected'}});
  };
  return {request,urls};
}
test('reader loads only selected trip and preserves published snapshot',async()=>{const {request,urls}=transport();const trip=await readPublicTripBySlug('selected',request);assert.equal(trip?.title,'已公開內容');assert.equal(trip?.publishedSnapshot,undefined);assert.equal(urls.filter(x=>x.searchParams.get('op')==='item').length,1);});
test('stale public index never exposes a now-private trip or unpublished slug',async()=>{assert.equal(await readPublicTripBySlug('selected',transport({private:true}).request),null);assert.equal(await readPublicTripBySlug('selected',transport({renamed:true}).request),null);});
test('unknown slug stops at index; transport errors remain errors',async()=>{const missing=transport({missing:true});assert.equal(await readPublicTripBySlug('absent',missing.request),null);assert.equal(missing.urls.length,1);await assert.rejects(readPublicTripBySlug('selected',transport({fail:true}).request));});
test('reader total budget also bounds index body read and aborts it',async()=>{let signal:AbortSignal|null|undefined;const request:typeof fetch=async(_input,init)=>{signal=init?.signal;return new Response(new ReadableStream({start(controller){signal?.addEventListener('abort',()=>controller.error(new Error('aborted')),{once:true});}}));};await assert.rejects(readPublicTripBySlug('selected',request,20),/逾時/);assert.equal(signal?.aborted,true);});

test('opening a listed trip reuses public cards without a second index RPC',async()=>{
  const {cachePublicHubTrips,resetPublicHubCacheForTests}=await import('../lib/public-hub.ts');
  resetPublicHubCacheForTests();await cachePublicHubTrips([publicTrip]);
  const {request,urls}=transport();
  try { assert.ok(await readPublicTripBySlug('selected',request));assert.equal(urls.some(x=>x.searchParams.get('op')==='public-hub'),false); }
  finally {resetPublicHubCacheForTests();}
});

test('new isolate restores public card snapshot before reading only the selected file',async()=>{
  const {cachePublicHubTrips,resetPublicHubCacheForTests}=await import('../lib/public-hub.ts');
  const original=Object.getOwnPropertyDescriptor(globalThis,'caches');let snapshot:Response|undefined;
  Object.defineProperty(globalThis,'caches',{configurable:true,value:{default:{put:async(_url:string,response:Response)=>{snapshot=response.clone();},match:async()=>snapshot?.clone()}}});
  try {await cachePublicHubTrips([publicTrip]);resetPublicHubCacheForTests();const {request,urls}=transport({private:true});assert.equal(await readPublicTripBySlug('selected',request),null);assert.equal(urls.some(x=>x.searchParams.get('op')==='public-hub'),false);}
  finally {if(original)Object.defineProperty(globalThis,'caches',original);else Reflect.deleteProperty(globalThis,'caches');resetPublicHubCacheForTests();}
});

test('cold catalog selection skips index and fetches only its public trip', async () => {
  const {request, urls} = transport({fail:true});
  const trip = await readPublicTripBySlug('selected', request, undefined, 'trip_selected');
  assert.equal(trip?.title, '已公開內容');
  assert.equal(urls.some(url => url.searchParams.get('op') === 'public-hub'), false);
  assert.equal(urls.filter(url => url.searchParams.get('op') === 'item').length, 1);
});
test('direct catalog hints cannot expose private or mismatched published trips', async () => {
  assert.equal(await readPublicTripBySlug('selected', transport({private:true}).request, undefined, 'trip_selected'), null);
  assert.equal(await readPublicTripBySlug('wrong-slug', transport().request, undefined, 'trip_selected'), null);
});

