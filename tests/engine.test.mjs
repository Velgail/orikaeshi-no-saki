import test from 'node:test';import assert from 'node:assert/strict';
import {createState,start,tick,act,check,serialize,restore,result,LIMIT} from '../engine.js';
const fresh=()=>{const s=createState();start(s);return s;};
const command=(s,id,a,arg)=>assert.equal(act(s,id,a,arg),true,`${id} ${a}: ${s.notice}`);
const wait=(s,id)=>{let n=0;while((s.trains.find(t=>t.id===id).dest!==null||s.trains.find(t=>t.id===id).busy)&&!s.ended){tick(s);assert.ok(n++<121);}};
function invariants(s){assert.equal(new Set(s.trains.map(t=>t.formation)).size,4);assert.equal(s.crews.length,6);assert.ok(s.crews.every(c=>c.duty<=LIMIT));assert.equal(new Set(s.trains.filter(t=>t.edge).map(t=>Math.min(...t.edge))).size,s.trains.filter(t=>t.edge).length);assert.deepEqual(restore(serialize(s)),s);}
function strategy(early){let s=fresh();command(s,'T4','relief');tick(s,2);
 if(early){command(s,'T1','dispatch',{dest:2});command(s,'T4','dispatch',{dest:4});
  for(let id of ['T1','T4']){wait(s,id);command(s,id,'turn');}
  tick(s,3);command(s,'T1','dispatch',{dest:0});command(s,'T4','dispatch',{dest:7});
  for(let id of ['T1','T4']){wait(s,id);command(s,id,'rest');commandMaybeTurnAfterRest(s,id);}
 }
 while(s.time<35)tick(s);
 for(let id of ['T1','T4']){let t=s.trains.find(t=>t.id===id);if(t.busy)wait(s,id);if(t.dir!==(t.at===0?1:-1)){command(s,id,'turn');wait(s,id);}}
 command(s,'T1','dispatch',{dest:7});command(s,'T4','dispatch',{dest:0});
 let prepared=new Set(),rested=new Set();for(let k=0;k<130&&!s.ended;k++){
 tick(s);invariants(s);
 for(let id of ['T1','T4']){let t=s.trains.find(t=>t.id===id);if(t.dest===null&&!t.edge&&!t.busy&&!prepared.has(id)&&!rested.has(id)&&s.stats.fullEast+s.stats.fullWest>=1&&t.duty!==0){command(s,id,'rest');prepared.add(id);rested.add(id);}}
 for(let id of prepared){let t=s.trains.find(t=>t.id===id);if(!t.busy&&!t.edge&&t.dest===null){const dest=t.at===0?7:0;if(t.dir!==Math.sign(dest-t.at))command(s,id,'turn');else {command(s,id,'dispatch',{dest});prepared.delete(id);}}}
 }
 return s;}
