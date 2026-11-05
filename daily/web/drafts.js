const DB = 'little-days-drafts';
function open() {
  return new Promise((resolve,reject) => {
    const request = indexedDB.open(DB,2);
    request.onupgradeneeded = () => {for(const name of ['drafts','recording-meta','recording-chunks'])if(!request.result.objectStoreNames.contains(name))request.result.createObjectStore(name);};
    request.onblocked = () => reject(Error('請先關閉另一個舊版小日子分頁，再試一次。'));
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
export async function readDraft(key) {
  const db = await open();
  try { return await new Promise((resolve,reject) => {const r=db.transaction('drafts').objectStore('drafts').get(key);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);}); }
  finally { db.close(); }
}
export async function writeDraft(key,value) {
  const db = await open();
  try { await new Promise((resolve,reject) => {const tx=db.transaction('drafts','readwrite');if(value===null)tx.objectStore('drafts').delete(key);else tx.objectStore('drafts').put(value,key);tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);}); }
  finally {db.close();}
}

function recordingRange(id){return IDBKeyRange.bound([id,0],[id,Number.MAX_SAFE_INTEGER]);}
export async function beginRecording(key,meta){
 const db=await open();try{await new Promise((resolve,reject)=>{const tx=db.transaction('recording-meta','readwrite');tx.objectStore('recording-meta').put(meta,key);tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);});}finally{db.close();}
}
export async function appendRecording(id,index,blob){
 const db=await open();try{await new Promise((resolve,reject)=>{const tx=db.transaction('recording-chunks','readwrite');tx.objectStore('recording-chunks').put(blob,[id,index]);tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);});}finally{db.close();}
}
export async function readRecording(key){
 const db=await open();try{return await new Promise((resolve,reject)=>{
  const tx=db.transaction(['recording-meta','recording-chunks']),request=tx.objectStore('recording-meta').get(key);let meta,chunks;
  request.onsuccess=()=>{meta=request.result;if(meta){const r=tx.objectStore('recording-chunks').getAll(recordingRange(meta.id));r.onsuccess=()=>chunks=r.result;}};
  tx.oncomplete=()=>resolve(meta&&chunks?.length?{...meta,blob:new Blob(chunks,{type:meta.mime||chunks[0]?.type||'audio/webm'})}:null);tx.onerror=()=>reject(tx.error);
 });}finally{db.close();}
}
export async function clearRecording(key,id){
 const db=await open();try{await new Promise((resolve,reject)=>{
  const tx=db.transaction(['recording-meta','recording-chunks'],'readwrite'),meta=tx.objectStore('recording-meta'),r=meta.get(key);
  r.onsuccess=()=>{if(r.result?.id===id)meta.delete(key);tx.objectStore('recording-chunks').delete(recordingRange(id));};tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);
 });}finally{db.close();}
}
