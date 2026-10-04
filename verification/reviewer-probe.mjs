import assert from 'node:assert/strict';
import {createState,start,tick,act,serialize,restore,validate,result,END} from '../engine.js';
import {strategy} from '../tests/strategies.mjs';
let accepted=0,refused=0;
for(const mode of ['normal','incident'])for(const time of [0,5,20,65]){
 const base=createState({mode});start(base);tick(base,time);
 for(const t of base.trains)for(const r of base.timetable.filter(r=>r.departure>=time-16&&r.departure<=time+72))for(const action of ['hold','resume','cancel','restorePlan','shorten','assign','reassignCycle'])for(const dest of action==='shorten'?[2,4,6,7]:[2]){
  const s=restore(serialize(base));if(act(s,t.id,action,{service:r.id,dest,crew:'C3'})){accepted++;validate(s);tick(s);validate(s);}else refused++;
 }
 for(const t of base.trains)for(const action of ['prepare','depotOut','depotIn'])for(const crew of ['C8','C1']){const s=restore(serialize(base));if(act(s,t.id,action,{crew})){accepted++;validate(s);tick(s);validate(s);}else refused++;}
}
console.log('公開差分・車庫指令',accepted+refused,'組：受理',accepted,'拒否',refused,'受理直後・翌分validate成功');
for(const policy of ['local','wait-rescue','wait-only']){const s=strategy(policy);assert.equal(s.time,END);console.log(policy,JSON.stringify({...result(s),recovery:s.recoveryAt}));}
const normal=createState({mode:'normal'});start(normal);tick(normal,END);assert.deepEqual(normal.violations,[]);assert.equal(normal.stats.overtime,0);console.log('正常432分：超勤0・違反0、朝を含む完了',normal.actual.filter(a=>a.status==='完了').length,'便');
const q=createState({mode:'normal'});start(q);tick(q,30);assert.ok(act(q,'T2','transfer',{crew:'C7'}));assert.ok(act(q,'T2','dispatch',{dest:7,crew:'C6'}));const extra=q.timetable.at(-1).id;tick(q,7);assert.ok(act(q,'T2','hold',{service:extra}));tick(q,4);assert.equal(q.time,41);assert.equal(q.trains[1].at,2);
assert.equal(q.crews.find(c=>c.id==='C8').at,7);const before=serialize(q);assert.equal(act(q,'T2','relief',{crew:'C8'}),false);const rejected=restore(serialize(q)),original=restore(before);rejected.notice=original.notice;assert.deepEqual(rejected,original);
assert.ok(act(q,'T2','alight',{crew:'C7'}));const old=q.crews.find(c=>c.id===q.trains[1].crew),work=old.todayWork,breaks=old.breakMinutesActual;assert.ok(act(q,'T2','relief',{crew:'C7'}));assert.equal(old.releaseAt,43);assert.equal(old.pendingBreak,0);validate(q);const saved=restore(serialize(q));tick(q,2);tick(saved,2);assert.deepEqual(saved,q);assert.equal(old.todayWork,work+2);assert.equal(old.breakMinutesActual,breaks);assert.equal(old.dutySegments.at(-1).kind,'preparation');tick(q);assert.equal(old.dutySegments.at(-1).kind,'standby');validate(q);
console.log('公開API：便乗C7を学園前で下車→現地交代、森ヶ丘C8遠隔拒否で台帳不変。旧担当C6の2分後処理は実働、以後は自由休憩でなく待機。保存継続一致');
