import test from 'node:test';import assert from 'node:assert/strict';
import {equipment,route,validRoute,canReverse,buildEquipment} from '../equipment.js';
import {createState,start,act,check,tick,restore,serialize,arrivalPlatform} from '../engine.js';
import {mapSVG,routeAvailability} from '../display.js';
const fresh=()=>{const s=createState();start(s);return s;};
test('全番線・全方向の明示経路、信号、ポイント通過が一致',()=>{
 for(const e of equipment){for(const r of e.routes)assert.ok(validRoute(e,r),r.id);for(const p of e.platforms)for(const d of [-1,1]){
 const s=fresh(),t=s.trains[0];Object.assign(t,{at:e.at,platform:p.number,dir:-d});s.crews[0].at=e.at;
 assert.equal(check(s,'T1','turn')==='',!!route(e.at,p.number,'departure',d),`${e.name}${p.number}/${d}`);
 assert.equal(canReverse(t),!!route(e.at,p.number,'departure',d));
 }const svg=mapSVG(fresh());for(const signal of e.signals.filter(s=>s.id.includes(':out:')))assert.ok(svg.includes(`data-signal="${signal.id}"`));for(const seg of e.segments)assert.ok(svg.includes(`data-segment="${seg.id}"`));}
});
test('同駅方向別番線と両方向番線、終端は到着向きの逆へ出発',()=>{
 const s=fresh(),t=s.trains[1];t.platform=2;assert.equal(canReverse(t),false);t.platform=1;assert.equal(canReverse(t),true);
 for(const [at,dir] of [[0,-1],[7,1]])assert.equal(canReverse({at,platform:1,dir}),true);
});
test('設備変更だけで折返判定・信号描画・説明が変わる／信号だけは無効',()=>{
 const original=buildEquipment();try{
 const c=equipment[2];c.routes=c.routes.filter(r=>r.id!=='2:1:out:-1');const s=fresh();assert.equal(canReverse(s.trains[1]),false);assert.match(check(s,'T2','turn'),/西向き出発信号/);assert.equal(mapSVG(s).includes('data-signal="2:1:out:-1"'),false);
 const b=equipment[1],template=b.routes.find(r=>r.id==='1:1:in:-1');const r={...structuredClone(template),kind:'departure',dir:-1,id:'1:1:out:-1',path:template.path.slice().reverse(),signalID:'1:1:out:-1'};
 b.signals.push({id:r.signalID,at:1,platform:1,dir:-1,segment:'1:track1'});assert.equal(canReverse({at:1,platform:1,dir:1}),false);b.routes.push(r);assert.equal(canReverse({at:1,platform:1,dir:1}),true);
 const invalid=structuredClone(r);invalid.path=['1:-1:branch2','1:-1:stem1','1:track1'];assert.equal(validRoute(b,invalid),false);
 }finally{equipment.splice(0,equipment.length,...original);}
});
test('方向対応着番線・自動折返予約・ロードの進路改ざん拒否',()=>{
 const s=fresh();act(s,'T1','auto');assert.equal(act(s,'T1','dispatch',{dest:1}),false);act(s,'T1','auto');assert.equal(act(s,'T1','dispatch',{dest:2}),true);tick(s,4);assert.equal(s.trains[0].reserved,4);assert.ok(route(2,4,'arrival',1));assert.ok(route(2,4,'departure',-1));
 const q=restore(serialize(s));q.trains[0].arrivalRoute='2:3:in:1';assert.throws(()=>restore(serialize(q)));q.trains[0].reserved=3;assert.throws(()=>restore(serialize(q)));
 const r=fresh();r.trains[1].at=1;r.trains[1].platform=1;r.trains[2].at=1;r.trains[2].platform=2;assert.equal(arrivalPlatform(r,{...r.trains[0],dest:2},1,1),null);
});
test('走行列車は駅間単線の中心上・図は出発進路のある信号だけ描く',()=>{const s=fresh();act(s,'T1','dispatch',{dest:2});for(let i=0;i<3;i++){const svg=mapSVG(s);assert.match(svg,/<g data-train="T1"[^]*?y="80"/);assert.equal(svg.includes('data-signal="1:1:out:-1"'),false);tick(s);}assert.equal(s.trains[0].platform,1);});

test('経路可用性は対応番線満杯の共通判定を反映、復元は着番線改ざんを拒否',()=>{
 const s=fresh();Object.assign(s.trains[1],{at:1,platform:1});Object.assign(s.trains[2],{at:1,platform:2});assert.match(check(s,'T1','dispatch',{dest:2}),/対応番線/);assert.equal(routeAvailability(s,0,1,1).status,'設定不可');assert.match(routeAvailability(s,0,1,1).reason,/桜町/);
 const q=fresh();act(q,'T1','dispatch',{dest:1});tick(q,4);q.trains[0].platform=2;q.trains[0].dir=-1;assert.throws(()=>restore(serialize(q)));
});

test('信号設備は初期・未設定・鎖錠・競合で中立、可用性を別に表示',()=>{
 const s=fresh();const symbol=q=>mapSVG(q).match(/<g data-signal="0:1:out:1">[^]*?<\/g>/)[0];
 const initial=symbol(s);assert.match(initial,/実現示は表示しません/);assert.match(initial,/fill="none"/);assert.doesNotMatch(initial,/<circle|#86c7b5|#f48080|設定可能/);
 assert.equal(routeAvailability(s,0,1,1).status,'設定可能');assert.match(mapSVG(s),/信号現示ではありません/);
 assert.equal(routeAvailability(s,1,1,-1).status,'経路なし');
 act(s,'T1','dispatch',{dest:2});assert.equal(routeAvailability(s,0,1,1).status,'進路鎖錠中');assert.equal(symbol(s),initial);
 assert.equal(routeAvailability(s,1,2,-1).status,'進路鎖錠中');
 const q=fresh();q.trains[2].edge=[1,0];q.trains[2].departureRoute=null;q.trains[2].arrivalRoute=null;
 assert.equal(routeAvailability(q,0,1,1).status,'閉塞待ち');assert.equal(symbol(q),initial);
 tick(s,3);assert.equal(routeAvailability(s,0,1,1).status,'設定不可');assert.match(routeAvailability(s,0,1,1).reason,/対応番線/);assert.equal(symbol(s),initial);
});
