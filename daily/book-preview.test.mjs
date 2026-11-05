import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('./web/app.js',import.meta.url),'utf8').split('\n').find(l=>l.includes("app.querySelector('#save-book').onclick=async"));
test('book save takes the visible title even before any change event',async()=>{
 let handler,payload;const values={'#preview-book-title':'獨立書名0557','#preview-template':'album','#preview-cover':'photo-1'};
 const ctx={app:{querySelector:()=>({set onclick(fn){handler=fn;}})},settings:{querySelector:s=>({value:values[s]})},getBookDraft:()=>({title:'old title',diaryIds:['a','b'],template:'journal',cover:''}),c:{chapters:[{diaryId:'a',number:1},{diaryId:'b',number:2}]},localStorage:{setItem(){},removeItem(){}},bookDraftKey:()=> 'book',uid:()=> 'request',api:async(action,p)=>{if(action==='collection'){payload=p;return {collection:{id:'saved'}};}return {};},state:{},activeView:{},bookView(){},note(){}};
 vm.createContext(ctx);vm.runInContext(source,ctx);await handler({target:{disabled:false,textContent:''}});
 assert.equal(payload.title,values['#preview-book-title']);assert.equal(payload.template,'album');assert.equal(payload.cover,'photo-1');assert.deepEqual([...payload.diaryIds],['a','b']);
});
