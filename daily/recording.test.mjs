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
