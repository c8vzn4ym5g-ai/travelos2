// Completed captures are immutable and independent from the next editable draft.
export function createCaptureOutbox({store,send,onChange=()=>{},onSaved=()=>{},limit=2}){
 const entries=new Map(),active=new Map(),acknowledged=new WeakSet();let disposed=false;
 const notify=()=>onChange([...entries.values()]);
 const writes=new WeakMap();
 const persist=entry=>{const snapshot=structuredClone(entry),prior=writes.get(entry)||Promise.resolve();const next=prior.catch(()=>{}).then(()=>store.put(snapshot));writes.set(entry,next);return next;};
 const remove=async entry=>{await writes.get(entry)?.catch(()=>{});await store.remove(entry.id);};
 function pump(){if(disposed)return;for(const e of entries.values()){if(active.size>=limit)break;if(e.status==='queued'&&!e.cancelled&&!active.has(e.id))run(e);}}
 async function run(entry){
  const controller=new AbortController();active.set(entry.id,controller);entry.status='uploading';notify();
  try{await persist(entry);if(entry.cancelled||controller.signal.aborted)throw Error('已取消這次傳送，內容仍保留，可按重試。');const result=await send(structuredClone(entry.payload),{signal:controller.signal,onProgress:n=>{entry.progress=n;notify();}});if(disposed)return;acknowledged.add(entry);onSaved(result.moment,entry);await remove(entry);entries.delete(entry.id);}
  catch(error){entry.status='failed';entry.error=entry.cancelled?'已取消這次傳送，內容仍保留，可按重試。':error.message;entry.conflict=!!error.captureConflict;entry.blocked=!!error.captureTooLarge;try{await persist(entry);}catch{entry.localError=true;}}
  finally{acknowledged.delete(entry);active.delete(entry.id);notify();pump();}
 }
 return {
  get entries(){return [...entries.values()];},
  async restore(){for(const e of await store.list()){if(e.status==='uploading'||e.status==='local')e.status='queued';entries.set(e.id,e);}notify();pump();},
  async enqueue(payload){
   const prior=entries.get(payload.requestId);if(prior){if(JSON.stringify(prior.payload)!==JSON.stringify(payload))throw Error('先前的片刻仍在保存，修改已保留在草稿。');return prior;}
   const entry={id:payload.requestId,payload:structuredClone(payload),status:'local',at:payload.capturedAt||new Date().toISOString()};entries.set(entry.id,entry);notify();
   try{await persist(entry);if(!entry.cancelled){entry.status='queued';await persist(entry);}}catch(error){entry.status='failed';entry.localError=true;entry.error='裝置暫存未完成，內容仍在，請重試並先不要離開。';notify();return entry;}
   notify();pump();return entry;
  },
  async retry(id){const e=entries.get(id);if(!e||active.has(id)||acknowledged.has(e)||e.conflict)return;e.cancelled=false;e.status='queued';e.error='';e.localError=false;try{await persist(e);}catch(error){e.status='failed';e.localError=true;e.error='裝置暫存尚未完成，原內容已保留，請重試。';notify();throw Error(e.error);}notify();pump();},
  async saveCopy(id,newId){const e=entries.get(id);if(!e||!e.conflict)return;const copy=await this.enqueue({...e.payload,requestId:newId});if(copy.localError){entries.delete(newId);try{await store.remove(newId);}catch{}notify();throw Error('另存尚未完成，原內容已保留，請重試。');}await store.remove(id);entries.delete(id);notify();},
  async cancel(id){const e=entries.get(id);if(!e||acknowledged.has(e))return;e.cancelled=true;e.status='failed';e.error='已取消這次傳送，內容仍保留，可按重試。';active.get(id)?.abort();notify();try{await persist(e);}catch{e.localError=true;e.error='取消已保留在此頁，裝置暫存尚未完成，請先不要離開。';notify();}},
  dispose(){disposed=true;for(const controller of active.values())controller.abort();}
 };
}
