// Local server only. Never imported by production worker or browser assets.
export async function memberFixture(request,env,worker,store){
 let fixture=store.get('local-qc','member-access-v1');
 if(!fixture){
  const origin=new URL(request.url).origin,tag=crypto.randomUUID().slice(0,8),password=crypto.randomUUID();
  const call=async(path,body,cookie)=>{const response=await worker.fetch(new Request(origin+'/api/'+path,{method:'POST',headers:{origin,'content-type':'application/json',...(cookie?{cookie}:{})},body:JSON.stringify(body)}),env);if(!response.ok)throw Error('Local member fixture failed: '+path);return {data:await response.json(),cookie:response.headers.get('set-cookie')?.split(';')[0]};};
  const owner=await call('register',{handle:'member-qc-owner-'+tag,password,name:'合成媽媽',child:'合成小禾',family:'成員存取合成驗收家庭',timezone:'Asia/Taipei'});
  const invite=await call('invite',{},owner.cookie),relative=await call('join',{handle:'member-qc-relative-'+tag,password,name:'合成爸爸',invite:invite.data.code});
  const thirdInvite=await call('invite',{},owner.cookie),observer=await call('join',{handle:'member-qc-observer-'+tag,password,name:'合成家人',invite:thirdInvite.data.code});
  fixture={owner:owner.cookie,relative:relative.cookie,observer:observer.cookie};store.put('local-qc','member-access-v1',fixture);
 }
 const role=new URL(request.url).searchParams.get('member')||'owner';
 if(!['owner','relative','observer'].includes(role))return new Response('Unknown local synthetic role',{status:400});
 return new Response(null,{status:302,headers:{location:'/','set-cookie':fixture[role]+'; HttpOnly; SameSite=Strict; Path=/','cache-control':'no-store'}});
}
