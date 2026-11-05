import {test} from 'node:test';
import assert from 'node:assert/strict';
import {familyInstant} from './web/family-time.js';
test('family wall clock is independent from the travelling member device zone',()=>{
 assert.equal(familyInstant('2026-11-06T12:30','America/Los_Angeles'),'2026-11-06T20:30:00.000Z');
 assert.equal(familyInstant('2026-11-06T12:30','Asia/Taipei'),'2026-11-06T04:30:00.000Z');
 assert.equal(familyInstant('2026-07-06T12:30','America/Los_Angeles'),'2026-07-06T19:30:00.000Z');
});
test('nonexistent, repeated and invalid wall clocks need a clear correction',()=>{
 assert.throws(()=>familyInstant('2026-03-08T02:30','America/Los_Angeles'),/沒有這個時間/);
 assert.throws(()=>familyInstant('2026-11-01T01:30','America/Los_Angeles'),/重複/);
 assert.throws(()=>familyInstant('2026-02-30T12:00','Asia/Taipei'),/無效/);
});
