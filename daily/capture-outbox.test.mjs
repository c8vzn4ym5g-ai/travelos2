import test from 'node:test';import assert from 'node:assert/strict';import {createCaptureOutbox} from './web/capture-outbox.js';import {newFamily,receive} from './domain.mjs';
const tick=()=>new Promise(r=>setTimeout(r,0));
function memory(){const map=new Map();return {map,list:async()=>[...map.values()].map(v=>structuredClone(v)),put:async e=>map.set(e.id,structuredClone(e)),remove:async id=>map.delete(id)};}
test('late acknowledgement never changes the next draft; captures keep independent identities',async()=>{const store=memory(),acks=[],saved=[];const q=createCaptureOutbox({store,send:p=>new Promise(resolve=>acks.push(()=>resolve({moment:{id:p.requestId,text:p.text}}))),onSaved:m=>saved.push(m)});const a={requestId:'a',text:'甲'},b={requestId:'b',text:'乙'};await q.enqueue(a);await q.enqueue(b);await tick();assert.equal(acks.length,2);a.text='外部修改';acks[1]();await tick();acks[0]();await tick();assert.deepEqual(saved.map(x=>x.text),['乙','甲']);assert.equal(q.entries.length,0);assert.equal(b.text,'乙');});
test('late cancellation restores and retries the same immutable request without duplicates',async()=>{const store=memory(),now='2026-11-05T05:00:00Z',f=newFamily({id:'f',name:'f',child:'c',now}),member={id:'m',name:'m'};let first=true;const send=async p=>{const moment=receive(f,p,member,now,'saved');if(first){first=false;throw Error('cancelled after commit');}return {moment};};const q=createCaptureOutbox({store,send});await q.enqueue({requestId:'a',text:'甲',media:[]});await tick();assert.equal(q.entries[0].status,'failed');const restored=createCaptureOutbox({store,send});await restored.restore();await restored.retry('a');await tick();assert.equal(f.moments.length,1);assert.equal(restored.entries.length,0);});
test('network failure remains durable and a second capture is not blocked',async()=>{const store=memory();const q=createCaptureOutbox({store,send:async p=>{if(p.requestId==='a')throw Error('offline');return {moment:{id:'b'}};}});await q.enqueue({requestId:'a',text:'甲'});await q.enqueue({requestId:'b',text:'乙'});await tick();assert.equal(q.entries.length,1);assert.equal(q.entries[0].payload.text,'甲');assert.equal(store.map.get('a').status,'failed');});


test('save-as-copy keeps the durable original if the new local copy cannot persist',async()=>{const store=memory();await store.put({id:'old',payload:{requestId:'old',text:'乙'},status:'failed',conflict:true});const put=store.put;store.put=async e=>{if(e.id==='new')throw Error('quota');return put(e);};const q=createCaptureOutbox({store,send:async()=>{throw Error('must not send');}});await q.restore();await assert.rejects(()=>q.saveCopy('old','new'),/保留/);assert.ok(store.map.has('old'));assert.equal(store.map.size,1);assert.equal(q.entries.length,1);});


test('retry persistence failure stays failed and keeps its only durable entry',async()=>{const store=memory();await store.put({id:'old',payload:{requestId:'old',text:'甲'},status:'failed'});const q=createCaptureOutbox({store,send:async()=>{throw Error('must not send');}});await q.restore();store.put=async()=>{throw Error('quota');};await assert.rejects(()=>q.retry('old'),/保留/);assert.equal(q.entries[0].status,'failed');assert.equal(q.entries[0].localError,true);assert.ok(store.map.has('old'));});


test('cancel queued capture survives restore and only explicit same-ID retry can send it',async()=>{
 const store=memory(),sent=[];let release;const gate=new Promise(r=>release=r);
 const q=createCaptureOutbox({store,limit:1,send:async p=>{sent.push(p.requestId);if(p.requestId==='first')await gate;return {moment:{id:p.requestId}};}});
 await q.enqueue({requestId:'first',text:'one'});await q.enqueue({requestId:'second',text:'private original'});await q.cancel('second');release();await tick();await tick();assert.deepEqual(sent,['first']);assert.equal(store.map.get('second').status,'failed');q.dispose();
 const restored=createCaptureOutbox({store,send:async p=>{sent.push(p.requestId);assert.equal(p.text,'private original');return {moment:{id:p.requestId}};}});await restored.restore();await tick();assert.deepEqual(sent,['first']);await Promise.all([restored.retry('second'),restored.retry('second')]);await tick();assert.deepEqual(sent,['first','second']);assert.equal(store.map.size,0);
});

test('cancel during initial persistence cannot be overwritten by queued transition',async()=>{
 const store=memory(),put=store.put,sent=[];let release,started;const gate=new Promise(r=>release=r),begun=new Promise(r=>started=r);let first=true;
 store.put=async e=>{if(first){first=false;started();await gate;}return put(e);};
 const q=createCaptureOutbox({store,send:async p=>{sent.push(p.requestId);return {moment:{id:p.requestId}};}});
 const pending=q.enqueue({requestId:'during-write',text:'kept'});await begun;const cancelled=q.cancel('during-write');release();await Promise.all([pending,cancelled]);await tick();assert.deepEqual(sent,[]);assert.equal(store.map.get('during-write').status,'failed');q.dispose();const restored=createCaptureOutbox({store,send:async()=>{throw Error('cancelled restore must not send');}});await restored.restore();assert.equal(restored.entries[0].payload.text,'kept');assert.equal(restored.entries[0].status,'failed');
});


