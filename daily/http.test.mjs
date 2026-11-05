import './generation-navigation.test.mjs';
import './weekly.test.mjs';
import './family-scope.test.mjs';
import './comment-recovery.test.mjs';
import './album-model.test.mjs';
import './interaction.test.mjs';
import './visible-reads.test.mjs';
import './camera-ui.test.mjs';
import './camera-session.test.mjs';
import './photo-visibility.test.mjs';
import './paper-status.test.mjs';
import './book-preview.test.mjs';
import './writer-state.test.mjs';
import './capture-session.test.mjs';
import './capture-outbox.test.mjs';
import './capture.test.mjs';
import './family-time.test.mjs';
import './recording.test.mjs';
import './story-model.test.mjs';
import './multimodal.test.mjs';
import './transport.test.mjs';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import worker,{DailyWarehouse} from './worker.js';
const origin='https://phone-test.example';
const db=new DatabaseSync(':memory:');
const sql={exec(query,...args){const s=db.prepare(query);const rows=s.columns().length?s.all(...args):(s.run(...args),[]);return {toArray:()=>rows};}};
const ctx={storage:{sql,transactionSync(fn){db.exec('BEGIN');try{const r=fn();db.exec('COMMIT');return r;}catch(e){db.exec('ROLLBACK');throw e;}}}};
const completion=value=>({choices:[{finish_reason:'stop',message:{content:typeof value==='string'?value:JSON.stringify(value)}}]});
const env={AI:{async run(model,input){if(model.includes('whisper'))return {text:'虛構口述'};const message=input.messages.at(-1).content;if(Array.isArray(message))return {...completion({facts:['桌上有橘子與藍色杯子'],uncertain:[]}),_testAdapter:true};const content=JSON.parse(message);if(input.messages[0].content.includes('週記'))return {...completion({title:'合成：這週一起留下的片刻',paragraphs:[{indices:content.days.map(d=>d.index),text:'這週跨日記下了共同的生活，也留下不同時候的片刻。'}]}),_testAdapter:true};if(input.messages[0].content.includes('paragraphs'))return completion({paragraphs:content.map(e=>({eventIndices:[e.index],text:'今天留下了這段生活記錄。'}))});return completion({groups:[]});}},ASSETS:{fetch:async()=>new Response('test')}};
const store=new DailyWarehouse(ctx,env);env.DAILY_WAREHOUSE={idFromName:n=>n,get:()=>store};
async function call(path,body,cookie){const headers={};if(cookie)headers.cookie=cookie;if(body){headers.origin=origin;headers['content-type']='application/json';}const response=await worker.fetch(new Request(origin+'/api/'+path,{method:body?'POST':'GET',headers,body:body?JSON.stringify(body):undefined}),env);const data=await response.json();return {response,data,cookie:response.headers.get('set-cookie')?.split(';')[0]};}
// Explicit historical fixture in the in-memory test warehouse; never a successful task API response.
async function historicalTask(body,cookie){const current=(await call('state',null,cookie)).data,f=store.get('family',current.family.id),task={...body,id:'historical:'+body.requestId,authorId:current.member.id,status:'unread',createdAt:new Date().toISOString()};f.tasks.push(task);if(body.sourceMomentId)f.moments.find(m=>m.id===body.sourceMomentId).reminderTaskId=task.id;store.put('family',f.id,f);return task;}

