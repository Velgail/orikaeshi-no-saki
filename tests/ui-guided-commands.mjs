// 実appの通常イベント用の共通操作。ブラウザーQAの代用ではない。
import assert from 'node:assert/strict';
import {stations,clock} from '../engine.js';
import {pickService,chooseCrew} from './ui-dom-harness.mjs';

export const groupFor = action => ({resume:'担当便の運転を判断する',shorten:'この便を折返す',dispatch:'運転可能区間で運行する',prepare:'予備を投入する',depotOut:'予備を投入する',reassignCycle:'この編成で代走する',endBreak:'乗務員の配置・休憩を判断する',transfer:'乗務員の配置・休憩を判断する',depotIn:'車庫へ戻す',cancel:'担当便の運転を判断する'})[action];
export function openGroup(ui,label){const group=ui.get('goals').querySelectorAll('[data-group]').find(button=>button.textContent===label);assert.ok(group,`${ui.get('clock').textContent} ${label}の目的ボタン`);group.onclick();}
export function choosePerson(ui,id){
  const node=ui.get('goals');
  const person=node.querySelectorAll('[data-person]').find(button=>button.dataset.person===id);
  assert.ok(person,`${id}の乗務員行`);
  const section=node.innerHTML.split('<details')[0];
  if(!section.includes(`data-person="${id}"`)){
    const others=node.querySelectorAll('details').find(item=>item.textContent==='ほかの乗務員を選ぶ');
    assert.ok(others,`${id}を選ぶ開閉領域`);others.open=true;
  }
  person.onclick();
}
export function goalMatches(button,action,arg){
  const text=button.textContent;
  if(action==='resume')return text.includes('まで再開');
  if(action==='shorten')return text.startsWith(`この便を${stations[arg.dest]}で折返す`);
  if(action==='dispatch')return text===`${stations[arg.dest]}へ運行する`;
  if(action==='prepare')return text.includes('車庫で準備を始める');
  if(action==='depotOut')return text.includes('森ヶ丘へ出庫');
  if(action==='reassignCycle')return text.startsWith(`${clock(Number(arg.service.slice(1)))}以後の${arg.service[0]==='A'?'T1':'T3'}運用を`);
  if(action==='endBreak')return text.includes('休憩を中断する');
  if(action==='transfer')return text.includes('この編成で便乗配置する');
  if(action==='depotIn')return text.startsWith('車庫へ戻す');
  if(action==='cancel')return text==='この便を部分運休する';
  return false;
}
export function compose(ui,id,action,arg={}){
  assert.equal(ui.get('manual').open,false,'高度な手動操作を開かない');
  ui.select(id);
  if(arg.service&&action!=='reassignCycle')pickService(ui,'timetable',arg.service);
  const before=ui.saveState();
  assert.equal(before.selected,id,`${action}の対象編成`);
  if(arg.service&&action!=='reassignCycle')assert.equal(ui.get('serviceSelect').value,arg.service,'表で指定した便を保持');
  openGroup(ui,groupFor(action));
  if(['endBreak','transfer'].includes(action))choosePerson(ui,arg.crew);
  const goal=ui.get('goals').querySelectorAll('[data-goal]').find(button=>goalMatches(button,action,arg));
  assert.ok(goal,`${clock(before.time)} ${id} ${action} ${JSON.stringify(arg)}の具体候補`);goal.onclick();
  if(arg.crew)chooseCrew(ui,arg.crew);
  const execute=ui.get('actionExecute').querySelectorAll('[data-action]').find(button=>button.dataset.action===action);
  assert.ok(execute,`${action}の独立実行フッター`);assert.equal(execute.disabled,false,'適合する通常候補は実行できる');
  return {before,execute};
}
export function command(ui,id,action,arg={}){
  const {before,execute}=compose(ui,id,action,arg);execute.onclick();
  const after=ui.saveState();
  assert.equal(after.history.length,before.history.length+1,`${action}が実履歴に1件残る`);
  assert.equal(after.time,before.time,'指令クリックは時間を省略しない');
  assert.equal(ui.get('actionExecute').querySelectorAll('[data-action]').length,0,'実行後の未確定指令は残らない');
}
export const localCommands=new Map([
  [5,[['T1','resume',{service:'AM012'}],['T3','resume',{service:'DM008'}],['T1','shorten',{service:'A024',dest:4}],['T3','shorten',{service:'D028',dest:2}]]],
  [38,[['T1','dispatch',{dest:7,crew:'C3'}],['T3','dispatch',{dest:0,crew:'C11'}],['T4','prepare',{crew:'C8'}]]],
  [44,[['T4','depotOut',{crew:'C8'}]]],
  [52,[['T3','reassignCycle',{service:'A060',crew:'C1'}]]],
  [55,[['T1','depotIn',{crew:'C20'}],['T4','reassignCycle',{service:'D064',crew:'C9'}]]],
  [57,[['T3','endBreak',{crew:'C11'}],['T3','transfer',{crew:'C11'}]]],
  [60,[['T4','endBreak',{crew:'C3'}],['T4','transfer',{crew:'C3'}]]],
]);
export const rescueCommands=new Map([
  [8,[['T4','prepare',{crew:'C8'}]]],[14,[['T4','depotOut',{crew:'C8'}]]],
  [20,[['T4','dispatch',{dest:4,crew:'C8'}]]],[35,[['T4','dispatch',{dest:7,crew:'C8'}]]],
  [65,[...['A024','A060','D028','D064'].map(service=>[service[0]==='A'?'T1':'T3','cancel',{service}]),['T1','resume',{service:'AM012'}],['T3','resume',{service:'DM008'}]]],
  [90,[['T1','endBreak',{crew:'C2'}],['T1','transfer',{crew:'C3'}]]],
  [94,[['T3','endBreak',{crew:'C10'}],['T3','transfer',{crew:'C11'}]]],
  [126,[['T1','transfer',{crew:'C1'}]]],[130,[['T3','transfer',{crew:'C9'}]]],
]);
export function localUntil(ui,target){
  ui.get('start').onclick();
  for(let minute=0;minute<target;minute++){
    for(const [id,action,arg] of localCommands.get(minute)??[])command(ui,id,action,arg);
    ui.step();
  }
  assert.equal(ui.get('clock').textContent,clock(target));
}
