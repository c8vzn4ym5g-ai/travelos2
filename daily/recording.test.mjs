import {createCaptureOutbox} from './web/capture-outbox.js';
import {test} from 'node:test';import assert from 'node:assert/strict';import {startRecording} from './web/recording.js';
class Track extends EventTarget {stopped=false;stop(){this.stopped=true;}}
class Recorder extends EventTarget {
 state='inactive';mimeType='audio/webm';start(){this.state='recording';}
 chunk(text){const e=new Event('dataavailable');e.data=new Blob([text],{type:this.mimeType});this.dispatchEvent(e);}
 stop(){this.chunk('end');this.state='inactive';this.dispatchEvent(new Event('stop'));}
}
const setup=options=>{const track=new Track(),session=startRecording({stream:{getTracks:()=>[track]},Recorder,...options});return {track,session};};
test('normal stop retains chunks, final data, and stops the owned microphone',async()=>{
 const saved=[];const {track,session}=setup({onChunk:(blob,index)=>saved.push(index)});session.recorder.chunk('first');session.stop();const r=await session.done;
 assert.equal(await r.blob.text(),'firstend');assert.deepEqual(saved,[0,1]);assert.equal(track.stopped,true);
});
test('track ending interrupts recording, retains available data and completes once',async()=>{
 let finishes=0;const {track,session}=setup({onFinish:()=>finishes++});session.recorder.chunk('partial');track.dispatchEvent(new Event('ended'));
 try{assert.equal(session.recorder.state,'inactive','system-ended microphone must stop the recording');}finally{session.stop();}
 const r=await session.done;assert.equal(r.reason,'interrupted');assert.equal(await r.blob.text(),'partialend');assert.equal(finishes,1);
});
test('recorder errors preserve earlier chunks and do not leave a recording running',async()=>{
 const {session}=setup({});session.recorder.chunk('kept');session.recorder.dispatchEvent(new Event('error'));
 try{assert.equal(session.recorder.state,'inactive');}finally{session.stop();}
 assert.equal((await session.done).reason,'interrupted');
});


test('a delayed oversized audio/mp4 delivery is preserved before the limit stops recording, including final data',async()=>{
 class Mp4Recorder extends Recorder{mimeType='audio/mp4';}
 const track=new Track(),saved=[];let finishes=0;
 const session=startRecording({stream:{getTracks:()=>[track]},Recorder:Mp4Recorder,maxBytes:4,onChunk:async(blob,index)=>saved.push({index,text:await blob.text(),type:blob.type}),onFinish:()=>finishes++});
 session.recorder.chunk('original-delayed-frame');const result=await session.done;
 assert.equal(await result.blob.text(),'original-delayed-frameend');assert.equal(result.blob.type,'audio/mp4');assert.equal(result.reason,'limit');assert.equal(track.stopped,true);assert.equal(finishes,1);assert.deepEqual(saved.map(x=>x.text),['original-delayed-frame','end']);assert.deepEqual(saved.map(x=>x.index),[0,1]);
});

test('available audio survives a chunk storage error and repeated interruption still finishes once',async()=>{
 let finishes=0;const {session,track}=setup({onChunk:()=>{throw Error('quota');},onFinish:()=>finishes++});session.recorder.chunk('kept');session.stop('interrupted');session.stop('interrupted');track.dispatchEvent(new Event('ended'));const result=await session.done;
 assert.equal(await result.blob.text(),'keptend');assert.equal(result.storageError.message,'quota');assert.equal(result.reason,'interrupted');assert.equal(finishes,1);assert.equal(track.stopped,true);
});


test('oversized interrupted original reaches durable outbox, survives failed send/restore and retries one identity',async()=>{
 const rows=new Map(),store={put:async e=>rows.set(e.id,structuredClone(e)),list:async()=>[...rows.values()].map(e=>structuredClone(e)),remove:async id=>rows.delete(id)};
 let attempts=0,finishCount=0;const original='delayed-original';
 const failed=createCaptureOutbox({store,send:async()=>{attempts++;throw Error('size limit');}});
 const {session}=setup({maxBytes:4,onFinish:async({blob})=>{finishCount++;await failed.enqueue({requestId:'recording-one',text:'',media:[{kind:'audio',blob}]});}});
 session.recorder.chunk(original);await session.done;await new Promise(r=>setTimeout(r,0));assert.equal(attempts,1);assert.equal(finishCount,1);assert.equal(rows.get('recording-one').status,'failed');failed.dispose();
 const saved=[];const restored=createCaptureOutbox({store,send:async payload=>{attempts++;assert.equal(payload.requestId,'recording-one');assert.equal(await payload.media[0].blob.text(),original+'end');return {moment:{id:'same-recording'}};},onSaved:m=>saved.push(m.id)});
 await restored.restore();assert.equal(attempts,1,'failed entries must not silently resend on restore');assert.equal(await restored.entries[0].payload.media[0].blob.text(),original+'end');await restored.retry('recording-one');await new Promise(r=>setTimeout(r,0));assert.equal(attempts,2);assert.deepEqual(saved,['same-recording']);assert.equal(rows.size,0);
});
