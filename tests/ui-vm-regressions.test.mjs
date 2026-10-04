// 実appのイベントをDOMスタブで検査する。実ブラウザーの描画・操作性の評価ではない。
// select.value は未登録optionを受理しないブラウザーの挙動を再現する。
import test from 'node:test';
import assert from 'node:assert/strict';
import {createState,start,tick} from '../engine.js';
import {crewCandidates} from '../guidance.js';

import {Element,app,pickService,choosePrepare,comparison,explanation,crewIDs,chooseCrew} from './ui-dom-harness.mjs';
import {choosePerson} from './ui-guided-commands.mjs';

test('DOMスタブのselectは存在しないoptionへのvalue設定を空にする',()=>{const node=new Element(true);node.innerHTML='<option value="A000">A000</option>';node.value='D028';assert.equal(node.value,'');node.value='A000';assert.equal(node.value,'A000');});

test('08:00 T1から所定・変更・実績表D028を選ぶとT3とD028が自動連携する',async()=>{
 const ui=await app();try{ui.get('start').onclick();assert.equal(ui.get('trainSelect').value,'T1');assert.ok(!ui.get('serviceSelect').options.includes('D028'));pickService(ui,'timetable','D028');assert.equal(ui.get('trainSelect').value,'T3');assert.equal(ui.get('serviceSelect').value,'D028');assert.match(ui.get('timetable').innerHTML,/<tr class="selected"><td><button data-pick="T3" data-pickservice="D028"/);assert.match(ui.get('context').textContent,/走行中/);}finally{ui.cleanup();}
});

test('別運用便・乗務員勤務子表の便切替も対象便を保持し担当者子表を開く',async()=>{
 const ui=await app();try{ui.normal();for(const [id,train] of [['B068','T2'],['D028','T3'],['A060','T1']]){pickService(ui,'timetable',id);assert.equal(ui.get('trainSelect').value,train);assert.equal(ui.get('serviceSelect').value,id);}
  const s=createState({mode:'normal'}),row=s.timetable.find(row=>row.id==='D028');const detail=ui.get('crews').querySelectorAll('details').find(node=>node.dataset.crew===row.crew);assert.ok(detail);detail.open=true;pickService(ui,'crews','D028');assert.equal(ui.get('trainSelect').value,'T3');assert.equal(ui.get('serviceSelect').value,'D028');assert.equal(ui.get('crews').querySelectorAll('details').find(node=>node.dataset.crew===row.crew).open,true);
  const c1=ui.get('crews').querySelectorAll('[data-pickcrew]').find(node=>node.dataset.pickcrew==='C1');c1.onclick();assert.equal(ui.get('crewSelect').value,'C1');assert.equal(ui.get('crews').querySelectorAll('details').find(node=>node.dataset.crew==='C1').open,true);
 }finally{ui.cleanup();}
});

test('1分送り後も担当比較・詳細の開閉と選んだ担当C8入力を保持する',async()=>{
 const ui=await app();try{ui.normal();ui.select('T4');choosePrepare(ui);comparison(ui).open=true;explanation(ui).open=true;chooseCrew(ui,'C8');assert.equal(comparison(ui).open,true,'候補変更時に比較表を保持');assert.equal(explanation(ui).open,true,'候補変更時に所要詳細を保持');ui.get('actions').scrollTop=71;ui.step();assert.equal(ui.get('clock').textContent,'08:01');assert.equal(comparison(ui).open,true);assert.equal(explanation(ui).open,true);assert.equal(ui.get('actions').scrollTop,71);assert.match(ui.get('actions').innerHTML,/担当 C8/);assert.equal(ui.get('actionExecute').querySelectorAll('[data-action]')[0].disabled,false);}finally{ui.cleanup();}
});

