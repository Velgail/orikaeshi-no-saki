import test from 'node:test';import assert from 'node:assert/strict';
import {equipment,route,validRoute,canReverse,buildEquipment} from '../equipment.js';
import {createState,start,act,check,tick,restore,serialize,arrivalPlatform} from '../engine.js';
import {mapSVG,routeAvailability} from '../display.js';
const fresh=()=>{const s=createState();start(s);return s;};
test('全番線・全方向の明示経路、信号、ポイント通過が一致',()=>{
 for(const e of equipment){for(const r of e.routes)assert.ok(validRoute(e,r),r.id);for(const p of e.platforms)for(const d of [-1,1]){
 const s=createState();start(s);const t=s.trains[3];Object.assign(t,{at:e.at,platform:p.number,dir:-d});s.crews[0].at=e.at;
 assert.equal(check(s,'T4','turn')==='',!!route(e.at,p.number,'departure',d),`${e.name}${p.number}/${d}`);
 assert.equal(canReverse(t),!!route(e.at,p.number,'departure',d));
 }const svg=mapSVG(fresh());for(const signal of e.signals.filter(s=>s.id.includes(':out:')))assert.ok(svg.includes(`data-signal="${signal.id}"`));for(const seg of e.segments)assert.ok(svg.includes(`data-segment="${seg.id}"`));}
});
test('同駅方向別番線と両方向番線、終端は到着向きの逆へ出発',()=>{
 const s=fresh(),t=s.trains[3];t.at=2;t.dir=1;t.platform=2;assert.equal(canReverse(t),false);t.platform=1;assert.equal(canReverse(t),true);
 for(const [at,dir] of [[0,-1],[7,1]])assert.equal(canReverse({at,platform:1,dir}),true);
});
test('設備変更だけで折返判定・信号描画・説明が変わる／信号だけは無効',()=>{
 const original=buildEquipment();try{
 const c=equipment[2];c.routes=c.routes.filter(r=>r.id!=='2:1:out:-1');const s=fresh();s.trains[3].at=2;s.trains[3].platform=1;s.trains[3].dir=1;assert.equal(canReverse(s.trains[3]),false);assert.match(check(s,'T4','turn'),/西向き出発信号/);assert.equal(mapSVG(s).includes('data-signal="2:1:out:-1"'),false);
 const b=equipment[1],template=b.routes.find(r=>r.id==='1:1:in:-1');const r={...structuredClone(template),kind:'departure',dir:-1,id:'1:1:out:-1',path:template.path.slice().reverse(),signalID:'1:1:out:-1'};
 b.signals.push({id:r.signalID,at:1,platform:1,dir:-1,segment:'1:track1'});assert.equal(canReverse({at:1,platform:1,dir:1}),false);b.routes.push(r);assert.equal(canReverse({at:1,platform:1,dir:1}),true);
 const invalid=structuredClone(r);invalid.path=['1:-1:branch2','1:-1:stem1','1:track1'];assert.equal(validRoute(b,invalid),false);
 }finally{equipment.splice(0,equipment.length,...original);}
});
test('モデル線分と中立信号設備の描画、発車後の鎖錠は可用性だけで表す',()=>{const s=createState({mode:'normal'});const initial=mapSVG(s);const symbol=svg=>svg.match(/<g data-signal="0:1:out:1">[^]*?<\/g>/)[0];assert.match(symbol(initial),/fill="none"/);assert.doesNotMatch(symbol(initial),/<circle|設定可能/);assert.equal(routeAvailability(s,0,1,1).status,'設定可能');start(s);assert.equal(routeAvailability(s,0,1,1).status,'進路鎖錠中');assert.equal(symbol(mapSVG(s)),symbol(initial));for(let i=0;i<3;i++){assert.match(mapSVG(s),/<g data-train="T1"[^]*?y="80"/);tick(s);}assert.equal(s.trains[0].platform,1);assert.equal(mapSVG(s).includes('data-signal="1:1:out:-1"'),false);assert.equal(routeAvailability(s,1,1,-1).status,'経路なし');});
