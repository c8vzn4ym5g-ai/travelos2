// Own one permission request and recorder. A cancelled request may resolve late.
export function createCaptureSession({getStream,startRecorder,isActive=()=>true,onChange=()=>{}}){
 let phase='idle',ticket=0,pending=null,controller=null;
 const change=(next,error)=>{phase=next;onChange({phase,error});};
 const release=stream=>stream?.getTracks().forEach(track=>track.stop());
 return {
  get phase(){return phase;},
  get busy(){return !!pending;},
  start(){
   if(pending)return pending;
   const own=++ticket;change('requesting');
   let job;job=Promise.resolve().then(async()=>{
    let stream;
    try{
     stream=await getStream();
     if(own!==ticket||!isActive()){release(stream);return;}
     controller=await startRecorder(stream);
     if(own!==ticket||!isActive()){controller.stop('interrupted');await controller.done;return;}
     change('recording');await controller.done;
     if(own===ticket)change('review');
    }catch(error){if(controller)controller.stop('interrupted');else release(stream);if(own===ticket)change('error',error);throw error;}
    finally{controller=null;if(pending===job)pending=null;if(own!==ticket)change('idle');}
   });pending=job;return job;
  },
  stop(reason='stopped'){if(!controller)return this.cancel();change('stopping');controller.stop(reason);return pending;},
  cancel(){ticket++;if(controller){change('stopping');controller.stop('interrupted');}else change('idle');return pending||Promise.resolve();}
 };
}
