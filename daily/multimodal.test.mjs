import {weekInputs} from './weekly.mjs';
const completion=value=>({choices:[{finish_reason:'stop',message:{content:JSON.stringify(value)}}]});
import {test} from 'node:test';import assert from 'node:assert/strict';import {observeImage,sourceEvidence,validatedGroups,arrangeSources,VISION_MODEL,GEMMA_VISION_MODEL,LEGACY_VISION_MODEL} from './multimodal.mjs';
test('vision request really contains image bytes and cannot turn a typed sentence into fake image inference',async()=>{
 let request;const ai={run:async(model,input)=>{request={model,input};return {response:JSON.stringify({facts:['橘色水果帶一片綠葉','右側有藍色有柄杯','媽媽第一次開心地餵奶'],uncertain:['無法看見杯內物品']})};}};
 const image='data:image/png;base64,c3ludGhldGlj';const r=await observeImage(ai,image,LEGACY_VISION_MODEL);assert.equal(request.model,LEGACY_VISION_MODEL);assert.equal(request.input.image,image);assert.equal(r.facts.length,2);assert.ok(!r.facts.join('').includes('第一次'));
});
test('explicit shared object can associate corrected speech and image; unrelated notes stay separate',()=>{
 const sources=[{id:'photo',author:'爸爸',text:'',media:[{kind:'image',observation:{facts:['桌上有橘子與藍色杯子']}}]},{id:'voice',author:'媽媽',text:'',media:[{kind:'audio',transcript:'小禾今天自己剝橘子。',transcriptReviewed:true}]},{id:'snow',author:'爺爺',text:'窗外下雪了。',media:[]}];
 let groups=validatedGroups(sources,{groups:[{sourceIds:['photo','voice'],anchor:'橘子'},{sourceIds:['snow'],anchor:''}]});assert.equal(groups.length,2);assert.equal(groups[0].relation,'possible');assert.match(groups[0].body,/AI整理/);assert.match(groups[0].body,/媽媽記下/);assert.ok(!groups[0].body.includes('照片裡小禾剝'));
 groups=validatedGroups(sources,{groups:[{sourceIds:['photo','voice','snow'],anchor:'橘子'}]});assert.equal(groups.length,3,'the model cannot force unrelated material into an event');
});
test('uncertain or rejected vision is not silently converted to successful understanding',async()=>{
 await assert.rejects(()=>observeImage({run:async()=>{throw Error('license agreement required');}},'data:image/png;base64,AAAA'),/license/);
 await assert.rejects(()=>observeImage({run:async()=>({response:'unstructured guess'})},'data:image/png;base64,AAAA'));
 await assert.rejects(()=>arrangeSources({run:async()=>({response:'not JSON'})},[{id:'a',author:'媽媽',text:'橘子',media:[]},{id:'b',author:'爺爺',text:'下雪',media:[]}]),/故事文字尚未/);
});


test('visual safety validation applies after traditional Chinese normalization',async()=>{
 const result=await observeImage({run:async()=>({response:JSON.stringify({facts:['妈妈很开心','桌上有橘子'],uncertain:[]})})},'data:image/png;base64,eA==',LEGACY_VISION_MODEL);assert.deepEqual(result.facts,['桌上有橘子']);
});
test('narrative accepts sourced family language and requires an exact unique source set',async()=>{
 const sources=[{id:'a',author:'Mom',text:'My father held an orange.',media:[]},{id:'b',author:'Dad',text:'An orange was on the table.',media:[]}];
 const ai={run:async(model,input)=>completion(input.messages[0].content.includes('paragraphs')?{paragraphs:[{eventIndices:[0,1],text:'My father held an orange. An orange was on the table.'}]}:{groups:[{sourceIds:['a','b'],anchor:'orange'}]})};
 const good=await arrangeSources(ai,sources);assert.equal(good.body,'My father held an orange. An orange was on the table.');
 const badAI={run:async(model,input)=>completion(input.messages[0].content.includes('paragraphs')?{paragraphs:[{eventIndices:[0,0],text:'Only a survived.'}]}:{groups:[{sourceIds:['a','b'],anchor:'orange'}]})};
 await assert.rejects(()=>arrangeSources(badAI,sources),/故事文字尚未/);
});


