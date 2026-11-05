// A datetime-local field is a wall clock in the family's zone, never the device zone.
export function familyInstant(localTime, zone) {
  if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(localTime))throw Error('請填完整的家庭日期與時間。');
  const naive=Date.parse(localTime+'Z');
  if(!Number.isFinite(naive)||new Date(naive).toISOString().slice(0,16)!==localTime)throw Error('日期或時間無效。');
  const format=new Intl.DateTimeFormat('en-CA',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'});
  const parts=value=>Object.fromEntries(format.formatToParts(new Date(value)).map(p=>[p.type,p.value]));
  const local=value=>{const p=parts(value);return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;};
  const candidates=new Set();
  for(const hours of [-36,-12,0,12,36]){
    const sample=naive+hours*3600000,p=parts(sample);
    const offset=Date.UTC(+p.year,+p.month-1,+p.day,+p.hour,+p.minute,+p.second)-sample;
    const instant=naive-offset;if(local(instant)===localTime)candidates.add(instant);
  }
  if(candidates.size===0)throw Error('家庭時區沒有這個時間，請選擇其他時間。');
  if(candidates.size>1)throw Error('這個時間遇到夏令時間重複，請選擇其他明確時間。');
  return new Date([...candidates][0]).toISOString();
}