test('creation-zone default stays fixed across foreign members and settings saves without moving reminders',async()=>{
 const owner=await call('register',{handle:'fixed-zone-owner',password:'synthetic-pass-43',name:'媽媽',child:'小禾',timezone:'America/Los_Angeles'});assert.equal(owner.response.status,200);
 const start=(await call('state',null,owner.cookie)).data;assert.equal(start.family.timezone,'America/Los_Angeles');
 const invite=await call('invite',{},owner.cookie),member=await call('join',{handle:'fixed-zone-traveller',password:'synthetic-pass-43',name:'家人',invite:invite.data.code,timezone:'Asia/Tokyo'});assert.equal(member.response.status,200);
 assert.equal((await call('state',null,member.cookie)).data.family.timezone,'America/Los_Angeles');
 const dueAt='2026-12-01T17:37:00.000Z',task=await historicalTask({requestId:'fixed-zone-task',text:'家庭提醒',assigneeId:start.member.id,dueAt},owner.cookie);
 assert.equal((await call('settings',{evening:'20:15'},owner.cookie)).response.status,200);
 assert.equal((await call('settings',{evening:'20:30',timezone:'Asia/Tokyo'},owner.cookie)).response.status,200);
 const login=await call('login',{handle:'fixed-zone-owner',password:'synthetic-pass-43',timezone:'Europe/London'});assert.equal(login.response.status,200);
 const after=(await call('state',null,login.cookie)).data.family;assert.equal(after.timezone,start.family.timezone);assert.equal(after.evening,'20:30');assert.equal(after.tasks.find(t=>t.id===task.id).dueAt,dueAt);
 const fallback=await call('register',{handle:'fixed-zone-fallback',password:'synthetic-pass-43',name:'家人',child:'小雨',timezone:'not/a-zone'});assert.equal(fallback.response.status,200);assert.equal((await call('state',null,fallback.cookie)).data.family.timezone,'Asia/Taipei');
});
test('production Worker never executes local QC seed handlers',async()=>{
 const production={...env,ASSETS:{fetch:async()=>new Response('Not found',{status:404})}};
 for(const path of ['/__qc-add-days','/__qc','/__camera-synthetic','/__weekly-qc'])for(const method of ['GET','POST'])assert.equal((await worker.fetch(new Request(origin+path,{method}),production)).status,404);
});
test('read receipts target viewed IDs, exclude authors and preserve private messages and tasks',async()=>{
 const a=await call('register',{handle:'read-owner',password:'synthetic-pass-43',name:'媽媽',child:'小禾'});
 const join=async(handle,name)=>{const invite=await call('invite',{},a.cookie);return call('join',{handle,password:'synthetic-pass-43',name,invite:invite.data.code});};
 const b=await join('read-dad','爸爸'),c=await join('read-grandma','奶奶');
 const aid=(await call('state',null,a.cookie)).data.member.id,bid=(await call('state',null,b.cookie)).data.member.id;
 await call('comment',{text:'全家留言',requestId:'read-common'},a.cookie);
 await call('comment',{text:'只給爸爸',recipientId:bid,requestId:'read-private'},a.cookie);
 let comments=(await call('state',null,a.cookie)).data.family.comments;
 const common=comments.find(c=>c.text==='全家留言'),privateId=comments.find(c=>c.text==='只給爸爸').id;
 assert.deepEqual(common.readBy,[]);
 await call('read',{},b.cookie);
 assert.deepEqual((await call('state',null,a.cookie)).data.family.comments.find(c=>c.id===common.id).readBy,[],'no IDs never marks a whole family');
 await call('read',{ids:[common.id,privateId]},c.cookie);
 comments=(await call('state',null,a.cookie)).data.family.comments;
 const cid=(await call('state',null,c.cookie)).data.member.id;
 assert.deepEqual(comments.find(c=>c.id===common.id).readBy,[cid]);
 assert.deepEqual(comments.find(c=>c.id===privateId).readBy,[],'unseen private IDs cannot be marked');
 await call('read',{ids:[common.id]},a.cookie);
 await call('read',{ids:[common.id,common.id]},b.cookie);await call('read',{ids:[common.id]},b.cookie);
 comments=(await call('state',null,a.cookie)).data.family.comments;
 assert.deepEqual(comments.find(c=>c.id===common.id).readBy,[cid,bid]);assert.ok(!comments.find(c=>c.id===common.id).readBy.includes(aid));
 const note=(await call('capture',{text:'這一刻',requestId:'read-note',media:[{kind:'audio',data:'data:audio/wav;base64,AAAA',rawOnly:true}]},a.cookie)).data.moment;
 await call('receipt',{id:note.id,kind:'seen'},a.cookie);await call('receipt',{id:note.id,kind:'seen'},b.cookie);await call('receipt',{id:note.id,kind:'seen'},b.cookie);
 const saved=(await call('state',null,a.cookie)).data.family.moments.find(m=>m.id===note.id);
 assert.equal(saved.seenBy.length,1);assert.equal(saved.seenBy[0].memberId,bid);assert.equal(saved.playedBy.length,0,'reading never counts as playing');
 const task=await historicalTask({requestId:'read-task',text:'準備午飯',assigneeId:bid,dueAt:new Date(Date.now()+3600000).toISOString()},a.cookie);
 await call('read',{ids:[privateId]},b.cookie);
 const after=(await call('state',null,b.cookie)).data.family;
 assert.equal(after.tasks.find(t=>t.id===task.id).status,task.status,'reading does not accept or complete a task');
 assert.equal((await call('state',null,c.cookie)).data.family.comments.some(c=>c.id===privateId),false);
});
test('HTTP private families, joining, large media, idempotency, diary conflicts and snapshots',async()=>{
 const a=await call('register',{handle:'mother-test',password:'synthetic-pass-43',name:'媽媽',child:'小禾',family:'A家'});assert.equal(a.response.status,200);
 const b=await call('register',{handle:'other-test',password:'synthetic-pass-43',name:'別家',child:'小雨',family:'B家'});assert.equal(b.response.status,200);
 const media={kind:'image',name:'synthetic-large.jpg',data:'data:image/jpeg;base64,'+'A'.repeat(2800000)};
 const saved=await call('capture',{requestId:'large-1',text:'今天笑了',media:[media]},a.cookie);assert.equal(saved.response.status,200);
 const retry=await call('capture',{requestId:'large-1',text:'今天笑了',media:[media]},a.cookie);assert.equal(retry.data.moment.id,saved.data.moment.id);
 const as=await call('state',null,a.cookie);assert.equal(as.data.family.moments.length,1);assert.equal(as.data.family.moments[0].media[0].data.length,2800023);
 assert.ok(db.prepare('SELECT MAX(length(CAST(payload AS BLOB))) AS bytes FROM records').get().bytes<2000000,'every SQL row remains below the provider limit');
 const bs=await call('state',null,b.cookie);assert.equal(bs.data.family.moments.length,0);
 const invite=await call('invite',{},a.cookie);const dad=await call('join',{handle:'father-test',password:'synthetic-pass-43',name:'爸爸',invite:invite.data.code});assert.equal(dad.response.status,200);
 const reuse=await call('join',{handle:'reuse-test',password:'synthetic-pass-43',name:'其他人',invite:invite.data.code});assert.equal(reuse.response.status,403);
 const ds=await call('state',null,dad.cookie);assert.equal(ds.data.family.id,as.data.family.id);assert.equal(ds.data.family.moments.length,1);
 const parallel=await Promise.all([call('capture',{requestId:'parallel-mom',text:'媽媽同時留下的一句'},a.cookie),call('capture',{requestId:'parallel-dad',text:'爸爸同時留下的一句'},dad.cookie)]);assert.ok(parallel.every(r=>r.response.status===200));const together=await call('state',null,a.cookie);assert.equal(together.data.family.moments.length,3);
 const date=as.data.today,g=await call('generate',{date},a.cookie);assert.equal(g.response.status,200);const d=g.data.diary;
 const edited=await call('edit',{id:d.id,baseRevision:1,title:'我們的一天',body:'人工確認的句子'},dad.cookie);assert.equal(edited.response.status,200);
 const stale=await call('edit',{id:d.id,baseRevision:1,title:'舊視窗',body:'不應覆蓋'},a.cookie);assert.equal(stale.response.status,409);
 await call('capture',{requestId:'late-2',text:'晚上補的一句',date},a.cookie);await call('generate',{date},a.cookie);
 const after=await call('state',null,a.cookie);assert.equal(after.data.family.diaries[0].current.body,'人工確認的句子');assert.ok(after.data.family.diaries[0].pending);
 const book=await call('collection',{title:'第一本',diaryIds:[d.id]},a.cookie);assert.equal(book.response.status,200);
 const outsider=await call('edit',{id:d.id,baseRevision:2,title:'越界',body:'越界'},b.cookie);assert.notEqual(outsider.response.status,200);
 const csrf=await worker.fetch(new Request(origin+'/api/capture',{method:'POST',headers:{origin:'https://other.example',cookie:a.cookie,'content-type':'application/json'},body:'{}'}),env);assert.equal(csrf.status,403);
 const unauth=await call('state');assert.equal(unauth.response.status,401);
 const voice=await call('capture',{requestId:'voice-only',date:'2026-11-03',media:[{kind:'audio',name:'synthetic.wav',data:'data:audio/wav;base64,AAAA'}]},a.cookie);assert.equal(voice.response.status,200);const voiceStory=await call('generate',{date:'2026-11-03'},a.cookie);assert.equal(voiceStory.response.status,200);const withVoice=await call('state',null,a.cookie);assert.equal(withVoice.data.family.moments.find(m=>m.id===voice.data.moment.id).media[0].transcript,'虛構口述');
});

