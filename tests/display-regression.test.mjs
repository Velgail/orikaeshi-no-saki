import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {createState,start,tick,act,morningSeed} from '../engine.js';
import {depotThroatStatus,depotHTML,serviceConstraint,focusTrain,trainPoint,mapSVG} from '../display.js';
import {equipment} from '../equipment.js';
test('車庫表は出発・到着・出入庫の実鎖錠と一致する',()=>{
 const s=createState({mode:'normal'});start(s);const seen=new Set();
 for(let n=0;n<432;n++){
 const active=s.trains.flatMap(t=>t.edge?[t.departureRoute,t.arrivalRoute]:[]).map(id=>equipment.flatMap(e=>e.routes).find(r=>r.id===id)).filter(r=>r.locks.includes(s.depot.lock));
 for(const r of active)seen.add(r.kind);
 const locked=active.length>0||s.trains.some(t=>t.depotMove?.route.locks.includes(s.depot.lock));
 assert.equal(depotThroatStatus(s),locked?'森ヶ丘西喉部使用中':'経路未設定');assert.ok(depotHTML(s).includes(depotThroatStatus(s)));tick(s);
 }
 assert.ok(seen.has('arrival'));assert.ok(seen.has('departure'));
 const q=createState({mode:'normal'});start(q);assert.ok(act(q,'T4','prepare',{crew:'C8'}));tick(q,5);assert.ok(act(q,'T4','depotOut',{crew:'C8'}));assert.match(depotThroatStatus(q),/使用中/);tick(q,6);assert.ok(act(q,'T4','depotIn',{crew:'C8'}));assert.match(depotThroatStatus(q),/使用中/);
});
test('点呼開始ログは勤務区間開始04:10と一致、実績を動かさない',()=>{
 const s=createState();for(const c of s.crews.filter(c=>c.dutyStart<0)){const h=s.morning.history.find(h=>h.msg.startsWith(c.id+' ')&&h.msg.includes('点呼開始'));assert.equal(h.time,c.dutyStart);assert.equal(c.dutySegments[0]?.start??c.initialSegments[0]?.start,c.dutyStart);}
});
test('便の制約表示は未計算・予測・運行中・確定実績を区別する',()=>{
 assert.match(serviceConstraint({started:false},{status:'未発車'},null),/未計算/);
 assert.equal(serviceConstraint({started:true},{status:'未発車'},{reason:'接続成立見込'}),'接続成立見込');
 assert.match(serviceConstraint({started:true},{status:'未発車'},null),/予測未定/);
 assert.match(serviceConstraint({started:true},{status:'運行中'},null),/運行中/);
 for(const status of ['完了','短縮完了','運休'])assert.match(serviceConstraint({started:true},{status},null),/確定済み/);
});
test('図で探すはページと内部の縦横を実座標へ移動、F4と両端・走行・出庫を含む',()=>{
 const s=createState({mode:'normal'});start(s);let calls=0;const map={clientWidth:760,clientHeight:380,scrollIntoView(o){assert.equal(o.block,'center');calls++;}};
 const verify=t=>{focusTrain(map,t);const [x,y]=trainPoint(t);assert.ok(x>=map.scrollLeft&&x<=map.scrollLeft+map.clientWidth);assert.ok(y>=map.scrollTop&&y<=map.scrollTop+map.clientHeight);};
 s.trains.forEach(verify);assert.ok(map.scrollTop>0);for(let n=0;n<36;n++){s.trains.forEach(verify);tick(s);}const q=morningSeed();start(q);for(let n=0;n<45;n++){q.trains.forEach(verify);tick(q);}assert.ok(calls>100);
});
test('操作本文と実行フッターは別領域、車庫見出しと駅待ち表示は離す',()=>{
 const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8'),css=fs.readFileSync(new URL('../style.css',import.meta.url),'utf8');assert.match(html,/id="actions"><\/div><\/div><div id="actionExecute" class="decision-footer">/);assert.match(css,/\.decision-body\{[^}]*overflow-y:auto/);assert.match(css,/\.decision-footer\{flex:none/);assert.doesNotMatch(css,/#actions button\{position:fixed/);
 const svg=mapSVG(createState());assert.match(svg,/y="275"[^>]*>待ち/);assert.match(svg,/y="310"[^>]*>森ヶ丘車庫/);assert.ok(svg.includes('留置4'));
});
