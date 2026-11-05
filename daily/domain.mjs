export const VERSION = 'daily-mobile-0.3.0-rc1';
export const dayAt = (now, zone) => new Intl.DateTimeFormat('en-CA', {timeZone:zone, year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(now));
export function newFamily({id, name, child, now, timezone='Asia/Taipei'}) {
  return {id,name,child,timezone,evening:'20:00',createdAt:now,trialEndsAt:new Date(Date.parse(now)+30*86400000).toISOString(),moments:[],diaries:[],comments:[],tasks:[],collections:[],jobs:{}};
}
export function active(f, now) { return Date.parse(now)<Date.parse(f.trialEndsAt); }
export function sourcesFor(f, date) { return f.moments.filter(m=>m.date===date&&!m.archivedAt); }
export function sourceKey(sources) { return sources.map(m=>(m.revision||1)>1?`${m.id}:v${m.revision}`:m.id).sort().join('|'); }
export function receive(f, input, member, now, id) {
  const prior=f.moments.find(m=>m.requestId===input.requestId&&m.authorId===member.id);
  if(prior)return prior;
  if(!active(f,now))throw Object.assign(new Error('試用已結束，目前可閱讀與下載既有內容。'),{status:403});
  const text=String(input.text||'').trim().slice(0,8000), media=input.media||[];
  if(!text&&!media.length)throw new Error('請留一句話或選一個檔案。');
  const date=input.date||dayAt(now,f.timezone);
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||Number.isNaN(Date.parse(date)))throw new Error('日期無效。');
  const moment={id,requestId:input.requestId,authorId:member.id,author:member.name,date,createdAt:now,text,title:String(input.title||'').slice(0,100),media,revision:1,seenBy:[],playedBy:[]};
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
export function edit(f,{id,baseRevision,title,body,selectedMedia},now) {
  const d=f.diaries.find(d=>d.id===id); if(!d)throw new Error('找不到日記。');
  if(d.current.number!==baseRevision)throw Object.assign(new Error('家人已更新這篇日記。你的文字仍在畫面上；請另存草稿或重新載入後合併。'),{status:409});
  const v={...d.current,number:d.versions.length+1,title:String(title).slice(0,150),body:String(body).slice(0,16000),kind:'manual',createdAt:now,...(Array.isArray(selectedMedia)?{selectedMedia:[...new Set(selectedMedia)]}:{})};
  d.versions.push(v);d.current=v;d.confirmedAt=now;return d;
}
export function plainStory(f,sources) {
  return sources.map(m=>{const words=[...new Set([m.text,...m.media.filter(x=>x.kind==='audio').map(x=>x.transcript||'')].filter(Boolean))].join('\n');return words?`${m.author}說：「${words}」`:`${m.author}留下了${m.media.map(x=>({image:'照片',audio:'聲音',video:'短片'})[x.kind]).join('、')}。`;}).join('\n\n');
}
export function editMoment(f,input,member,now) {
 const m=f.moments.find(m=>m.id===input.id);if(!m)throw new Error('找不到這張紙條。');
 if(m.authorId!==member.id&&member.role!=='owner')throw Object.assign(new Error('只能修改自己留下的紙條。'),{status:403});
 if((m.revision||1)!==input.baseRevision)throw Object.assign(new Error('這張紙條已有新修改，你的文字仍保留在畫面上。'),{status:409});
 m.history||=[];m.history.push({revision:m.revision||1,text:m.text,title:m.title||'',transcripts:m.media.map(a=>a.transcript||''),at:now});
 m.text=String(input.text||'').slice(0,8000);m.title=String(input.title||'').slice(0,100);m.revision=(m.revision||1)+1;m.updatedAt=now;return m;
}
function numberWord(s){if(/^\d+$/.test(s))return Number(s);const n={'零':0,'〇':0,'一':1,'二':2,'兩':2,'三':3,'四':4,'五':5,'六':6,'七':7,'八':8,'九':9};if(s==='十')return 10;if(s.includes('十')){const [a,b]=s.split('十');return (a?n[a]:1)*10+(b?n[b]:0);}return n[s];}
export function reminderHint(text, date, members) {
 if(!/提醒|叫一聲|叫我|記得|別忘|不要忘/.test(text)||/昨天|已經|提醒過/.test(text))return null;
 if(/明天|後天/.test(text))date=new Date(Date.parse(date+'T12:00:00Z')+(/後天/.test(text)?2:1)*86400000).toISOString().slice(0,10);
 const match=text.match(/(上午|早上|中午|下午|晚上)?\s*([零〇一二兩三四五六七八九十\d]{1,3})\s*[點时時:：]\s*([零〇一二兩三四五六七八九十\d]{1,3})?\s*(半)?/);
 let localTime='';if(match){let h=numberWord(match[2]),min=match[4]?30:(match[3]?numberWord(match[3]):0);if(['下午','晚上'].includes(match[1])&&h<12)h+=12;if(match[1]==='早上'&&h===12)h=0;if(h>=0&&h<24&&min>=0&&min<60)localTime=`${date}T${String(h).padStart(2,'0')}:${String(min).padStart(2,'0')}`;}
 const people=members.filter(m=>text.includes(m.name));
 return {text:text.slice(0,500),localTime,assigneeId:people.length===1?people[0].id:'',status:'needs-confirmation'};
}
export function due(f,now) { const p=new Intl.DateTimeFormat('en-GB',{timeZone:f.timezone,hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(new Date(now));return p>=f.evening; }