test('Chinese accounts, aggregated validation, editable source versions and honest receipts/reminders',async()=>{
 const invalid=await call('register',{handle:'!',password:'x',name:'',child:''});assert.equal(invalid.response.status,400);assert.deepEqual(Object.keys(invalid.data.fieldErrors).sort(),['child','handle','name','password']);
 const a=await call('register',{handle:'  中文媽媽  ',password:'synthetic-pass-88',name:'媽媽',child:'小禾'});assert.equal(a.response.status,200);
 const login=await call('login',{handle:'中文媽媽',password:'synthetic-pass-88'});assert.equal(login.response.status,200);assert.match(login.response.headers.get('set-cookie'),/Max-Age=2592000/);
 const invite=await call('invite',{},a.cookie);const b=await call('join',{handle:'中文爸爸',password:'synthetic-pass-88',name:'爸爸',invite:invite.data.code});assert.equal(b.response.status,200);
 const moment=(await call('capture',{requestId:'voice-note',text:'明天十二點提醒爸爸吃午飯',media:[{kind:'audio',data:'data:audio/wav;base64,AAAA',transcriptReviewed:true}]},a.cookie)).data.moment;
 assert.equal(moment.reminderHint.localTime.slice(11),'12:00');assert.equal((await call('state',null,a.cookie)).data.family.tasks.length,0,'candidate is not a scheduled task');
 assert.equal((await call('receipt',{id:moment.id,kind:'played',mediaIndex:0,playedSeconds:0},b.cookie)).response.status,400);
 await call('receipt',{id:moment.id,kind:'seen'},b.cookie);let stored=(await call('state',null,a.cookie)).data.family.moments[0];assert.equal(stored.seenBy.length,1);assert.equal(stored.playedBy.length,0,'opening does not mean playback');
 for(let i=0;i<2;i++)await call('receipt',{id:moment.id,kind:'played',mediaIndex:0,playedSeconds:1.1},b.cookie);
 stored=(await call('state',null,a.cookie)).data.family.moments[0];assert.equal(stored.playedBy.length,1);
 const generated=await call('generate',{date:moment.date},a.cookie);assert.equal(generated.response.status,200);
 const edit=await call('moment-edit',{id:moment.id,baseRevision:1,title:'媽媽留話',text:'更正文字',transcripts:{0:'孩子的小名是小禾'}},a.cookie);assert.equal(edit.response.status,200);assert.equal(edit.data.moment.media[0].data,moment.media[0].data);assert.equal(edit.data.moment.media[0].transcriptReviewed,true);
 assert.equal((await call('moment-edit',{id:moment.id,baseRevision:1,text:'舊稿'},a.cookie)).response.status,409);
 assert.equal((await call('moment-edit',{id:moment.id,baseRevision:2,text:'別人的紙條'},b.cookie)).response.status,403);
 assert.equal((await call('state',null,a.cookie)).data.family.diaries[0].hasNewSources,true);
 await call('process-moment',{id:moment.id},a.cookie);stored=(await call('state',null,a.cookie)).data.family.moments[0];assert.equal(stored.media[0].transcript,'孩子的小名是小禾','AI never overwrites corrected transcript');
 const raw=(await call('capture',{requestId:'raw-explicit',date:moment.date,media:[{kind:'audio',data:'data:audio/wav;base64,AAAA',rawOnly:true,transcriptReviewed:true}]},a.cookie)).data.moment;await call('process-moment',{id:raw.id,force:true},a.cookie);assert.ok((await call('state',null,a.cookie)).data.family.moments.find(m=>m.id===raw.id).media[0].transcript,'raw sound can be explicitly transcribed later');
 const taskBody={requestId:'r1',sourceMomentId:moment.id,text:'吃午飯',assigneeId:b.data.member?.id|| (await call('state',null,b.cookie)).data.member.id,dueAt:new Date(Date.now()+86400000).toISOString()};
 const task=await historicalTask(taskBody,a.cookie);assert.equal(task.sourceMomentId,moment.id);
 const retry=await call('task',taskBody,a.cookie);assert.equal(retry.response.status,410);assert.match(retry.data.error,/功能已停止/);assert.equal((await call('state',null,a.cookie)).data.family.tasks.length,1);
 const reply=await call('comment',{text:'我來準備',momentId:moment.id,requestId:'reply-1'},b.cookie);assert.equal(reply.response.status,200);assert.equal((await call('state',null,a.cookie)).data.family.comments[0].momentId,moment.id);await call('comment',{text:'第二句',momentId:moment.id,requestId:'reply-2'},b.cookie);assert.equal((await call('state',null,a.cookie)).data.family.comments.length,2);
});


