import {test} from 'node:test';import assert from 'node:assert/strict';import {observeImage,validatedGroups,arrangeSources,VISION_MODEL,GEMMA_VISION_MODEL} from './multimodal.mjs';
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
 await assert.rejects(()=>arrangeSources({run:async()=>({response:'not JSON'})},[{id:'a',author:'媽媽',text:'橘子',media:[]},{id:'b',author:'爺爺',text:'下雪',media:[]}]),/故事文字尚未/);
});


test('visual safety validation applies after traditional Chinese normalization',async()=>{
 const result=await observeImage({run:async()=>({response:JSON.stringify({facts:['妈妈很开心','桌上有橘子'],uncertain:[]})})},'data:image/png;base64,eA==');assert.deepEqual(result.facts,['桌上有橘子']);
});
test('narrative accepts sourced family language and requires an exact unique source set',async()=>{
 const sources=[{id:'a',author:'Mom',text:'My father held an orange.',media:[]},{id:'b',author:'Dad',text:'An orange was on the table.',media:[]}];
 const ai={run:async(model,input)=>({response:JSON.stringify(input.messages[0].content.includes('paragraphs')?{paragraphs:[{sourceIds:['a','b'],text:'My father held an orange. An orange was on the table.'}]}:{groups:[{sourceIds:['a','b'],anchor:'orange'}]})})};
 const good=await arrangeSources(ai,sources);assert.equal(good.body,'My father held an orange. An orange was on the table.');
 const badAI={run:async(model,input)=>({response:JSON.stringify(input.messages[0].content.includes('paragraphs')?{paragraphs:[{sourceIds:['a','a'],text:'Only a survived.'}]}:{groups:[{sourceIds:['a','b'],anchor:'orange'}]})})};
 await assert.rejects(()=>arrangeSources(badAI,sources),/故事文字尚未/);
});


test('Gemma vision uses typed image content and completion output, never a fake response field',async()=>{
 let request;const pixels='data:image/png;base64,eA==';const ai={run:async(model,input)=>{request={model,input};return {choices:[{finish_reason:'stop',message:{content:JSON.stringify({facts:['桌上有橘子'],uncertain:[]})}}]};}};
 const result=await observeImage(ai,pixels,GEMMA_VISION_MODEL);assert.equal(request.model,GEMMA_VISION_MODEL);assert.equal(request.input.messages[0].content[1].image_url.url,pixels);assert.equal(request.input.max_completion_tokens,600);assert.equal(result.model,GEMMA_VISION_MODEL);assert.deepEqual(result.facts,['桌上有橘子']);
 await assert.rejects(()=>observeImage({run:async()=>({response:'not the Gemma contract'})},pixels,GEMMA_VISION_MODEL));
 await assert.rejects(()=>observeImage({run:async()=>({choices:[{finish_reason:'length',message:{content:'{}'}}]})},pixels,GEMMA_VISION_MODEL));
});
