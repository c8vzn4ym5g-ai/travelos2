import {test} from 'node:test';import assert from 'node:assert/strict';import {bookSnapshot,versionMedia} from './web/story-model.js';
test('two-day book keeps chosen order, template, cover and adopted versions',()=>{
 const f={child:'小禾',moments:[{id:'m1',author:'媽媽',media:[{kind:'image',data:'first'},{kind:'audio',data:'voice'}]}],diaries:[{id:'d1',date:'2026-11-04',current:{number:2,title:'第一天',body:'人工文字',kind:'manual',sourceIds:['m1'],selectedMedia:['m1:0']}},{id:'d2',date:'2026-11-05',current:{number:1,title:'第二天',body:'第二天的話',sourceIds:[]}}]};
 const book=bookSnapshot(f,{diaryIds:['d2','d1'],template:'album',cover:'m1:0'});assert.deepEqual(book.chapters.map(c=>c.date),['2026-11-05','2026-11-04']);assert.equal(book.template,'album');assert.equal(book.cover,'m1:0');assert.equal(versionMedia(f,book.chapters[1]).length,1);
 f.diaries[0].current.body='後來修改';f.diaries[0].current.selectedMedia.push('m1:1');assert.equal(book.chapters[1].body,'人工文字');assert.deepEqual(book.chapters[1].selectedMedia,['m1:0']);assert.throws(()=>bookSnapshot(f,{diaryIds:['d1'],cover:'unknown:0'}));
});