test('active abort preserves original and explicit retry keeps one ID; another member queue is independent',async()=>{
 const store=memory(),otherStore=memory(),sent=[];let aborted=false,started;const began=new Promise(r=>started=r);
 const q=createCaptureOutbox({store,send:(p,{signal})=>new Promise((resolve,reject)=>{sent.push(p.requestId);started();signal.addEventListener('abort',()=>{aborted=true;reject(Error('aborted'));},{once:true});})});
 await q.enqueue({requestId:'same-id',text:'private owner original'});await began;await q.cancel('same-id');await tick();assert.equal(aborted,true);assert.equal(q.entries[0].status,'failed');q.dispose();
 const other=createCaptureOutbox({store:otherStore,send:async p=>({moment:{id:p.requestId}})});await other.restore();assert.equal(other.entries.length,0);await other.enqueue({requestId:'other-id',text:'other member'});await tick();assert.equal(store.map.get('same-id').payload.text,'private owner original');
 const restored=createCaptureOutbox({store,send:async p=>{sent.push(p.requestId);return {moment:{id:p.requestId}};}});await restored.restore();assert.deepEqual(sent,['same-id']);await Promise.all([restored.retry('same-id'),restored.retry('same-id')]);await tick();assert.deepEqual(sent,['same-id','same-id']);assert.equal(restored.entries.length,0);
});

test('cancel while queued persistence is pending remains failed on disk and does not send',async()=>{
 const store=memory(),put=store.put;let n=0,release,started;const gate=new Promise(r=>release=r),began=new Promise(r=>started=r);
 store.put=async e=>{if(++n===2){started();await gate;}return put(e);};let calls=0;const q=createCaptureOutbox({store,send:async()=>{calls++;return {moment:{id:'unexpected'}};}});
 const enqueue=q.enqueue({requestId:'queued-write',text:'original'});await began;const cancel=q.cancel('queued-write');release();await Promise.all([enqueue,cancel]);await tick();assert.equal(calls,0);assert.equal(store.map.get('queued-write').cancelled,true);assert.equal(store.map.get('queued-write').status,'failed');
});

test('confirmed late success after active cancellation cannot leave a resurrected cancelled record',async()=>{
 const store=memory();let finish,started;const gate=new Promise(r=>finish=r),began=new Promise(r=>started=r);const saved=[];
 const q=createCaptureOutbox({store,send:async p=>{started();await gate;return {moment:{id:p.requestId}};},onSaved:m=>saved.push(m.id)});
 await q.enqueue({requestId:'late-confirmed',text:'kept'});await began;await q.cancel('late-confirmed');finish();await tick();await tick();assert.deepEqual(saved,['late-confirmed']);assert.equal(store.map.size,0);assert.equal(q.entries.length,0);
});


test('cancel and retry during acknowledged serialized removal cannot resurrect a saved entry',async()=>{
 const disk=new Map();let chain=Promise.resolve(),release,started;const gate=new Promise(r=>release=r),began=new Promise(r=>started=r);
 const serialize=fn=>{const job=chain.then(fn);chain=job.catch(()=>{});return job;};
 const store={put:e=>serialize(()=>disk.set(e.id,structuredClone(e))),remove:id=>serialize(async()=>{started();await gate;disk.delete(id);}),list:async()=>[...disk.values()].map(e=>structuredClone(e))};
 let sends=0;const q=createCaptureOutbox({store,send:async p=>{sends++;return {moment:{id:p.requestId}};}});
 await q.enqueue({requestId:'acknowledged',text:'original'});await began;const cancel=q.cancel('acknowledged'),retry=q.retry('acknowledged');release();await Promise.all([cancel,retry]);await tick();await chain;assert.equal(q.entries.length,0);assert.equal(disk.size,0);assert.equal(sends,1);
 const restored=createCaptureOutbox({store,send:async()=>{throw Error('saved item must not resurrect');}});await restored.restore();assert.equal(restored.entries.length,0);
});

test('acknowledged removal failure remains visible and recoverable instead of swallowing storage error',async()=>{
 const store=memory();let fail=true,sends=0;store.remove=async id=>{if(fail)throw Error('disk removal failed');store.map.delete(id);};
 const q=createCaptureOutbox({store,send:async p=>{sends++;return {moment:{id:p.requestId}};}});await q.enqueue({requestId:'remove-failed',text:'original'});await tick();assert.equal(q.entries[0].status,'failed');assert.match(q.entries[0].error,/disk removal failed/);assert.ok(store.map.has('remove-failed'));fail=false;await q.retry('remove-failed');await tick();assert.equal(q.entries.length,0);assert.equal(store.map.size,0);assert.equal(sends,2);
});
