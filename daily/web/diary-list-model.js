export function diaryRows(family,pending=[]){
 const moments=[...family.moments.filter(m=>!m.archivedAt),...pending];
 const dates=[...new Set([...family.diaries.map(d=>d.date),...moments.map(m=>m.date)])].sort().reverse();
 return dates.map(date=>{const diary=family.diaries.find(d=>d.date===date),sources=moments.filter(m=>m.date===date),saved=family.moments.filter(m=>m.date===date&&!m.archivedAt),photo=sources.flatMap(m=>m.media||[]).find(m=>m.kind==='image');return {date,diary,eligible:!!diary,count:saved.length,photo,summary:diary?.current.body||sources.map(m=>m.text||m.media?.find(a=>a.kind==='audio')?.transcript||'').filter(Boolean).join(' · ')};});
}