test('Gemma vision uses typed image content and completion output, never a fake response field',async()=>{
 let request;const pixels='data:image/png;base64,eA==';const ai={run:async(model,input)=>{request={model,input};return {choices:[{finish_reason:'stop',message:{content:JSON.stringify({facts:['桌上有橘子'],uncertain:[]})}}]};}};
 const result=await observeImage(ai,pixels,GEMMA_VISION_MODEL);assert.equal(request.model,GEMMA_VISION_MODEL);assert.equal(request.input.messages[0].content[1].image_url.url,pixels);assert.equal(request.input.max_completion_tokens,1800);assert.equal(request.input.chat_template_kwargs.enable_thinking,false);assert.equal(result.model,GEMMA_VISION_MODEL);assert.deepEqual(result.facts,['桌上有橘子']);
 await assert.rejects(()=>observeImage({run:async()=>({response:'not the Gemma contract'})},pixels,GEMMA_VISION_MODEL));
 await assert.rejects(()=>observeImage({run:async()=>({choices:[{finish_reason:'length',message:{content:'{}'}}]})},pixels,GEMMA_VISION_MODEL));
});


test('different wording of a shared object can connect; an explicit separate event stays separate',()=>{
 const sources=[{id:'photo',author:'媽媽',text:'',media:[{kind:'image',observation:{facts:['圓形的橘色物體與綠色葉片']}}]},{id:'voice',author:'爸爸',text:'今天把橘子放在桌上。',media:[]}];
 const group={sourceIds:['photo','voice'],anchor:'橘子',links:[{sourceId:'photo',quote:'圓形的橘色物體'},{sourceId:'voice',quote:'把橘子放在桌上'}],linkReason:'家人提到的物件與照片的外形顏色相符'};
 assert.equal(validatedGroups(sources,{groups:[group]}).length,1);
 sources[1].text+='這是不同事件。';assert.equal(validatedGroups(sources,{groups:[group]}).length,2);
});


test('real mixed-response regression allows two related inputs in one paragraph and keeps snow separate',async()=>{
 const sources=[{id:'photo',author:'Mom',text:'',media:[{kind:'image',observation:{facts:['藍色杯子與橘色物體']}}]},{id:'voice',author:'Dad',text:'把橘子放在桌上，旁邊有藍色杯子。',media:[]},{id:'snow',author:'Grandpa',text:'另外記一件不同事件：窗外下雪了。',media:[]}];
 const result=await arrangeSources({run:async()=>completion({paragraphs:[{eventIndices:[0,1],text:'把橘子放在桌上，旁邊放著一個藍色杯子。'},{eventIndices:[2],text:'爺爺說窗外下雪了。'}]})},sources);
 assert.equal(result.events.length,2);assert.deepEqual(result.events[0].sourceIds,['photo','voice']);assert.deepEqual(result.events[1].sourceIds,['snow']);assert.ok(!result.body.includes('AI整理'));
 await assert.rejects(()=>arrangeSources({run:async()=>completion({paragraphs:[{eventIndices:[0,1,2],text:'全部一起做。'}]})},sources),/故事文字尚未/);
});


test('prose model sees plain material content and short indices, never UUID-copy or review labels',async()=>{
 const source={id:'private-material-uuid',author:'媽媽',text:'把橘子放在桌上。',media:[{kind:'image',observation:{facts:['藍色杯子']}}]};let payload;
 const result=await arrangeSources({run:async(model,input)=>{payload=JSON.parse(input.messages.at(-1).content);return completion({paragraphs:[{eventIndices:[0],text:'把橘子放在桌上，旁邊有藍色杯子。'}]});}},[source]);
 assert.equal(payload[0].index,0);assert.deepEqual(payload[0].photoFacts,['藍色杯子']);assert.ok(!JSON.stringify(payload).includes(source.id));assert.ok(!JSON.stringify(payload).includes('待核對'));assert.deepEqual(result.events[0].sourceIds,[source.id]);
});

