import test from 'node:test';
import assert from 'node:assert/strict';
import {preview,serialize,restore,tick,result} from '../engine.js';
import {strategy} from './strategies.mjs';

test('通常local方針の休憩中断確認は現時点の残休憩・条件付き超勤影響を示し、状態を変えない',()=>{
 let checked=false;
 const final=strategy('local',s=>{
  if(s.time!==57)return;
  checked=true;
  const before=serialize(s),p=preview(s,'T3','endBreak',{crew:'C11'});
  assert.equal(p.reason,'');
  assert.match(p.info,/担当 C11/);
  assert.match(p.info,/自由休憩の残り21分を取消/);
  assert.match(p.info,/別の休憩を補わず同じ所定終業まで働く場合/);
  assert.match(p.info,/実働21分増・評価対象超勤21分増/);
  assert.equal(serialize(s),before);
  const later=restore(before);tick(later);
  const updated=preview(later,'T3','endBreak',{crew:'C11'});
  assert.equal(updated.reason,'');
  assert.match(updated.info,/自由休憩の残り20分を取消/);
  assert.match(updated.info,/実働20分増・評価対象超勤20分増/);
  const unavailable=preview(s,'T3','endBreak',{crew:'C1'});
  assert.ok(unavailable.reason);
  assert.doesNotMatch(unavailable.info,/自由休憩の残り0分を取消/);
 },true);
 assert.equal(checked,true);
 assert.equal(result(final).success,true);
});
