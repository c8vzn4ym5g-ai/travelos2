import {test} from 'node:test';import assert from 'node:assert/strict';
import {diaryRows} from './web/diary-list-model.js';import {createTimePicker,timeParts,timeValue,nextFamilyDate} from './web/time-picker.js';import {seedDays} from './test-support/seed-days.mjs';
import {deviceFamilyZone,initialFamilyZone,DEFAULT_FAMILY_ZONE} from './web/family-zone.js';
test('creation uses a valid device zone and falls back without claiming unavailable device data',()=>{
 assert.equal(initialFamilyZone('America/Los_Angeles'),'America/Los_Angeles');assert.equal(initialFamilyZone('Asia/Tokyo'),'Asia/Tokyo');
 for(const value of [undefined,null,'','not/a-zone','+08:00'])assert.equal(initialFamilyZone(value),DEFAULT_FAMILY_ZONE);
 assert.equal(deviceFamilyZone({DateTimeFormat(){throw Error('unavailable');}}),null);assert.equal(deviceFamilyZone({DateTimeFormat:()=>({resolvedOptions:()=>({})})}),null);
});
test('one date model includes material-only and pending days but only existing diaries are selectable',()=>{
 const photo={kind:'image',data:'data:image/png;base64,AAAA'},diary={id:'d1',date:'2026-11-04',current:{body:'家人的日記'}};
 const family={diaries:[diary],moments:[{date:'2026-11-05',text:'尚未整理',media:[photo]},{date:'2026-11-04',text:'同日片段',media:[]},{date:'2026-11-02',archivedAt:'x',media:[]}]};
 const rows=diaryRows(family,[{date:'2026-11-06',text:'正在保存',media:[]}]);assert.deepEqual(rows.map(r=>[r.date,r.eligible,r.count]),[['2026-11-06',false,0],['2026-11-05',false,1],['2026-11-04',true,1]]);assert.equal(rows[1].photo,photo);assert.equal(rows[2].diary,diary);assert.equal(rows[2].summary,'家人的日記');assert.equal(family.diaries.length,1);
});
test('reminder wheel roundtrip retains every minute and the family calendar date',()=>{
 for(const value of ['2026-12-31T23:59','2026-03-08T00:01','2026-11-05T16:07'])assert.equal(timeValue(timeParts(value,{today:'2026-11-05'})),value);
 assert.equal(timeValue(timeParts('',{today:'2026-11-05',now:'09:37'})),'2026-11-05T09:37');
});
test('daily story roundtrip is time-only; next family date is calendar arithmetic',()=>{
 assert.equal(timeValue(timeParts('20:15',{daily:true}),true),'20:15');assert.equal(nextFamilyDate('2026-12-31'),'2027-01-01');assert.equal(nextFamilyDate('2028-02-28'),'2028-02-29');assert.equal(nextFamilyDate('2026-03-08'),'2026-03-09');
});
test('local two-day fixture only fills missing diaries and does not replace login or a manual day',async()=>{
 const calls=[],state={today:'2026-11-05',family:{id:'synthetic',name:'虛構驗收家庭',diaries:[{date:'2026-11-05',current:{body:'人工內容'}}]}};
 const worker={async fetch(request){const path=new URL(request.url).pathname;calls.push(path);if(path==='/api/state')return Response.json(state);const body=await request.json();assert.equal(body.date,'2026-11-04');assert.equal(request.headers.get('cookie'),'test-session');return Response.json({ok:true});}};
 const get=await seedDays(new Request('http://127.0.0.1:3358/__qc-add-days',{headers:{cookie:'test-session'}}),{},worker);assert.equal(get.status,200);assert.deepEqual(calls,['/api/state']);
 calls.length=0;const post=await seedDays(new Request('http://127.0.0.1:3358/__qc-add-days',{method:'POST',headers:{origin:'http://127.0.0.1:3358',cookie:'test-session'}}),{},worker);assert.equal(post.status,303);assert.equal(post.headers.get('set-cookie'),null);assert.deepEqual(calls,['/api/state','/api/capture','/api/generate']);assert.equal(state.family.diaries[0].current.body,'人工內容');
 state.family.name='真正家庭';calls.length=0;assert.equal((await seedDays(new Request('http://127.0.0.1:3358/__qc-add-days',{method:'POST',headers:{origin:'http://127.0.0.1:3358'}}),{},worker)).status,403);assert.deepEqual(calls,['/api/state']);
});