test('story payload retains uncertain actions and distinguishes imported time from occurrence',async()=>{
 let request;const action={actor:'人',verb:'手靠近嘴',object:'',visibleEvidence:'手在嘴邊',certainty:'uncertain',alternatives:['看不清是否接觸']};
 const ai={run:async(model,input)=>{request=input;return completion({paragraphs:[{eventIndices:[0],text:'家人記下吃橘子的片刻。',support:[{phrase:'吃橘子',inputIndex:0,evidenceType:'human',evidenceQuote:'吃橘子'}]}]});}};
 await arrangeSources(ai,[{id:'synthetic',date:'2026-11-05',capturedAt:'2026-11-05T12:00:00Z',timeOrigin:'import_time',author:'合成家人',text:'吃橘子',media:[{kind:'image',observation:{facts:['手在嘴邊'],uncertain:['看不清是否接觸'],actions:[action]}}]}],{timezone:'Asia/Taipei'});
 const input=JSON.parse(request.messages[1].content)[0];assert.equal(input.timeOrigin,'import_time');assert.equal(input.familyTimezone,'Asia/Taipei');assert.equal(input.author,'合成家人');assert.equal(input.recordedAt,'2026-11-05T12:00:00Z');assert.equal(input.actions[0].certainty,'uncertain');assert.equal(input.uncertain[0].text,'看不清是否接觸');
});
test('vision explicitly requests graded actions and normalizes returned uncertainty without another model call',async()=>{let calls=0;const r=await observeImage({run:async(model,input)=>{calls++;assert.match(input.messages[0].content[0].text,/actions/);assert.equal(input.max_completion_tokens,1800);return completion({facts:['手在嘴邊'],uncertain:['接觸看不清'],actions:[{actor:'人',verb:'靠近',visibleEvidence:'手在嘴邊',certainty:'uncertain',alternatives:['未接觸']}]});}},'data:image/png;base64,c3ludGhldGlj');assert.equal(calls,1);assert.equal(r.actions[0].certainty,'uncertain');assert.deepEqual(r.uncertain,['接觸看不清']);});


test('human correction excludes only its own obsolete action; other image uncertainty and clear actions retain media association',()=>{
 const reviewed={kind:'image',observationReviewed:true,observation:{facts:['只拿橘子'],uncertain:[],actions:[{verb:'吃',certainty:'clear',visibleEvidence:'舊AI判斷'}]}};
 const unreviewed={kind:'image',observation:{facts:['手靠近嘴'],uncertain:['看不清是否接觸'],actions:[{verb:'靠近嘴',certainty:'uncertain',visibleEvidence:'手在嘴邊',alternatives:['沒有接觸']}]}},clear={kind:'video',observation:{facts:['翻書'],uncertain:[],actions:[{verb:'翻書',certainty:'clear',visibleEvidence:'手掀書頁'}]}};
 const m={id:'mixed',date:'2026-10-26',author:'家人',revision:2,media:[reviewed,unreviewed,clear],text:'更正後原話',capturedAt:'2026-11-06T01:00:00Z',timeOrigin:'import_time'},snapshot=JSON.stringify(m);
 const daily=sourceEvidence(m);assert.deepEqual(daily.actions.map(a=>[a.verb,a.certainty,a.index]),[['靠近嘴','uncertain',1],['翻書','clear',2]]);assert.equal(daily.uncertain[0].text,'看不清是否接觸');assert.equal(daily.visual[0].reviewed,true);assert.equal(daily.timeOrigin,'import_time');assert.equal(daily.date,'2026-10-26');
 const bundle=weekInputs({timezone:'Asia/Taipei',moments:[m],diaries:[]},'2026-10-26','2026-11-06T02:00:00Z');assert.deepEqual(bundle.inputs[0].sources[0].actions.map(a=>[a.verb,a.certainty]),[['靠近嘴','uncertain'],['翻書','clear']]);assert.deepEqual(bundle.inputs[0].sources[0].uncertain,['看不清是否接觸']);assert.equal(JSON.stringify(m),snapshot,'Evidence filtering never rewrites original material');
});
