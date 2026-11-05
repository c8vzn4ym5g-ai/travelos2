// Own one bounded recording and return every available chunk on stop.
export function startRecording({stream,Recorder=globalThis.MediaRecorder,onChunk=()=>{},onFinish=()=>{},maxBytes=8*1024*1024,maxDurationMs=180000}) {
 const recorder=new Recorder(stream),chunks=[];let bytes=0,reason='stopped',finished=false,stopping=false,queue=Promise.resolve(),storageError=null,fallback;
 let resolveDone;const done=new Promise(resolve=>resolveDone=resolve);
 const tracks=stream.getTracks();
 const interrupted=()=>stop('interrupted');
 for(const track of tracks)track.addEventListener('ended',interrupted);
 recorder.addEventListener('error',interrupted);
 const session={recorder,done,stop};
 const timer=setTimeout(()=>stop('limit'),maxDurationMs);
 function stop(why='stopped'){
  if(finished||stopping)return;stopping=true;reason=why;
  try{if(recorder.state!=='inactive')recorder.stop();else fallback=setTimeout(finish,1000);}catch{fallback=setTimeout(finish,1000);}
 }
 async function finish(){
  if(finished)return;finished=true;clearTimeout(timer);clearTimeout(fallback);
  for(const track of tracks){track.removeEventListener('ended',interrupted);track.stop();}
  recorder.removeEventListener('error',interrupted);
  await queue;const blob=new Blob(chunks,{type:recorder.mimeType||chunks[0]?.type||'audio/webm'});
  const result={blob,reason,storageError};try{await onFinish(result);}catch(error){result.finishError=error;}finally{resolveDone(result);}
 }
 recorder.addEventListener('dataavailable',event=>{
  if(finished||!event.data?.size)return;
  if(bytes+event.data.size>maxBytes){stop('limit');return;}
  const index=chunks.length;chunks.push(event.data);bytes+=event.data.size;
  queue=queue.then(()=>onChunk(event.data,index)).catch(error=>{storageError=error;});
 });
 recorder.addEventListener('stop',finish,{once:true});
 try{recorder.start(1000);}catch(error){clearTimeout(timer);for(const track of tracks){track.removeEventListener('ended',interrupted);track.stop();}throw error;}return session;
}
