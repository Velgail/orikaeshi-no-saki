import {check,preview,routeClosureReason,stations,clock,commandFields} from './engine.js';
export function crewCandidates(s,id,action,arg={}){
 if(!commandFields(action).crew)return [];
 return s.crews.map(c=>({id:c.id,label:`${c.name} ${c.id} / ${stations[c.at]??'移動中'} / 所定終業${clock(c.plannedDutyEnd)}`,reason:check(s,id,action,{...arg,crew:c.id})})).filter(c=>!c.reason);
}
export function guidance(s,id,service){
 const t=s.trains.find(t=>t.id===id),rows=s.timetable.filter(r=>s.plans.find(p=>p.id===r.id).train===id&&!['完了','短縮完了','運休'].includes(s.actual.find(a=>a.id===r.id).status));
 const r=rows.find(r=>r.id===service)||rows.find(r=>r.id===t.service)||rows[0],p=s.plans.find(p=>p.id===r?.id),choices=[],blocked=[];
 const add=(action,label,arg={})=>{let crews=crewCandidates(s,id,action,arg);if(commandFields(action).crew&&crews.length&&!arg.crew)arg={...arg,crew:crews[0].id};const reason=check(s,id,action,arg);if(action==='shorten'&&routeClosureReason(s,t.edge?.[1]??t.at,arg.dest))label+='（変更計画・閉鎖手前で待機）';const item={action,label,arg,reason,crews,info:preview(s,id,action,arg).info};(reason?blocked:choices).push(item);};
 if(t.depotTrack){if(!t.busy)add(t.prepared?'depotOut':'prepare',t.prepared?'予備投入：森ヶ丘へ出庫（3分＋後処理3分）':'予備投入：車庫で準備を始める（5分）');}
 else if(t.depotMove||t.busy){/* 実時間の処理を待つ */}
 else if(t.service){if(p?.hold)add('resume',`この便を${stations[p.dest]}まで再開`,{service:r.id});else add('hold','この便を次の駅で抑止',{service:r.id});if(!t.edge)add('relief','現地の適格者へ乗務交代');}
 else {for(let dest=0;dest<8;dest++)if(dest!==t.at)add('dispatch',`${stations[dest]}へ運行する`,{dest,mode:'旅客'});}
 if(r){if(p.dest!==r.dest||p.train!==r.train)add('restorePlan','所定の変更計画に戻す（条件成立待ち）',{service:r.id});add('cancel','この便を部分運休する',{service:r.id});for(let dest=Math.min(r.origin,r.dest);dest<=Math.max(r.origin,r.dest);dest++)if(dest!==r.origin&&dest!==p.dest)add('shorten',`この便を${stations[dest]}で折返す`,{service:r.id,dest});
 if(p.hold||s.actual.find(a=>a.id===r.id).status==='未発車')add('planResume',`${stations[p.dest]}行きを将来計画として保存（実行待ち）`,{service:r.id});
 }
 if(!t.service&&!t.depotTrack&&!t.edge){for(const target of s.timetable.filter(x=>x.origin===t.at&&x.departure>=s.time&&s.plans.find(p=>p.id===x.id).train!==id&&s.actual.find(a=>a.id===x.id).status==='未発車').slice(0,8)){add('assign',`${clock(target.departure)} ${stations[target.origin]}→${stations[target.dest]}をこの編成で代走`,{service:target.id});add('reassignCycle',`${clock(target.departure)}以後の${target.train}運用をこの編成で代走`,{service:target.id});}}
 if(!t.edge&&!t.busy&&!t.depotTrack&&!t.depotMove)for(const action of ['endBreak','transfer','alight','break','depotIn'])for(const c of crewCandidates(s,id,action))add(action,`${c.label}：${{endBreak:'休憩を中断する',transfer:'この編成で便乗配置する',alight:'現駅で下車する',break:'自由休憩30分',depotIn:'車庫へ戻す（3分）'}[action]}`,{crew:c.id});
 const context=t.depotTrack?'車庫予備：準備5分 → 出庫3分 → 後処理3分 → 運転区間を選択':t.depotMove?'出入庫中：実経路と喉部を使用中。完了を待ってください。':t.busy?'終着・折返／準備中：処理完了後に次の判断を表示します。':t.edge?'走行中：既進入区間は安全退出。到着後の運転区間を判断してください。':t.service?'駅停車中：担当便の運転区間・折返・再開を判断します。':'駅待機：運転可能区間への運行、または始発駅が一致する便の代走を選べます。';
 return {service:r?.id,context,choices,blocked};
}
export function executeChoice(s,id,item){return check(s,id,item.action,item.arg);}
