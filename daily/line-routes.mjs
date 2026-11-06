import {currentInvitation} from './invitations.mjs';
import {lineConfig,prepareLineLogin,verifyLineLogin} from './line-login.mjs';
import {newFamily} from './domain.mjs';
import {initialFamilyZone} from './web/family-zone.js';

const random=()=>Array.from(crypto.getRandomValues(new Uint8Array(32)),v=>v.toString(16).padStart(2,'0')).join('');
const hash=async value=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value))),v=>v.toString(16).padStart(2,'0')).join('');
const fail=(message,status=400)=>{throw Object.assign(Error(message),{status});};
const json=(value,status=200,headers={})=>Response.json(value,{status,headers:{'cache-control':'no-store',...headers}});
const clear='daily_line=; HttpOnly; Secure; SameSite=Lax; Path=/api/line; Max-Age=0';

export async function handleLineLogin(store,request,body){
 const url=new URL(request.url),path=url.pathname,config=lineConfig(store.env,url.origin);
 if(path==='/api/line/config')return json({enabled:!!config});
 if(!config)fail('LINE 登入尚未設定，請先使用原本的家庭登入方式。',503);
 if(path==='/api/line/start'){
  if(request.method!=='POST')fail('請從登入按鈕開始。',405);
  const intent=body.intent;
  if(!['login','register','join','link'].includes(intent))fail('請選擇登入、建立家庭或加入家人。');
  if(intent==='register'&&!String(body.child||'').trim())fail('請先填孩子的小名。');
  if(intent==='join'&&!String(body.invite||'').trim())fail('請先填家人給你的邀請碼。');
  let linked;
  if(intent==='link'){
   const secret=(request.headers.get('cookie')||'').match(/(?:^|; )daily_session=([^;]+)/)?.[1],session=secret?store.get('session',await hash(secret)):null;
   linked=session?store.get('account',session.accountHandle):null;
   if(!session||session.expiresAt<Date.now()||!linked||linked.revokedAt||(session.accessVersion||0)!==(linked.accessVersion||0))fail('請先登入家庭，再連結 LINE。',401);
  }
  const pending=store.all('line-auth');for(const item of pending)if(item.expiresAt<=Date.now())store.sql.exec('DELETE FROM records WHERE kind=? AND id=?','line-auth',item.id);
  if(pending.filter(a=>a.expiresAt>Date.now()).length>=100)fail('登入請求較多，請稍後再試。',429);
  const auth=await prepareLineLogin(config),key=await hash(auth.state);
  store.put('line-auth',key,{id:key,nonce:auth.nonce,verifier:auth.verifier,proofHash:await hash(auth.proof),expiresAt:Date.now()+600000,intent,name:String(body.name||'').slice(0,40),child:String(body.child||'').slice(0,40),family:String(body.family||'').slice(0,60),timezone:initialFamilyZone(body.timezone),invite:String(body.invite||'').slice(0,100),...(linked?{accountHandle:linked.handle,accessVersion:linked.accessVersion||0}:{})});
  return json({url:auth.url},200,{'set-cookie':`daily_line=${auth.state}.${auth.proof}; HttpOnly; Secure; SameSite=Lax; Path=/api/line; Max-Age=600`});
 }
 if(path!=='/api/line/callback')fail('找不到操作。',404);
 let attempt;
 try{
  const state=url.searchParams.get('state')||'',proof=(request.headers.get('cookie')||'').match(/(?:^|; )daily_line=([a-f0-9]{64})\.([a-f0-9]{64})(?:;|$)/);
  if(!/^[a-f0-9]{64}$/.test(state)||!proof||proof[1]!==state)fail('LINE 登入頁已變更，請從原瀏覽器重新開始。');
  const key=await hash(state),proofHash=await hash(proof[2]);attempt=store.get('line-auth',key);
  if(!attempt||attempt.expiresAt<=Date.now()||proofHash!==attempt.proofHash)fail('LINE 登入已過期或已使用，請重新開始。');
  store.sql.exec('DELETE FROM records WHERE kind=? AND id=?','line-auth',key);
  if(url.searchParams.has('error'))fail('LINE 登入已取消，原家庭登入仍可使用。');
  const code=url.searchParams.get('code');if(!code||code.length>2000)fail('LINE 登入回應未完成，請重新開始。');
  const person=await verifyLineLogin(config,{...attempt,code},store.env.LINE_HTTP?store.env.LINE_HTTP.fetch.bind(store.env.LINE_HTTP):fetch);
  const identityKey=await hash(config.channelId+':'+person.sub),identity=store.get('line-identity',identityKey),recoverable=store.get('account','line_'+identityKey.slice(0,32));let account=identity?store.get('account',identity.accountHandle):recoverable?.lineIdentityKey===identityKey?recoverable:null;
  if(attempt.intent==='link'){
   const target=store.get('account',attempt.accountHandle);
   if(!target||target.revokedAt||(target.accessVersion||0)!==attempt.accessVersion)fail('家庭存取已更新，請重新登入。',401);
   if(account&&account.id!==target.id)fail('這個 LINE 已連結另一個帳號，未更動原家庭。',409);
   account=target;
  }else if(!account){
   if(attempt.intent==='login')fail('這個 LINE 尚未加入家庭，請用邀請連結加入或建立家庭。',403);
   let family,invite,inviteKey;
   if(attempt.intent==='join'){
    inviteKey=await hash(attempt.invite);invite=store.get('invite',inviteKey);
    family=invite?store.get('family',invite.familyId):null;
    if(!currentInvitation(invite,family))fail('邀請連結已失效，請家人重新建立。',403);
   }else family=newFamily({id:crypto.randomUUID(),name:attempt.family||attempt.child+'的家',child:attempt.child,timezone:attempt.timezone,now:new Date().toISOString()});
   const handle='line_'+identityKey.slice(0,32);if(store.get('account',handle))fail('LINE 帳號尚未完成，請重新開始登入。',409);
   account={id:crypto.randomUUID(),handle,name:attempt.name||person.name,familyId:family.id,role:attempt.intent==='join'?'member':'owner',authProvider:'line',lineIdentityKey:identityKey,accessVersion:0};
   if(invite){invite.used=true;store.put('invite',inviteKey,invite);}else store.put('family',family.id,family);
   store.put('account',handle,account);
  }else if(account.revokedAt||attempt.intent==='join'){
   if(attempt.intent!=='join')fail('你已不在這個家庭，請取得新的邀請連結後重新加入。',403);
   const inviteKey=await hash(attempt.invite),invite=store.get('invite',inviteKey);account=store.get('account',account.handle);
   if(!account||!currentInvitation(invite,store.get('family',account.familyId))||invite.familyId!==account.familyId)fail('請使用原家庭的新邀請連結。',403);
   invite.used=true;store.put('invite',inviteKey,invite);delete account.revokedAt;store.put('account',account.handle,account);
  }
  const secret=random(),sessionKey=await hash(secret),latest=store.get('account',account.handle);
  if(!latest||latest.revokedAt||(latest.accessVersion||0)!==(account.accessVersion||0))fail('家庭存取已更新，請重新登入。',401);
  store.put('line-identity',identityKey,{accountHandle:account.handle});store.put('session',sessionKey,{accountHandle:account.handle,accessVersion:account.accessVersion||0,expiresAt:Date.now()+30*86400000});
  const headers=new Headers({location:'/','cache-control':'no-store'});headers.append('set-cookie',`daily_session=${secret}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=2592000`);headers.append('set-cookie',clear);return new Response(null,{status:303,headers});
 }catch(error){return new Response(null,{status:303,headers:{location:'/#auth='+(attempt?.intent==='join'?'join':attempt?.intent==='register'?'register':'login')+'&line-error='+encodeURIComponent(error.status?error.message:'LINE 登入未完成，請重新開始。'),'set-cookie':clear,'cache-control':'no-store'}});}
}