test('時間進行で08:15休憩終了C9が担当候補に加わり比較と選択C8を保持する',async()=>{
 const ui=await app();try{ui.normal();ui.step(14);ui.select('T4');choosePrepare(ui);chooseCrew(ui,'C8');comparison(ui).open=true;assert.ok(!crewIDs(ui).includes('C9'));ui.speeds.find(node=>node.dataset.speed==='60').onclick();ui.frame(performance.now()+1100);assert.equal(ui.get('clock').textContent,'08:15');const expected=createState({mode:'normal'});start(expected);tick(expected,15);assert.deepEqual(crewIDs(ui),crewCandidates(expected,'T4','prepare').map(node=>node.id));assert.ok(crewIDs(ui).includes('C9'));assert.equal(comparison(ui).open,true);assert.match(ui.get('actions').innerHTML,/担当 C8/);}finally{ui.cleanup();}
});

test('08:24所定乗務に就いたC3は候補から除外し古い担当入力は理由付き実行不可になる',async()=>{
 const ui=await app();try{ui.normal();ui.step(23);ui.select('T4');choosePrepare(ui);chooseCrew(ui,'C3');comparison(ui).open=true;ui.step();assert.equal(ui.get('clock').textContent,'08:24');const expected=createState({mode:'normal'});start(expected);tick(expected,24);assert.deepEqual(crewIDs(ui),crewCandidates(expected,'T4','prepare').map(node=>node.id));assert.ok(!crewIDs(ui).includes('C3'));assert.equal(comparison(ui).open,true);assert.match(ui.get('actions').innerHTML,/担当 C3/);assert.match(ui.get('actions').innerHTML,/不可：/);const oldExecute=ui.get('actionExecute').querySelectorAll('[data-action]')[0];assert.equal(oldExecute.disabled,true);oldExecute.onclick();assert.doesNotMatch(ui.get('history').innerHTML,/T4\/F4 車庫車両準備/);chooseCrew(ui,'C8');assert.equal(ui.get('actionExecute').querySelectorAll('[data-action]')[0].disabled,false);assert.match(ui.get('actions').innerHTML,/担当 C8/);}finally{ui.cleanup();}
});

test('比較から便乗担当C1をC4へ変更すると最終確定表示と実行記録もC4になる',async()=>{
 const ui=await app();try{ui.normal();ui.step(18);ui.select('T2');const group=ui.get('goals').querySelectorAll('[data-group]').find(node=>node.textContent==='乗務員の配置・休憩を判断する');assert.ok(group);group.onclick();choosePerson(ui,'C1');const goal=ui.get('goals').querySelectorAll('[data-goal]').find(node=>node.textContent.includes('青木 C1')&&node.textContent.includes('便乗配置する'));assert.ok(goal);goal.onclick();comparison(ui).open=true;chooseCrew(ui,'C4');const execute=ui.get('actionExecute').querySelectorAll('[data-action]')[0];assert.match(execute.textContent,/加藤 C4/);assert.doesNotMatch(execute.textContent,/青木 C1/);assert.match(ui.get('actions').innerHTML,/担当 C4/);execute.onclick();assert.match(ui.get('history').innerHTML,/T2\/F2 便乗配置[^<]* C4/);}finally{ui.cleanup();}
});

test('同運用のA024からA060へ便を切り替えると旧draftと古い確定イベントを破棄する',async()=>{
 const ui=await app();try{ui.normal();pickService(ui,'timetable','A024');const group=ui.get('goals').querySelectorAll('[data-group]').find(node=>node.textContent==='この便を折返す');assert.ok(group);group.onclick();const goal=ui.get('goals').querySelectorAll('[data-goal]')[0];assert.ok(goal);goal.onclick();const oldExecute=ui.get('actionExecute').querySelectorAll('[data-action]')[0];assert.ok(oldExecute);pickService(ui,'timetable','A060');assert.equal(ui.get('trainSelect').value,'T1');assert.equal(ui.get('serviceSelect').value,'A060');assert.equal(ui.get('actionExecute').querySelectorAll('[data-action]').length,0);const before=ui.get('history').innerHTML;oldExecute.onclick();assert.equal(ui.get('history').innerHTML,before);}finally{ui.cleanup();}
});