test('V2 private messages, recoverable notes, conflict rebase and selected book shares',async()=>{
 const owner=await call('register',{handle:'v2-owner',password:'synthetic-pass-43',name:'媽媽',child:'小禾'});
 const invitation=await call('invite',{},owner.cookie);
 const member=await call('join',{handle:'v2-member',password:'synthetic-pass-43',name:'爸爸',invite:invitation.data.code});
 const outsider=await call('register',{handle:'v2-outsider',password:'synthetic-pass-43',name:'別家',child:'小雨'});
 const state=await call('state',null,owner.cookie),memberState=await call('state',null,member.cookie);
 const privateMessage=await call('comment',{text:'只給爸爸的話',recipientId:memberState.data.member.id,requestId:'private-v2'},owner.cookie);assert.equal(privateMessage.response.status,200);
 assert.ok((await call('state',null,member.cookie)).data.family.comments.some(c=>c.text==='只給爸爸的話'));
 assert.equal((await call('state',null,outsider.cookie)).data.family.comments.length,0);
 const note=await call('capture',{requestId:'v2-day1',date:'2026-10-01',text:'今天一起看雲。'},owner.cookie);
 const first=await call('generate',{date:'2026-10-01'},owner.cookie);assert.equal(first.response.status,200);
 const id=first.data.diary.id;
 const one=await call('edit',{id,baseRevision:1,title:'媽媽保存',body:'媽媽的文字'},owner.cookie);assert.equal(one.response.status,200);
 assert.equal((await call('edit',{id,baseRevision:1,title:'爸爸保存',body:'爸爸的文字'},member.cookie)).response.status,409);
 const latest=(await call('state',null,member.cookie)).data.family.diaries.find(d=>d.id===id);
 assert.equal((await call('edit',{id,baseRevision:latest.current.number,title:'一起保存',body:'媽媽的文字，加上爸爸的文字'},member.cookie)).response.status,200);
 const versions=(await call('state',null,owner.cookie)).data.family.diaries.find(d=>d.id===id).versions;
 assert.ok(versions.some(v=>v.body==='媽媽的文字'));assert.ok(versions.some(v=>v.body.includes('加上爸爸')));
 await call('capture',{requestId:'v2-day2',date:'2026-10-02',text:'今天讀故事。'},owner.cookie);
 const second=await call('generate',{date:'2026-10-02'},owner.cookie);
 const collection=await call('collection',{requestId:'v2-book',title:'我們的兩天',diaryIds:[second.data.diary.id,id],template:'album'},owner.cookie);assert.equal(collection.response.status,200);
 assert.deepEqual(collection.data.collection.chapters.map(c=>c.date),['2026-10-02','2026-10-01']);
 const shared=await call('book-share',{id:collection.data.collection.id},owner.cookie);assert.equal(shared.response.status,200);
 const publicBook=await call('shared-book',{token:shared.data.token});assert.equal(publicBook.response.status,200);assert.ok(!JSON.stringify(publicBook.data).includes('只給爸爸的話'));
 const revoked=await call('book-share-revoke',{id:shared.data.id},owner.cookie);assert.equal(revoked.response.status,200);assert.equal((await call('shared-book',{token:shared.data.token})).response.status,404);
 assert.equal((await call('moment-archive',{id:note.data.moment.id},owner.cookie)).response.status,200);
 assert.ok((await call('state',null,owner.cookie)).data.family.moments.find(m=>m.id===note.data.moment.id).archivedAt);
 assert.equal((await call('moment-archive',{id:note.data.moment.id,restore:true},owner.cookie)).response.status,200);
});


