import {DurableObject} from 'cloudflare:workers';
import {arrange,transcribe} from '../baby-poc/ai.mjs';
import {VERSION,newFamily,receive,sourcesFor,sourceKey,integrate,edit,plainStory,dayAt,due,active} from './domain.mjs';
const json=(v,status=200,headers={})=>Response.json(v,{status,headers:{'cache-control':'no-store',...headers}});
const fail=(message,status=400)=>{throw Object.assign(new Error(message),{status});};
const id=()=>crypto.randomUUID();
const token=()=>Array.from(crypto.getRandomValues(new Uint8Array(24)),b=>b.toString(16).padStart(2,'0')).join('');
const hash=async s=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s))),b=>b.toString(16).padStart(2,'0')).join('');
async function password(p,salt){const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(p),'PBKDF2',false,['deriveBits']);return Array.from(new Uint8Array(await crypto.subtle.deriveBits({name:'PBKDF2',salt:new TextEncoder().encode(salt),iterations:100000,hash:'SHA-256'},key,256)),b=>b.toString(16).padStart(2,'0')).join('');}
const cookie=s=>`daily_session=${s}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=2592000`;
function validateMedia(media){if(!Array.isArray(media)||media.length>4)fail('每次最多四個檔案，可分次補入。');for(const m of media){if(!['image','audio','video'].includes(m.kind)||!new RegExp(`^data:${m.kind}/(?:jpeg|png|webp|gif|mp4|webm|ogg|mpeg|wav|x-wav|mp3|aac|quicktime|x-m4a|3gpp|3gpp2)(?:;[^,]*)?;base64,`,'i').test(m.data||''))fail('請使用常見照片、聲音或影片格式。');if(m.data.length>8*1024*1024*1.38)fail('單一測試檔案限 8MB，請縮短影片或換較小檔案。');}}
export class DailyWarehouse extends DurableObject {
 constructor(ctx,env){super(ctx,env);this.env=env;this.sql=ctx.storage.sql;this.sql.exec('CREATE TABLE IF NOT EXISTS records (kind TEXT, id TEXT, payload TEXT, PRIMARY KEY(kind,id))');}
 get(k,i){const r=this.sql.exec('SELECT payload FROM records WHERE kind=? AND id=?',k,i).toArray()[0];if(!r)return null;const value=JSON.parse(r.payload);if(k==='family'&&value.chunks)return JSON.parse(Array.from({length:value.chunks},(_,n)=>JSON.parse(this.sql.exec('SELECT payload FROM records WHERE kind=? AND id=?','family-chunk',`${i}:${n}`).toArray()[0].payload)).join(''));return value;}
 put(k,i,v){const text=JSON.stringify(v);if(k!=='family')return this.sql.exec('INSERT OR REPLACE INTO records VALUES (?,?,?)',k,i,text);const chunks=Math.ceil(text.length/400000);this.ctx.storage.transactionSync(()=>{for(let n=0;n<chunks;n++)this.sql.exec('INSERT OR REPLACE INTO records VALUES (?,?,?)','family-chunk',`${i}:${n}`,JSON.stringify(text.slice(n*400000,(n+1)*400000)));this.sql.exec('INSERT OR REPLACE INTO records VALUES (?,?,?)',k,i,JSON.stringify({chunks}));});}
 all(k){return this.sql.exec('SELECT id,payload FROM records WHERE kind=?',k).toArray().map(r=>k==='family'?this.get(k,r.id):JSON.parse(r.payload));}
 async generate(fid,date){
  let f=this.get('family',fid),sources=sourcesFor(f,date),key=sourceKey(sources),d=f.diaries.find(d=>d.date===date);
  if(!sources.length||!active(f,new Date().toISOString())||d?.sourceKey===key||d?.pending?.sourceKey===key)return d||null;
  if(f.jobs[date]&&Date.now()-Date.parse(f.jobs[date].startedAt)<120000)return d||null;
  const usageDay=dayAt(new Date().toISOString(),f.timezone);f.usage||={};f.usage[usageDay]||={stories:0,transcriptions:0};if(f.usage[usageDay].stories>=30)fail('今日已達測試版30次整理上限，仍可手動編輯。',429);f.usage[usageDay].stories++;
  const job={id:id(),startedAt:new Date().toISOString(),key};f.jobs[date]=job;this.put('family',fid,f);
  try{
   for(const source of sources)for(const audio of source.media.filter(m=>m.kind==='audio'&&!m.transcript)){
    const fresh=this.get('family',fid);fresh.usage[usageDay]||={stories:0,transcriptions:0};if(fresh.usage[usageDay].transcriptions>=20)fail('今日已達測試版20次轉寫上限。原聲已保留，可手動補文字。',429);fresh.usage[usageDay].transcriptions++;this.put('family',fid,fresh);
    const result=await transcribe(this.env.AI,audio.data,'zh');audio.transcript=result.transcript;
    const latest=this.get('family',fid),stored=latest.moments.find(m=>m.id===source.id)?.media.find(m=>m.kind==='audio'&&m.data===audio.data);if(stored)stored.transcript=result.transcript;this.put('family',fid,latest);
   }
   const notes=plainStory(f,sources);let body=notes,mode='source-layout';
   if(notes.trim()&&sources.some(s=>s.text||s.media.some(m=>m.transcript))){
    if(notes.length>22000)fail('今日文字較多，請分成不同日期或先手動整理；原素材已保存。',413);
    const result=await arrange(this.env.AI,{title:`${f.child}的日記`,date,place:'',speaker:'家人',note:notes,transcript:''},'zh');body=result.draft;mode='ai-story';
   }
   f=this.get('family',fid);if(f.jobs[date]?.id!==job.id)return null;
   // Integrate exactly the source snapshot seen by the model. Late arrivals stay pending.
   const current=f.moments;f.moments=sources;d=integrate(f,date,body,new Date().toISOString());f.moments=current;
   if(d)d.generationMode=mode;delete f.jobs[date];delete f.lastError;this.put('family',fid,f);return d;
  }catch(e){f=this.get('family',fid);if(f.jobs[date]?.id===job.id){delete f.jobs[date];f.lastError='故事整理暫時失敗，原素材已保存，請稍後重試。';this.put('family',fid,f);}throw e;}
 }
 async fetch(request){try{return await this.handle(request);}catch(e){return json({error:e.status?e.message:'服務暫時無法完成，資料未送出時請保留輸入並重試。'},e.status||400);}}
 async handle(request){
  const path=new URL(request.url).pathname,now=new Date().toISOString();
  if(path==='/internal/tick'){
   let generated=0,failed=0;for(const f of this.all('family'))if(due(f,now)&&active(f,now)){
    const days=[...new Set(f.moments.map(m=>m.date))].filter(d=>d<=dayAt(now,f.timezone));
    for(const date of days)try{if(await this.generate(f.id,date))generated++;}catch{failed++;}
   }return json({generated,failed});
  }
  let body={};if(request.method==='POST'){const reader=request.body?.getReader();let size=0;const parts=[];if(reader){while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>12*1024*1024){await reader.cancel();fail('一次傳送上限12MB，請分次留下片刻。',413);}parts.push(value);}}const bytes=new Uint8Array(size);let offset=0;for(const p of parts){bytes.set(p,offset);offset+=p.length;}body=JSON.parse(new TextDecoder().decode(bytes)||'{}');}
  if(['/api/register','/api/login','/api/join'].includes(path)){
   const handle=String(body.handle||'').trim().toLowerCase(),p=String(body.password||'');
   if(!/^[a-z0-9_-]{3,40}$/.test(handle)||p.length<8||p.length>128)fail('登入名稱請用 3–40 個英數字；密碼至少 8 字。');
   let account=this.get('account',handle);
   if(path==='/api/login'){if(!account||await password(p,account.salt)!==account.password)fail('登入名稱或密碼不正確。',401);}
   else{
    if(account)fail('這個登入名稱已有人使用，請換一個。',409);
    const salt=token(),digest=await password(p,salt);let f,role;
    if(path==='/api/join'){
     const inviteHash=await hash(String(body.invite||'')),invite=this.get('invite',inviteHash);
     if(!invite||invite.used||Date.parse(invite.expiresAt)<Date.now())fail('邀請碼無效或已使用，請家人重新建立。',403);
     f=this.get('family',invite.familyId);role='member';invite.used=true;this.put('invite',inviteHash,invite);
    }else {f=newFamily({id:id(),name:String(body.family||`${String(body.child||'寶寶')}的家`).slice(0,60),child:String(body.child||'寶寶').slice(0,40),now});role='owner';this.put('family',f.id,f);}
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
  if(path==='/api/state')return json({version:VERSION,member,family:f,today:dayAt(now,f.timezone),members:this.all('account').filter(a=>a.familyId===f.id).map(a=>({id:a.id,name:a.name,role:a.role})),trialActive:active(f,now)});
  if(path==='/api/export')return json({version:VERSION,family:f});
  if(path==='/api/invite'){
   if(account.role!=='owner')fail('請由家庭管理者建立邀請。',403);
   const code=token();this.put('invite',await hash(code),{familyId:f.id,used:false,expiresAt:new Date(Date.now()+7*86400000).toISOString()});return json({code});
  }
  if(!active(f,now))fail('30天試用已結束；既有日記仍可閱讀與匯出。此測試版尚不收費。',403);
  if(path==='/api/capture'){
   validateMedia(body.media||[]);if(JSON.stringify(f).length+JSON.stringify(body).length>20*1024*1024)fail('測試家庭容量已達20MB。請匯出內容，暫停新增。',413);
   const m=receive(f,body,member,now,id());this.put('family',f.id,f);return json({moment:m});
  }
  if(path==='/api/transcribe'){
   if(typeof body.audio!=='string'||body.audio.length>12*1024*1024||!body.audio.startsWith('data:audio/'))fail('請選 8MB 內的聲音檔。');
   const usageDay=dayAt(now,f.timezone);f.usage||={};f.usage[usageDay]||={stories:0,transcriptions:0};if(f.usage[usageDay].transcriptions>=20)fail('今日已達測試版20次轉寫上限，仍可手動輸入。',429);f.usage[usageDay].transcriptions++;this.put('family',f.id,f);return json(await transcribe(this.env.AI,body.audio,'zh'));
  }
  if(path==='/api/generate'){if(!/^\d{4}-\d{2}-\d{2}$/.test(body.date||''))fail('請選日期。');const diary=await this.generate(f.id,body.date);return json({diary});}
  if(path==='/api/edit'){const diary=edit(f,body,now);this.put('family',f.id,f);return json({diary});}
  if(path==='/api/adopt'){
   const d=f.diaries.find(d=>d.id===body.id);if(!d?.pending)fail('目前沒有更新草稿。');if(d.current.number!==body.baseRevision)fail('家人已更新，請重新載入。',409);
   d.current={...d.pending,number:d.versions.length+1,kind:'manual'};d.versions.push(d.current);d.sourceKey=d.current.sourceKey;d.pending=null;d.confirmedAt=now;this.put('family',f.id,f);return json({ok:true});
  }
  if(path==='/api/settings'){if(account.role!=='owner')fail('請由管理者調整。',403);if(!/^([01]\d|2[0-3]):(00|15|30|45)$/.test(body.evening||''))fail('請選每15分鐘的時刻。');try{dayAt(now,body.timezone);}catch{fail('時區無效。');}f.evening=body.evening;f.timezone=body.timezone;}
  else if(path==='/api/comment'){
   if(!String(body.text||'').trim())fail('請輸入留言。');const prior=f.comments.find(c=>c.requestId===body.requestId&&c.authorId===member.id);if(prior)return json({ok:true});
   f.comments.push({id:id(),requestId:body.requestId,authorId:member.id,author:member.name,text:String(body.text).slice(0,1000),createdAt:now,readBy:[member.id]});
  }else if(path==='/api/read'){f.comments.forEach(c=>{if(!c.readBy.includes(member.id))c.readBy.push(member.id);});}
  else if(path==='/api/task'){
   if(!String(body.text||'').trim()||!this.all('account').some(a=>a.familyId===f.id&&a.id===body.assigneeId))fail('請填內容及選擇家人。');
   const prior=f.tasks.find(t=>t.requestId===body.requestId&&t.authorId===member.id);if(prior)return json({ok:true});
   if(!body.dueAt||Number.isNaN(Date.parse(body.dueAt)))fail('請選提醒時間。');f.tasks.push({id:id(),requestId:body.requestId,authorId:member.id,text:String(body.text).slice(0,500),assigneeId:body.assigneeId,dueAt:body.dueAt,status:'unread',createdAt:now});
  }else if(path==='/api/task-status'){
   const task=f.tasks.find(t=>t.id===body.id);if(!task||![task.assigneeId].includes(member.id))fail('只有被指派的家人能更新此提醒。',403);if(!['read','accepted','done'].includes(body.status))fail('狀態無效。');task.status=body.status;
  }else if(path==='/api/collection'){
   const ids=[...new Set(body.diaryIds||[])];if(!ids.length||ids.some(i=>!f.diaries.some(d=>d.id===i)))fail('請選至少一篇日記。');
   const c={id:id(),title:String(body.title||`${f.child}的小日子`).slice(0,100),createdAt:now,chapters:ids.map(i=>{const d=f.diaries.find(d=>d.id===i);return {date:d.date,...d.current};})};f.collections.push(c);
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
