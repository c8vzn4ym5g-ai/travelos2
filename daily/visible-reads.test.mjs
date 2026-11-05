import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createVisibleReads} from './web/visible-reads.js';
const settle=()=>new Promise(resolve=>setImmediate(resolve));
function fixture(){
 const events=new Map(),windowEvents=new Map();let observer,focus=true,rect={top:760,bottom:810,left:10,right:200},active=true;
 const doc={visibilityState:'visible',hasFocus:()=>focus,documentElement:{clientWidth:390,clientHeight:844},addEventListener:(n,f)=>events.set(n,f),removeEventListener:n=>events.delete(n),defaultView:{getComputedStyle:()=>({}),addEventListener:(n,f)=>windowEvents.set(n,f),removeEventListener:n=>windowEvents.delete(n)}};
 class Observer{constructor(fn){this.fn=fn;observer=this;}observe(){}disconnect(){}}
 const element={isConnected:true,closest:()=>null,getBoundingClientRect:()=>rect},sent=[],read=[];
 const tracker=createVisibleReads({doc,Observer,isActive:()=>active,send:async t=>sent.push(t.key),onRead:t=>read.push(t.key)});
 return {doc,events,windowEvents,element,sent,read,tracker,show:()=>observer.fn([{target:element,isIntersecting:true,intersectionRatio:.1}]),rect:r=>rect=r,focus:v=>focus=v,active:v=>active=v};
}
test('visible receipts wait for readable foreground content, recheck scroll, dedupe and clean up',async()=>{
 const f=fixture(),item={element:f.element,key:'family:member:comment:1'};f.tracker.watch([item]);await settle();assert.equal(f.sent.length,0);
 f.show();await settle();assert.equal(f.sent.length,0,'only a few pixels above dock are not readable');
 f.rect({top:300,bottom:350,left:10,right:200});f.doc.visibilityState='hidden';f.events.get('scroll')();await settle();assert.equal(f.sent.length,0);
 f.doc.visibilityState='visible';f.focus(false);f.events.get('visibilitychange')();await settle();assert.equal(f.sent.length,0);
 f.focus(true);f.windowEvents.get('focus')();await settle();assert.deepEqual(f.sent,[item.key]);
 f.events.get('scroll')();f.tracker.watch([item]);f.show();await settle();assert.equal(f.sent.length,1);
 f.tracker.dispose();assert.equal(f.events.size,0);assert.equal(f.windowEvents.size,0);
});
test('leaving a view before queued receipt prevents stale read; a different member can read independently',async()=>{
 const f=fixture();f.rect({top:300,bottom:350,left:10,right:200});f.tracker.watch([{element:f.element,key:'one'}]);f.show();f.active(false);await settle();assert.equal(f.sent.length,0);
 f.active(true);f.tracker.watch([{element:f.element,key:'two'}]);f.show();await settle();assert.deepEqual(f.read,['two']);f.tracker.dispose();
});