test('video frame contract supports current objects and legacy strings; failed image processing retries',async()=>{
 const originalAI=env.AI;let visionRequests=0;
 env.AI={run:async(model,input)=>{if(Array.isArray(input.messages.at(-1).content)){visionRequests++;assert.match(input.messages[0].content[1].image_url.url,/^data:image/);return completion({facts:['桌上有橘子'],uncertain:[]});}const evidence=JSON.parse(input.messages.at(-1).content);return completion(input.messages[0].content.includes('paragraphs')?{paragraphs:evidence.map(e=>({eventIndices:[e.index],text:'桌上放著橘子。'}))}:{groups:[]});}};
 try{
  const a=await call('register',{handle:'v2-frames',password:'synthetic-pass-43',name:'媽媽',child:'小禾'});
  const pixels='data:image/jpeg;base64,eA==';
  for(const [n,preview] of [[1,{data:pixels,seconds:0}],[2,pixels]]){
   const capture=await call('capture',{requestId:'frame'+n,date:'2026-10-03',media:[{kind:'video',data:'data:video/mp4;base64,eA==',preview}]},a.cookie);
   assert.equal(capture.response.status,200);assert.equal((await call('process-moment',{id:capture.data.moment.id},a.cookie)).response.status,200);
   const saved=(await call('state',null,a.cookie)).data.family.moments.find(m=>m.id===capture.data.moment.id);assert.deepEqual(saved.media[0].observation.facts,['桌上有橘子']);
  }
  assert.equal(visionRequests,2);
  const capture=await call('capture',{requestId:'failed-photo',date:'2026-10-04',text:'桌上有橘子',media:[{kind:'image',data:pixels}]},a.cookie);
  assert.equal((await call('generate',{date:'2026-10-04'},a.cookie)).response.status,200);
  const state=(await call('state',null,a.cookie)).data;const stored=store.get('family',state.family.id);stored.moments.find(m=>m.id===capture.data.moment.id).media[0].observation.state='failed';store.put('family',stored.id,stored);
  const before=visionRequests;assert.equal((await call('generate',{date:'2026-10-04'},a.cookie)).response.status,200);assert.equal(visionRequests,before+1);
 }finally{env.AI=originalAI;}
});

