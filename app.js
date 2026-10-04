import {guidance,crewCandidates} from './guidance.js';
import {createPacer,setSpeed,advance,progress} from './realtime.js';
import {mapSVG,updateTimetable,crewHTML,depotHTML,morningHTML,preserveHTML,focusTrain} from './display.js';
import {createState,start,tick,act,preview,stations,clock,serialize,restore,result,playerInfo,connections,commandFields,completionCounts} from './engine.js';
import {evaluate,overtimeRecord} from './labor.js';
let draft=null,draftTarget=null,draftService=null,goalGroup=null,goalPerson=null,selectedFinalService=null,executionToken=0;
let s=createState(),speed=0,last=performance.now();const pacer=createPacer(),$=id=>document.getElementById(id);
const esc=v=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
$('trainSelect').innerHTML=s.trains.map(t=>`<option>${t.id}</option>`).join('');
$('dest').innerHTML=stations.map((n,i)=>`<option value="${i}">${n}</option>`).join('');$('dest').value='2';
$('crewSelect').innerHTML='<option value="">現地自動選定</option>'+s.crews.map(c=>`<option>${c.id}</option>`).join('');
function args(){const fields=commandFields($('actionSelect').value);return Object.fromEntries(Object.entries({service:$('serviceSelect').value||undefined,dest:Number($('dest').value),mode:$('mode').value,crew:$('crewSelect').value}).filter(([key])=>fields[key]));}
function clearCommand(){draft=null;goalGroup=null;goalPerson=null;selectedFinalService=null;$('goals').innerHTML='';$('manual').open=false;$('actionSelect').value='';$('dest').value='2';$('mode').value='旅客';$('crewSelect').innerHTML='<option value="">現地自動選定</option>'+s.crews.map(c=>`<option>${c.id}</option>`).join('');$('crewSelect').value='';}
function selectTarget(id,service,crew){clearCommand();s.selected=id;$('serviceSelect').value='';if(crew)$('crewSelect').value=crew;render({service});}
function render({service}={}){
 const viewToken=++executionToken;
 const isFinal=id=>['完了','短縮完了','運休'].includes(s.actual.find(a=>a.id===id)?.status);
 if(service!==undefined)selectedFinalService=isFinal(service)?service:null;
 $('clock').textContent=clock(s.time);$('phase').textContent=s.started?s.phase:'指令待機';$('speedNote').textContent=speed?`${speed}倍 / 実1秒＝ゲーム${speed}秒 / 次tickまでゲーム${Math.ceil(60*(1-progress(pacer)))}秒`:'停止中 / 計画可能';$('notice').textContent=s.notice;
 const pending=s.important.some(n=>!n.acknowledged);$('ack').hidden=!pending;$('speedLock').textContent=pending?'重要通知の確認待ち：確認後、進行速度を選び直してください。':'';$('start').disabled=s.started;$('step').disabled=!s.started||s.ended||pending;$('scenario').disabled=s.started;document.querySelectorAll('[data-speed]').forEach(b=>b.classList.toggle('active',Number(b.dataset.speed)===speed));
 const info=playerInfo(s);$('closure').textContent=info.constraint;$('important').textContent=info.latest;
 const map=$('map'),scroll=map.scrollLeft,vertical=map.scrollTop;map.innerHTML=mapSVG(s);map.scrollLeft=scroll;map.scrollTop=vertical;map.querySelectorAll('[data-train]').forEach(g=>{const pick=()=>selectTarget(g.dataset.train);g.onclick=pick;g.onkeydown=e=>{if(e.key==='Enter')pick();};});
 const t=s.trains.find(t=>t.id===s.selected);$('trainSelect').value=t.id;$('selected').textContent=t.id;
 if(draftTarget!==t.id){draft=null;goalGroup=null;goalPerson=null;draftTarget=t.id;if(service===undefined)selectedFinalService=null;}
 const chosen=service??$('serviceSelect').value;const g=guidance(s,t.id,isFinal(chosen)&&chosen!==selectedFinalService?undefined:chosen);const rows=s.timetable.filter(r=>s.plans.find(p=>p.id===r.id).train===t.id&&(r.id===g.service||!isFinal(r.id)));$('serviceSelect').innerHTML=rows.map(r=>`<option value="${r.id}">${clock(r.departure)} ${stations[r.origin]}→${stations[r.dest]} ${r.id}${isFinal(r.id)?'（実績確定）':''}</option>`).join('');$('serviceSelect').value=g.service||'';
 if(draftService!==g.service){draft=null;goalGroup=null;goalPerson=null;}draftService=g.service;
 if(draft&&commandFields(draft.action).crew)draft={...draft,crews:crewCandidates(s,t.id,draft.action,draft.arg)};
 s.selectedService=$('serviceSelect').value;s.selectedCrew=$('crewSelect').value;
 $('trainInfo').textContent=`${t.id} / ${t.formation} / ${t.crew||'担当未割当'}：${t.depotTrack?'森ヶ丘車庫 留置'+t.depotTrack+'線':t.depotMove?'車庫移動あと'+t.depotMove.remaining+'分':t.edge?stations[t.edge[0]]+'→'+stations[t.edge[1]]+' あと'+t.remaining+'分 / 到着予約'+t.reserved+'番':stations[t.at]+t.platform+'番'}、${t.dir===1?'東':'西'}向き / 準備${t.busy}分 / ${t.service||'次便待機'}。所定便は自動発車。入力中も進行します。`;
 const actions=[['prepare','車庫で車両準備（5分）'],['depotOut','車庫から出庫（3分）'],['depotIn','車庫へ入庫（3分）'],['hold','便を抑止'],['resume','抑止解除'],['shorten','便の行先を短縮'],['assign','選択編成で代走・交代計画'],['reassignCycle','この便以後の運用を代走編成へ'],['restorePlan','変更を所定へ戻す'],['cancel','便を部分運休'],['dispatch','臨時運行・配置移動'],['turn','番線で反転準備'],['relief','駅抑止中の乗務交代'],['transfer','指定乗員を便乗'],['alight','便乗者を現駅で下車'],['break','指定乗員を自由休憩'],['endBreak','自由休憩を中断'],['retire','指定乗員を終業']];
 if(!$('actionSelect').innerHTML){$('actionSelect').innerHTML='<option value="">詳細指令を選ぶ</option>'+actions.map(([a,label])=>`<option value="${a}">${label}</option>`).join('');$('actionSelect').value='';}
 const manual=$('manual').open;
 $('context').textContent=g.context;
 const crewGroup='乗務員の配置・休憩を判断する';
 const group=x=>['prepare','depotOut'].includes(x.action)?'予備を投入する':x.action==='depotIn'?'車庫へ戻す':x.action==='dispatch'?'運転可能区間で運行する':x.action==='shorten'?'この便を折返す':['assign','reassignCycle'].includes(x.action)?'この編成で代走する':['planResume','planShorten'].includes(x.action)?'将来の変更計画を保存する':['transfer','endBreak','alight','break'].includes(x.action)?crewGroup:'担当便の運転を判断する';
 const groups=[...new Set(g.choices.map(group))];let shown=g.choices.filter(x=>group(x)===goalGroup);
 if(goalGroup==='車庫へ戻す')shown=shown.slice(0,1).map(x=>({...x,label:'車庫へ戻す（移動3分）'}));
 const goalButton=(x,i)=>`<button data-goal="${i}">${esc(x.label)}</button>`;
 let goals=groups.map((label,i)=>`<button data-group="${i}">${esc(label)}</button>`).join('')||'<p>今は準備・到着または適格な担当者を待ちます。所定便は自動運行します。</p>';
 if(goalGroup){
  goals='<button data-back="1">目的を選び直す</button>';
  if(goalGroup===crewGroup){
   const people=[...new Set(shown.map(x=>x.arg.crew))].map(id=>s.crews.find(c=>c.id===id));
   const priority=c=>c.ride||c.rest?0:s.time>=c.dutyStart?1:2;
   people.sort((a,b)=>priority(a)-priority(b)||Number(a.id.slice(1))-Number(b.id.slice(1)));
   const personButton=c=>{const next=s.timetable.filter(r=>s.plans.find(p=>p.id===r.id).crew===c.id&&r.departure>=s.time&&s.actual.find(a=>a.id===r.id).status==='未発車').sort((a,b)=>a.departure-b.departure)[0];return `<button data-person="${c.id}">${esc(`${c.name} ${c.id} / ${stations[c.at]??'移動中'} / ${c.ride?'便乗中':c.rest?'休憩あと'+c.rest+'分':s.time<c.dutyStart?'勤務開始'+clock(c.dutyStart):'待機'} / 所定終業${clock(c.plannedDutyEnd)}${next?' / 次便'+clock(next.departure)+' '+stations[next.origin]+'発 '+next.id:''}`)}</button>`;};
   if(goalPerson){
    const person=s.crews.find(c=>c.id===goalPerson);
    shown=shown.filter(x=>x.arg.crew===goalPerson);
    goals+='<button data-personback="1">対象者を選び直す</button>'+`<p>${esc(person.name+' '+person.id)}の今できる操作</p>`+(shown.map(goalButton).join('')||'<p>現在、この人に適用できる操作はありません。対象者を選び直してください。</p>');
   }else{
    const relevant=people.filter(c=>s.time>=c.dutyStart).slice(0,3),other=people.filter(c=>!relevant.includes(c));
    goals+='<p>所在・休憩・次便を見て対象者を選びます。</p>'+relevant.map(personButton).join('')+(other.length?`<details data-detail="${t.id}:${crewGroup}:people"><summary>ほかの乗務員を選ぶ</summary>${other.map(personButton).join('')}</details>`:'');
   }
  }else if(goalGroup==='この編成で代走する'){
   const departure=x=>s.timetable.find(r=>r.id===x.arg.service).departure;
   shown.sort((a,b)=>departure(a)-departure(b));
   const first=shown.length?departure(shown[0]):null;
   goals+='<p>直近の始発便。単便か、以後の運用かを選びます。</p>'+shown.map((x,i)=>departure(x)===first?goalButton(x,i):'').join('');
   if(shown.some(x=>departure(x)!==first))goals+=`<details data-detail="${t.id}:${goalGroup}:later"><summary>ほかの便を選ぶ</summary>${shown.map((x,i)=>departure(x)!==first?goalButton(x,i):'').join('')}</details>`;
  }else goals+=shown.map(goalButton).join('');
 }
 preserveHTML($('goals'),goals);
 $('goals').querySelectorAll('[data-group]').forEach(b=>b.onclick=()=>{if(viewToken!==executionToken)return;goalGroup=groups[Number(b.dataset.group)];goalPerson=null;draft=null;render();});
 $('goals').querySelectorAll('[data-back]').forEach(b=>b.onclick=()=>{if(viewToken!==executionToken)return;goalGroup=null;goalPerson=null;draft=null;render();});
 $('goals').querySelectorAll('[data-person]').forEach(b=>b.onclick=()=>{if(viewToken!==executionToken)return;goalPerson=b.dataset.person;draft=null;render();});
 $('goals').querySelectorAll('[data-personback]').forEach(b=>b.onclick=()=>{if(viewToken!==executionToken)return;goalPerson=null;draft=null;render();});
 $('goals').querySelectorAll('[data-goal]').forEach(b=>b.onclick=()=>{if(viewToken!==executionToken)return;draft=shown[Number(b.dataset.goal)];render();});
 $('blocked').innerHTML='<summary>今選べない行先・操作と理由</summary>'+g.blocked.map(x=>`<p>${esc(x.label)}：${esc(x.reason)}</p>`).join('');
 const a=manual?$('actionSelect').value:draft?.action,arg=manual?args():draft?.arg;
 const p=a?preview(s,t.id,a,arg):null;
 for(const [key,id] of Object.entries({dest:'dest',mode:'mode',crew:'crewSelect'})){$(id).disabled=!commandFields(a)[key];$(id).closest('label').hidden=!manual||!commandFields(a)[key];}
 if(manual&&commandFields(a).crew){const current=$('crewSelect').value;const cs=crewCandidates(s,t.id,a,args());$('crewSelect').innerHTML='<option value="">現地自動選定</option>'+cs.map(c=>`<option value="${c.id}">${esc(c.label)}</option>`).join('')+(current&&!cs.some(c=>c.id===current)?`<option value="${esc(current)}" disabled>${esc(current)}（現在は条件不適合・選び直し）</option>`:'');$('crewSelect').value=current;}
 $('actionExecute').innerHTML=p?`<button data-action="${a}" ${p.reason?'disabled':''}>${manual?'詳細操作':esc(draft.label)}を確定</button><button id="cancelDraft">戻る・取消</button>`:'<small>目的を選ぶと、対象と担当を確認して実行できます。</small>';
 const plan=s.plans.find(x=>x.id===arg?.service),dest=arg?.dest??plan?.dest;const short=p?`${t.id}/${t.formation}${arg?.service?'・'+arg.service:''} / ${dest!==undefined?stations[dest]+'行き / ':''}担当 ${arg?.crew||t.crew||plan?.crew||'現地自動選定'}。${p.info.match(/所要＝[^。]+。/)?.[0]||(['prepare','depotOut'].includes(a)?'準備5分・出庫3分・後処理3分。':'所定自動運行と実処理時間を維持。')} ${p.info.match(/追加評価対象超勤見込[^（]+/)?.[0]||''}${p.info.match(/次便 [^。]+。/)?.[0]||''}${p.info.match(/自由休憩の残り[^。]+。別の休憩[^。]+。/)?.[0]||''}`:'';
 const detailKey=esc([t.id,a,arg?.service,arg?.dest,arg?.mode].join(':'));
 preserveHTML($('actions'),p?`<div class="action"><small>${esc(manual?p.info:short)}${!manual?'<details data-detail="'+detailKey+':info"><summary>所要・勤務枠・次便の詳細</summary>'+esc(p.info)+'</details>':''}${p.reason?'<span class="reason">不可：'+esc(p.reason)+'</span>':''}</small></div>`+(!manual&&commandFields(a).crew?'<details data-detail="'+detailKey+':crews"><summary>担当候補を比較・変更</summary>'+draft.crews.map(c=>`<button data-choosecrew="${c.id}" aria-pressed="${c.id===arg.crew}">${esc(c.label)}${c.id===arg.crew?'（選択中）':''}</button>`).join('')+(draft.crews.length?'':'<p>現在、条件を満たす担当者はいません。</p>')+'</details>':''):'');
 $('actions').querySelectorAll('[data-choosecrew]').forEach(b=>b.onclick=()=>{if(viewToken!==executionToken||!draft)return;const crew=b.dataset.choosecrew;const choice=g.choices.find(x=>x.action===draft.action&&x.arg.crew===crew&&['service','dest','mode'].every(k=>x.arg[k]===draft.arg[k]));if(goalGroup===crewGroup)goalPerson=crew;draft={...draft,label:goalGroup==='車庫へ戻す'?draft.label:choice?.label||draft.label,arg:{...draft.arg,crew}};render();});
 $('actionExecute').querySelectorAll('[data-action]').forEach(b=>{const target=t.id,command=a,inputs={...arg};b.onclick=()=>{if(b.disabled||s.selected!==target||viewToken!==executionToken)return;executionToken++;b.disabled=true;act(s,target,command,inputs);draft=null;render();};});
 $('cancelDraft')?.addEventListener?.('click',()=>{if(viewToken!==executionToken)return;clearCommand();render();});
 $('roster').innerHTML='<table><tr><th>編成運用</th><th>位置 / 実行状態</th></tr>'+s.trains.map(t=>`<tr data-id="${t.id}" class="pick ${t.id===s.selected?'selected':''}"><td>${t.id}/${t.formation}</td><td>${t.depotTrack?'車庫'+t.depotTrack+'線':t.depotMove?'出入庫中':t.edge?stations[t.at]+'→'+stations[t.edge[1]]:stations[t.at]+t.platform+'番'} / ${t.service||'次便待ち'}<br>${t.service?esc(s.actual.find(a=>a.id===t.service).reason)||'運行中':''}</td></tr>`).join('')+'</table>';$('roster').querySelectorAll('[data-id]').forEach(r=>r.onclick=()=>selectTarget(r.dataset.id));
 preserveHTML($('crews'),crewHTML(s,evaluate,overtimeRecord));preserveHTML($('depot'),depotHTML(s));preserveHTML($('morning'),morningHTML(s));
 const links=s.started?connections(s):[];$('connections').innerHTML='<table>'+links.map(x=>`<tr><td>${x.id} ${clock(x.departure)}</td><td>${x.possible?'接続成立見込':'接続不足'}：${esc(x.reason)}</td></tr>`).join('')+'</table>';
 updateTimetable($('timetable'),s);bindRelations();const r=result(s),counts=completionCounts(s);$('metrics').textContent=`目的地到着 ${r.transported}人 / 未着${r.unfinished}人 / 待ち${r.wait}人分 / 許容超勤実績${r.overtime}分 / 復旧${s.recoveryAt?clock(s.recoveryAt):'未達'}`;$('history').innerHTML=s.history.slice().reverse().map(h=>`<div>${clock(h.time)} ${esc(h.msg)}</div>`).join('');
 if(s.ended&&!s.resultViewed){s.resultViewed=true;pause();$('resultText').innerHTML=`<h2>${s.mode==='normal'?'正常所定運行の観察終了':r.success?'所定運用の復旧を確認':'復旧条件未達'}</h2><p>15:12固定観察終了。目的地到着${r.transported}人、未着${r.unfinished}人、待ち${r.wait}人分。許容超勤${r.overtime}分。評価${r.score}。</p><p>${s.mode==='normal'?'正常観察：朝から累計完了'+counts.morningTotal+'便／08:00以降の完了'+counts.observation+'便（引継ぎ時走行中'+counts.inherited+'便を含む）。08:00以降に発車・完了'+counts.observationDeparted+'便。時刻表で所定と全実績を照合できます。復旧目標の対象外です。':''}</p><p>${s.mode==='normal'?'障害なし：復旧判定対象外／所定運行の確認結果': '所定1周期の全停車・発着と翌接続：'+(s.recoveryAt?clock(s.recoveryAt)+'に成立':'未成立')}。途中運休${s.actual.filter(a=>a.status==='運休').length}、短縮完了${s.actual.filter(a=>a.status==='短縮完了').length}便。</p><p>${esc(r.violations.join(' / '))||'確定した法令・協定／社内規程違反なし。未終了勤務は自動退勤させず、続行予測の確認が必要です。'}</p><p>短縮した客は目的地を維持し、乗換後の到着だけを輸送完了として計上します。時刻表と操作履歴を確認してください。</p>`;$('result').showModal();}
}
function bindRelations(){for(const parent of ['timetable','crews','depot','morning']){const node=$(parent);node.querySelectorAll('[data-pick]').forEach(b=>b.onclick=()=>{selectTarget(b.dataset.pick,b.dataset.pickservice);$('findTrain').onclick();});node.querySelectorAll('[data-pickcrew]').forEach(b=>b.onclick=()=>{const id=b.dataset.pickcrew;if(!id)return;const c=s.crews.find(c=>c.id===id);selectTarget(c?.train||c?.ride||s.selected,undefined,id);const d=[...$('crews').querySelectorAll('details')].find(d=>d.dataset.crew===id);if(d){d.open=true;d.scrollIntoView?.({block:'center'});}});}}
function pause(){speed=0;setSpeed(pacer,0);last=performance.now();}
$('scenario').onchange=()=>{clearCommand();s=createState({mode:$('scenario').value});$('serviceSelect').value='';render();};$('start').onclick=()=>{start(s);render();};$('step').onclick=()=>{pause();if(!s.important.some(n=>!n.acknowledged))tick(s);render();};
for(const id of ['dest','mode','crewSelect','actionSelect'])$(id).onchange=()=>{draft=null;goalGroup=null;goalPerson=null;render();};$('serviceSelect').onchange=()=>{clearCommand();render({service:$('serviceSelect').value});};$('manual').ontoggle=()=>{draft=null;render();};
document.querySelectorAll('[data-speed]').forEach(b=>b.onclick=()=>{if(Number(b.dataset.speed)>0&&s.important.some(n=>!n.acknowledged)){s.notice='重要通知を確認してください。';render();return;}speed=Number(b.dataset.speed);setSpeed(pacer,speed);last=performance.now();render();});
function reset(){pause();clearCommand();s=createState({mode:$('scenario').value});$('serviceSelect').value='';if($('result').open)$('result').close();render();}$('reset').onclick=()=>{if(confirm('現在の運行を破棄しますか？'))reset();};$('replay').onclick=reset;
$('save').onclick=()=>{try{localStorage.setItem('aoba-save-v8',serialize(s));s.notice='完全状態を保存しました。';}catch{s.notice='保存できませんでした。';}render();};$('load').onclick=()=>{clearCommand();try{s=restore(localStorage.getItem('aoba-save-v8'));pause();s.resultViewed=false;$('scenario').value=s.mode;}catch(e){s.notice=e.message;}render({service:s.selectedService});};
$('help').onclick=()=>{pause();$('helpDialog').showModal();render();};$('closeHelp').onclick=()=>$('helpDialog').close();$('closeIntro').onclick=()=>$('intro').close();$('closeResult').onclick=()=>$('result').close();$('ack').onclick=()=>{s.important.forEach(n=>n.acknowledged=true);render();};
$('trainSelect').onchange=()=>selectTarget($('trainSelect').value);$('findTrain').onclick=()=>{const t=s.trains.find(t=>t.id===s.selected);focusTrain($('map'),t);};
document.addEventListener('visibilitychange',()=>{pause();render();});
function frame(now){const elapsed=now-last;last=now;const moved=advance(pacer,elapsed,{active:!document.hidden&&s.started&&!s.ended&&!$('intro').open&&!$('helpDialog').open,step:()=>tick(s),eventKey:()=>s.important.length+Number(s.ended)});speed=pacer.speed;if(moved)render();else $('speedNote').textContent=speed?`${speed}倍 / 実1秒＝ゲーム${speed}秒 / 次tickまでゲーム${Math.ceil(60*(1-progress(pacer)))}秒`:'停止中 / 計画可能';requestAnimationFrame(frame);}render();$('intro').showModal();requestAnimationFrame(frame);
