import {initialFamilyZone} from './web/family-zone.js';
import {DurableObject} from 'cloudflare:workers';
import {transcribe} from '../baby-poc/ai.mjs';
import {observeImage,arrangeSources,VISION_MODEL,GEMMA_VISION_MODEL,LEGACY_VISION_MODEL} from './multimodal.mjs';
import {VERSION,newFamily,receive,sourcesFor,sourceKey,integrate,edit,editMoment,reminderHint,plainStory,dayAt,due,active} from './domain.mjs';
import {normalizeHandle,authErrors} from './web/validation.js';
import {bookSnapshot,versionMedia} from './web/story-model.js';
const json=(v,status=200,headers={})=>Response.json(v,{status,headers:{'cache-control':'no-store',...headers}});
const fail=(message,status=400)=>{throw Object.assign(new Error(message),{status});};
const id=()=>crypto.randomUUID();
const token=()=>Array.from(crypto.getRandomValues(new Uint8Array(24)),b=>b.toString(16).padStart(2,'0')).join('');
const hash=async s=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s))),b=>b.toString(16).padStart(2,'0')).join('');
async function password(p,salt){const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(p),'PBKDF2',false,['deriveBits']);return Array.from(new Uint8Array(await crypto.subtle.deriveBits({name:'PBKDF2',salt:new TextEncoder().encode(salt),iterations:100000,hash:'SHA-256'},key,256)),b=>b.toString(16).padStart(2,'0')).join('');}
const cookie=s=>`daily_session=${s}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=2592000`;
function validateMedia(media){if(!Array.isArray(media)||media.length>4)fail('每次最多四個檔案，可分次補入。');for(const m of media){if(!['image','audio','video'].includes(m.kind)||!new RegExp(`^data:${m.kind}/(?:jpeg|png|webp|gif|mp4|webm|ogg|mpeg|wav|x-wav|mp3|aac|quicktime|x-m4a|3gpp|3gpp2)(?:;[^,]*)?;base64,`,'i').test(m.data||''))fail('請使用常見照片、聲音或影片格式。');if(m.analysisImage&&(!/^data:image\/(jpeg|png);base64,/.test(m.analysisImage)||m.analysisImage.length>3*1024*1024))fail('照片整理副本過大，原圖可另行保存。');if(m.preview?.data&&(!/^data:image\/(jpeg|png);base64,/.test(m.preview.data)||m.preview.data.length>3*1024*1024))fail('短片取樣畫面無效。');if(m.data.length>8*1024*1024*1.38)fail('單一測試檔案限 8MB，請縮短影片或換較小檔案。');}}
export class DailyWarehouse extends DurableObject {
 constructor(ctx,env){super(ctx,env);this.env=env;this.momentJobs=new Map();this.sql=ctx.storage.sql;this.sql.exec('CREATE TABLE IF NOT EXISTS records (kind TEXT, id TEXT, payload TEXT, PRIMARY KEY(kind,id))');}
 get(k,i){const r=this.sql.exec('SELECT payload FROM records WHERE kind=? AND id=?',k,i).toArray()[0];if(!r)return null;const value=JSON.parse(r.payload);if(['family','book-share'].includes(k)&&value.chunks)return JSON.parse(Array.from({length:value.chunks},(_,n)=>JSON.parse(this.sql.exec('SELECT payload FROM records WHERE kind=? AND id=?',`${k}-chunk`,`${i}:${n}`).toArray()[0].payload)).join(''));return value;}
 put(k,i,v){const text=JSON.stringify(v);if(!['family','book-share'].includes(k))return this.sql.exec('INSERT OR REPLACE INTO records VALUES (?,?,?)',k,i,text);const chunks=Math.ceil(text.length/400000);this.ctx.storage.transactionSync(()=>{for(let n=0;n<chunks;n++)this.sql.exec('INSERT OR REPLACE INTO records VALUES (?,?,?)',`${k}-chunk`,`${i}:${n}`,JSON.stringify(text.slice(n*400000,(n+1)*400000)));this.sql.exec('INSERT OR REPLACE INTO records VALUES (?,?,?)',k,i,JSON.stringify({chunks}));});}
 all(k){return this.sql.exec('SELECT id,payload FROM records WHERE kind=?',k).toArray().map(r=>k==='family'?this.get(k,r.id):JSON.parse(r.payload));}
 visibleComment(c,member){return !c.recipientId||c.authorId===member.id||c.recipientId===member.id;}
 members(fid){return this.all('account').filter(a=>a.familyId===fid).map(a=>({id:a.id,name:a.name,role:a.role}));}
 processMoment(fid,momentId,force=false,visionModel=VISION_MODEL){
  const key=`${fid}:${momentId}`;let pending=this.momentJobs.get(key);
  if(!pending){pending=this.runMoment(fid,momentId,force,visionModel).finally(()=>this.momentJobs.delete(key));this.momentJobs.set(key,pending);this.ctx.waitUntil?.(pending.catch(()=>{}));}
  let timer;return Promise.race([pending,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Object.assign(Error('素材仍在整理，原始內容已保存，稍後可讀取結果。'),{status:504})),90000);})]).finally(()=>clearTimeout(timer));
 }
 async runMoment(fid,momentId,force=false,visionModel=VISION_MODEL){
  let f=this.get('family',fid),m=f.moments.find(m=>m.id===momentId);if(!m)fail('找不到這張紙條。',404);
  if(m.processing&&Date.now()-Date.parse(m.processing.at)<120000)return {moment:m,processing:true};
  if(force)for(const audio of m.media)if(audio.kind==='audio'&&audio.rawOnly&&!audio.transcript){audio.transcriptReviewed=false;audio.rawOnly=false;}
  const job={id:id(),at:new Date().toISOString()};m.processing=job;this.put('family',fid,f);
  const reserve=(field,limit)=>{const current=this.get('family',fid),day=dayAt(new Date().toISOString(),current.timezone);current.usage||={};current.usage[day]||={stories:0,transcriptions:0};current.usage[day][field]||=0;if(current.usage[day][field]>=limit)fail('今天的素材整理額度已用完，原始內容仍在，可手動更正。',429);current.usage[day][field]++;this.put('family',fid,current);};
  try{
   for(let i=0;i<m.media.length;i++){
    const source=m.media[i];
    if(source.kind==='audio'&&!source.transcript&&!source.transcriptReviewed){
     reserve('transcriptions',20);const result=await transcribe(this.env.AI,source.data,'zh');f=this.get('family',fid);const latest=f.moments.find(x=>x.id===momentId);
     if(latest.processing?.id===job.id&&latest.media[i]?.data===source.data&&!latest.media[i].transcriptReviewed){latest.media[i].transcript=result.transcript;latest.revision=(latest.revision||1)+1;latest.updatedAt=new Date().toISOString();this.put('family',fid,f);}
    }
    const image=source.kind==='image'?(source.analysisImage||source.data):source.kind==='video'?(typeof source.preview==='string'?source.preview:source.preview?.data):null;
    if(image&&!source.observationReviewed){
     const sourceHash=await hash(image);if(source.observation?.sourceHash===sourceHash&&source.observation.model===visionModel&&['ready','uncertain'].includes(source.observation.state))continue;
     f=this.get('family',fid);if(visionModel===LEGACY_VISION_MODEL&&f.visualModelGate&&!force)fail('照片理解需要管理者確認模型使用條款，原始素材已保存。',503);
     reserve('visuals',20);let observation;
     try{observation=await observeImage(this.env.AI,image,visionModel);}catch(error){
      f=this.get('family',fid);const latest=f.moments.find(x=>x.id===momentId),requiresTerms=/agree|licen[cs]e|acceptable use|terms|agreement/i.test(String(error.message));
      if(requiresTerms&&visionModel===LEGACY_VISION_MODEL)f.visualModelGate='terms-required';
      if(latest.processing?.id===job.id&&!latest.media[i].observationReviewed)latest.media[i].observation={state:'failed',code:requiresTerms?'terms-required':'unavailable',sourceHash,providerError:{message:String(error.message||'').replace(/Bearer\s+[^\s]+/gi,'Bearer [redacted]').slice(0,1400),code:String(error.code||error.status||'').slice(0,80)}};
      this.put('family',fid,f);if(requiresTerms)fail('照片理解需要管理者確認模型使用條款，原始素材已保存。',503);throw error;
     }
     f=this.get('family',fid);const latest=f.moments.find(x=>x.id===momentId),stored=latest.media[i];
     if(latest.processing?.id===job.id&&!stored.observationReviewed&&(stored.kind==='image'?(stored.analysisImage||stored.data):(typeof stored.preview==='string'?stored.preview:stored.preview?.data))===image){stored.observation={...observation,sourceHash,at:new Date().toISOString(),...(source.kind==='video'?{frameSeconds:source.preview.seconds}:{} )};latest.revision=(latest.revision||1)+1;latest.updatedAt=new Date().toISOString();if(visionModel===LEGACY_VISION_MODEL)delete f.visualModelGate;this.put('family',fid,f);}
    }
   }
   f=this.get('family',fid);m=f.moments.find(x=>x.id===momentId);if(m.processing?.id===job.id)delete m.processing;delete m.processError;
   const words=[m.text,...m.media.filter(a=>a.kind==='audio').map(a=>a.transcript||'')].join('\n');m.reminderHint=reminderHint(words,m.date,this.members(fid));this.put('family',fid,f);return {moment:m};
  }catch(e){f=this.get('family',fid);m=f.moments.find(x=>x.id===momentId);if(m.processing?.id===job.id)delete m.processing;m.processError=e.status===503?e.message:'部分素材尚未整理，原始內容仍完整保存，可重試或自己補文字。';this.put('family',fid,f);throw e;}
 }
 async generate(fid,date){
  let f=this.get('family',fid),sources=sourcesFor(f,date),key=sourceKey(sources),d=f.diaries.find(d=>d.date===date);
  const needsProcessing=(await Promise.all(sources.flatMap(m=>m.media.map(async a=>{const pixels=a.kind==='image'?(a.analysisImage||a.data):a.kind==='video'?(typeof a.preview==='string'?a.preview:a.preview?.data):null;return !!pixels&&!a.observationReviewed&&(!a.observation||a.observation.state==='failed'||a.observation.sourceHash!==await hash(pixels));})))).some(Boolean);
  if(!sources.length||!active(f,new Date().toISOString())||(!needsProcessing&&(d?.sourceKey===key||d?.pending?.sourceKey===key)))return d||null;
  if(f.jobs[date]&&Date.now()-Date.parse(f.jobs[date].startedAt)<120000)return d||null;
  const originalIds=new Set(sources.map(m=>m.id)),job={id:id(),startedAt:new Date().toISOString(),key};f.jobs[date]=job;this.put('family',fid,f);
  try{
   for(const source of sources){try{const r=await this.processMoment(fid,source.id);if(r.processing)fail('素材還在整理中，原始內容已保存，請稍後讀取結果。',409);}catch(error){if(!source.text&&!source.media.some(m=>m.kind==='audio'&&(m.transcript||m.transcriptReviewed)))throw error;}}
   f=this.get('family',fid);sources=sourcesFor(f,date).filter(m=>originalIds.has(m.id));if(!sources.length){delete f.jobs[date];this.put('family',fid,f);return null;}
   const notes=plainStory(f,sources);if(notes.length>22000)fail('今天的內容較多，請先分日整理；原始素材已保存。',413);
   const usageDay=dayAt(new Date().toISOString(),f.timezone);f.usage||={};f.usage[usageDay]||={stories:0,transcriptions:0};if(f.usage[usageDay].stories>=30)fail('今日AI整理額度已用完，仍可手動編輯。',429);f.usage[usageDay].stories++;this.put('family',fid,f);
   let body,events,mode;
   const hasVisual=sources.some(m=>m.media.some(a=>a.observation?.facts?.length));
   if(hasVisual||sources.some(m=>m.text||m.media.some(a=>a.transcript))){const result=await arrangeSources(this.env.AI,sources);({body,events,mode}=result);}
   else{body=notes;mode='source-layout';}
   f=this.get('family',fid);if(f.jobs[date]?.id!==job.id)return null;
   const current=f.moments;f.moments=sources;d=integrate(f,date,body,new Date().toISOString());f.moments=current;
   if(d){d.generationMode=mode;const version=d.pending?.sourceKey===sourceKey(sources)?d.pending:d.current;if(events)version.events=events;version.preparedThrough=sources.map(m=>m.updatedAt||m.createdAt).sort().at(-1);}
   delete f.jobs[date];delete f.lastError;delete f.lastGenerationDiagnostic;this.put('family',fid,f);return d;
  }catch(e){f=this.get('family',fid);if(f.jobs[date]?.id===job.id){delete f.jobs[date];if(e.diagnostic)f.lastGenerationDiagnostic=e.diagnostic;f.lastError=e.status===503?e.message:'故事整理尚未完成，原始素材已保存，可以稍後重試。';this.put('family',fid,f);}throw e;}
 }
 async fetch(request){try{return await this.handle(request);}catch(e){return json({error:e.status?e.message:'目前無法完成，請保留輸入並稍後再試。',...(e.fieldErrors?{fieldErrors:e.fieldErrors}:{})},e.status||400);}}
 async handle(request){
  const path=new URL(request.url).pathname,now=new Date().toISOString();
  if(path==='/internal/tick'){
   let generated=0,failed=0;for(const f of this.all('family'))if(due(f,now)&&active(f,now)){
    const days=[...new Set(f.moments.map(m=>m.date))].filter(d=>d<=dayAt(now,f.timezone));
    for(const date of days)try{if(await this.generate(f.id,date))generated++;}catch{failed++;}
   }return json({generated,failed});
  }
  let body={};if(request.method==='POST'){const reader=request.body?.getReader();let size=0;const parts=[];if(reader){while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>12*1024*1024){await reader.cancel();fail('一次傳送上限12MB，請分次留下片刻。',413);}parts.push(value);}}const bytes=new Uint8Array(size);let offset=0;for(const p of parts){bytes.set(p,offset);offset+=p.length;}body=JSON.parse(new TextDecoder().decode(bytes)||'{}');}
  if(path==='/api/shared-book'){
   if(!/^[a-f0-9]{48}$/i.test(body.token||''))fail('分享連結無效，請向分享者索取新連結。',404);
   const share=this.get('book-share',await hash(body.token));if(!share||share.revoked||Date.parse(share.expiresAt)<Date.now())fail('分享已到期或已被收回，請向分享者索取新連結。',404);
   return json({collection:share.collection,media:share.media,child:share.child});
  }
  if(['/api/register','/api/login','/api/join'].includes(path)){
   const handle=normalizeHandle(body.handle),p=String(body.password||''),errors=authErrors(body,path.split('/').at(-1));
   if(Object.keys(errors).length)throw Object.assign(new Error('請一起核對下面幾個地方。'),{status:400,fieldErrors:errors});
   let account=this.get('account',handle);
   if(path==='/api/login'){if(!account||await password(p,account.salt)!==account.password)fail('登入名稱或密碼不正確。',401);}
   else{
    if(account)fail('這個登入名稱已有人使用，請換一個。',409);
    const salt=token(),digest=await password(p,salt);let f,role;
    if(path==='/api/join'){
     const inviteHash=await hash(String(body.invite||'')),invite=this.get('invite',inviteHash);
     if(!invite||invite.used||Date.parse(invite.expiresAt)<Date.now())fail('邀請碼無效或已使用，請家人重新建立。',403);
     f=this.get('family',invite.familyId);role='member';invite.used=true;this.put('invite',inviteHash,invite);
    }else {f=newFamily({id:id(),name:String(body.family||`${String(body.child||'寶寶')}的家`).slice(0,60),child:String(body.child||'寶寶').slice(0,40),now,timezone:initialFamilyZone(body.timezone)});role='owner';this.put('family',f.id,f);}
    if(this.get('account',handle))fail('登入名稱已存在。',409);
    account={id:id(),handle,name:String(body.name||'家人').slice(0,40),familyId:f.id,role,salt,password:digest};this.put('account',handle,account);
   }
   const session=token();this.put('session',await hash(session),{accountHandle:handle,expiresAt:Date.now()+30*86400000});
   return json({ok:true},200,{'set-cookie':cookie(session)});
  }
  const sessionToken=(request.headers.get('cookie')||'').match(/(?:^|; )daily_session=([^;]+)/)?.[1];
  const session=sessionToken?this.get('session',await hash(sessionToken)):null;
  if(!session||session.expiresAt<Date.now())fail('請先登入家庭。',401);
  const account=this.get('account',session.accountHandle);if(!account)fail('請重新登入。',401);
  let f=this.get('family',account.familyId);const member={id:account.id,name:account.name,role:account.role};
  if(path==='/api/logout'){this.sql.exec('DELETE FROM records WHERE kind=? AND id=?','session',await hash(sessionToken));return json({ok:true},200,{'set-cookie':'daily_session=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0'});}
  if(path==='/api/state'){for(const d of f.diaries)d.hasNewSources=sourceKey(sourcesFor(f,d.date))!==(d.pending?.sourceKey||d.sourceKey);return json({version:VERSION,member,family:{...f,comments:f.comments.filter(c=>this.visibleComment(c,member))},today:dayAt(now,f.timezone),members:this.members(f.id),trialActive:active(f,now)});}
  if(path==='/api/export')return json({version:VERSION,family:{...f,comments:f.comments.filter(c=>this.visibleComment(c,member))}});
  if(path==='/api/invite'){
   if(account.role!=='owner')fail('請由家庭管理者建立邀請。',403);
   const code=token();this.put('invite',await hash(code),{familyId:f.id,used:false,expiresAt:new Date(Date.now()+7*86400000).toISOString()});return json({code});
  }
  if(!active(f,now))fail('30天試用已結束；既有日記仍可閱讀與匯出。此測試版尚不收費。',403);
  if(path==='/api/capture'){
   const prior=f.moments.find(m=>m.requestId===body.requestId&&m.authorId===member.id);if(prior)return json({moment:prior});validateMedia(body.media||[]);if(JSON.stringify(f).length+JSON.stringify(body).length>20*1024*1024)fail('測試家庭容量已達20MB。請匯出內容，暫停新增。',413);
   const m=receive(f,body,member,now,id());m.reminderHint=reminderHint(m.text,m.date,this.members(f.id));this.put('family',f.id,f);return json({moment:m});
  }
  if(path==='/api/process-moment')return json(await this.processMoment(f.id,body.id,body.force===true));
  if(path==='/api/moment-edit'){
   const m=editMoment(f,body,member,now);for(const [index,text] of Object.entries(body.transcripts||{})){const media=m.media[Number(index)];if(media?.kind==='audio'){media.transcript=String(text).slice(0,8000);media.transcriptReviewed=true;}}
   for(const [index,value] of Object.entries(body.visualFacts||{})){const media=m.media[Number(index)];if(media&&['image','video'].includes(media.kind)){media.observation={...(media.observation||{}),state:'ready',facts:String(value).split('\n').map(v=>v.trim()).filter(Boolean).slice(0,8),uncertain:[]};media.observationReviewed=true;}}m.reminderHint=reminderHint([m.text,...m.media.filter(a=>a.kind==='audio').map(a=>a.transcript||'')].join('\n'),m.date,this.members(f.id));this.put('family',f.id,f);return json({moment:m});
  }
  if(path==='/api/moment-archive'){const m=f.moments.find(m=>m.id===body.id);if(!m)fail('找不到紙條。',404);if(m.authorId!==member.id&&member.role!=='owner')fail('只能處理自己留下的紙條。',403);if(body.restore)delete m.archivedAt;else m.archivedAt=now;m.revision=(m.revision||1)+1;this.put('family',f.id,f);return json({ok:true});}
  if(path==='/api/receipt'){
   const m=f.moments.find(m=>m.id===body.id);if(!m)fail('找不到這張紙條。',404);
   if(body.kind==='seen'){if(m.authorId===member.id)return json({ok:true});m.seenBy||=[];if(!m.seenBy.some(r=>r.memberId===member.id&&r.revision===(m.revision||1)))m.seenBy.push({memberId:member.id,revision:m.revision||1,at:now});}
   else if(body.kind==='played'&&m.media[body.mediaIndex]?.kind==='audio'&&Number(body.playedSeconds)>=1){m.playedBy||=[];if(!m.playedBy.some(r=>r.memberId===member.id&&r.mediaIndex===body.mediaIndex))m.playedBy.push({memberId:member.id,mediaIndex:body.mediaIndex,at:now});}
   else fail('播放或閱讀狀態無效。');this.put('family',f.id,f);return json({ok:true});
  }
  if(path==='/api/transcribe'){
   if(typeof body.audio!=='string'||body.audio.length>12*1024*1024||!body.audio.startsWith('data:audio/'))fail('請選 8MB 內的聲音檔。');
   const usageDay=dayAt(now,f.timezone);f.usage||={};f.usage[usageDay]||={stories:0,transcriptions:0};if(f.usage[usageDay].transcriptions>=20)fail('今日已達測試版20次轉寫上限，仍可手動輸入。',429);f.usage[usageDay].transcriptions++;this.put('family',f.id,f);return json(await transcribe(this.env.AI,body.audio,'zh'));
  }
  if(path==='/api/generate'){if(!/^\d{4}-\d{2}-\d{2}$/.test(body.date||''))fail('請選日期。');const diary=await this.generate(f.id,body.date);return json({diary});}
  if(path==='/api/edit'){if(Array.isArray(body.selectedMedia)){const d=f.diaries.find(d=>d.id===body.id);const allowed=new Set(versionMedia(f,{sourceIds:d?.current.sourceIds||[]}).map(m=>m.key));if(body.selectedMedia.some(key=>!allowed.has(key)))fail('選取的照片或原聲不屬於這篇日記。');}const diary=edit(f,body,now);this.put('family',f.id,f);return json({diary});}
  if(path==='/api/adopt'){
   const d=f.diaries.find(d=>d.id===body.id);if(!d?.pending)fail('目前沒有更新草稿。');if(d.current.number!==body.baseRevision)fail('家人已更新，請重新載入。',409);
   d.current={...d.pending,number:d.versions.length+1,kind:'manual'};d.versions.push(d.current);d.sourceKey=d.current.sourceKey;d.pending=null;d.confirmedAt=now;this.put('family',f.id,f);return json({ok:true});
  }
  if(path==='/api/settings'){if(account.role!=='owner')fail('請由管理者調整。',403);if(!/^([01]\d|2[0-3]):(00|15|30|45)$/.test(body.evening||''))fail('請選每15分鐘的時刻。');f.evening=body.evening;}
  else if(path==='/api/comment'){
   if(!String(body.text||'').trim())fail('請輸入留言。');const prior=f.comments.find(c=>c.requestId===body.requestId&&c.authorId===member.id);if(prior){if(prior.text!==String(body.text).slice(0,1000)||String(prior.recipientId||'')!==String(body.recipientId||''))fail('先前留言已保存，這份修改仍保留。請讀取家人最新消息後再送出。',409);return json({ok:true});}
   if(body.recipientId&&!this.members(f.id).some(m=>m.id===body.recipientId))fail('請選擇這個家庭的收件人。');f.comments.push({...(body.recipientId?{recipientId:body.recipientId}:{}),id:id(),requestId:body.requestId,authorId:member.id,author:member.name,text:String(body.text).slice(0,1000),...(body.momentId&&f.moments.some(m=>m.id===body.momentId)?{momentId:body.momentId}:{}),createdAt:now,readBy:[]});
  }else if(path==='/api/read'){const ids=new Set(Array.isArray(body.ids)?body.ids.slice(0,100):[]);f.comments.filter(c=>ids.has(c.id)&&c.authorId!==member.id&&this.visibleComment(c,member)).forEach(c=>{c.readBy||=[];if(!c.readBy.includes(member.id))c.readBy.push(member.id);});}
  else if(path==='/api/task'){
   if(!String(body.text||'').trim()||!this.all('account').some(a=>a.familyId===f.id&&a.id===body.assigneeId))fail('請填內容及選擇家人。');
   const prior=f.tasks.find(t=>(body.requestId&&t.requestId===body.requestId&&t.authorId===member.id)||(body.sourceMomentId&&t.sourceMomentId===body.sourceMomentId));if(prior)return json({ok:true,task:prior});
   if(!body.dueAt||Number.isNaN(Date.parse(body.dueAt)))fail('請選提醒時間。');if(Date.parse(body.dueAt)<=Date.now())fail('這個時間已過，請選下一次要提醒的日期與時間。');
   const moment=body.sourceMomentId?f.moments.find(m=>m.id===body.sourceMomentId):null;if(body.sourceMomentId&&!moment)fail('找不到提醒來源。');
   const task={id:id(),requestId:body.requestId,authorId:member.id,text:String(body.text).slice(0,500),assigneeId:body.assigneeId,dueAt:body.dueAt,status:'unread',createdAt:now,...(moment?{sourceMomentId:moment.id}:{})};f.tasks.push(task);if(moment)moment.reminderTaskId=task.id;this.put('family',f.id,f);return json({ok:true,task});
  }else if(path==='/api/task-status'){
   const task=f.tasks.find(t=>t.id===body.id);if(!task||![task.assigneeId].includes(member.id))fail('只有被指派的家人能更新此提醒。',403);if(!['read','accepted','done'].includes(body.status))fail('狀態無效。');task.status=body.status;
  }else if(path==='/api/book-share'){
   const collection=f.collections.find(c=>c.id===body.id);if(!collection)fail('找不到這本故事集。',404);
   const secret=token(),shareId=await hash(secret),media={},snapshot=JSON.parse(JSON.stringify(collection));
   snapshot.chapters=snapshot.chapters.map(ch=>{const selected=versionMedia(f,ch);for(const m of selected)media[m.key]={kind:m.kind,data:m.data};return {...ch,mediaKeys:selected.map(m=>m.key)};});
   delete snapshot.authorId;delete snapshot.requestId;
   const share={familyId:f.id,authorId:member.id,bookId:collection.id,expiresAt:new Date(Date.now()+7*86400000).toISOString(),child:f.child,collection:snapshot,media};
   this.put('book-share',shareId,share);return json({id:shareId,token:secret,expiresAt:share.expiresAt});
  }else if(path==='/api/book-share-revoke'){
   const share=this.get('book-share',body.id);if(!share||share.familyId!==f.id)fail('找不到這份分享。',404);if(share.authorId!==member.id&&member.role!=='owner')fail('請由分享者或家庭管理者收回。',403);share.revoked=true;this.put('book-share',body.id,share);return json({ok:true});
  }else if(path==='/api/collection'){
   const prior=body.requestId&&f.collections.find(c=>c.requestId===body.requestId&&c.authorId===member.id);if(prior)return json({ok:true,collection:prior});
   for(const [diaryId,revision] of Object.entries(body.expectedRevisions||{}))if(f.diaries.find(d=>d.id===diaryId)?.current.number!==revision)fail('家人更新了日記，你的編排仍保留。請重新預覽最新版本後保存。',409);
   const book=bookSnapshot(f,body),collection={id:id(),requestId:body.requestId,authorId:member.id,createdAt:now,...book};f.collections.push(collection);this.put('family',f.id,f);return json({ok:true,collection});
  }else fail('找不到操作。',404);
  this.put('family',f.id,f);return json({ok:true});
 }
}
export default {
 async fetch(request,env){const u=new URL(request.url);if(u.pathname.startsWith('/api/')){
  if(!['GET','POST'].includes(request.method))return json({error:'不支援的操作'},405);
  if(request.method==='POST'&&request.headers.get('origin')!==u.origin)return json({error:'請從本站操作。'},403);
  if(Number(request.headers.get('content-length')||0)>12*1024*1024)return json({error:'一次傳送上限12MB，請分次留下片刻。'},413);
  const response=await env.DAILY_WAREHOUSE.get(env.DAILY_WAREHOUSE.idFromName('daily-mobile-v1')).fetch(request);return response;
 }const r=await env.ASSETS.fetch(request);const h=new Headers(r.headers);h.set('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data: blob:; media-src 'self' data: blob:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'");h.set('X-Content-Type-Options','nosniff');h.set('Referrer-Policy','same-origin');return new Response(r.body,{status:r.status,headers:h});},
 async scheduled(event,env,ctx){ctx.waitUntil(env.DAILY_WAREHOUSE.get(env.DAILY_WAREHOUSE.idFromName('daily-mobile-v1')).fetch('https://internal/internal/tick'));}
};