function lifecycleHarness(){
 const events=new Map(),viewEvents=new Map(),classes=new Set(),children=[],background=[{inert:false},{inert:true}],stack=[{original:true}];
 const doc={visibilityState:'visible',activeElement:null,addEventListener:(n,f)=>events.set(n,f),removeEventListener:n=>events.delete(n),querySelectorAll:()=>background};
 doc.defaultView={addEventListener:(n,f)=>viewEvents.set(n,f),removeEventListener:n=>viewEvents.delete(n),history:{get state(){return stack.at(-1);},pushState(s){stack.push(s);},back(){stack.pop();queueMicrotask(()=>viewEvents.get('popstate')?.());}}};
 doc.body={classList:{contains:n=>classes.has(n),add:n=>classes.add(n),toggle:(n,v)=>v?classes.add(n):classes.delete(n)},append:n=>children.push(n)};
 doc.createElement=()=>{const controls={};return {className:'',innerHTML:'',querySelectorAll:()=>[],querySelector:s=>controls[s]||=({focus(){doc.activeElement=this;},textContent:''}),remove(){children.splice(children.indexOf(this),1);}};};
 const trigger={isConnected:true,focus(){doc.activeElement=this;}},sent=[],target={value:'20:15',dispatchEvent:e=>sent.push(e.type)};
 return {doc,events,viewEvents,background,children,stack,target,trigger,sent,open:picker=>picker.open({target,trigger,daily:true,today:'2026-11-05'})};
}
const settle=()=>new Promise(resolve=>setImmediate(resolve));
test('actual picker controller is single-flight and browser Back/cancel restore original inert/focus without changing value',async()=>{
 const h=lifecycleHarness(),picker=createTimePicker({doc:h.doc});h.open(picker);h.open(picker);assert.equal(h.children.length,1);assert.deepEqual(h.background.map(n=>n.inert),[true,true]);assert.equal(h.stack.length,2);
 h.children[0].querySelector('[data-clock-cancel]').onclick({type:'click'});await settle();assert.equal(h.children.length,0);assert.equal(h.stack.length,1);assert.deepEqual(h.background.map(n=>n.inert),[false,true]);assert.equal(h.doc.activeElement,h.trigger);assert.equal(h.target.value,'20:15');assert.deepEqual(h.sent,[]);
 h.open(picker);h.doc.defaultView.history.back();await settle();assert.equal(h.children.length,0);assert.equal(h.stack.length,1);assert.equal(h.target.value,'20:15');picker.dispose();assert.equal(h.events.size,0);assert.equal(h.viewEvents.size,0);
});
test('actual picker Done only emits field events; hidden interruption cancels rather than submitting',async()=>{
 const h=lifecycleHarness(),picker=createTimePicker({doc:h.doc});h.open(picker);h.children[0].querySelector('[data-clock-done]').onclick();await settle();assert.equal(h.target.value,'20:15');assert.deepEqual(h.sent,['input','change']);assert.equal(h.children.length,0);
 h.sent.length=0;h.open(picker);h.doc.visibilityState='hidden';h.events.get('visibilitychange')();await settle();assert.equal(h.children.length,0);assert.equal(h.target.value,'20:15');assert.deepEqual(h.sent,[]);assert.deepEqual(h.background.map(n=>n.inert),[false,true]);picker.dispose();
});

// Presentation feedback is downstream of the real durable enqueue result.
test('capture arrival never signals before local persistence or for a failed local write',async()=>{
 const {readFileSync}=await import('node:fs'),{default:vm}=await import('node:vm');const app=readFileSync(new URL('./web/app.js',import.meta.url),'utf8');const a=app.indexOf('function queueCapture('),b=app.indexOf('\nfunction ',a+10),code=app.slice(a,b);let resolve;const captured=new Set();let paints=0;const c={outbox:{enqueue:()=>new Promise(r=>resolve=r)},settlingCaptures:captured,settledCaptureIds:new Set(),paintCaptures:()=>paints++,selectedDate:'x',authorFilter:'x',sortOrder:'old'};vm.createContext(c);vm.runInContext(code,c);
 const waiting=c.queueCapture({requestId:'a',text:'family note'});assert.equal(captured.size,0);resolve({localError:true});await waiting;assert.equal(captured.size,0);assert.equal(paints,0);
 const good=c.queueCapture({requestId:'b',text:'family note'});assert.equal(captured.size,0);resolve({status:'queued'});await good;assert.equal(captured.has('b'),true);assert.equal(paints,1);
});
test('success companion cannot show in hidden camera or reduced-motion contexts',async()=>{
 const {readFileSync}=await import('node:fs'),{default:vm}=await import('node:vm');const app=readFileSync(new URL('./web/app.js',import.meta.url),'utf8');const a=app.indexOf('function showSavedCompanion('),b=app.indexOf('\nfunction ',a+10);let made=0;const c={cameraOpen:false,document:{visibilityState:'visible',querySelector:()=>null,createElement:()=>{made++;return {setAttribute(){},remove(){}}},body:{append(){}}},matchMedia:()=>({matches:false}),setTimeout:()=>{}};vm.createContext(c);vm.runInContext(app.slice(a,b),c);c.cameraOpen=true;c.showSavedCompanion();assert.equal(made,0);c.cameraOpen=false;c.document.visibilityState='hidden';c.showSavedCompanion();assert.equal(made,0);c.document.visibilityState='visible';c.matchMedia=()=>({matches:true});c.showSavedCompanion();assert.equal(made,0);c.matchMedia=()=>({matches:false});c.showSavedCompanion();assert.equal(made,1);
});
