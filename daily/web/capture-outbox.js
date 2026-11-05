// Completed captures are immutable and independent from the next editable draft.
export function createCaptureOutbox({store,send,onChange=()=>{},onSaved=()=>{},limit=2}){
 const entries=new Map(),active=new Map();let disposed=false;
 const notify=()=>onChange([...entries.values()]);
 const persist=entry=>store.put(structuredClone(entry));
 function pump(){if(disposed)return;for(const e of entries.values()){if(active.size>=limit)break;if(e.status==='queued'&&!active.has(e.id))run(e);}}
 async function run(entry){
  const controller=new AbortController();active.set(entry.id,controller);entry.status='uploading';notify();
  try{await persist(entry);const result=await send(structuredClone(entry.payload),{signal:controller.signal,onProgress:n=>{entry.progress=n;notify();}});if(disposed)return;onSaved(result.moment,entry);await store.remove(entry.id);entries.delete(entry.id);}
  catch(error){entry.status='failed';entry.error=error.message;entry.conflict=!!error.captureConflict;entry.blocked=!!error.captureTooLarge;try{await persist(entry);}catch{entry.localError=true;}}
  finally{active.delete(entry.id);notify();pump();}
 }
 return {
  get entries(){return [...entries.values()];},
  async restore(){for(const e of await store.list()){if(e.status==='uploading'||e.status==='local')e.status='queued';entries.set(e.id,e);}notify();pump();},
  async enqueue(payload){
   const prior=entries.get(payload.requestId);if(prior){if(JSON.stringify(prior.payload)!==JSON.stringify(payload))throw Error('先前的片刻仍在保存，修改已保留在草稿。');return prior;}
   const entry={id:payload.requestId,payload:structuredClone(payload),status:'local',at:payload.capturedAt||new Date().toISOString()};entries.set(entry.id,entry);notify();
   try{await persist(entry);entry.status='queued';await persist(entry);}catch(error){entry.status='failed';entry.localError=true;entry.error='裝置暫存未完成，內容仍在，請重試並先不要離開。';notify();return entry;}
   notify();pump();return entry;
  },
  async retry(id){const e=entries.get(id);if(!e||active.has(id)||e.conflict)return;e.status='queued';e.error='';e.localError=false;try{await persist(e);}catch(error){e.status='failed';e.localError=true;e.error='裝置暫存尚未完成，原內容已保留，請重試。';notify();throw Error(e.error);}notify();pump();},
  async saveCopy(id,newId){const e=entries.get(id);if(!e||!e.conflict)return;const copy=await this.enqueue({...e.payload,requestId:newId});if(copy.localError){entries.delete(newId);try{await store.remove(newId);}catch{}notify();throw Error('另存尚未完成，原內容已保留，請重試。');}await store.remove(id);entries.delete(id);notify();},
  cancel(id){active.get(id)?.abort();},
  dispose(){disposed=true;for(const controller of active.values())controller.abort();}
 };
}