function commandMaybeTurnAfterRest(s,id){wait(s,id);command(s,id,'turn');wait(s,id);}
test('通常移動、乗客輸送、編成と乗務員の同位置',()=>{let s=fresh();command(s,'T1','dispatch',{dest:2});tick(s,3);assert.equal(s.trains[0].at,1);assert.equal(s.crews[0].at,1);assert.equal(s.stats.transported,12);wait(s,'T1');assert.equal(s.trains[0].at,2);invariants(s);});
test('閉鎖、片方向再開、全線再開、進入中列車の退出',()=>{let s=fresh();tick(s,5);assert.equal(s.phase,'区間閉鎖');s.trains[0].at=3;s.crews[0].at=3;assert.match(check(s,'T1','dispatch',{dest:4}),/閉鎖/);tick(s,15);assert.equal(check(s,'T1','dispatch',{dest:4}),'');s.trains[0].at=4;s.crews[0].at=4;s.trains[0].dir=-1;assert.match(check(s,'T1','dispatch',{dest:3}),/閉鎖/);tick(s,15);assert.equal(check(s,'T1','dispatch',{dest:3}),'');let q=fresh();q.trains[0].at=3;q.crews[0].at=3;tick(q,4);command(q,'T1','dispatch',{dest:4});tick(q,3);assert.equal(q.trains[0].at,4);});
test('折返し設備と準備時間、連打拒否、リセット独立',()=>{let s=fresh();s.trains[0].at=3;s.crews[0].at=3;assert.match(check(s,'T1','turn'),/出発信号/);s.trains[0].at=2;s.crews[0].at=2;command(s,'T1','turn');assert.equal(act(s,'T1','turn'),false);tick(s,3);assert.equal(s.trains[0].dir,-1);assert.equal(createState().time,0);assert.equal(createState().trains[0].dir,1);});
test('対向占有と番線予約を拒否',()=>{let s=fresh();command(s,'T1','dispatch',{dest:1});s.trains[1].at=1;s.crews[1].at=1;s.trains[1].dir=-1;s.trains[1].platform=2;assert.match(check(s,'T2','dispatch',{dest:0}),/占有/);let q=fresh();q.trains[1].at=1;q.crews[1].at=1;q.trains[2].at=1;q.trains[2].platform=2;q.crews[2].at=1;assert.match(check(q,'T1','dispatch',{dest:1}),/満杯/);});
test('乗務境界36分、休憩と交代、予備投入',()=>{let s=fresh();s.crews[0].duty=32;assert.equal(check(s,'T1','dispatch',{dest:1}),'');s.crews[0].duty=33;assert.match(check(s,'T1','dispatch',{dest:1}),/上限/);command(s,'T1','rest');tick(s,7);assert.equal(s.crews[0].duty,33);tick(s);assert.equal(s.crews[0].duty,0);command(s,'T1','relief');assert.equal(s.trains[0].crew,'C4');assert.equal(s.crews[0].at,0);command(s,'T4','relief');assert.equal(s.trains[3].crew,'C6');invariants(s);});
test('完全保存往復と継続決定性、無効保存の拒否',()=>{let s=fresh();command(s,'T1','transfer');command(s,'T1','dispatch',{dest:2});tick(s);const raw=serialize(s),copy=restore(raw);tick(s,9);tick(copy,9);assert.deepEqual(copy,s);for(const bad of ['x','{}',JSON.stringify({...s,version:99}),JSON.stringify({...s,waiting:[-1]}),JSON.stringify({...s,trains:s.trains.map(t=>({...t,formation:'F1'}))})])assert.throws(()=>restore(bad));});
test('回送同乗・遠隔交代・拠点への乗員回復（終盤の詰み救済）',()=>{let s=fresh();command(s,'T1','transfer');command(s,'T1','dispatch',{dest:2,mode:'回送'});wait(s,'T1');assert.equal(s.stats.transported,0);assert.equal(s.crews[3].at,2);assert.equal(s.crews[3].ride,null);command(s,'T1','relief');tick(s,2);assert.equal(s.crews[0].train,null);command(s,'T1','transfer');command(s,'T1','turn');tick(s,3);command(s,'T1','dispatch',{dest:0,mode:'回送'});wait(s,'T1');assert.equal(s.crews[0].at,0);tick(s,8);assert.equal(s.crews[0].duty,0);invariants(s);});
test('2戦略が実輸送と配置復旧で完走しトレードオフを持つ',()=>{const reserve=strategy(false),local=strategy(true);assert.equal(result(reserve).success,true,serialize(reserve));assert.equal(result(local).success,true,serialize(local));assert.ok(local.stats.transported>reserve.stats.transported);assert.ok(local.recoveryAt>reserve.recoveryAt);console.log('戦略実測',JSON.stringify({reserve:result(reserve),reserveTime:reserve.recoveryAt,local:result(local),localTime:local.recoveryAt}));});
test('操作なしでは勝利せず、時間切れと自動運用抑止',()=>{let s=fresh();tick(s,120);assert.equal(s.ended,true);assert.equal(result(s).success,false);let q=fresh();command(q,'T1','auto');command(q,'T1','dispatch',{dest:2});tick(q,8);command(q,'T1','hold');assert.equal(q.trains[0].auto,false);assert.equal(q.trains[0].dest,null);});
test('決定論的な混合操作2400分で資源・保存・占有の不変条件',()=>{for(let seed=1;seed<=20;seed++){let rng=seed;const rnd=n=>{rng=(Math.imul(rng,1664525)+1013904223)>>>0;return rng%n;};let s=fresh();for(let minute=0;minute<120&&!s.ended;minute++){for(let attempt=0;attempt<4;attempt++){const id=`T${rnd(4)+1}`,a=['dispatch','hold','turn','rest','relief','transfer','alight','auto'][rnd(8)];act(s,id,a,{dest:rnd(8),mode:rnd(2)?'旅客':'回送'});}tick(s);invariants(s);}}});
test('予備への同乗誤操作を拒否し、同乗は駅で降車して回復できる',()=>{let s=fresh();assert.match(check(s,'T4','transfer'),/担当乗務員/);command(s,'T1','transfer');command(s,'T1','alight');assert.equal(s.crews[3].ride,null);assert.equal(s.crews[3].at,0);assert.equal(s.crews[3].rest,8);invariants(s);});
test('番線予約は到着まで保持され、同駅4編成を別番線で描く',async()=>{const {platformUse}=await import('../engine.js');const {mapSVG}=await import('../display.js');let s=fresh();command(s,'T1','dispatch',{dest:2});assert.equal(s.trains[0].reserved,1);tick(s,4);assert.equal(s.trains[0].reserved,4);assert.deepEqual(platformUse(s,2).map(x=>x.platform),[4,1]);tick(s,3);assert.equal(s.trains[0].platform,4);invariants(s);let q=createState();q.trains.forEach((t,i)=>{t.at=2;t.platform=i+1;});const svg=mapSVG(q);for(let i=0;i<4;i++)assert.ok(svg.includes(`y="${90+i*48-10}"`));assert.ok(svg.includes('予備：駅番線'));});
test('列車ダイヤの競合遅れ・抑止運休・自動運用・保存',async()=>{const {serviceDelay}=await import('../engine.js');const {timetableHTML}=await import('../display.js');let s=fresh();command(s,'T1','dispatch',{dest:2});tick(s,2);s.trains[1].dir=-1;command(s,'T2','dispatch',{dest:1});tick(s,7);const r=s.timetable[0];assert.equal(r.stops[1].planned,7);assert.equal(r.stops[1].actual,9);assert.equal(r.status,'完了');assert.equal(serviceDelay(s,r),2);assert.ok(timetableHTML(s).includes('2分遅れ'));invariants(s);command(s,'T2','dispatch',{dest:0});tick(s,3);assert.equal(s.timetable.at(-1).status,'完了');let q=fresh();command(q,'T1','auto');command(q,'T1','dispatch',{dest:2});tick(q,7);assert.equal(q.timetable.length,2);command(q,'T1','hold');assert.equal(q.timetable[1].status,'運休');invariants(q);const bad=JSON.parse(serialize(s));bad.timetable[0].stops[0].planned=999;assert.throws(()=>restore(JSON.stringify(bad)));});

