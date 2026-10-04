// 新候補の階層導線を実appイベントで確認する。DOMスタブであり実ブラウザーQAではない。
import test from 'node:test';
import assert from 'node:assert/strict';
import {crewCandidates} from '../guidance.js';
import {app,comparison,crewIDs,chooseCrew} from './ui-dom-harness.mjs';
import {command,compose,openGroup,choosePerson,goalMatches,localUntil} from './ui-guided-commands.mjs';

const goals=ui=>ui.get('goals').querySelectorAll('[data-goal]');
const execute=ui=>ui.get('actionExecute').querySelectorAll('[data-action]')[0];
const detail=(ui,title)=>ui.get('goals').querySelectorAll('details').find(item=>item.textContent===title);
const upfront=ui=>ui.get('goals').innerHTML.split('<details')[0];
const unchangedHistory=(ui,old)=>{const before=ui.get('history').innerHTML;old.onclick();assert.equal(ui.get('history').innerHTML,before,'以前の描画・未確定選択イベントは指令しない');};

test('08:52代走は直近09:00の単便／以後運用を先に出し、後続便の選択と開閉・入力保持・取消を確認',async()=>{
  const ui=await app();try{
    localUntil(ui,52);ui.select('T3');openGroup(ui,'この編成で代走する');
    assert.equal((upfront(ui).match(/data-goal=/g)||[]).length,2,'直近の2種類だけを先に示す');
    assert.match(upfront(ui),/09:00 中央→森ヶ丘をこの編成で代走/);
    assert.match(upfront(ui),/09:00以後のT1運用をこの編成で代走/);
    assert.doesNotMatch(upfront(ui),/10:12/,'後続便は同格の先頭ボタンにしない');
    const others=detail(ui,'ほかの便を選ぶ');assert.ok(others);assert.equal(others.open,false);
    others.open=true;ui.get('save').onclick();assert.equal(detail(ui,'ほかの便を選ぶ').open,true,'保存再描画でも後続便を開いた状態を保つ');
    const later=goals(ui).find(button=>goalMatches(button,'reassignCycle',{service:'A132'}));assert.ok(later,'任意の10:12以後T1運用も見つけられる');later.onclick();
    chooseCrew(ui,'C1');comparison(ui).open=true;const stale=execute(ui);assert.equal(stale.disabled,false);assert.match(stale.textContent,/10:12以後のT1運用/);
    ui.step();assert.equal(ui.get('clock').textContent,'08:53');assert.equal(detail(ui,'ほかの便を選ぶ').open,true);assert.equal(comparison(ui).open,true);assert.match(ui.get('actions').innerHTML,/担当 C1/);assert.match(execute(ui).textContent,/10:12以後のT1運用/);unchangedHistory(ui,stale);
    const canceled=execute(ui);ui.get('cancelDraft').onclick();assert.equal(execute(ui),undefined);unchangedHistory(ui,canceled);
    const {execute:next}=compose(ui,'T3','reassignCycle',{service:'A060',crew:'C1'});assert.match(next.textContent,/09:00以後のT1運用/);next.onclick();
    const state=ui.saveState();assert.equal(state.plans.find(plan=>plan.id==='A060').train,'T3');assert.equal(state.plans.find(plan=>plan.id==='A132').train,'T3','以後運用を明示確定した時に後続便も移す');assert.equal(state.trains.find(train=>train.id==='T3').service,null,'代走計画は時間を省略して始発しない');
  }finally{ui.cleanup();}
});

test('08:55T1の車庫戻しは独立した1目的からC20を比較選択し、取消／復元／二重実行と実3分移動を守る',async()=>{
  const ui=await app();try{
    localUntil(ui,55);ui.select('T1');
    const state=ui.saveState();assert.equal(state.trains.find(train=>train.id==='T1').service,null);
    const group=ui.get('goals').querySelectorAll('[data-group]').find(button=>button.textContent==='車庫へ戻す');assert.ok(group,'担当便がなくても車庫へ戻す目的を直接選べる');group.onclick();
    assert.equal(goals(ui).length,1,'乗務員ごとに同じ入庫を複製しない');assert.equal(goals(ui)[0].textContent,'車庫へ戻す（移動3分）');goals(ui)[0].onclick();
    assert.ok(crewIDs(ui).includes('C20'));comparison(ui).open=true;chooseCrew(ui,'C20');assert.equal(comparison(ui).open,true);assert.match(ui.get('actions').innerHTML,/担当 C20/);assert.equal(execute(ui).disabled,false);
    const canceled=execute(ui);ui.get('cancelDraft').onclick();assert.equal(execute(ui),undefined);unchangedHistory(ui,canceled);
    const restored=compose(ui,'T1','depotIn',{crew:'C20'}).execute;ui.get('save').onclick();assert.ok(execute(ui),'保存だけは編集中の入庫を保持');ui.get('load').onclick();assert.equal(execute(ui),undefined,'読込は入庫draftを破棄');unchangedHistory(ui,restored);
    const staleGroup=ui.get('goals').querySelectorAll('[data-group]').find(button=>button.textContent==='車庫へ戻す');ui.select('T3');unchangedHistory(ui,staleGroup);assert.equal(execute(ui),undefined);
    const {before,execute:depot}=compose(ui,'T1','depotIn',{crew:'C20'});depot.onclick();depot.onclick();
    const moved=ui.saveState();assert.equal(moved.history.length,before.history.length+1,'二重clickで入庫は1件');assert.equal(moved.time,55);const train=moved.trains.find(train=>train.id==='T1');assert.equal(train.depotTrack,null);assert.equal(train.depotMove.kind,'depotIn');assert.equal(train.depotMove.remaining,3);assert.equal(train.depotMove.crew,'C20');assert.ok(train.depotMove.route,'実車庫経路を使う');
    command(ui,'T4','reassignCycle',{service:'D064',crew:'C9'});const assigned=ui.saveState();assert.equal(assigned.plans.find(plan=>plan.id==='D064').train,'T4');assert.equal(assigned.plans.find(plan=>plan.id==='D064').crew,'C9','09:04以後T3運用の担当C9を比較で指定できる');
    ui.step(3);const arrived=ui.saveState();assert.equal(arrived.trains.find(train=>train.id==='T1').depotMove,null);assert.ok(arrived.trains.find(train=>train.id==='T1').depotTrack,'3分の車庫移動で初めて留置線に着く');
  }finally{ui.cleanup();}
});

