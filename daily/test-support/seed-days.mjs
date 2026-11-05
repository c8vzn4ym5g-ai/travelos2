// Local-only, user-triggered synthetic fixture completion. Never imported by Worker/web.
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export async function seedDays(request,env,worker){
 const origin=new URL(request.url).origin,cookie=request.headers.get('cookie')||'';
 const call=async(path,body)=>{const response=await worker.fetch(new Request(origin+'/api/'+path,{method:body?'POST':'GET',headers:{cookie,...(body?{origin,'content-type':'application/json'}:{})},body:body?JSON.stringify(body):undefined}),env);const data=await response.json();if(!response.ok)throw Error(data.error||'本機樣例未完成');return data;};
 const page=(text,status=200)=>new Response('<!doctype html><html lang="zh-Hant"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>本機合成日記樣例</title><body style="font:18px/1.7 system-ui;max-width:560px;margin:32px auto;padding:16px">'+text+'</body></html>',{status,headers:{'content-type':'text/html; charset=utf-8','cache-control':'no-store'}});
 try{
  const state=await call('state');if(!/^(虛構|合成|隔離|獨立|驗收)/.test(state.family.name))return page('<h1>沒有新增資料</h1><p>這個入口只接受名稱明確標示為合成／驗收的家庭。</p><a href="/">回原家庭</a>',403);
  const previous=new Date(state.today+'T12:00:00Z');previous.setUTCDate(previous.getUTCDate()-1);const dates=[previous.toISOString().slice(0,10),state.today];
  if(request.method==='GET')return page('<h1>本機兩日日記樣例</h1><p>'+esc(state.family.name)+'</p><p>'+dates.join('、')+'</p><p>僅補沒有日記的日期；已有日記、原素材與登入都保留。本機AI使用合成替身。</p><form method="post"><button style="font:inherit;padding:14px 22px" type="submit">補齊兩天合成日記</button></form><a href="/">不新增，返回</a>');
  if(request.method!=='POST'||request.headers.get('origin')!==origin)return page('<p>請由本機樣例頁操作。</p>',403);
  for(const date of dates){if(state.family.diaries.some(d=>d.date===date))continue;await call('capture',{requestId:'interaction-fixture-'+state.family.id+'-'+date,date,text:date===state.today?'合成樣例：今天家人一起在窗邊讀繪本。':'合成樣例：昨天一起把橘子放在藍色杯子旁邊。'});await call('generate',{date});}
  return new Response(null,{status:303,headers:{location:'/'}});
 }catch(error){return page('<h1>沒有完成樣例</h1><p>'+esc(error.message)+'</p><a href="/">回原頁</a>',400);}
}
