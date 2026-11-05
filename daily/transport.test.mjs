import {test} from 'node:test';
import assert from 'node:assert/strict';
import {sendJSON} from './web/transport.js';
test('upload cancellation is owned, removes its listener, and retries the same payload',async()=>{
 const previous=globalThis.XMLHttpRequest;const requests=[];
 class FakeXHR{constructor(){this.upload={};requests.push(this);}open(){}setRequestHeader(){}send(body){this.body=body;}abort(){this.onabort?.();}}
 globalThis.XMLHttpRequest=FakeXHR;
 try{
  const controller=new AbortController(),body={requestId:'stable-capture',text:'synthetic'};
  const pending=sendJSON('/api/capture',body,{signal:controller.signal});controller.abort();
  await assert.rejects(pending,/取消/);assert.equal(requests[0].onabort,null);
  let progress;const retry=sendJSON('/api/capture',body,{onProgress:value=>progress=value});const request=requests[1];
  request.upload.onprogress({lengthComputable:true,loaded:5,total:10});assert.equal(progress,50);
  request.status=200;request.responseText=JSON.stringify({moment:{id:'same-note'}});request.onload();
  assert.equal((await retry).moment.id,'same-note');assert.equal(request.body,requests[0].body);assert.equal(request.upload.onprogress,null);
 }finally{globalThis.XMLHttpRequest=previous;}
});
