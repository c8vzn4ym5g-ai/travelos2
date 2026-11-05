import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('./web/app.js',import.meta.url),'utf8');
const owner=source.slice(source.indexOf('let generationViewEpoch='),source.indexOf('function saveView()'));
const functions=['generateToday','generateWeekly'].map(name=>source.split('\n').find(line=>line.startsWith('async function '+name+'('))).join('\n');
for(const failure of [false,true])for(const kind of ['daily','weekly'])for(const action of ['normal','switch','composer','background','scroll','away-back','new-member'])test(`${kind} ${failure?'failure':'success'} respects ${action} view ownership`,async()=>{
 const listeners={};let release;const gate=new Promise(r=>release=r),opened=[];
 const family={id:'f',diaries:[{id:'d',date:'2026-11-05'}],weeklies:[{id:'w',start:'2026-11-02'}]};
 const button={disabled:false,textContent:''},status={textContent:''},root={};
 const c={state:{family,member:{id:'m'},today:'2026-11-05'},tab:'diary',activeView:null,journalMode:kind,selectedDate:'',scrollY:0,composerOpen:false,cameraOpen:false,voiceActive:false,photoChoosing:false,
 document:{visibilityState:'visible',addEventListener:(name,fn)=>listeners[name]=fn},window:{addEventListener:()=>{}},app:{firstElementChild:root,querySelector:selector=>selector==='#generate'?button:status},note:()=>{},showDiary:id=>opened.push(id),showWeekly:id=>opened.push(id),render:()=>opened.push('render'),renderWeeklies:()=>opened.push('render'),api:async route=>{if(route==='state')return {family,member:{id:'m'}};await gate;if(failure)throw Error('controlled failure');}};
 vm.createContext(c);vm.runInContext(owner+functions,c);
 const promise=kind==='daily'?c.generateToday('2026-11-05'):c.generateWeekly('2026-11-02');
 if(action==='switch')c.tab='today';if(action==='composer')c.composerOpen=true;if(action==='background'){c.document.visibilityState='hidden';listeners.visibilitychange();}if(action==='scroll'){c.scrollY=100;listeners.scroll();}if(action==='away-back'){listeners.click();c.tab='today';listeners.click();c.tab='diary';}if(action==='new-member')c.state={family,member:{id:'other'}};
 release();await promise;assert.equal(opened.length,action==='normal'&&!failure?1:action==='normal'&&failure&&kind==='weekly'?1:0);if(kind==='daily'&&action==='scroll'){assert.equal(button.disabled,false);assert.equal(button.textContent,failure?'重試整理':'閱讀日記');}if(action==='new-member')assert.equal(c.state.member.id,'other');
});
