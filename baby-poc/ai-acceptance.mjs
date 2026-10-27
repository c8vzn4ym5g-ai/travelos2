import { createRequire } from 'node:module';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';
import { fixtures } from './fixtures.mjs';
const require=createRequire(import.meta.url);
const {chromium}=require('C:/Users/chao_/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const here=dirname(fileURLToPath(import.meta.url));
const origin=process.env.BABY_AI_ORIGIN||'https://travelos-baby-poc.chao-jason.workers.dev';
const out='C:/Users/chao_/Documents/Codex/2026-10-27/tr/outputs';
const report={origin,completed:false,books:[],transcriptions:[],arrangements:[],recordings:[],requests:[],layouts:[],scope:'Independent fictional POC; no original TravelOS requests'};
const persist=async()=>{await mkdir(join(here,'scratch'),{recursive:true});await writeFile(join(here,'scratch/ai-acceptance.json'),JSON.stringify(report,null,2));await writeFile(join(out,'親子記錄-AI錄音接通.json'),JSON.stringify(report,null,2));};
const browser=await chromium.launch({headless:true,executablePath:'C:/Users/chao_/AppData/Local/ms-playwright/chromium_headless_shell-1234/chrome-headless-shell-win64/chrome-headless-shell.exe',args:['--use-fake-device-for-media-stream','--use-file-for-fake-audio-capture='+join(here,'assets/voice-zh-1.wav'),'--use-fake-ui-for-media-stream']});
function observe(context){context.on('request',request=>{if(request.url().startsWith(origin+'/api/'))report.requests.push({method:request.method(),url:request.url()});});context.setDefaultTimeout(20000);context.setDefaultNavigationTimeout(30000);}
async function responseFor(page,path,action){const pending=page.waitForResponse(r=>r.url()===origin+path&&r.request().method()==='POST',{timeout:90000});await action();const response=await pending;const data=await response.json();if(!response.ok())throw new Error(path+' HTTP '+response.status()+': '+JSON.stringify(data));return data;}
async function duration(locator){await locator.waitFor({state:'visible'});return locator.evaluate(async el=>{el.load();if(el.readyState<1)await Promise.race([new Promise(resolve=>el.addEventListener('loadedmetadata',resolve,{once:true})),new Promise((_,reject)=>setTimeout(()=>reject(new Error('Audio metadata timeout')),10000))]);return el.duration;});}
async function fillCapture(page,source){for(const key of ['title','date','place','speaker','note'])await page.locator('[name='+key+']').fill(source[key]||'');const encoded=source.photo.split(',')[1];const bytes=source.photo.includes(';base64,')?Buffer.from(encoded,'base64'):Buffer.from(decodeURIComponent(encoded));await page.locator('#photo-file').setInputFiles({name:'fictional-memory.svg',mimeType:'image/svg+xml',buffer:bytes});await page.locator('#photo-stage').waitFor({state:'visible'});}
async function repairConfirmation(){
  const previous=JSON.parse(await readFile(join(here,'scratch/ai-acceptance.json'),'utf8'));
  await writeFile(join(here,'scratch/ai-acceptance-v1.json'),JSON.stringify({...previous,supersededBy:'targeted-confirmation-after-6c3fdd5'},null,2));
  await writeFile(join(out,'親子記錄-AI錄音接通-v1.json'),JSON.stringify({...previous,supersededBy:'targeted-confirmation-after-6c3fdd5'},null,2));
  report.repairCommit='6c3fdd5';report.supersedes='ai-acceptance-v1.json';report.recordings=previous.recordings.map(recording=>({...recording,reusedUnchangedEvidence:true}));report.layouts=previous.layouts;report.qualityReview='pending';
  const context=await browser.newContext({viewport:{width:1280,height:900}});observe(context);const page=await context.newPage();
  await page.goto(origin+'/?lang=zh');await page.locator('[name=title]').waitFor();
  const rawSourceId=previous.books.find(book=>book.lang==='zh').sourceMomentId;
  const state=await(await page.request.get(origin+'/api/state')).json();
  const originalSource=state.moments.find(moment=>moment.id===rawSourceId);
  await fillCapture(page,originalSource);await page.locator('#audio-file').setInputFiles(join(here,'assets/voice-zh-1.wav'));await page.locator('#capture-audio').waitFor({state:'visible'});
  const stt=await responseFor(page,'/api/transcribe',()=>page.locator('#transcribe-button').click());await page.waitForFunction(value=>document.querySelector('#transcript')?.value===value,stt.transcript);
  const traditional=stt.transcript.includes('窗邊')&&!/[边没觉静]/.test(stt.transcript);if(!traditional)throw new Error('Chinese transcription still contains the observed Simplified forms: '+stt.transcript);
  const corrected=stt.transcript.replaceAll('小河','小禾');await page.locator('#transcript').fill(corrected);
  const confirmedCapture=await responseFor(page,'/api/capture',()=>page.locator('button[type=submit]').click());const confirmedSourceId=confirmedCapture.moment.id;
  report.transcriptions.push({lang:'zh',source:'same uploaded WAV, targeted confirmation',...stt,traditionalObserved:traditional,manualCorrection:{from:'小河',to:'小禾',editedInCaptureUI:true,persistedInNewMoment:true,correctedText:corrected,confirmedSourceId,supersedesRawTranscriptSourceId:rawSourceId},accuracyClaim:'Manual review remains necessary; no verbatim accuracy claim'});
  for(const oldBook of previous.books){
    const lang=oldBook.lang;console.log('Targeted AI revision '+lang+' '+oldBook.id);await page.goto(origin+'/?book='+oldBook.id+'&lang='+lang);await page.locator('[name=entry-body-0]').waitFor();
    await page.locator('[data-step="1"]').click();if(lang==='zh'){for(const id of previous.arrangements.find(result=>result.lang==='zh').sourceIds)await page.locator('[data-select="'+id+'"]').uncheck();for(const id of [confirmedSourceId,'demo-zh-2','demo-zh-3'])await page.locator('[data-select="'+id+'"]').check();}
    const responses=[];const listener=async response=>{if(response.url()===origin+'/api/arrange'&&response.request().method()==='POST')responses.push({status:response.status(),...await response.json()});};page.on('response',listener);await page.locator('#arrange').click();await page.locator('#adopt-drafts').waitFor({timeout:240000});page.off('response',listener);
    if(responses.length!==3||responses.some(result=>result.status!==200||result.model!=='@cf/meta/llama-3.3-70b-instruct-fp8-fast'))throw new Error('New model not returned for all three drafts');
    const sourceIds=previous.arrangements.find(result=>result.lang===lang).sourceIds.map(id=>lang==='zh'&&id===rawSourceId?confirmedSourceId:id);
    report.arrangements.push({lang,sourceIds,results:responses});await page.locator('#adopt-drafts').click();await page.locator('[name=entry-body-0]').waitFor();await page.locator('#review-confirm').check();const save=await responseFor(page,'/api/book',()=>page.locator('#save-book').click());await page.locator('#edit-book').waitFor();
    const expectedFirst=lang==='zh'?confirmedSourceId:oldBook.sourceMomentId;
    if(save.book.id!==oldBook.id||!save.book.entries.some(entry=>entry.momentId===expectedFirst))throw new Error('Revision changed book or captured source ID');
    const separate=await browser.newContext({viewport:{width:1280,height:900}});observe(separate);const reopened=await separate.newPage();await reopened.goto(origin+'/?book='+oldBook.id+'&lang='+lang);await reopened.locator('[name=entry-body-0]').waitFor();if(await reopened.locator('[name=entry-body-0]').inputValue()!==responses[0].draft)throw new Error('Revised draft readback mismatch');
    const preview=await separate.newPage();await preview.addInitScript(()=>{window.print=()=>{window.__printed=true;};});await preview.goto(origin+'/api/book/'+oldBook.id+'/pdf');await preview.waitForFunction(()=>window.__printed===true);await preview.evaluate(async()=>{await document.fonts.ready;await Promise.all([...document.images].map(image=>image.decode()));});const pdfPath=join(out,lang==='zh'?'AI成長書-繁中.pdf':'AI成長書-English.pdf');await preview.pdf({path:pdfPath,preferCSSPageSize:true,printBackground:true});
    report.books.push({...oldBook,sourceMomentId:expectedFirst,...(lang==='zh'?{supersedesRawTranscriptSourceId:rawSourceId}:{}),model:responses[0].model,updatedAt:save.book.updatedAt,targetedReconfirmation:true,pdfPath});await persist();await separate.close();
  }
  report.completed=true;report.functionalFlowPassed=true;report.contentQualityPassed=null;report.qualityReview='Six new outputs preserved for independent factual review';report.completedAt=new Date().toISOString();await persist();await context.close();console.log(JSON.stringify({completed:true,arrangements:report.arrangements,transcriptions:report.transcriptions},null,2));
}
try{
  if(process.argv.includes('--repair')){await repairConfirmation();await browser.close();process.exit(0);}
  for(const lang of ['zh','en']){
    console.log('Starting real AI '+lang+' journey');
    const context=await browser.newContext({viewport:{width:1280,height:900},permissions:['microphone']});observe(context);
    const page=await context.newPage();
    await page.goto(origin+'/?lang='+lang);
    await responseFor(page,'/api/demo',()=>page.locator('#load-demo').click());
    await page.goto(origin+'/?lang='+lang);
    await page.locator('[name=title]').waitFor();
    const source=fixtures(lang).moments[0];
    await fillCapture(page,source);
    await page.locator('#audio-file').setInputFiles(join(here,'assets/voice-'+lang+'-1.wav'));
    const audioDuration=await duration(page.locator('#capture-audio'));
    await page.locator('#capture-audio').evaluate(async audio=>{await audio.play();});
    await page.waitForTimeout(400);
    const played=await page.locator('#capture-audio').evaluate(audio=>{const time=audio.currentTime;audio.pause();return time;});
    if(!(played>0))throw new Error('Uploaded audio did not play');
    const transcript=await responseFor(page,'/api/transcribe',()=>page.locator('#transcribe-button').click());
    if(!transcript.transcript?.trim()||transcript.mode!=='ai-transcription')throw new Error('Transcription missing real model output');
    await page.waitForFunction(expected=>document.querySelector('#transcript')?.value===expected,transcript.transcript);
    report.transcriptions.push({lang,source:'uploaded WAV',model:transcript.model,mode:transcript.mode,transcript:transcript.transcript,audioDuration,playedSeconds:played});
    const capture=await responseFor(page,'/api/capture',()=>page.locator('button[type=submit]').click());
    const sourceId=capture.moment.id;
    await page.locator('[data-select="demo-'+lang+'-2"]').check();
    await page.locator('[data-select="demo-'+lang+'-3"]').check();
    if(await page.locator('[data-select]:checked').count()!==3)throw new Error('Expected uploaded source plus two sample moments');
    const aiResponses=[];
    const listener=async response=>{if(response.url()===origin+'/api/arrange'&&response.request().method()==='POST'){const payload=await response.json();aiResponses.push({status:response.status(),...payload});}};
    page.on('response',listener);
    await page.locator('#arrange').click();
    await page.locator('#adopt-drafts').waitFor({timeout:150000});
    page.off('response',listener);
    if(aiResponses.length!==3||aiResponses.some(result=>result.mode!=='ai-story'||!result.model||!result.draft||result.status!==200))throw new Error('Three real AI drafts not returned: '+JSON.stringify(aiResponses));
    const sourceNotes=[capture.moment,...fixtures(lang).moments.slice(1)].map(moment=>moment.note);
    if(aiResponses.some((result,index)=>result.draft.trim()===sourceNotes[index].trim()))throw new Error('AI output is unchanged source text');
    report.arrangements.push({lang,sourceIds:[sourceId,'demo-'+lang+'-2','demo-'+lang+'-3'],results:aiResponses});
    await page.locator('#adopt-drafts').click();
    await page.locator('[name=entry-body-0]').waitFor();
    const title=lang==='zh'?'小禾的一歲：那些想留下的日子':'Milo’s first year: little days to keep';
    await page.locator('[name=coverTitle]').fill(title);
    await page.locator('[name=childName]').fill(lang==='zh'?'小禾':'Milo');
    await page.locator('[name=birthDate]').fill('2025-10-01');
    const generated=await page.locator('[name=entry-body-0]').inputValue();
    const edited=generated+(lang==='zh'?'\n這道晨光，我想和你一起記住。':'\nI want us to remember this morning light.');
    await page.locator('[name=entry-body-0]').fill(edited);
    await page.locator('#review-confirm').check();
    const firstSave=await responseFor(page,'/api/book',()=>page.locator('#save-book').click());
    await page.locator('#edit-book').waitFor();
    const id=firstSave.book.id;
    const freshContext=await browser.newContext({viewport:{width:1280,height:900}});observe(freshContext);
    const fresh=await freshContext.newPage();await fresh.goto(origin+'/?book='+id+'&lang='+lang);
    await fresh.locator('[name=entry-body-0]').waitFor();
    if(await fresh.locator('[name=entry-body-0]').inputValue()!==edited)throw new Error('Fresh editor lost saved AI draft edit');
    const continued=edited+(lang==='zh'?'\n以後翻到這一頁，還能想起那個早晨。':'\nOne day, these pages will bring us back to that morning.');
    await fresh.locator('[name=entry-body-0]').fill(continued);await fresh.locator('#review-confirm').check();
    const finalSave=await responseFor(fresh,'/api/book',()=>fresh.locator('#save-book').click());await fresh.locator('#edit-book').waitFor();
    if(finalSave.book.entries[0].momentId!==sourceId||finalSave.book.entries[0].body!==continued||finalSave.book.entries[0].photo!==source.photo)throw new Error('Captured photo to AI book source chain differs');
    for(const width of [1280,390]){await fresh.setViewportSize({width,height:width===390?844:900});const layout=await fresh.evaluate(()=>({client:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth}));if(layout.client!==layout.scroll)throw new Error('Horizontal overflow '+lang+' '+width);report.layouts.push({lang,width,...layout});if(lang==='zh')await fresh.screenshot({path:join(out,width===390?'親子記錄-AI手機.png':'親子記錄-AI桌面.png'),fullPage:true});}
    const preview=await freshContext.newPage();await preview.addInitScript(()=>{window.print=()=>{window.__printed=true;};});await preview.goto(origin+'/api/book/'+id+'/pdf');
    await preview.waitForFunction(()=>window.__printed===true,{timeout:15000});
    await preview.evaluate(async()=>{await document.fonts.ready;await Promise.all([...document.images].map(image=>image.decode()));});
    const pdfPath=join(out,lang==='zh'?'AI成長書-繁中.pdf':'AI成長書-English.pdf');
    await preview.pdf({path:pdfPath,preferCSSPageSize:true,printBackground:true});
    report.books.push({id,lang,title,sourceMomentId:sourceId,sourceChain:true,model:aiResponses[0].model,adopted:true,reviewConfirmed:true,independentContextContinuation:true,updatedAt:finalSave.book.updatedAt,printDialogTriggered:true,pdfPath,entries:finalSave.book.entries.length});
    await persist();console.log('Completed '+lang+' book '+id);await freshContext.close();await context.close();
  }
  console.log('Starting browser MediaRecorder recording');
  const context=await browser.newContext({viewport:{width:390,height:844},permissions:['microphone']});observe(context);const page=await context.newPage();await page.goto(origin+'/?lang=zh');await page.locator('#record-button').waitFor();await page.locator('#record-button').click();await page.waitForFunction(()=>document.querySelector('#record-button')?.textContent==='停止錄音');await page.waitForTimeout(10000);await page.locator('#record-button').click();await page.locator('#capture-audio').waitFor({state:'visible'});const recordedDuration=await duration(page.locator('#capture-audio'));const recordedMime=await page.locator('#capture-audio').evaluate(audio=>audio.src.slice(5,audio.src.indexOf(';')));const result=await responseFor(page,'/api/transcribe',()=>page.locator('#transcribe-button').click());if(!result.transcript?.trim()||!/[㐀-鿿]/.test(result.transcript))throw new Error('Recorded Chinese speech did not yield Chinese transcript');report.recordings.push({lang:'zh',mechanism:'Real browser MediaRecorder with fake microphone WAV input; not physical microphone',mime:recordedMime,duration:recordedDuration,model:result.model,transcript:result.transcript,mode:result.mode});await context.close();report.completed=true;report.completedAt=new Date().toISOString();await persist();console.log(JSON.stringify({completed:true,books:report.books,recordings:report.recordings},null,2));
}catch(error){report.error=error.message;await persist();console.error(error);process.exitCode=1;}finally{await browser.close();}