test('comment retry is idempotent without silently accepting changed text or private scope',async()=>{
 const a=await call('register',{handle:'comment-recovery-owner',password:'synthetic-pass-43',name:'Mom',child:'Synthetic'});const invite=await call('invite',{},a.cookie),b=await call('join',{handle:'comment-recovery-dad',password:'synthetic-pass-43',name:'Dad',invite:invite.data.code});const bid=(await call('state',null,b.cookie)).data.member.id;
 const payload={requestId:'comment-recovery-a',text:'private synthetic',recipientId:bid};assert.equal((await call('comment',payload,a.cookie)).response.status,200);assert.equal((await call('comment',payload,a.cookie)).response.status,200);assert.equal((await call('comment',{...payload,text:'newer draft'},a.cookie)).response.status,409);assert.equal((await call('comment',{...payload,recipientId:''},a.cookie)).response.status,409);const comments=(await call('state',null,a.cookie)).data.family.comments;assert.equal(comments.length,1);assert.equal(comments[0].text,payload.text);assert.equal(comments[0].recipientId,bid);
});

test('retired reminder UI preserves historical export and ordinary time-mentioned capture creates no task',async()=>{
 const owner=await call('register',{handle:'retired-task-history',password:'synthetic-pass-43',name:'Mom',child:'Synthetic'}),initial=(await call('state',null,owner.cookie)).data;const task=await historicalTask({requestId:'legacy-task-record',text:'historical task',assigneeId:initial.member.id,dueAt:'2026-12-01T20:00:00Z'},owner.cookie);await call('task-status',{id:task.id,status:'accepted'},owner.cookie);const before=(await call('export',null,owner.cookie)).data.family;const stopped=await call('task',{requestId:'new-retired-request',text:'do not create',assigneeId:initial.member.id,dueAt:'2026-12-01T20:00:00Z'},owner.cookie);assert.equal(stopped.response.status,410);assert.match(stopped.data.error,/功能已停止/);
 const capture=await call('capture',{requestId:'ordinary-time-note',date:'2026-11-05',text:'16:00 提醒我喝奶，這段原話留在日記。',media:[]},owner.cookie);assert.equal(capture.response.status,200);const after=(await call('export',null,owner.cookie)).data.family;assert.deepEqual(after.tasks,before.tasks);assert.equal(after.timezone,before.timezone);assert.equal(after.evening,before.evening);assert.equal(after.moments.find(m=>m.id===capture.data.moment.id).text,'16:00 提醒我喝奶，這段原話留在日記。');
});