test('D028を保存し別運用へ切り替えて復元するとT3とD028を保持し古い入力を残さない',async()=>{
 const ui=await app();try{ui.normal();pickService(ui,'timetable','D028');ui.get('save').onclick();pickService(ui,'timetable','B068');assert.equal(ui.get('trainSelect').value,'T2');ui.get('load').onclick();assert.equal(ui.get('trainSelect').value,'T3');assert.equal(ui.get('serviceSelect').value,'D028');assert.equal(ui.get('actionExecute').querySelectorAll('[data-action]').length,0);assert.match(ui.get('speedNote').textContent,/停止/);}finally{ui.cleanup();}
});

test('高度手動の担当C3が時間進行で失効しても入力を保持し自動選定へ置き換えない',async()=>{
 const ui=await app();try{ui.normal();ui.step(23);ui.select('T4');ui.get('manual').open=true;ui.get('manual').ontoggle();ui.get('actionSelect').value='prepare';ui.get('actionSelect').onchange();ui.get('crewSelect').value='C3';ui.get('crewSelect').onchange();assert.equal(ui.get('crewSelect').value,'C3');assert.equal(ui.get('actionExecute').querySelectorAll('[data-action]')[0].disabled,false);ui.step();assert.equal(ui.get('clock').textContent,'08:24');assert.equal(ui.get('crewSelect').value,'C3');assert.match(ui.get('crewSelect').innerHTML,/<option(?=[^>]*value="C3")(?=[^>]*\bdisabled\b)[^>]*>/);assert.equal(ui.get('actionExecute').querySelectorAll('[data-action]')[0].disabled,true);assert.match(ui.get('actions').innerHTML,/不可：/);ui.get('save').onclick();assert.equal(ui.get('crewSelect').value,'C3');const invalid=ui.get('actionExecute').querySelectorAll('[data-action]')[0];assert.equal(invalid.disabled,true);invalid.onclick();assert.doesNotMatch(ui.get('history').innerHTML,/T4\/F4 車庫車両準備/);ui.get('crewSelect').value='C8';ui.get('crewSelect').onchange();assert.equal(ui.get('actionExecute').querySelectorAll('[data-action]')[0].disabled,false);}finally{ui.cleanup();}
});

test('高度手動の取消・同運用便切替・復元・再プレイは古い指令を破棄し保存だけは保持する',async()=>{
 const ui=await app();try{ui.normal();
  const manual=(action,crew)=>{ui.get('manual').open=true;ui.get('manual').ontoggle();ui.get('actionSelect').value=action;ui.get('actionSelect').onchange();if(crew){ui.get('crewSelect').value=crew;ui.get('crewSelect').onchange();}return ui.get('actionExecute').querySelectorAll('[data-action]')[0];};
  const cleared=()=>{assert.equal(ui.get('manual').open,false);assert.equal(ui.get('actionSelect').value,'');assert.equal(ui.get('actionExecute').querySelectorAll('[data-action]').length,0);};
  ui.select('T4');const canceled=manual('prepare','C8');assert.equal(canceled.disabled,false);ui.get('cancelDraft').onclick();cleared();const history=ui.get('history').innerHTML;canceled.onclick();assert.equal(ui.get('history').innerHTML,history);ui.get('manual').open=true;ui.get('manual').ontoggle();assert.equal(ui.get('actionSelect').value,'');assert.equal(ui.get('actionExecute').querySelectorAll('[data-action]').length,0);
  pickService(ui,'timetable','A024');const switched=manual('hold');assert.equal(switched.disabled,false);pickService(ui,'timetable','A060');cleared();const beforeSwitch=ui.get('history').innerHTML;switched.onclick();assert.equal(ui.get('history').innerHTML,beforeSwitch);assert.equal(ui.get('serviceSelect').value,'A060');
  ui.select('T4');const restored=manual('prepare','C8');ui.get('save').onclick();assert.equal(ui.get('manual').open,true);assert.equal(ui.get('actionSelect').value,'prepare');assert.equal(ui.get('crewSelect').value,'C8');assert.equal(ui.get('actionExecute').querySelectorAll('[data-action]').length,1);ui.get('load').onclick();cleared();const beforeLoad=ui.get('history').innerHTML;restored.onclick();assert.equal(ui.get('history').innerHTML,beforeLoad);
  const replayed=manual('prepare','C8');ui.get('replay').onclick();cleared();const beforeReplay=ui.get('history').innerHTML;replayed.onclick();assert.equal(ui.get('history').innerHTML,beforeReplay);
 }finally{ui.cleanup();}
});

