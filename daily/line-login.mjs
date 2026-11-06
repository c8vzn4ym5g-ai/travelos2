const fail=message=>Object.assign(Error(message),{status:502});
const random=()=>Array.from(crypto.getRandomValues(new Uint8Array(32)),v=>v.toString(16).padStart(2,'0')).join('');
export function lineConfig(env,origin){
 if(!/^\d{5,20}$/.test(String(env.LINE_CHANNEL_ID||''))||!env.LINE_CHANNEL_SECRET||!env.LINE_REDIRECT_URI)return null;
 try{const uri=new URL(env.LINE_REDIRECT_URI);if(uri.protocol!=='https:'||uri.origin!==origin||uri.pathname!=='/api/line/callback'||uri.search||uri.hash)return null;return {channelId:String(env.LINE_CHANNEL_ID),secret:String(env.LINE_CHANNEL_SECRET),redirectUri:uri.href};}catch{return null;}
}
export async function prepareLineLogin(config){
 const state=random(),nonce=random(),verifier=random(),proof=random(),digest=new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(verifier))),challenge=btoa(String.fromCharCode(...digest)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
 const url=new URL('https://access.line.me/oauth2/v2.1/authorize');url.search=new URLSearchParams({response_type:'code',client_id:config.channelId,redirect_uri:config.redirectUri,state,scope:'openid profile',nonce,code_challenge:challenge,code_challenge_method:'S256'}).toString();return {state,nonce,verifier,proof,url:url.href};
}
export async function verifyLineLogin(config,attempt,fetcher=fetch){
 const deadline=AbortSignal.timeout(15000);
 async function post(endpoint,body){let response;try{response=await fetcher('https://api.line.me/oauth2/v2.1/'+endpoint,{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams(body).toString(),signal:deadline});}catch{throw fail('LINE 連線未完成，請重新開始登入。');}if(!response.ok)throw fail('LINE 未完成登入驗證，請重新開始。');try{return await response.json();}catch{throw fail('LINE 回應未完成，請重新開始登入。');}}
 const token=await post('token',{grant_type:'authorization_code',code:attempt.code,redirect_uri:config.redirectUri,client_id:config.channelId,client_secret:config.secret,code_verifier:attempt.verifier});if(typeof token.id_token!=='string'||!token.id_token)throw fail('LINE 未提供可驗證的登入資料。');
 const person=await post('verify',{id_token:token.id_token,client_id:config.channelId,nonce:attempt.nonce});if(person.iss!=='https://access.line.me'||person.aud!==config.channelId||person.nonce!==attempt.nonce||typeof person.sub!=='string'||!person.sub||person.sub.length>200||!Number.isFinite(person.exp)||person.exp*1000<=Date.now())throw fail('LINE 登入資料不符，請重新開始。');
 return {sub:person.sub,name:typeof person.name==='string'?person.name.slice(0,40):'家人'};
}