test('weekly API synthesizes separate versions, protects manual text, retries failures and preserves existing books',async()=>{
 const owner=await call('register',{handle:'weekly-owner',password:'synthetic-pass-43',name:'Mom',child:'Synthetic'}),invite=await call('invite',{},owner.cookie),dad=await call('join',{handle:'weekly-dad',password:'synthetic-pass-43',name:'Dad',invite:invite.data.code});
 const monday=(await call('capture',{requestId:'week-mon',date:'2026-10-26',text:'一起挑選桌上的橘子。',media:[{kind:'image',data:'data:image/png;base64,AAAA'}]},owner.cookie)).data.moment;await call('process-moment',{id:monday.id},owner.cookie);
 const wed=(await call('capture',{requestId:'week-wed',date:'2026-10-28',text:'接著記下剝橘子。',media:[{kind:'audio',data:'data:audio/wav;base64,AAAA'}]},dad.cookie)).data.moment;await call('moment-edit',{id:wed.id,baseRevision:1,text:'接著記下剝橘子。',transcripts:{0:'這是更正後的原話，一起剝橘子。'}},dad.cookie);
 await call('capture',{requestId:'week-separate',date:'2026-11-01',text:'另一件事：窗外看雪，和橘子不是同一件事。'},owner.cookie);
 await call('generate',{date:'2026-10-26'},owner.cookie);await call('generate',{date:'2026-10-28'},owner.cookie);let family=(await call('state',null,owner.cookie)).data.family;const d=family.diaries.find(d=>d.date==='2026-10-26');await call('edit',{id:d.id,baseRevision:d.current.number,title:'家人寫下的橘子',body:'手改日記：橘子放在藍杯旁。'},owner.cookie);family=(await call('state',null,owner.cookie)).data.family;
 const book=await call('collection',{requestId:'weekly-old-book',title:'先前的小書',diaryIds:family.diaries.map(d=>d.id),template:'simple'},owner.cookie);assert.equal(book.response.status,200);const bookSnapshot=JSON.stringify(book.data.collection);
 const first=await call('generate-week',{start:'2026-10-26'},owner.cookie);assert.equal(first.response.status,200);const w=first.data.weekly;assert.equal(w.start,'2026-10-26');assert.equal(w.end,'2026-11-01');assert.ok(w.current.diaryVersions.some(v=>v.body.includes('手改日記')));assert.ok(w.current.inputs.some(d=>d.sources.some(s=>s.words.includes('更正後'))));assert.equal(w.current.generationMode,'synthetic-adapter');assert.equal(w.versions.length,1);
 const repeat=await call('generate-week',{start:w.start},owner.cookie);assert.equal(repeat.data.weekly.versions.length,1);await call('edit-week',{id:w.id,baseRevision:1,title:'家人的週記',body:'這段週記是人工修改。'},owner.cookie);
 await call('capture',{requestId:'week-late',date:'2026-10-30',text:'晚到的記錄：週五讀繪本。'},dad.cookie);let update=await call('generate-week',{start:w.start},owner.cookie);assert.equal(update.data.weekly.current.body,'這段週記是人工修改。');assert.ok(update.data.weekly.pending);assert.equal((await call('edit-week',{id:w.id,baseRevision:1,title:'stale',body:'wrong'},dad.cookie)).response.status,409);
 await call('capture',{requestId:'week-failure',date:'2026-10-31',text:'週六下雨。'},owner.cookie);const realRun=env.AI.run;env.AI.run=async(model,input)=>{if(input.messages?.[0]?.content?.includes('週記'))throw Error('bounded synthetic failure');return realRun(model,input);};assert.ok((await call('generate-week',{start:w.start},owner.cookie)).response.status>=400);env.AI.run=realRun;
 family=(await call('state',null,owner.cookie)).data.family;assert.equal(family.weeklies[0].current.body,'這段週記是人工修改。');assert.ok(family.weekErrors[w.start]);update=await call('generate-week',{start:w.start},owner.cookie);assert.equal(update.response.status,200);assert.equal(update.data.weekly.current.body,'這段週記是人工修改。');assert.equal((await call('state',null,owner.cookie)).data.family.weeklies.length,1);assert.equal(JSON.stringify((await call('state',null,owner.cookie)).data.family.collections[0]),bookSnapshot);
 const empty=await call('generate-week',{start:'2026-10-19'},owner.cookie);assert.equal(empty.data.weekly,null);
});
test('weekly retry revisits failed prepared images with the same key but never processes future material',async()=>{
 const owner=await call('register',{handle:'week-retry-owner',password:'synthetic-pass-43',name:'Mom',child:'Synthetic'}),date='2026-11-03',start='2026-11-02';
 const image=(await call('capture',{requestId:'retry-week-image',date,text:'桌上留著橘子。',media:[{kind:'image',data:'data:image/png;base64,AAAA'}]},owner.cookie)).data.moment,future=(await call('capture',{requestId:'future-week-image',date:'2026-11-08',text:'未來日的素材',media:[{kind:'image',data:'data:image/png;base64,BBBB'}]},owner.cookie)).data.moment;
 let attempts=0;const original=env.AI.run;env.AI.run=async(model,input)=>{if(Array.isArray(input.messages?.at(-1)?.content)){attempts++;if(attempts===1)throw Error('synthetic image failure');}return original(model,input);};
 try{const first=await call('generate-week',{start},owner.cookie);assert.equal(first.response.status,200);await call('edit-week',{id:first.data.weekly.id,baseRevision:1,title:'手改',body:'保留家人修改'},owner.cookie);const retry=await call('generate-week',{start},owner.cookie);assert.equal(retry.response.status,200);assert.equal(attempts,2);assert.equal(retry.data.weekly.current.body,'保留家人修改');assert.ok(retry.data.weekly.pending.inputs[0].sources[0].photoFacts.length);const family=(await call('state',null,owner.cookie)).data.family;assert.equal(family.moments.find(m=>m.id===future.id).media[0].observation,undefined);assert.equal(family.moments.find(m=>m.id===image.id).media[0].data,'data:image/png;base64,AAAA');}finally{env.AI.run=original;}
});
test('official scheduled handler creates daily and completed family week with closed client, not next Monday week',async()=>{
 const owner=await call('register',{handle:'week-cron-owner',password:'synthetic-pass-43',name:'Mom',child:'Synthetic',timezone:'America/Los_Angeles'}),familyId=(await call('state',null,owner.cookie)).data.family.id;
 for(const [date,text] of [['2026-11-02','週一留下橘子'],['2026-11-04','週三延續橘子'],['2026-11-09','下週一讀繪本']])await call('capture',{requestId:'cron-'+date,date,text},owner.cookie);
 const memory=new DatabaseSync(':memory:'),sql={exec(query,...args){const q=memory.prepare(query),rows=q.columns().length?q.all(...args):(q.run(...args),[]);return {toArray:()=>rows};}},isolatedEnv={...env},warehouse=new DailyWarehouse({storage:{sql,transactionSync(fn){memory.exec('BEGIN');try{const r=fn();memory.exec('COMMIT');return r;}catch(e){memory.exec('ROLLBACK');throw e;}}}},isolatedEnv);isolatedEnv.DAILY_WAREHOUSE={idFromName:n=>n,get:()=>({fetch:r=>warehouse.fetch(typeof r==='string'?new Request(r):r)})};warehouse.put('family',familyId,store.get('family',familyId));warehouse.put('account','week-cron-owner',store.get('account','week-cron-owner'));const raw=owner.cookie.split('=')[1],key=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(raw))),b=>b.toString(16).padStart(2,'0')).join('');warehouse.put('session',key,{accountHandle:'week-cron-owner',expiresAt:Date.now()+86400000});
 const read=async()=>{const r=await worker.fetch(new Request(origin+'/api/state',{headers:{cookie:owner.cookie}}),isolatedEnv);return (await r.json()).family;},tick=async time=>{const work=[];await worker.scheduled({scheduledTime:Date.parse(time)},isolatedEnv,{waitUntil:p=>work.push(p)});await Promise.all(work);};
 await tick('2026-11-09T03:45:00Z');assert.equal((await read()).weeklies?.length||0,0);await tick('2026-11-09T04:15:00Z');let family=await read();assert.equal(family.diaries.length,2);assert.equal(family.weeklies.length,1);assert.equal(family.weeklies[0].start,'2026-11-02');const versions=family.weeklies[0].versions.length;await tick('2026-11-09T04:30:00Z');assert.equal((await read()).weeklies[0].versions.length,versions);await tick('2026-11-10T04:15:00Z');family=await read();assert.equal(family.diaries.length,3);assert.equal(family.weeklies.length,1,'Monday starts a new unfinished week, no fake ready weekly');
});
test('first saved moment schedules first daily without a second client request or background polling',async()=>{
 const owner=await call('register',{handle:'first-auto-owner',password:'synthetic-pass-43',name:'Mom',child:'Synthetic'}),jobs=[],prior=ctx.waitUntil;ctx.waitUntil=p=>jobs.push(p);try{await call('capture',{requestId:'first-auto',text:'今天留下第一句話。',media:[]},owner.cookie);await Promise.all(jobs);assert.equal((await call('state',null,owner.cookie)).data.family.diaries.length,1);}finally{if(prior)ctx.waitUntil=prior;else delete ctx.waitUntil;}
});

