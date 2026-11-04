export const VERSION = 'daily-mobile-0.1.2';
export const dayAt = (now, zone) => new Intl.DateTimeFormat('en-CA', {timeZone:zone, year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(now));
export function newFamily({id, name, child, now, timezone='Asia/Taipei'}) {
  return {id,name,child,timezone,evening:'20:00',createdAt:now,trialEndsAt:new Date(Date.parse(now)+30*86400000).toISOString(),moments:[],diaries:[],comments:[],tasks:[],collections:[],jobs:{}};
}
export function active(f, now) { return Date.parse(now)<Date.parse(f.trialEndsAt); }
export function sourcesFor(f, date) { return f.moments.filter(m=>m.date===date); }
export function sourceKey(sources) { return sources.map(m=>m.id).sort().join('|'); }
export function receive(f, input, member, now, id) {
  const prior=f.moments.find(m=>m.requestId===input.requestId&&m.authorId===member.id);
  if(prior)return prior;
  if(!active(f,now))throw Object.assign(new Error('試用已結束，目前可閱讀與下載既有內容。'),{status:403});
  const text=String(input.text||'').trim().slice(0,8000), media=input.media||[];
  if(!text&&!media.length)throw new Error('請留一句話或選一個檔案。');
  const date=input.date||dayAt(now,f.timezone);
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||Number.isNaN(Date.parse(date)))throw new Error('日期無效。');
  const moment={id,requestId:input.requestId,authorId:member.id,author:member.name,date,createdAt:now,text,media};
  f.moments.push(moment); return moment;
}
export function integrate(f,date,body,now) {
  const sources=sourcesFor(f,date); if(!sources.length)return null;
  const key=sourceKey(sources); let d=f.diaries.find(d=>d.date===date);
  if(d?.sourceKey===key||d?.pending?.sourceKey===key)return d;
  const version={number:(d?.versions.length||0)+1,title:`${f.child}的${date.slice(5).replace('-','月')}日`,body,sourceIds:sources.map(m=>m.id),sourceKey:key,createdAt:now,kind:'generated'};
  if(!d){d={id:`diary-${date}`,date,versions:[],current:version,sourceKey:key,pending:null};f.diaries.push(d);}
  else if(d.current.kind==='manual'||d.confirmedAt){d.pending=version;}
  else {d.current=version;d.sourceKey=key;}
  d.versions.push(version);return d;
}
export function edit(f,{id,baseRevision,title,body},now) {
  const d=f.diaries.find(d=>d.id===id); if(!d)throw new Error('找不到日記。');
  if(d.current.number!==baseRevision)throw Object.assign(new Error('家人已更新這篇日記。你的文字仍在畫面上；請另存草稿或重新載入後合併。'),{status:409});
  const v={...d.current,number:d.versions.length+1,title:String(title).slice(0,150),body:String(body).slice(0,16000),kind:'manual',createdAt:now};
  d.versions.push(v);d.current=v;d.confirmedAt=now;return d;
}
export function plainStory(f,sources) {
  return sources.map(m=>{const words=[...new Set([m.text,...m.media.filter(x=>x.kind==='audio').map(x=>x.transcript||'')].filter(Boolean))].join('\n');return words?`${m.author}說：「${words}」`:`${m.author}留下了${m.media.map(x=>({image:'照片',audio:'聲音',video:'短片'})[x.kind]).join('、')}。`;}).join('\n\n');
}
export function due(f,now) { const p=new Intl.DateTimeFormat('en-GB',{timeZone:f.timezone,hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(new Date(now));return p>=f.evening; }
