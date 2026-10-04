// 実appの通常イベントをDOMスタブで確認。ブラウザーQAではない。
import test from 'node:test';
import assert from 'node:assert/strict';
import {app,pickService} from './ui-dom-harness.mjs';

const enter=(ui,label)=>{const b=ui.get('goals').querySelectorAll('[data-group]').find(b=>b.textContent===label);assert.ok(b,label);b.onclick();};
const destinations=ui=>ui.get('goals').querySelectorAll('[data-goal]').map(b=>b.textContent.match(/^この便を(.+?)で折返す/)?.[1]).filter(Boolean).sort();
const back=ui=>ui.get('goals').querySelectorAll('[data-back]')[0].onclick();

test('08:05通常の折返候補と明示将来計画を便の始発駅から正しく分ける',async()=>{
 const ui=await app();try{
  ui.get('start').onclick();ui.step(5);
  for(const [id,ordinary,future] of [['A024',['新都心','東川原'],['学園前']],['D064',['新都心','東川原'],['学園前']],['D028',['学園前'],['新都心','東川原']],['A060',['学園前'],['新都心','東川原']]]){
   pickService(ui,'timetable',id);enter(ui,'この便を折返す');assert.deepEqual(destinations(ui),ordinary.sort(),id+'通常');assert.doesNotMatch(ui.get('goals').innerHTML,/変更計画・閉鎖手前/);
   back(ui);enter(ui,'将来の変更計画を保存する');assert.deepEqual(destinations(ui),future.sort(),id+'将来');assert.match(ui.get('goals').innerHTML,/再開条件成立まで実行待ち/);
  }
 }finally{ui.cleanup();}
});

test('08:20東向きのみ再開で中央始発便だけが通常折返へ戻り西向き計画は待つ',async()=>{
 const ui=await app();try{
  ui.get('start').onclick();ui.step(20);
  for(const id of ['D028','A060']){pickService(ui,'timetable',id);enter(ui,'この便を折返す');assert.deepEqual(destinations(ui),['学園前','新都心','東川原'].sort(),id);}
  for(const id of ['A024','D064']){pickService(ui,'timetable',id);enter(ui,'この便を折返す');assert.deepEqual(destinations(ui),['新都心','東川原'].sort(),id);back(ui);enter(ui,'将来の変更計画を保存する');assert.deepEqual(destinations(ui),['学園前']);}
 }finally{ui.cleanup();}
});

test('通常UIの閉鎖依存短縮は保存読込後も必要経路成立まで始発を待つ',async()=>{
 const ui=await app();try{
  ui.get('start').onclick();ui.step(5);pickService(ui,'timetable','AM012');enter(ui,'将来の変更計画を保存する');
  ui.get('goals').querySelectorAll('[data-goal]').find(b=>b.textContent.includes('行きを将来計画として保存')).onclick();ui.get('actionExecute').querySelectorAll('[data-action]')[0].onclick();
  pickService(ui,'timetable','A024');enter(ui,'将来の変更計画を保存する');ui.get('goals').querySelectorAll('[data-goal]').find(b=>b.textContent.startsWith('この便を学園前で折返す')).onclick();
  assert.match(ui.get('actions').innerHTML,/将来/);const execute=ui.get('actionExecute').querySelectorAll('[data-action]')[0];assert.equal(execute.dataset.action,'planShorten');assert.equal(execute.disabled,false);execute.onclick();
  const saved=ui.saveState();assert.equal(saved.plans.find(p=>p.id==='A024').waitForRoute,true);assert.equal(saved.plans.find(p=>p.id==='A024').hold,false);ui.get('load').onclick();assert.equal(ui.get('actionExecute').querySelectorAll('[data-action]').length,0);
  for(let minute=6;minute<=64;minute++){ui.step();const state=ui.saveState();const a=state.actual.find(a=>a.id==='A024');assert.equal(a.actualDeparture,null);if(minute>=24)assert.match(a.reason,/将来計画・実行待ち.*西.*閉鎖/);}
  ui.step(19);const state=ui.saveState();assert.equal(state.time,83);assert.equal(state.actual.find(a=>a.id==='A024').actualDeparture,83,'経路再開と現地担当の休憩終了後に発車');
 }finally{ui.cleanup();}
});

test('明示した実績確定便は保持し、自動進行で完了した担当便は次便へ連携する',async()=>{
 const ui=await app();try{
  ui.normal();assert.equal(ui.get('serviceSelect').value,'AM012');ui.step(24);assert.equal(ui.get('serviceSelect').value,'A024','通常完了後は次便へ');
  pickService(ui,'timetable','AM012');assert.equal(ui.get('serviceSelect').value,'AM012');assert.match(ui.get('context').textContent,/AM012.*完了.*実績.*確定/);ui.step();assert.equal(ui.get('serviceSelect').value,'AM012');
  ui.select('T1');assert.equal(ui.get('serviceSelect').value,'A024','編成を選び直すと現便へ');
 }finally{ui.cleanup();}
});
