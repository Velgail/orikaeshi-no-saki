import test from 'node:test';
import assert from 'node:assert/strict';
import {restore,result,clock} from '../engine.js';
import {app} from './ui-dom-harness.mjs';

import {command,localCommands as local,rescueCommands as rescue} from './ui-guided-commands.mjs';

// 実appの通常ボタンで全指令を入力する。DOMスタブであり実ブラウザーQAではない。
for(const [policy,commands,expected] of [
  ['local',local,{wait:16354,transported:862,unfinished:65,overtime:43,score:9813,recoveryAt:132,commands:15}],
  ['wait-rescue',rescue,{wait:20729,transported:862,unfinished:65,overtime:30,score:9567,recoveryAt:204,commands:16}],
])test(`通常appイベントだけで${policy}の全指令と15:12までの復旧を確認（DOMスタブ）`,async()=>{
  const ui=await app();let count=0;
  try{
    ui.get('start').onclick();
    for(let minute=0;minute<432;minute++){
      if(policy==='wait-rescue'&&minute===20){
        ui.select('T4');assert.match(ui.get('blocked').innerHTML,/中央へ運行する.*東川原―川原.*西向き閉鎖/);
        const group=ui.get('goals').querySelectorAll('[data-group]').find(button=>button.textContent==='運転可能区間で運行する');assert.ok(group);group.onclick();
        const goals=ui.get('goals').querySelectorAll('[data-goal]');assert.ok(!goals.some(button=>button.textContent==='中央へ運行する'));assert.ok(goals.some(button=>button.textContent==='東川原へ運行する'));
      }
      for(const [id,action,arg] of commands.get(minute)??[]){command(ui,id,action,arg);count++;}
      if(policy==='local'&&minute===5){assert.equal(ui.get('trainSelect').value,'T3');assert.equal(ui.get('serviceSelect').value,'D028','別運用の次便は現走行DM008へ戻らない');}
      ui.step();
    }
    assert.equal(count,expected.commands);
    ui.saveState();const state=restore(ui.savedState());
    const measured=result(state);
    assert.equal(state.time,432);assert.equal(state.ended,true);assert.equal(state.recoveryAt,expected.recoveryAt);
    assert.equal(measured.success,true);assert.deepEqual(measured.violations,[]);
    for(const key of ['wait','transported','unfinished','overtime','score'])assert.equal(measured[key],expected[key],`${policy} ${key}`);
    assert.match(ui.get('metrics').textContent,new RegExp(`待ち${expected.wait}人分 / 許容超勤実績${expected.overtime}分 / 復旧${clock(expected.recoveryAt)}`));
    assert.match(ui.get('resultText').innerHTML,/所定運用の復旧を確認/);
    console.log('通常app DOMイベント完走',policy,JSON.stringify({...measured,recoveryAt:state.recoveryAt,commands:count}));
  }finally{ui.cleanup();}
});
