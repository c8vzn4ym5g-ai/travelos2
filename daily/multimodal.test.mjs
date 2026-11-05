import {test} from 'node:test';import assert from 'node:assert/strict';import {observeImage,validatedGroups,arrangeSources,VISION_MODEL} from './multimodal.mjs';
test('vision request really contains image bytes and cannot turn a typed sentence into fake image inference',async()=>{
 let request;const ai={run:async(model,input)=>{request={model,input};return {response:JSON.stringify({facts:['橘色水果帶一片綠葉','右側有藍色有柄杯','媽媽第一次開心地餵奶'],uncertain:['無法看見杯內物品']})};}};
 const image='data:image/png;base64,c3ludGhldGlj';const r=await observeImage(ai,image);assert.equal(request.model,VISION_MODEL);assert.equal(request.input.image,image);assert.equal(r.facts.length,2);assert.ok(!r.facts.join('').includes('第一次'));
});
test('explicit shared object can associate corrected speech and image; unrelated notes stay separate',()=>{
 const sources=[{id:'photo',author:'爸爸',text:'',media:[{kind:'image',observation:{facts:['桌上有橘子與藍色杯子']}}]},{id:'voice',author:'媽媽',text:'',media:[{kind:'audio',transcript:'小禾今天自己剝橘子。',transcriptReviewed:true}]},{id:'snow',author:'爺爺',text:'窗外下雪了。',media:[]}];
 let groups=validatedGroups(sources,{groups:[{sourceIds:['photo','voice'],anchor:'橘子'},{sourceIds:['snow'],anchor:''}]});assert.equal(groups.length,2);assert.equal(groups[0].relation,'possible');assert.match(groups[0].body,/AI觀察/);assert.match(groups[0].body,/媽媽記下/);assert.ok(!groups[0].body.includes('照片裡小禾剝'));
 groups=validatedGroups(sources,{groups:[{sourceIds:['photo','voice','snow'],anchor:'橘子'}]});assert.equal(groups.length,3,'the model cannot force unrelated material into an event');
});
test('uncertain or rejected vision is not silently converted to successful understanding',async()=>{
 await assert.rejects(()=>observeImage({run:async()=>{throw Error('license agreement required');}},'data:image/png;base64,AAAA'),/license/);
 await assert.rejects(()=>observeImage({run:async()=>({response:'unstructured guess'})},'data:image/png;base64,AAAA'));
 const r=await arrangeSources({run:async()=>({response:'not JSON'})},[{id:'a',author:'媽媽',text:'橘子',media:[]},{id:'b',author:'爺爺',text:'下雪',media:[]}]);assert.equal(r.events.length,2);
});
