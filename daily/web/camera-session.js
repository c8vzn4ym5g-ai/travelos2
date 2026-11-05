// One visible camera stream; each shutter owns a distinct immutable frame and save job.
export function captureVideoFrame(video,{createCanvas=()=>document.createElement('canvas')}={}){
 const width=video.videoWidth,height=video.videoHeight;if(!width||!height)throw Error('相機畫面還沒準備好，請稍等。');
 const canvas=createCanvas();canvas.width=width;canvas.height=height;canvas.getContext('2d').drawImage(video,0,0,width,height);
 return new Promise((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(Error('這張照片未完成，請再拍一次。')),'image/jpeg',.92));
}
export function createCameraSession({getStream,attach,snapshot,enqueue,uid,isActive=()=>true,onChange=()=>{},maxEncoding=2}){
 let token=0,pending=null,stream=null,phase='closed',sequence=0,latest=null,error='',saving=0,encoding=0;const jobs=new Set();
 const release=s=>{for(const track of s?.getTracks?.()||[])track.stop();};const notify=()=>onChange({phase,latest,error,saving,encoding,maxEncoding});
 async function open(){if(pending)return pending;if(stream&&phase==='live')return true;const own=++token;phase='requesting';error='';notify();pending=(async()=>{let granted;try{granted=await getStream();if(own!==token||!isActive()){release(granted);return false;}stream=granted;await attach(granted);if(own!==token||!isActive()){release(granted);if(stream===granted)stream=null;return false;}phase='live';notify();return true;}catch(e){release(granted);if(stream===granted)stream=null;if(own===token){phase='error';error=e.message||'相機未能開啟';notify();}return false;}})();const owned=pending;owned.then(()=>{if(pending===owned)pending=null;},()=>{if(pending===owned)pending=null;});return owned;}
 function capture(){if(phase!=='live'||!stream||!isActive())return Promise.resolve(null);if(encoding>=maxEncoding){error='照片正在收下，請稍候再拍。';notify();return Promise.resolve(null);}error='';const order=++sequence,id=uid(),shot={id,order,status:'capturing',blob:null,error:'',capturedAt:new Date().toISOString()};latest=shot;saving++;encoding++;notify();let frame;try{frame=snapshot();}catch(e){frame=Promise.reject(e);}const job=(async()=>{try{const blob=await frame;encoding--;shot.blob=blob;shot.status='local';if(latest?.order===order)notify();const entry=await enqueue({id,blob,order,capturedAt:shot.capturedAt});shot.status=entry?.localError?'failed':'queued';shot.error=entry?.error||'';return shot;}catch(e){if(!shot.blob)encoding--;shot.status='failed';shot.error=e.message;return shot;}finally{saving--;jobs.delete(job);if(latest?.order===order)error=shot.error;notify();}})();jobs.add(job);return job;}
 function close(){token++;release(stream);stream=null;phase='closed';notify();}
 return {open,capture,close,get requestPending(){return !!pending;},get phase(){return phase;},get latest(){return latest;},get unsettled(){return [...jobs];}};
}
