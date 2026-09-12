import test from 'node:test';
import assert from 'node:assert/strict';
import { prepareTripSave, publishedTrip } from '../lib/trip-publication.ts';
import type { TripDetail } from '../lib/types.ts';
const original = {id:'trip_a',title:'已完成的遊記',slug:'a',visibility:'public',updatedAt:'old',journalEntries:[],photos:[],places:[],travelRoute:[],costs:[],musicTracks:[]} as unknown as TripDetail;
test('saving a public journal keeps its published words while preserving new draft words',()=>{
  const result=prepareTripSave(original,{...original,title:'還在修改'},false);
  assert.equal(result.title,'還在修改');
  assert.equal(publishedTrip(result)?.title,'已完成的遊記');
  assert.equal(original.title,'已完成的遊記');
});
test('only explicit publish replaces the reader version and excludes planned entries',()=>{
  const draft=prepareTripSave(original,{...original,title:'新版'},false);
  draft.journalEntries=[{id:'planned',entryKind:'plan',body:'明天可能去A'},{id:'actual',entryKind:'actual',body:'最後去了E'}] as TripDetail['journalEntries'];
  const result=prepareTripSave(draft,draft,true);
  assert.equal(publishedTrip(result)?.title,'新版');
  assert.deepEqual(publishedTrip(result)?.journalEntries.map(e=>e.id),['actual']);
  assert.equal(result.journalEntries.length,2);
});
test('private draft cannot become public by a normal save or leak a previous public snapshot',()=>{
  const privateTrip={...original,visibility:'private'} as TripDetail;
  assert.equal(publishedTrip(prepareTripSave(privateTrip,{...privateTrip,visibility:'public'},false)),null);
  assert.equal(publishedTrip(prepareTripSave(original,{...original,visibility:'private'},false)),null);
});
