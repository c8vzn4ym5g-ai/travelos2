import assert from 'node:assert/strict';
import test from 'node:test';
import { readPublicTripBySlug } from '../lib/public-trip.ts';
const publicTrip = {id:'trip_selected',slug:'selected',title:'已公開內容',visibility:'public',photos:[],journalEntries:[],places:[]};
function transport(options: {private?:boolean; missing?:boolean; fail?:boolean; renamed?:boolean} = {}) {
  const urls: URL[]=[];
  const request: typeof fetch = async input => {
    const url = new URL(String(input)); urls.push(url);
    const op=url.searchParams.get('op');
    assert.ok(!['trips','list','editor-catalog'].includes(op ?? ''),'never read full catalog');
    if(op==='public-hub') {if(options.fail)throw new Error('offline'); return Response.json({trips:options.missing?[]:[publicTrip]});}
    if(op==='drive-access')return Response.json({token:'test',folderId:'family'});
    if(url.searchParams.has('q')) {assert.match(url.searchParams.get('q')!,/name = 'travelos__trip__trip_selected.json'/);return Response.json({files:[{id:'only-file',name:'travelos__trip__trip_selected.json'}]});}
    assert.equal(url.pathname,'/drive/v3/files/only-file');
    return Response.json({...publicTrip,title:'不能公開的修改',visibility:options.private?'private':'public',publishedSnapshot:{...publicTrip,slug:options.renamed?'renamed':'selected'}});
  };
  return {request,urls};
}
test('reader loads only selected trip and preserves published snapshot',async()=>{const {request,urls}=transport();const trip=await readPublicTripBySlug('selected',request);assert.equal(trip?.title,'已公開內容');assert.equal(trip?.publishedSnapshot,undefined);assert.equal(urls.filter(x=>x.searchParams.has('alt')).length,1);});
test('stale public index never exposes a now-private trip or unpublished slug',async()=>{assert.equal(await readPublicTripBySlug('selected',transport({private:true}).request),null);assert.equal(await readPublicTripBySlug('selected',transport({renamed:true}).request),null);});
test('unknown slug stops at index; transport errors remain errors',async()=>{const missing=transport({missing:true});assert.equal(await readPublicTripBySlug('absent',missing.request),null);assert.equal(missing.urls.length,1);await assert.rejects(readPublicTripBySlug('selected',transport({fail:true}).request));});
test('reader total budget also bounds index body read and aborts it',async()=>{let signal:AbortSignal|null|undefined;const request:typeof fetch=async(_input,init)=>{signal=init?.signal;return new Response(new ReadableStream({start(){}}));};await assert.rejects(readPublicTripBySlug('selected',request,20),/逾時/);assert.equal(signal?.aborted,true);});