test('対象便selectの変更は高度手動の未確定指令と旧入力を破棄する',async()=>{
 const ui=await app();try{ui.normal();pickService(ui,'timetable','A024');ui.get('manual').open=true;ui.get('manual').ontoggle();ui.get('actionSelect').value='hold';ui.get('actionSelect').onchange();ui.get('dest').value='4';ui.get('mode').value='回送';const oldExecute=ui.get('actionExecute').querySelectorAll('[data-action]')[0];assert.equal(oldExecute.disabled,false);
  ui.get('serviceSelect').value='A060';ui.get('serviceSelect').onchange();assert.equal(ui.get('serviceSelect').value,'A060');assert.equal(ui.get('manual').open,false);assert.equal(ui.get('actionSelect').value,'');assert.equal(ui.get('dest').value,'2');assert.equal(ui.get('mode').value,'旅客');assert.equal(ui.get('actionExecute').querySelectorAll('[data-action]').length,0);const before=ui.get('history').innerHTML;oldExecute.onclick();assert.equal(ui.get('history').innerHTML,before);
 }finally{ui.cleanup();}
});

test('取消・編成切替・復元では旧担当/行先/種別を消し、保存と進行は編集中の入力を保つ',async()=>{
 const ui=await app();try{ui.normal();
  const compose=()=>{ui.select('T4');ui.get('manual').open=true;ui.get('manual').ontoggle();ui.get('actionSelect').value='prepare';ui.get('actionSelect').onchange();ui.get('crewSelect').value='C8';ui.get('crewSelect').onchange();ui.get('dest').value='4';ui.get('mode').value='回送';};
  const cleared=()=>{assert.equal(ui.get('crewSelect').value,'');assert.equal(ui.get('dest').value,'2');assert.equal(ui.get('mode').value,'旅客');assert.equal(ui.get('actionSelect').value,'');assert.equal(ui.get('manual').open,false);};
  compose();ui.get('save').onclick();ui.step();assert.equal(ui.get('crewSelect').value,'C8');assert.equal(ui.get('dest').value,'4');assert.equal(ui.get('mode').value,'回送');ui.get('cancelDraft').onclick();cleared();ui.get('manual').open=true;ui.get('manual').ontoggle();ui.get('actionSelect').value='prepare';ui.get('actionSelect').onchange();assert.equal(ui.get('crewSelect').value,'','取消した担当を暗黙に再利用しない');
  compose();ui.select('T1');cleared();compose();ui.get('load').onclick();cleared();
 }finally{ui.cleanup();}
});

test('担当候補selectを絞った後の乗務員リンクは別担当を明示選択して子表を開く',async()=>{
 const ui=await app();try{ui.normal();ui.select('T4');ui.get('manual').open=true;ui.get('manual').ontoggle();ui.get('actionSelect').value='prepare';ui.get('actionSelect').onchange();assert.ok(!ui.get('crewSelect').options.includes('C2'));const c2=ui.get('crews').querySelectorAll('[data-pickcrew]').find(node=>node.dataset.pickcrew==='C2');assert.ok(c2);c2.onclick();assert.equal(ui.get('crewSelect').value,'C2');assert.equal(ui.get('trainSelect').value,'T1');assert.equal(ui.get('crews').querySelectorAll('details').find(node=>node.dataset.crew==='C2').open,true);assert.equal(ui.get('manual').open,false);assert.equal(ui.get('actionExecute').querySelectorAll('[data-action]').length,0);
 }finally{ui.cleanup();}
});
