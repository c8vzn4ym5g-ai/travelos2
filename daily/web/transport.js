// One owned request, with a bounded lifetime. Retrying uses the existing capture ID.
export function sendJSON(url,body,{signal,onProgress,timeout=90000}={}){
 return new Promise((resolve,reject)=>{
  const xhr=new XMLHttpRequest();let settled=false;
  const finish=(error,value)=>{if(settled)return;settled=true;signal?.removeEventListener('abort',abort);xhr.onload=xhr.onerror=xhr.onabort=xhr.ontimeout=null;xhr.upload.onprogress=null;error?reject(error):resolve(value);};
  const abort=()=>xhr.abort();
  xhr.open('POST',url);xhr.setRequestHeader('content-type','application/json');xhr.timeout=timeout;
  xhr.upload.onprogress=e=>{if(e.lengthComputable)onProgress?.(Math.round(e.loaded/e.total*100));};
  xhr.onload=()=>{let data;try{data=JSON.parse(xhr.responseText);}catch{return finish(Error('連線中斷，素材和文字已保留，請重試。'));}if(xhr.status>=200&&xhr.status<300)return finish(null,data);const error=Error(data.error||'保存未完成，請重試。');error.status=xhr.status;finish(error);};
  xhr.onerror=()=>finish(Error('目前無法連線。素材和文字已保留，恢復連線後可重試。'));
  xhr.ontimeout=()=>finish(Error('等待保存逾時。請重試確認結果，不會重複留下紙條。'));
  xhr.onabort=()=>finish(Error('已取消傳送，素材和文字仍在。若已送達，重試會確認同一張紙條。'));
  if(signal?.aborted)return finish(Error('已取消傳送，素材和文字仍在。'));
  signal?.addEventListener('abort',abort,{once:true});xhr.send(JSON.stringify(body));
 });
}
