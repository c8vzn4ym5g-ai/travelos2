const DB = 'little-days-drafts';
function open() {
  return new Promise((resolve,reject) => {
    const request = indexedDB.open(DB,1);
    request.onupgradeneeded = () => request.result.createObjectStore('drafts');
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
