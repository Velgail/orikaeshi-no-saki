import assert from 'node:assert/strict';
import {createState,start,tick,act,serialize,restore,validate,result,END} from '../engine.js';
import {strategy} from '../tests/strategies.mjs';
let accepted=0,refused=0;
for(const mode of ['normal','incident'])for(const time of [0,5,7,10,20,36,40,65,72,100]){
 const base=createState({mode});start(base);tick(base,time);
 for(const t of base.trains)for(const r of base.timetable.filter(r=>r.departure<=time+72))for(const action of ['hold','resume','cancel','restorePlan','shorten','assign'])for(const dest of action==='shorten'?[2,4,6,7]:[2]){
  const s=restore(serialize(base));
  if(act(s,t.id,action,{service:r.id,dest,crew:'C3'})){accepted++;validate(s);tick(s);validate(s);}else refused++;
 }
}
console.log('選択編成×対象便×差分指令：受理',accepted,'拒否',refused,'受理直後・1分後validate成功');
for(const policy of ['local','wait-rescue','wait-only']){
 const s=strategy(policy);assert.equal(s.time,END);console.log(policy,JSON.stringify({...result(s),recovery:s.recoveryAt}));
}
const s=createState({mode:'normal'});start(s);tick(s,END);assert.deepEqual(s.violations,[]);console.log('正常無操作固定288分：違反0、所定完了',s.actual.filter(a=>a.status==='完了').length);
const q=createState({mode:'normal'});start(q);
assert.ok(act(q,'T1','cancel',{service:'A000'}));
assert.ok(act(q,'T3','dispatch',{dest:2}));assert.ok(act(q,'T4','dispatch',{dest:2}));
tick(q,6);assert.ok(act(q,'T1','dispatch',{dest:7}));const extra=q.timetable.at(-1).id;
assert.ok(act(q,'T1','hold',{service:extra}));tick(q,18);assert.ok(act(q,'T1','resume',{service:extra}));tick(q,4);
assert.equal(q.trains[0].at,2);assert.equal(q.trains[0].platform,2);
assert.equal(act(q,'T1','shorten',{service:extra,dest:2}),false);
validate(q);console.log('公開APIで学園前1/4番線占有→2番線東着：現在番線に逆進路のない短縮を拒否');
const z=createState({mode:'normal'});start(z);tick(z,27);const c=z.crews[0],work=c.todayWork,breaks=c.breakMinutesActual;
assert.equal(c.releaseAt,29);assert.equal(c.availableAt,59);assert.equal(c.pendingBreak,30);assert.equal(c.rest,0);
assert.equal(act(z,'T3','transfer',{crew:'C1'}),false);
tick(z,2);assert.equal(c.todayWork,work+2);assert.equal(c.breakMinutesActual,breaks);assert.equal(c.rest,0);
const saved=restore(serialize(z));tick(z);tick(saved);assert.deepEqual(saved,z);assert.equal(c.breakMinutesActual,breaks+1);assert.equal(c.rest,29);
console.log('終着27分→後処理28/29分は実働、30分から自由休憩、後処理中配置拒否・保存継続一致');
assert.ok(act(q,'T1','hold',{service:extra}));tick(q);const oldID=q.trains[0].crew;
assert.equal(q.time,29);assert.equal(q.trains[0].at,2);
const remote=q.crews.find(c=>c.id==='C2'),replacement=q.crews.find(c=>c.id==='C4');
assert.notEqual(remote.at,2);assert.equal(replacement.at,2);
const beforeRefusal=serialize(q);
assert.equal(act(q,'T1','relief',{crew:'C2'}),false);
assert.match(q.notice,/この駅.*指定交代員/);
const refusedState=restore(serialize(q)),before=restore(beforeRefusal);refusedState.notice=before.notice;assert.deepEqual(refusedState,before);
assert.ok(act(q,'T1','relief',{crew:'C4'}));assert.equal(q.trains[0].crew,'C4');assert.equal(replacement.train,'T1');
const old=q.crews.find(c=>c.id===oldID),oldWork=old.todayWork,oldBreak=old.breakMinutesActual;
assert.equal(old.train,null);assert.equal(old.at,2);assert.equal(old.locationState,'preparation');
assert.equal(old.releaseAt,q.time+2);assert.equal(old.availableAt,q.time+2);assert.equal(old.rest,0);assert.equal(old.pendingBreak,0);validate(q);
const reliefSaved=restore(serialize(q));tick(q,2);tick(reliefSaved,2);assert.deepEqual(reliefSaved,q);validate(q);
assert.equal(old.todayWork,oldWork+2);assert.equal(old.breakMinutesActual,oldBreak);assert.equal(old.at,2);assert.equal(old.rest,0);assert.ok(old.dutySegments.filter(x=>x.end>29&&x.start<31).every(x=>x.work&&x.kind==='preparation'));assert.match(q.history.at(-1).msg,/現地乗務交代/);tick(q);tick(reliefSaved);assert.deepEqual(reliefSaved,q);assert.equal(old.todayWork,oldWork+3);assert.equal(old.breakMinutesActual,oldBreak);assert.equal(old.dutySegments.at(-1).kind,'standby');assert.equal(old.rest,0);validate(q);
console.log('29分学園前：遠隔C2拒否で台帳不変、現地C4交代・保存継続一致。現地交代の旧乗員も後処理2分を実働計上、学園前では自由休憩にせず待機、履歴は日本語');