test('再現回帰：自動ONで桜町行きを事前拒否し、OFFの片道到着は向きを保持',()=>{
 const s=fresh();command(s,'T1','auto');assert.match(check(s,'T1','dispatch',{dest:1}),/出発信号/);
 assert.equal(act(s,'T1','dispatch',{dest:1,mode:'旅客'}),false);assert.equal(s.trains[0].dest,null);
 command(s,'T1','auto');command(s,'T1','dispatch',{dest:1});tick(s,6);
 assert.equal(s.trains[0].dir,1);assert.equal(s.trains[0].edge,null);assert.equal(s.trains[0].dest,null);
 invariants(s);assert.match(check(s,'T1','auto'),/出発信号/);
 const bad=restore(serialize(s));bad.trains[0].dir=-1;bad.trains[0].dest=0;bad.trains[0].busy=3;
 assert.throws(()=>restore(serialize(bad)));bad.trains[0].dest=null;assert.throws(()=>restore(serialize(bad)));
});
test('全折り返し不可駅で手動・自動・運用変更・ロード後の反転を拒否し前進で回復',()=>{
 for(const dest of [1,3,5]){
  const s=fresh();tick(s,35);command(s,'T1','auto');assert.equal(act(s,'T1','dispatch',{dest,mode:'回送'}),false);
  command(s,'T1','auto');command(s,'T1','dispatch',{dest,mode:'回送'});wait(s,'T1');
  const q=restore(serialize(s));for(const state of [s,q]){
   assert.equal(act(state,'T1','turn'),false);assert.equal(act(state,'T1','auto'),false);
   assert.match(check(state,'T1','dispatch',{dest:0}),/方向/);
   command(state,'T1','hold');command(state,'T1','dispatch',{dest:dest+1,mode:'旅客'});wait(state,'T1');invariants(state);
  }assert.deepEqual(q,s);
 }
});
test('全合法折り返し駅で自動反転3分と保存継続、ON/OFFの途中変更',()=>{
 for(const dest of [0,2,4,6,7]){
  const s=fresh();tick(s,35);const id=dest===0?'T3':'T1';command(s,id,'auto');command(s,id,'dispatch',{dest});
  const t=s.trains.find(t=>t.id===id),direction=t.dir;
  while(t.edge||t.at!==dest){tick(s);invariants(s);}
  assert.equal(t.dir,-direction);assert.equal(t.busy,3);assert.notEqual(t.dest,null);
  const q=restore(serialize(s));tick(s,3);tick(q,3);assert.deepEqual(q,s);invariants(s);
 }
 const s=fresh();command(s,'T1','dispatch',{dest:2});tick(s,3);
 command(s,'T1','auto');const q=restore(serialize(s));tick(s,4);tick(q,4);assert.deepEqual(q,s);assert.equal(s.trains[0].dir,-1);
 command(s,'T1','auto');command(s,'T1','hold');tick(s,3);command(s,'T1','dispatch',{dest:1});tick(s,3);
 assert.equal(act(s,'T1','auto'),false);tick(s);assert.equal(s.trains[0].dir,-1);invariants(s);
});
test('保存の逆向き区間・非合法自動運用・不正起点の次運用を拒否',()=>{
 const s=fresh();command(s,'T1','dispatch',{dest:2});tick(s,3);
 const bad=restore(serialize(s));bad.trains[0].auto=true;bad.trains[0].dest=1;assert.throws(()=>restore(serialize(bad)));
 const q=fresh();command(q,'T1','dispatch',{dest:1});tick(q,4);command(q,'T1','dispatch',{dest:2});
 const wrong=restore(serialize(q));wrong.trains[0].edge=[1,0];wrong.trains[0].reserved=2;wrong.formations[0].edge=[1,0];assert.throws(()=>restore(serialize(wrong)));
 const origin=restore(serialize(q));origin.timetable.at(-1).dest=0;origin.timetable.at(-1).stops=[{at:0,planned:7,actual:null}];assert.throws(()=>restore(serialize(origin)));
});
test('西向きの全不可駅と、不可駅起点の運用変更後も自動ONを拒否',()=>{
 for(const dest of [1,3,5]){
  const s=fresh();tick(s,35);command(s,'T3','dispatch',{dest});wait(s,'T3');
  assert.equal(s.trains[2].dir,-1);assert.equal(act(s,'T3','turn'),false);invariants(s);
  command(s,'T3','dispatch',{dest:dest-1,mode:'回送'});tick(s,3);
  // 片道運用終了後は合法駅を起点とした新しい自動往復を設定できる。
  if(s.trains[2].busy)tick(s);assert.equal(act(s,'T3','auto'),true);invariants(s);
  const q=restore(serialize(s));tick(s,3);tick(q,3);assert.deepEqual(q,s);
 }
 const s=fresh();command(s,'T1','dispatch',{dest:1});tick(s,4);
 tick(s,31);command(s,'T1','dispatch',{dest:4});tick(s,3);assert.equal(act(s,'T1','auto'),false);invariants(s);
});
test('保存の運用起点・行先・種別・サービス矛盾を拒否',()=>{
 const s=fresh();command(s,'T1','auto');command(s,'T1','dispatch',{dest:2});
 for(const patch of [{origin:4},{dest:4},{mode:'回送'},{service:'S999'}]){
  const bad=restore(serialize(s));Object.assign(bad.trains[0],patch);assert.throws(()=>restore(serialize(bad)));
 }
 const q=restore(serialize(s));tick(s,10);tick(q,10);assert.deepEqual(q,s);invariants(s);
});