test('weekly automatic failure does not repeat on unchanged sources; explicit retry and changed sources remain available',async()=>{
 const owner=await call('register',{handle:'week-auto-failure',password:'synthetic-pass-43',name:'Mom',child:'Synthetic'});await call('capture',{requestId:'weekly-fail-source',date:'2026-11-02',text:'合成橘子記錄'},owner.cookie);const f=(await call('state',null,owner.cookie)).data.family;let calls=0;const prior=env.AI;env.AI={run:async()=>{calls++;throw Error('controlled weekly failure');}};
 try{await assert.rejects(store.generateWeek(f.id,'2026-11-02','2026-11-08T12:00:00Z',true));assert.equal(calls,1);await store.generateWeek(f.id,'2026-11-02','2026-11-08T12:15:00Z',true);assert.equal(calls,1);await assert.rejects(store.generateWeek(f.id,'2026-11-02','2026-11-08T12:30:00Z'));assert.equal(calls,2);const latest=store.get('family',f.id);latest.moments[0].revision++;latest.moments[0].text+='新的補充';store.put('family',f.id,latest);await assert.rejects(store.generateWeek(f.id,'2026-11-02','2026-11-08T12:45:00Z',true));assert.equal(calls,3);}finally{env.AI=prior;}
});

test('failed in-flight weekly attempt cannot mark a newer family correction as already attempted',async()=>{
 const owner=await call('register',{handle:'week-inflight-change',password:'synthetic-pass-43',name:'Mom',child:'Synthetic'});await call('capture',{requestId:'week-inflight-source',date:'2026-11-02',text:'舊的合成橘子記錄'},owner.cookie);const f=(await call('state',null,owner.cookie)).data.family;let release,entered;const started=new Promise(r=>entered=r),gate=new Promise(r=>release=r);let calls=0;const prior=env.AI;env.AI={run:async()=>{calls++;entered();await gate;throw Error('old attempt failure');}};
 try{const pending=store.generateWeek(f.id,'2026-11-02','2026-11-08T12:00:00Z',true);await started;const latest=store.get('family',f.id);latest.moments[0].revision++;latest.moments[0].text='家人更正的新記錄';store.put('family',f.id,latest);release();await assert.rejects(pending);await assert.rejects(store.generateWeek(f.id,'2026-11-02','2026-11-08T12:15:00Z',true));assert.equal(calls,2,'new revision was never part of the failed model input and must remain eligible');}finally{env.AI=prior;}
});