test('08:57乗務員は人を先に選び、C11／C3中断・便乗と後続人選択、再描画・戻る・対象切替の失効を確認',async()=>{
  const ui=await app();try{
    localUntil(ui,57);ui.select('T3');openGroup(ui,'乗務員の配置・休憩を判断する');
    assert.equal(goals(ui).length,0,'人を選ぶ前はcrew×actionの平坦ボタンを並べない');
    assert.ok(ui.get('goals').querySelectorAll('[data-person]').length>3,'後続の乗務員も選択できる');
    assert.ok((upfront(ui).match(/data-person=/g)||[]).length<=3,'先頭は今の状態に関わる少数の人');
    assert.match(upfront(ui),/C11/,'休憩中C11を先頭に示す');assert.doesNotMatch(upfront(ui),/C12|C15|C18|C19/,'勤務前の人を先頭で休憩操作させない');
    assert.ok(detail(ui,'ほかの乗務員を選ぶ'),'ほかの人も開いて選べる');
    choosePerson(ui,'C11');assert.ok(goals(ui).some(button=>button.textContent.includes('休憩を中断する')));assert.ok(goals(ui).every(button=>button.textContent.includes(' C11 /')),'選んだ人に適用する操作だけを並べる');
    const back=ui.get('goals').querySelectorAll('[data-personback]')[0];assert.ok(back);back.onclick();assert.equal(goals(ui).length,0,'対象者を選び直すと古いactionを残さない');
    choosePerson(ui,'C11');const rest=goals(ui).find(button=>button.textContent.includes('休憩を中断する'));rest.onclick();const stale=execute(ui);comparison(ui).open=true;ui.get('save').onclick();assert.equal(comparison(ui).open,true);ui.get('load').onclick();assert.equal(execute(ui),undefined);unchangedHistory(ui,stale);
    ui.select('T3');openGroup(ui,'乗務員の配置・休憩を判断する');const stalePerson=ui.get('goals').querySelectorAll('[data-person]').find(button=>button.dataset.person==='C11');choosePerson(ui,'C11');const staleRest=goals(ui).find(button=>button.textContent.includes('休憩を中断する'));ui.select('T4');unchangedHistory(ui,stalePerson);unchangedHistory(ui,staleRest);assert.equal(execute(ui),undefined);
    command(ui,'T3','endBreak',{crew:'C11'});command(ui,'T3','transfer',{crew:'C11'});const c11=ui.saveState().crews.find(crew=>crew.id==='C11');assert.equal(c11.rest,0);assert.equal(c11.ride,'T3');
    ui.step(3);assert.equal(ui.get('clock').textContent,'09:00');command(ui,'T4','endBreak',{crew:'C3'});command(ui,'T4','transfer',{crew:'C3'});const c3=ui.saveState().crews.find(crew=>crew.id==='C3');assert.equal(c3.rest,0);assert.equal(c3.ride,'T4');
  }finally{ui.cleanup();}
});

test('人選択階層でも時間進行に適合便乗候補を再検査し、選んだ人と比較開閉を保持する',async()=>{
  const ui=await app();try{
    ui.normal();ui.step(18);ui.select('T2');openGroup(ui,'乗務員の配置・休憩を判断する');choosePerson(ui,'C1');
    const goal=goals(ui).find(button=>button.textContent.includes('この編成で便乗配置する'));assert.ok(goal);goal.onclick();chooseCrew(ui,'C4');comparison(ui).open=true;
    const old=execute(ui);ui.step();assert.equal(ui.get('clock').textContent,'08:19');assert.equal(comparison(ui).open,true);assert.match(ui.get('actions').innerHTML,/担当 C4/);assert.match(execute(ui).textContent,/ C4 /,'比較で変更した人は再描画でC1に戻らない');
    const current=ui.saveState();assert.equal(current.time,19);assert.deepEqual(crewIDs(ui),crewCandidates(current,'T2','transfer').map(crew=>crew.id),'現時点で適合する便乗候補と一致');unchangedHistory(ui,old);
    const back=ui.get('goals').querySelectorAll('[data-personback]')[0];assert.ok(back);back.onclick();assert.equal(execute(ui),undefined);assert.equal(goals(ui).length,0);assert.equal(ui.get('actions').innerHTML,'');
  }finally{ui.cleanup();}
});
