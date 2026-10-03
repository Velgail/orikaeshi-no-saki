import {stations,capacities,turns,hubs,platformUse,clock,serviceDelay} from './engine.js';
const xAt=i=>70+i*140, yAt=p=>78+(p-1)*34;
export function mapSVG(s){
 let out='<svg viewBox="0 0 1120 280" role="img" aria-label="青葉線の番線、渡り線、到着予約と列車位置">';
 for(let i=0;i<7;i++){
  const blocked=i===3&&s.time>=5&&s.time<35;
  out+=`<path d="M ${xAt(i)+42} 78 H ${xAt(i+1)-42}" stroke="${blocked?'#e6a665':'#4e788e'}" stroke-width="4"/>`;
  if(blocked)out+=`<text x="${xAt(i)+70}" y="65" text-anchor="middle" fill="#edbc76" font-size="11">${s.time<20?'× 閉鎖':'東向き →'}</text>`;
 }
 stations.forEach((name,i)=>{
  const x=xAt(i);out+=`<text x="${x}" y="23" text-anchor="middle" fill="#e1edf5" font-size="15">${name}</text><text x="${x}" y="43" text-anchor="middle" fill="#86c7b5" font-size="11">${turns.includes(i)?'折返 ':''}${hubs.includes(i)?'乗務拠点':''}</text>`;
  for(let p=1;p<=capacities[i];p++){
   const y=yAt(p),u=platformUse(s,i).find(u=>u.platform===p);
   out+=`<path d="M ${x-42} 78 L ${x-30} ${y} H ${x+30} L ${x+42} 78" fill="none" stroke="${u?'#83cbb9':'#4e788e'}" stroke-width="2"/><text x="${x-43}" y="${y+4}" text-anchor="end" fill="#b4c7d3" font-size="10">${p}</text>`;
   if(u?.reserved)out+=`<rect x="${x-27}" y="${y-11}" width="54" height="22" rx="3" fill="#172e3e" stroke="#edbc76" stroke-dasharray="4 3"/><text x="${x}" y="${y+4}" text-anchor="middle" fill="#edbc76" font-size="10">${u.id}予約</text>`;
  }
  if(turns.includes(i))out+=`<path d="M ${x-29} 78 L ${x+29} 112 M ${x-29} 112 L ${x+29} 78" fill="none" stroke="#86c7b5" stroke-width="2"/>`;
  if(i===7)out+=`<path d="M ${x+30} 78 L ${x+58} 208 H ${x-25}" fill="none" stroke="#86c7b5" stroke-width="2"/><text x="${x}" y="229" text-anchor="middle" fill="#86c7b5" font-size="11">車庫（投入は駅番線）</text>`;
  out+=`<text x="${x}" y="262" text-anchor="middle" fill="#9eb3c5" font-size="11">待ち ${s.waiting[i]}人</text>`;
 });
 s.trains.forEach(t=>{
  const x=t.edge?xAt(t.edge[0])+(xAt(t.edge[1])-xAt(t.edge[0]))*(3-t.remaining)/3:xAt(t.at),y=t.edge?205:yAt(t.platform);
  out+=`<g data-train="${t.id}" tabindex="0" role="button" aria-label="${t.id} ${t.edge?'走行中':stations[t.at]+t.platform+'番線'}を選択" style="cursor:pointer"><rect x="${x-27}" y="${y-11}" width="54" height="22" rx="4" fill="${t.id===s.selected?'#82d6b8':'#365a71'}"/><text x="${x}" y="${y+4}" text-anchor="middle" fill="${t.id===s.selected?'#0c2425':'#e7f3f8'}" font-size="11">${t.id} ${t.dir===1?'→':'←'}</text></g>`;
 });return out+'</svg>';
}
export function timetableHTML(s){
 if(!s.timetable.length)return '<p>発車・運用指定で列車別の予定ダイヤを確定します。指定後は競合待ちでも予定時刻を動かしません。</p>';
 return '<table><thead><tr><th>運用 / 列車</th><th>発車予定 / 行先</th><th>到着予定 / 実績</th><th>状態・遅れ</th></tr></thead><tbody>'+s.timetable.slice().reverse().map(r=>{
  const last=r.stops.at(-1);return `<tr><td>${r.id} / ${r.train}<br>${r.mode}</td><td>${clock(r.departure)} ${stations[r.origin]}<br>実発${r.actualDeparture===null?'—':clock(r.actualDeparture)}<br>→${stations[r.dest]}</td><td>${clock(last.planned)}<br>${last.actual===null?'未着':clock(last.actual)}</td><td>${r.status}<br>${serviceDelay(s,r)}分遅れ<details><summary>駅別着・発</summary>${r.stops.map((x,i)=>`${stations[x.at]}：着予定${clock(x.planned)} / 実績${x.actual===null?'—':clock(x.actual)}${i<r.stops.length-1?'・発予定'+clock(x.planned+1):''}`).join('<br>')}</details></td></tr>`;
 }).join('')+'</tbody></table>';
}
