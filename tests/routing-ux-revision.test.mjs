import test from 'node:test';
import assert from 'node:assert/strict';
import {createState,start,tick,act,check,preview,serialize,restore,serviceOrigin} from '../engine.js';
import {guidance} from '../guidance.js';

const fresh=(mode='incident')=>{const s=createState({mode});start(s);return s;};
const shortChoices=(s,id,service,action)=>guidance(s,id,service).choices.filter(x=>x.action===action).map(x=>x.arg.dest);
for(const [id,service,origin,ordinary,future] of [
 ['T1','A024',7,[4,6],[2]],['T3','D064',7,[4,6],[2]],
 ['T3','D028',0,[2],[4,6]],['T1','A060',0,[2],[4,6]],
])test(`08:05 ${service}の所定始発${origin}から通常短縮と再開待ち計画を分ける`,()=>{
 const s=fresh();tick(s,5);
 const r=s.timetable.find(r=>r.id===service);
 assert.equal(serviceOrigin(s,r),origin);
 assert.deepEqual(shortChoices(s,id,service,'shorten'),ordinary);
 assert.deepEqual(shortChoices(s,id,service,'planShorten'),future);
 for(const dest of ordinary)assert.equal(check(s,id,'shorten',{service,dest}),'');
 for(const dest of future){
  assert.match(check(s,id,'shorten',{service,dest}),/閉鎖中.*再開時刻は未確定/);
  const before=serialize(s);assert.equal(act(s,id,'shorten',{service,dest}),false);s.notice=JSON.parse(before).notice;assert.equal(serialize(s),before);
  assert.equal(check(s,id,'planShorten',{service,dest}),'');
  assert.match(preview(s,id,'planShorten',{service,dest}).info,/必要経路の再開条件が成立するまで新たに発車しません/);
 }
});
test('08:20東向き再開で中央起点は通常短縮へ移り、森ヶ丘起点は西向き計画を維持',()=>{
 const s=fresh();tick(s,20);
 for(const [id,service] of [['T3','D028'],['T1','A060']]){
  assert.deepEqual(shortChoices(s,id,service,'shorten'),[2,4,6]);
  assert.deepEqual(shortChoices(s,id,service,'planShorten'),[]);
  assert.ok(!guidance(s,id,service).choices.some(x=>x.action==='planResume'),'開通・未抑止便の冗長な将来計画は出さない');
 }
 for(const [id,service] of [['T1','A024'],['T3','D064']]){
  assert.deepEqual(shortChoices(s,id,service,'shorten'),[4,6]);
  assert.deepEqual(shortChoices(s,id,service,'planShorten'),[2]);
  assert.match(check(s,id,'shorten',{service,dest:2}),/西向き閉鎖/);
 }
});
test('既進入DM008の短縮分類は退出先川原から判定し、遡って閉鎖違反を付けない',()=>{
 const s=fresh();tick(s,5);const t=s.trains.find(t=>t.id==='T3'),r=s.timetable.find(r=>r.id==='DM008');
 assert.deepEqual(t.edge,[4,3]);assert.equal(serviceOrigin(s,r),3);
 assert.ok(shortChoices(s,'T3','DM008','shorten').includes(2));
 assert.ok(!shortChoices(s,'T3','DM008','planShorten').includes(2));
 assert.ok(act(s,'T3','shorten',{service:'DM008',dest:2}));
 assert.ok(act(s,'T3','resume',{service:'DM008'}));tick(s,6);
 assert.equal(s.actual.find(a=>a.id==='DM008').status,'短縮完了');assert.deepEqual(s.violations,[]);
});
test('閉鎖依存短縮を保存復元し、全必要経路再開までは始発を出ず、再開後も現地担当を検査する',()=>{
 let s=fresh();tick(s,5);
 assert.ok(act(s,'T1','planResume',{service:'AM012'}));
 const item=guidance(s,'T1','A024').choices.find(x=>x.action==='planShorten'&&x.arg.dest===2);
 assert.ok(item);assert.ok(act(s,'T1',item.action,item.arg));
 s=restore(serialize(s));const plan=s.plans.find(p=>p.id==='A024');
 assert.equal(plan.dest,2);assert.equal(plan.hold,false);assert.equal(plan.waitForRoute,true);
 tick(s,55);const a=s.actual.find(a=>a.id==='A024');
 assert.equal(a.actualDeparture,null);assert.equal(a.status,'未発車');assert.match(a.reason,/将来計画・実行待ち.*西向き閉鎖/);
 assert.equal(s.trains.find(t=>t.id==='T1').at,7);assert.ok(!s.trains.find(t=>t.id==='T1').edge);
 s=restore(serialize(s));tick(s,5);
 assert.equal(s.actual.find(a=>a.id==='A024').actualDeparture,null);
 assert.match(s.actual.find(a=>a.id==='A024').reason,/始発駅に.*勤務可能な乗務員がいません/);
 assert.ok(act(s,'T1','assign',{service:'A024',crew:'C2'}));tick(s);
 assert.equal(s.actual.find(a=>a.id==='A024').actualDeparture,66);
 assert.deepEqual(s.trains.find(t=>t.id==='T1').edge,[7,6]);assert.deepEqual(s.violations,[]);
});
test('開通・未抑止の所定便にplanResumeを出さず、明示抑止の解除計画と変更復元は残す',()=>{
 const s=fresh('normal');assert.ok(!guidance(s,'T1','A060').choices.some(x=>x.action==='planResume'));
 assert.ok(act(s,'T1','hold',{service:'A060'}));
 assert.ok(guidance(s,'T1','A060').choices.some(x=>x.action==='planResume'));
 assert.ok(act(s,'T1','planResume',{service:'A060'}));
 assert.ok(!guidance(s,'T1','A060').choices.some(x=>x.action==='planResume'));
 assert.ok(act(s,'T1','shorten',{service:'A060',dest:2}));
 assert.ok(guidance(s,'T1','A060').choices.some(x=>x.action==='restorePlan'));
});
test('運休・完了の選択は別の未完了便へ落ちず、確定実績の開示と変更不可を維持',()=>{
 const s=fresh();assert.ok(act(s,'T1','cancel',{service:'A060'}));
 for(const service of ['A060','AM156']){
  const g=guidance(s,'T1',service);assert.equal(g.service,service);assert.match(g.context,new RegExp(`選択便 ${service} は.*実績は確定`));
  assert.ok(!g.choices.some(x=>x.arg.service),'確定便を選んだまま別便を変更しない');
 }
});
test('別編成の便を直接cancelしても計画・実績・件数を変えず、担当編成からの取消は可能',()=>{
 const s=fresh();const before=serialize(s);
 assert.match(check(s,'T1','cancel',{service:'D028'}),/D028はT3の担当/);
 assert.equal(act(s,'T1','cancel',{service:'D028'}),false);
 s.notice=JSON.parse(before).notice;assert.equal(serialize(s),before);
 assert.ok(act(s,'T3','cancel',{service:'D028'}));assert.equal(s.actual.find(a=>a.id==='D028').status,'運休');
});
