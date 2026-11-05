import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {newFamily,receive} from './domain.mjs';
const source=readFileSync(new URL('./web/app.js',import.meta.url),'utf8').split('\n').find(line=>line.startsWith('async function saveCapture()'));
function harness({early=false}={}){
 const now='2026-11-05T04:54:00.000Z',family=newFamily({id:'synthetic-family',name:'synthetic',child:'synthetic',now}),member={id:'synthetic-mom',name:'synthetic'};
 const elements=[],writes=[],notices=[],sent=[];let first=true,next=0;
 const element=()=>{const e={disabled:false,textContent:'',removed:false,setAttribute(){},after(){},remove(){this.removed=true;}};elements.push(e);return e;};
 const button=element(),error=element();let context;
 context={AbortController,Error,captureTransfer:null,draftText:'甲：原本內容',draftDate:'2026-11-05',files:[],captureId:'original-request',composerOpen:true,selectedDate:'',authorFilter:'',
  app:{querySelector:selector=>selector==='#capture button[type=submit]'?button:selector==='#capture-error'?error:elements.find(e=>e.id===selector.slice(1)&&!e.removed)||null,querySelectorAll:()=>[]},document:{createElement:element},
  persistCapture:async()=>writes.push(structuredClone({text:context.draftText,files:context.files,requestId:context.captureId})),draftKey:()=> 'synthetic-draft',uid:()=> 'new-request-'+(++next),
  writeDraft:async(key,value)=>writes.push(structuredClone(value)),localStorage:{removeItem(){}},load:async()=>{},note:text=>notices.push(text),
  api:async(path,body,{signal}={})=>{assert.equal(path,'capture');sent.push(structuredClone(body));if(first&&early){first=false;context.captureTransfer.abort();throw Error('已取消傳送');}const moment=receive(family,body,member,now,'saved-'+(family.moments.length+1));if(first){first=false;context.captureTransfer.abort();assert.equal(signal.aborted,true);throw Error('已取消傳送');}return {moment};}
 };
 vm.createContext(context);vm.runInContext(source,context);return {context,family,writes,notices,sent,elements};
}
test('late-cancel edited retry preserves text and attachments until explicit save-as-new',async()=>{
 const h=harness(),c=h.context;await assert.rejects(c.saveCapture(),/取消/);
 c.draftText='乙：取消後改過的內容';c.files=[{kind:'audio',name:'synthetic.wav',data:'data:audio/wav;base64,Qg==',rawOnly:true}];
 await assert.rejects(c.saveCapture(),/草稿/);
 assert.equal(h.family.moments.length,1);assert.equal(h.family.moments[0].text,'甲：原本內容');assert.equal(c.draftText,'乙：取消後改過的內容');assert.equal(c.files.length,1);assert.equal(c.captureId,'original-request');assert.notEqual(h.writes.at(-1),null);assert.equal(h.notices.length,0);
 const copy=h.elements.find(e=>e.id==='save-capture-copy'&&!e.removed);assert.ok(copy);assert.match(copy.textContent,/另存/);await copy.onclick();
 assert.equal(h.family.moments.length,2);assert.equal(h.family.moments[1].text,'乙：取消後改過的內容');assert.equal(h.family.moments[1].media[0].data,'data:audio/wav;base64,Qg==');assert.equal(c.draftText,'');assert.equal(h.writes.at(-1),null);assert.match(h.notices.at(-1),/收好了/);assert.equal(h.sent[0].requestId,h.sent[1].requestId);assert.notEqual(h.sent[2].requestId,h.sent[1].requestId);
});
test('unchanged late retry confirms the original without another note or extra step',async()=>{
 const h=harness();await assert.rejects(h.context.saveCapture(),/取消/);await h.context.saveCapture();assert.equal(h.family.moments.length,1);assert.equal(h.context.draftText,'');assert.ok(!h.elements.some(e=>e.id==='save-capture-copy'));assert.equal(h.writes.at(-1),null);
});
test('early-cancel edited retry saves only the new content',async()=>{
 const h=harness({early:true});await assert.rejects(h.context.saveCapture(),/取消/);h.context.draftText='乙：改過的內容';await h.context.saveCapture();assert.equal(h.family.moments.length,1);assert.equal(h.family.moments[0].text,'乙：改過的內容');assert.equal(h.context.draftText,'');
});
test('attachment-only changes after a late cancellation remain in the draft',async()=>{
 const h=harness();h.context.files=[{kind:'audio',data:'data:audio/wav;base64,QQ==',rawOnly:true}];await assert.rejects(h.context.saveCapture(),/取消/);h.context.files=[{kind:'audio',data:'data:audio/wav;base64,Qg==',rawOnly:true}];await assert.rejects(h.context.saveCapture(),/草稿/);assert.equal(h.context.files[0].data,'data:audio/wav;base64,Qg==');assert.equal(h.family.moments[0].media[0].data,'data:audio/wav;base64,QQ==');assert.notEqual(h.writes.at(-1),null);
});
