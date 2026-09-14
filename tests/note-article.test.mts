import test from 'node:test';
import assert from 'node:assert/strict';
import {articleToNote,noteToArticle,newNote} from '../lib/note-article.ts';

const now='2026-09-14T12:00:00.000Z';
test('legacy coffee prose and originals survive the shared article adapter',()=>{
  const note={...newNote('真實咖啡館','coffee','coffee_one',now),journalEntries:undefined,visitedAt:'2020-02-17',comments:'原本評論',lifeNote:'原本生活記憶',address:'原地址',coffeeOrdered:'拿鐵',linkedTripId:'trip_original',photos:[{id:'photo',coffeeShopId:'coffee_one',storageKey:'/photo.jpg',originalFilename:'original.jpg',caption:'原說明',takenAt:'2020-02-17T09:00:00Z',createdAt:now}]};
  const before=structuredClone(note);const article=noteToArticle(note);
  assert.equal(article.summary,'原本評論');assert.equal(article.journalEntries[0].body,'原本生活記憶');
  const saved=articleToNote({...article,title:'修改標題',summary:'修改評論'},note);
  assert.equal(saved.name,'修改標題');assert.equal(saved.comments,'修改評論');
  assert.equal(saved.lifeNote,'原本生活記憶');assert.equal(saved.visitedAt,'2020-02-17');
  assert.equal(saved.address,'原地址');assert.equal(saved.coffeeOrdered,'拿鐵');assert.equal(saved.linkedTripId,'trip_original');
  assert.deepEqual(saved.photos,note.photos);assert.deepEqual(note,before);
});

test('coffee draft adapter retains the separate public snapshot and edited dates',()=>{
  const original=newNote('公開標題','coffee','coffee_one',now);
  const note={...original,name:'未公開標題',visibility:'public' as const,publicDateLabel:'冬天',showEntryDates:true,closingNote:'感想',publishedSnapshot:{...original,visibility:'public' as const}};
  const article=noteToArticle(note);
  assert.equal(article.title,'未公開標題');assert.equal(article.publishedSnapshot?.title,'公開標題');
  assert.equal(article.publicDateLabel,'冬天');assert.equal(article.showEntryDates,true);assert.equal(article.closingNote,'感想');
  assert.deepEqual(articleToNote(article,note).publishedSnapshot,note.publishedSnapshot);
});

test('new food note has no invented story or visit date and custom chapters round-trip',()=>{
  const note=newNote('晚餐','food','food_one',now);const article=noteToArticle(note);
  assert.equal(note.visibility,'private');assert.equal(article.startDate,'');assert.equal(article.publicDateLabel,'');assert.deepEqual(article.journalEntries,[]);
  const entry={id:'entry',tripId:note.id,title:'我的筆記',body:'今天留下的原文',entryDate:'',mood:null,weatherSummary:null,aiSummary:null,createdAt:now,updatedAt:now};
  const saved=articleToNote({...article,journalEntries:[entry]},note);
  assert.deepEqual(noteToArticle(saved).journalEntries,[entry]);
  assert.equal(saved.lifeNote,'今天留下的原文');
});
