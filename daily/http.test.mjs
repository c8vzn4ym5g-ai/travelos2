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
const env={AI:{async run(model,input){if(model.includes('whisper'))return {text:'虛構口述'};const message=input.messages?.at(-1)?.content;let content;try{content=JSON.parse(message);}catch{}if(Array.isArray(content))return {response:JSON.stringify(input.messages[0].content.includes('paragraphs')?{paragraphs:content.map(e=>({sourceIds:e.sourceIds,text:'今天留下了這段生活記錄。'}))}:{groups:[]})};return {response:'媽媽說今天笑了。'};}},ASSETS:{fetch:async()=>new Response('test')}};
const store=new DailyWarehouse(ctx,env);env.DAILY_WAREHOUSE={idFromName:n=>n,get:()=>store};
async function call(path,body,cookie){const headers={};if(cookie)headers.cookie=cookie;if(body){headers.origin=origin;headers['content-type']='application/json';}const response=await worker.fetch(new Request(origin+'/api/'+path,{method:body?'POST':'GET',headers,body:body?JSON.stringify(body):undefined}),env);const data=await response.json();return {response,data,cookie:response.headers.get('set-cookie')?.split(';')[0]};}
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
 const task=await call('task',taskBody,a.cookie);assert.equal(task.response.status,200);assert.equal(task.data.task.sourceMomentId,moment.id);
 const retry=await call('task',taskBody,a.cookie);assert.equal(retry.data.task.id,task.data.task.id);assert.equal((await call('state',null,a.cookie)).data.family.tasks.length,1);
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
 env.AI={run:async(model,input)=>{if(model.includes('vision')){visionRequests++;assert.match(input.image,/^data:image/);return {response:JSON.stringify({facts:['桌上有橘子'],uncertain:[]})};}const evidence=JSON.parse(input.messages.at(-1).content);return {response:JSON.stringify(input.messages[0].content.includes('paragraphs')?{paragraphs:evidence.map(e=>({sourceIds:e.sourceIds,text:'桌上放著橘子。'}))}:{groups:[]})};}};
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
