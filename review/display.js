import {stations,capacities,hubs,platformUse,clock,serviceDelay,departureReason} from './engine.js';
import {equipment,stationX,platformY,route} from './equipment.js';
const xAt=stationX,yAt=platformY;
// 設備の存在と経路の可用性を分離。実信号現示はモデル化しない。
export function routeAvailability(s,at,platform,dir){
 const out=route(at,platform,'departure',dir);
 if(!out)return {status:'経路なし',reason:`${stations[at]}${platform}番線には${dir===1?'東':'西'}向き出発信号／列車進路がありません。`};
 const active=s.trains.filter(t=>t.edge).flatMap(t=>[t.departureRoute,t.arrivalRoute]).filter(Boolean).map(id=>equipment.flatMap(e=>e.routes).find(r=>r.id===id));
 if(active.some(r=>r?.locks.some(l=>out.locks.includes(l))))return {status:'進路鎖錠中',reason:'走行列車がこの駅側の進路資源を使用中です。'};
 const occupant=s.trains.find(t=>!t.edge&&t.at===at&&t.platform===platform);
 const reason=departureReason(s,{...(occupant||{}),at,platform,dir,dest:at+dir,auto:false},dir,at+dir);
 return {status:reason?(reason.includes('占有中')?'閉塞待ち':'設定不可'):'設定可能',reason:reason||'未設定。発車操作で経路を設定・鎖錠します（乗務員・準備条件は操作欄で確認）。'};
}
export function mapSVG(s){
 let out='<svg viewBox="0 0 2660 325" role="img" aria-label="駅間単線・方向別信号と番線。横スクロールで詳細を確認">';
 for(let i=0;i<7;i++){
 const blocked=i===3&&['区間閉鎖','片方向再開'].includes(s.phase);
 out+=`<path data-block="${i}" d="M ${xAt(i)+120} 90 H ${xAt(i+1)-120}" stroke="${blocked?'#e6a665':'#739bac'}" stroke-width="4"/><text x="${xAt(i)+170}" y="62" text-anchor="middle" fill="#edbc76" font-size="14">${blocked?s.phase==='区間閉鎖'?'閉鎖':'東 → のみ':'単線'}</text>`;
 }
 equipment.forEach(e=>{
 const x=xAt(e.at);out+=`<text x="${x}" y="22" text-anchor="middle" fill="#e1edf5" font-size="18">${e.name}</text>`;
 for(const seg of e.segments)out+=`<path data-segment="${seg.id}" d="M ${seg.a.join(' ')} L ${seg.b.join(' ')}" stroke="#739bac" stroke-width="3" fill="none"/>`;
 for(const p of e.platforms){const y=yAt(p.number);out+=`<rect x="${x-40}" y="${y+15}" width="80" height="8" fill="#8193a0"/><text x="${x+50}" y="${y+20}" fill="#dce5ed" font-size="14">${p.number}番</text>`;
 if(e.at===0||e.at===7){const end=x+(e.at===0?-48:48);out+=`<path d="M ${end} ${y-8} V ${y+8}" stroke="#dce5ed" stroke-width="5"/>`;}
 const u=platformUse(s,e.at).find(u=>u.platform===p.number);if(u?.reserved)out+=`<text x="${x}" y="${y-16}" text-anchor="middle" fill="#edbc76" font-size="14">${u.id} 到着予約</text>`;
 }
 for(const signal of e.signals){
 if(!signal.id.includes(':out:')){const side=-signal.dir;const x1=x+side*120;out+=`<g data-signal="${signal.id}"><title>${e.name} ${signal.dir===1?'東':'西'}向き場内信号設備：番線への進入経路（実現示は表示しません）</title><rect x="${x1-4}" y="59" width="8" height="12" fill="none" stroke="#aac0ce" stroke-width="2"/><text x="${x1-10}" y="48" fill="#dce5ed" font-size="14">場内${signal.dir===1?'→':'←'}</text></g>`;continue;}
 if(!route(e.at,signal.platform,'departure',signal.dir))continue;
 const x1=x+signal.dir*40,y=yAt(signal.platform)-12;
 out+=`<g data-signal="${signal.id}"><title>${e.name}${signal.platform}番 ${signal.dir===1?'東':'西'}向き出発信号設備（実現示は表示しません）</title><rect x="${x1-4}" y="${y-6}" width="8" height="12" fill="none" stroke="#aac0ce" stroke-width="2"/><text x="${x1+signal.dir*10}" y="${y+4}" fill="#dce5ed" font-size="14">${signal.dir===1?'→':'←'}</text></g>`;
 }

 out+=`<text x="${x}" y="302" text-anchor="middle" fill="#9eb3c5" font-size="14">待ち ${s.waiting[e.at]}人${e.at===7?' / 予備：駅番線':''}</text>`;
 });
 s.trains.forEach(t=>{
 const d=t.edge?Math.sign(t.edge[1]-t.edge[0]):0;
 const x=t.edge?xAt(t.at)+d*(120+100*(3-t.remaining)/3):xAt(t.at),y=t.edge?90:yAt(t.platform);
 out+=`<g data-train="${t.id}" tabindex="0" role="button" aria-label="${t.id}を選択" style="cursor:pointer"><rect x="${x-21}" y="${y-10}" width="42" height="20" rx="4" fill="${t.id===s.selected?'#82d6b8':'#365a71'}"/><text x="${x}" y="${y+5}" text-anchor="middle" fill="${t.id===s.selected?'#0c2425':'#e7f3f8'}" font-size="14">${t.id}${t.dir===1?'→':'←'}</text></g>`;
 });
 const t=s.trains.find(t=>t.id===s.selected),e=equipment[t.at];
 const availability=e.platforms.map(p=>`<tr><td>${p.number}番</td>${[-1,1].map(d=>{const a=routeAvailability(s,e.at,p.number,d);return `<td>${d===1?'東':'西'}：${a.status}<br>${a.reason}</td>`;}).join('')}</tr>`).join('');
 return out+'</svg>'+`<section class="routeavailability"><h3>${e.name}：出発経路の可用性（信号現示ではありません）</h3><table><thead><tr><th>番線</th><th>西向き</th><th>東向き</th></tr></thead><tbody>${availability}</tbody></table></section>`+`<p class="trackdetail">${e.name}${t.platform}番線：出発進路 ${[-1,1].map(d=>route(t.at,t.platform,'departure',d)?`${d===1?'東':'西'}向き信号・進路あり`:`${d===1?'東':'西'}向き信号・進路なし`).join(' / ')}。中立の枠記号＋矢印は信号設備と方向（実現示は非表示）、灰色長方形はホーム、端の縦線は車止め。到着予約は進入・続行方向を満たす空き番線（終着は折返可能番線を優先）。</p>`;
}
export function timetableHTML(s){
 if(!s.timetable.length)return '<p>発車・運用指定で列車別の予定ダイヤを確定します。指定後は競合待ちでも予定時刻を動かしません。</p>';
 return '<table><thead><tr><th>運用 / 列車</th><th>発車予定 / 行先</th><th>到着予定 / 実績</th><th>状態・遅れ</th></tr></thead><tbody>'+s.timetable.slice().reverse().map(r=>{
  const last=r.stops.at(-1);return `<tr><td>${r.id} / ${r.train}<br>${r.mode}</td><td>${clock(r.departure)} ${stations[r.origin]}<br>実発${r.actualDeparture===null?'—':clock(r.actualDeparture)}<br>→${stations[r.dest]}</td><td>${clock(last.planned)}<br>${last.actual===null?'未着':clock(last.actual)}</td><td>${r.status}<br>${serviceDelay(s,r)}分遅れ<details data-service="${r.id}"><summary>駅別着・発</summary>${r.stops.map((x,i)=>`${stations[x.at]}：着予定${clock(x.planned)} / 実績${x.actual===null?'—':clock(x.actual)}${i<r.stops.length-1?'・発予定'+clock(x.planned+1):''}`).join('<br>')}</details></td></tr>`;
 }).join('')+'</tbody></table>';
}

export function updateTimetable(container,s){const opened=new Set([...container.querySelectorAll('details')].filter(d=>d.open).map(d=>d.dataset.service));container.innerHTML=timetableHTML(s);container.querySelectorAll('details').forEach(d=>d.open=opened.has(d.dataset.service));}
