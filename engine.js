import {equipment,route,canReverse,reverseReason} from './equipment.js';
export {equipment,canReverse} from './equipment.js';
export const VERSION=4;
export const stations=['中央','桜町','学園前','川原','東川原','丘の上','新都心','森ヶ丘'];
export const hubs=[0,6,7], reliefStations=[0,2,4,6,7], capacities=[3,2,4,2,3,2,4,3];
export const LIMIT=36;
export function createState(){return {version:VERSION,time:0,started:false,phase:'導入',ended:false,selected:'T1',nextService:5,timetable:[],formations:['F1','F2','F3','F4'].map((id,i)=>({id,train:`T${i+1}`,at:[0,2,6,7][i],edge:null,status:i===3?'予備':'待機'})),trains:[{id:'T1',formation:'F1',crew:'C1',at:0,dir:1},{id:'T2',formation:'F2',crew:'C2',at:2,dir:1},{id:'T3',formation:'F3',crew:'C3',at:6,dir:-1},{id:'T4',formation:'F4',crew:null,at:7,dir:-1}].map(t=>({...t,platform:1,reserved:null,edge:null,remaining:0,busy:0,dest:null,origin:t.at,originPlatform:1,arrivalDirection:null,departureRoute:null,arrivalRoute:null,mode:'旅客',auto:false,onboard:0,service:null,held:false,riders:[]})),crews:[0,2,6,0,6,7].map((at,i)=>({id:`C${i+1}`,at,train:i<3?`T${i+1}`:null,duty:0,rest:0})),waiting:Array(8).fill(12),stats:{wait:0,transported:0,cancelled:0,fullWest:0,fullEast:0,blocked:0},history:[],important:[],notice:'現在は全区間で正常運転。列車を選び、行先と操作の説明を確認してください。', recoveryAt:null,reopenSnapshot:null};}
export function phase(s){return s.time<5?'平常運転':s.time<20?'区間閉鎖':s.time<35?'片方向再開':'全線再開';}
export function closed(s,a,b){return Math.min(a,b)===3 && (s.time>=5&&s.time<20 || s.time>=20&&s.time<35&&b<a);}
function log(s,msg){s.history.push({time:s.time,msg});s.notice=msg;}
export function clock(n){return `${String(8+Math.floor(n/60)).padStart(2,'0')}:${String(n%60).padStart(2,'0')}`;}
function crew(s,t){return s.crews.find(c=>c.id===t.crew);}
export function options(s,id){let t=s.trains.find(t=>t.id===id);return {train:t,crew:t&&crew(s,t)};}
function autoReason(s,t,dest=t.dest){
 if(dest===null)return canReverse(t)||route(t.at,t.platform,'departure',t.dir)&&route(t.at,t.platform,'arrival',-t.dir)?'':`${stations[t.at]}${t.platform}番線には往復に必要な進入・出発信号／列車進路がありません。`;
 const d=Math.sign(dest-t.at)||t.dir;
 if(!route(t.origin,t.originPlatform??t.platform,'departure',d)||!route(t.origin,t.originPlatform??t.platform,'arrival',-d))return `${stations[t.origin]}の起点番線に戻り方向の出発進路がありません。`;
 if(!equipment[dest].platforms.some(p=>route(dest,p.number,'arrival',d)&&route(dest,p.number,'departure',-d)))return `${stations[dest]}に到着方向と折返方向を満たす番線・出発信号／列車進路がありません。`;
 return '';
}
function reverse(t){const reason=reverseReason(t);if(reason)return reason;t.dir*=-1;t.busy=3;return '';}
export function arrivalPlatform(s,t,n,d){const used=platformUse(s,n).map(u=>u.platform);const required=t.auto&&n===t.dest?-d:d;
 const candidates=equipment[n].platforms.filter(p=>!used.includes(p.number)&&route(n,p.number,'arrival',d)&&(n===t.dest&&!t.auto||route(n,p.number,'departure',required)));
 candidates.sort((a,b)=>n===t.dest?Number(!!route(n,b.number,'departure',-d))-Number(!!route(n,a.number,'departure',-d)):Number(!!route(n,a.number,'departure',-d))-Number(!!route(n,b.number,'departure',-d)));
 return candidates[0]?.number??null;
}
export function departureReason(s,t,d=Math.sign(t.dest-t.at),n=t.at+d){
 if(!route(t.at,t.platform,'departure',d))return `${stations[t.at]}${t.platform}番線には${d===1?'東':'西'}向き出発信号／列車進路がありません。`;
 if(closed(s,t.at,n))return `${stations[t.at]}―${stations[n]}はこの方向に閉鎖中です。`;
 if(s.trains.some(x=>x!==t&&x.edge&&Math.min(...x.edge)===Math.min(t.at,n)))return '隣接区間が占有中です。対向・続行とも到着を待ってください。';
 const target=arrivalPlatform(s,t,n,d);
 const out=route(t.at,t.platform,'departure',d);const incoming=target===null?null:route(n,target,'arrival',d);const locks=[...out.locks,...(incoming?.locks??[])];
 if(s.trains.some(x=>x!==t&&x.edge&&[x.departureRoute,x.arrivalRoute].filter(Boolean).some(id=>equipment.flatMap(e=>e.routes).find(r=>r.id===id)?.locks.some(l=>locks.includes(l)))))return '駅の進路鎖錠資源が使用中です。到着を待ってください。';
 if(arrivalPlatform(s,t,n,d)===null)return `${stations[n]}の対応番線が満杯、または必要な進入・出発進路がありません。`;
 return '';
}
export function check(s,id,action,arg){let t=s.trains.find(t=>t.id===id);if(!t)return '列車がありません。';if(!s.started||s.ended)return '運転開始前または結果表示中です。';if(t.edge!==null)return '走行中です。到着後に操作してください。';if(action==='auto')return t.auto?'':autoReason(s,t);if(action==='hold')return '';if(t.busy)return `準備中です。あと${t.busy}分必要です。`;
 if(action==='hold'||action==='auto')return '';
 if(action==='alight'){if(!t.riders.length)return '同乗乗務員がいません。';return '';}
 if(action==='transfer'){if(!t.crew)return 'まず担当乗務員を交代・予備投入で割り当ててください。';if(t.dest!==null)return '発車前に同乗を指定してください。';if(!s.crews.some(c=>!c.train&&!c.ride&&c.at===t.at&&!c.rest))return '駅に同乗できる待機乗務員がいません。';return '';}
 if(action==='turn'){if(reverseReason(t))return reverseReason(t);if(t.dest!==null)return '先に抑止して現在の運用を解除してください。';return '';}
 if(action==='rest'){if(!t.crew)return '乗務員がいません。';if(!hubs.includes(t.at))return '休憩設備は中央・新都心・森ヶ丘だけです。';if(t.dest!==null)return '先に抑止してください。';return '';}
 if(action==='relief'){if(!reliefStations.includes(t.at))return '交代設備は中央・学園前・東川原・新都心・森ヶ丘です。待機乗務員は列車に同乗して届けられます。';if(t.dest!==null)return '先に抑止してください。';if(!s.crews.some(c=>!c.train&&!c.ride&&c.at===t.at&&!c.rest&&c.duty===0))return 'この駅に休憩済みの待機乗務員がいません。';return '';}
 if(action==='dispatch'){
 if(!Number.isInteger(arg?.dest)||arg.dest<0||arg.dest>7||arg.dest===t.at)return '異なる行先駅を選んでください。';
 if(t.dest!==null)return '現在の運用を先に抑止してください。';
 if(t.auto&&autoReason(s,{...t,origin:t.at,originPlatform:t.platform},arg.dest))return `自動往復不可：${autoReason(s,{...t,origin:t.at,originPlatform:t.platform},arg.dest)} 自動OFFなら片道運用ができます。`;
 const d=Math.sign(arg.dest-t.at);if(t.dir!==d)return '進行方向が逆です。折り返しを先に実施してください。';
 let c=crew(s,t);if(!c)return '乗務員がいません。拠点で交代・予備投入してください。';if(c.rest)return `休憩中です。あと${c.rest}分。`;
 const duration=Math.abs(arg.dest-t.at)*4;if(c.duty+duration>LIMIT)return `乗務上限36分を超えます（現在${c.duty}分＋最大${duration}分）。短い運用か拠点で休憩・交代を選んでください。`;
 for(let a=t.at;a!==arg.dest;a+=d){if(closed(s,a,a+d))return `${stations[a]}―${stations[a+d]}はこの方向に閉鎖中です。`;}
 const n=t.at+d;return departureReason(s,{...t,dest:arg.dest},d,n);
 return '';
 }
 return '不明な操作です。';}
export function platformUse(s,n){return s.trains.filter(t=>t.edge?t.edge[1]===n:t.at===n).map(t=>({id:t.id,platform:t.edge?t.reserved:t.platform,reserved:!!t.edge}));}
function occupancy(s,n){return s.trains.filter(t=>t.edge===null?t.at===n:t.edge[1]===n).length;}
export function preview(s,id,action,arg){const reason=check(s,id,action,arg);let t=s.trains.find(t=>t.id===id);let info={alight:'同乗乗務員を現在の駅で降車。拠点なら8分休憩。人の位置は変わりません。',transfer:'待機乗務員1名を次の行先まで同乗。乗務時間は加算されません。折り返し駅で交代、拠点で休憩できます。',dispatch:`所要最大${t&&arg?Math.abs(arg.dest-t.at)*4:0}分（競合待ちを除く）。${arg?.mode==='回送'?'輸送なし・編成と乗務員を移送。':'各駅で最大80人輸送。'} 行先側に編成と乗務員が移ります。`,turn:'3分拘束。向きを反転。反対側へ戻すには再度3分必要です。',rest:'8分拘束。乗務時間を0分に戻します。休憩中の輸送はできません。',relief:'2分拘束。駅の待機乗務員を使用。離脱乗務員はこの拠点なら8分休憩、他駅では待機します。',hold:'駅で現在の運用を解除し自動折り返しも停止。走行中は到着を待ちます。',auto:'現在の起点番線と到着予定番線に戻り方向の出発信号・進路がある運用のみON可。到着駅で3分折り返し、元の出発駅へ同じ種別で発車。閉鎖・上限・競合時は停止し再試行します。抑止で解除できます。'}[action];return {reason,info};}
export function act(s,id,action,arg){const reason=check(s,id,action,arg);if(reason){s.stats.blocked++;s.notice=reason;return false;}let t=s.trains.find(t=>t.id===id),c=crew(s,t);
 if(action==='alight'){for(const id of t.riders){let r=s.crews.find(c=>c.id===id);r.ride=null;r.at=t.at;if(hubs.includes(t.at))r.rest=8;}t.riders=[];}
 if(action==='transfer'){const rider=s.crews.find(c=>!c.train&&!c.ride&&c.at===t.at&&!c.rest);rider.ride=t.id;t.riders.push(rider.id);}
 if(action==='dispatch'){t.dest=arg.dest;t.origin=t.at;t.originPlatform=t.platform;t.mode=arg.mode==='回送'?'回送':'旅客';t.service=`S${s.nextService++}`;recordService(s,t);s.formations.find(f=>f.id===t.formation).status='運用';t.held=false;depart(s,t);}
 if(action==='turn')reverse(t);
 if(action==='hold'){cancelService(s,t);t.dest=null;t.auto=false;t.held=true;}
 if(action==='auto')t.auto=!t.auto;
 if(action==='rest'){c.rest=8;t.busy=8;}
 if(action==='relief'){const next=s.crews.find(x=>!x.train&&!x.ride&&x.at===t.at&&!x.rest&&x.duty===0);if(c){c.train=null;c.at=t.at;c.rest=hubs.includes(t.at)?8:0;}next.train=t.id;t.crew=next.id;t.busy=2;}
 log(s,`${id} ${ {dispatch:`${t.mode} ${stations[t.origin]}→${stations[t.dest]}`,turn:'折り返し準備3分',hold:'抑止・運用解除',auto:t.auto?'自動折り返しON':'自動折り返しOFF',rest:'乗務員休憩8分',alight:'同乗乗務員を降車',transfer:'待機乗務員同乗（行先で降車）',relief:`${t.crew}へ交代2分`}[action]}`);return true;}
function depart(s,t){if(t.dest===null||t.busy||t.edge!==null)return;let d=Math.sign(t.dest-t.at),n=t.at+d,c=crew(s,t);if(d!==t.dir){cancelService(s,t);t.dest=null;t.auto=false;log(s,`${t.id} 進行方向と運用が不一致のため抑止。折り返し駅で運用を再指定してください。`);return;}if(c&&c.duty+Math.abs(t.dest-t.at)*4>LIMIT){cancelService(s,t);t.dest=null;t.auto=false;log(s,`${t.id} 乗務余裕不足。駅で抑止し休憩・交代または短い運用へ。`);return;}if(!c||c.rest||departureReason(s,t,d,n)||c.duty+3>LIMIT)return;
 const service=s.timetable.find(r=>r.id===t.service);if(service&&service.actualDeparture===null)service.actualDeparture=s.time;
 if(t.mode==='旅客'){t.onboard=Math.min(80,s.waiting[t.at]);s.waiting[t.at]-=t.onboard;}t.reserved=arrivalPlatform(s,t,n,d);t.departureRoute=route(t.at,t.platform,'departure',d).id;t.arrivalRoute=route(n,t.reserved,'arrival',d).id;t.edge=[t.at,n];let f=s.formations.find(f=>f.id===t.formation);f.at=null;f.edge=[t.at,n];f.status='走行';t.remaining=3;c.at=null;for(const id of t.riders)s.crews.find(c=>c.id===id).at=null;}
export function tick(s,count=1){if(!s.started||s.ended)return s;for(let k=0;k<count&&!s.ended;k++){
 s.time++;let p=phase(s);if(p!==s.phase){s.phase=p;if(p==='全線再開')s.reopenSnapshot=s.trains.map(t=>({id:t.id,at:t.at,moving:!!t.edge,duty:crew(s,t)?.duty??null,crew:t.crew}));const message=p==='区間閉鎖'?'事故発生：08:05 川原―東川原の設備故障。走行中の列車は当該区間を退出後に閉鎖。':p==='片方向再開'?'08:20 現場確認：東向きのみ再開。西向きの再開時刻は未確定です。':'08:35 全線再開。両方向各2本の端から端までの旅客運行と配置復旧を目指してください。';s.important.push({time:s.time,msg:message,acknowledged:false});log(s,message);}
 for(let i=0;i<8;i++){s.waiting[i]+=i===0||i===7?5:3;s.stats.wait+=s.waiting[i];}
 for(let c of s.crews){if(c.rest){c.rest--;if(!c.rest)c.duty=0;}}
 for(let t of s.trains){let c=crew(s,t);if(t.busy){t.busy--;if(!t.busy&&t.dest!==null)depart(s,t);continue;}if(t.edge){c.duty++;t.remaining--;if(!t.remaining){t.arrivalDirection=t.dir;t.at=t.edge[1];t.platform=t.reserved;t.reserved=null;t.edge=null;t.departureRoute=null;t.arrivalRoute=null;const service=s.timetable.find(r=>r.id===t.service);if(service){service.stops.find(r=>r.at===t.at).actual=s.time;if(t.at===t.dest)service.status='完了';}let f=s.formations.find(f=>f.id===t.formation);f.at=t.at;f.edge=null;f.status='待機';c.at=t.at;for(const id of t.riders)s.crews.find(c=>c.id===id).at=t.at;s.stats.transported+=t.onboard;t.onboard=0;t.busy=1;
 if(t.at===t.dest){for(const id of t.riders){let rider=s.crews.find(c=>c.id===id);rider.ride=null;if(hubs.includes(t.at))rider.rest=8;}t.riders=[];if(s.time>=35&&t.mode==='旅客'&&Math.abs(t.origin-t.dest)===7){if(t.dest===0)s.stats.fullWest++;else s.stats.fullEast++;log(s,`${t.id} 全線旅客運行完了（${stations[t.dest]}着）`);}const old=t.origin;t.dest=null;if(t.auto){const reason=reverseReason(t)||reverse(t);if(reason){t.auto=false;log(s,`${t.id} 自動往復停止：${reason} 向きを保持し、同方向の片道運用を指定してください。`);}else{t.dest=old;t.origin=t.at;t.originPlatform=t.platform;t.service=`S${s.nextService++}`;recordService(s,t);}}}
 }}else if(t.dest!==null){if(c&&c.duty+Math.abs(t.dest-t.at)*4>LIMIT){cancelService(s,t);t.auto=false;t.dest=null;log(s,`${t.id} 乗務時間の余裕不足で駅抑止。短い運用または休憩・交代が必要。`);}else depart(s,t);}}
 const west=s.trains.filter(t=>t.edge===null&&t.at<=2).length,east=s.trains.filter(t=>t.edge===null&&t.at>=6).length;
 if(s.stats.fullWest>=2&&s.stats.fullEast>=2&&west>=1&&east>=1&&s.trains.every(t=>!t.edge&&!t.busy)){s.ended=true;s.recoveryAt=s.time;log(s,'配置と全線輸送の復旧を達成しました。');}
 if(s.time>=120&&!s.ended){s.ended=true;s.stats.cancelled=Math.max(0,4-s.stats.fullWest-s.stats.fullEast);log(s,'10:00 指令終了。復旧条件未達。履歴と残った資源を確認してください。');}
 }return s;}

function recordService(s,t){const d=Math.sign(t.dest-t.at);s.timetable.push({id:t.service,train:t.id,mode:t.mode,origin:t.at,dest:t.dest,departure:s.time,actualDeparture:null,status:'運行中',stops:Array.from({length:Math.abs(t.dest-t.at)},(_,i)=>({at:t.at+d*(i+1),planned:s.time+3+i*4,actual:null}))});}
function cancelService(s,t){const r=s.timetable.find(r=>r.id===t.service);if(r&&r.status==='運行中')r.status='運休';}
export function serviceDelay(s,r){return Math.max(0,...r.stops.map(x=>x.actual!==null?x.actual-x.planned:r.status==='運行中'?s.time-x.planned:0));}

export function start(s){s.started=true;s.phase=phase(s);log(s,'運転開始。自動発車はOFF。行先を選び発車してください。');}
export function serialize(s){return JSON.stringify(s);}
export function restore(raw){if(typeof raw!=='string'||raw.length>1000000)throw Error('保存データが大きすぎるか形式が不正です。');let s;try{s=JSON.parse(raw);}catch{throw Error('保存データがJSONではありません。現在のゲームは保持しました。');}const bad=()=>{throw Error('保存形式・状態が不正、またはバージョンが異なります。現在のゲームは保持しました。');};
 if(!s||s.version!==VERSION||!Number.isInteger(s.time)||s.time<0||s.time>120||!Array.isArray(s.trains)||s.trains.length!==4||!Array.isArray(s.crews)||s.crews.length!==6)bad();
 if(!Array.isArray(s.timetable)||s.timetable.length>1000||s.timetable.some(r=>!/^S[0-9]+$/.test(r.id)||!s.trains.some(t=>t.id===r.train)||!['旅客','回送'].includes(r.mode)||!['運行中','完了','運休'].includes(r.status)||!Number.isInteger(r.departure)||r.departure<0||r.departure>s.time||!(r.actualDeparture===null||Number.isInteger(r.actualDeparture)&&r.actualDeparture>=r.departure&&r.actualDeparture<=s.time)||!Number.isInteger(r.origin)||r.origin<0||r.origin>7||!Number.isInteger(r.dest)||r.dest<0||r.dest>7||r.origin===r.dest||!Array.isArray(r.stops)||r.stops.length!==Math.abs(r.dest-r.origin)||r.stops.some((x,i)=>x.at!==r.origin+Math.sign(r.dest-r.origin)*(i+1)||x.planned!==r.departure+3+i*4||!(x.actual===null||Number.isInteger(x.actual)&&x.actual>=x.planned&&x.actual<=s.time))))bad();if(new Set(s.timetable.map(r=>r.id)).size!==s.timetable.length)bad();
 if(!Array.isArray(s.important)||s.important.length>3||s.important.some((n,i)=>n.time!==[5,20,35][i]||n.time>s.time||typeof n.msg!=='string'||typeof n.acknowledged!=='boolean')||s.important.length!==[5,20,35].filter(t=>t<=s.time).length)bad();
 const base=createState();for(const key of Object.keys(base))if(!(key in s))bad();
 for(const key of ['started','ended'])if(typeof s[key]!=='boolean')bad();if(!Array.isArray(s.formations)||s.formations.length!==4||!Array.isArray(s.history)||s.history.some(h=>!Number.isInteger(h.time)||h.time<0||h.time>s.time||typeof h.msg!=='string'))bad();
 if(!Array.isArray(s.waiting)||s.waiting.length!==8||s.waiting.some(n=>!Number.isInteger(n)||n<0)||!s.stats||Object.keys(base.stats).some(k=>!Number.isInteger(s.stats[k])||s.stats[k]<0))bad();
 if(!(s.recoveryAt===null||Number.isInteger(s.recoveryAt)&&s.recoveryAt>=35&&s.recoveryAt<=s.time)||s.recoveryAt!==null&&!s.ended)bad();if(s.reopenSnapshot!==null&&(!Array.isArray(s.reopenSnapshot)||s.reopenSnapshot.length!==4||s.reopenSnapshot.some((r,i)=>r.id!==`T${i+1}`||!Number.isInteger(r.at)||r.at<0||r.at>7||typeof r.moving!=='boolean'||!(r.duty===null||Number.isInteger(r.duty)&&r.duty>=0&&r.duty<=LIMIT))))bad();
 const pos=n=>Number.isInteger(n)&&n>=0&&n<8;const int=n=>Number.isInteger(n)&&n>=0;
 for(let i=0;i<4;i++){let t=s.trains[i];let f=s.formations[i];if(f?.train!==t.id||f.at!==(t.edge?null:t.at)||JSON.stringify(f.edge)!==JSON.stringify(t.edge)||!['予備','待機','運用','走行'].includes(f.status))bad();if(!Array.isArray(t.riders)||new Set(t.riders).size!==t.riders.length||t.riders.some(id=>!s.crews.some(c=>c.id===id&&c.ride===t.id)))bad();if(!Number.isInteger(t.platform)||t.platform<1||t.platform>capacities[t.at]||!(t.edge?Number.isInteger(t.reserved)&&t.reserved>=1&&t.reserved<=capacities[t.edge[1]]:t.reserved===null))bad();if(t.id!==`T${i+1}`||t.formation!==`F${i+1}`||s.formations[i]?.id!==t.formation||!pos(t.at)||![-1,1].includes(t.dir)||!int(t.busy)||t.busy>8||!int(t.remaining)||t.remaining>3||!int(t.onboard)||t.onboard>80||!pos(t.origin)||!(t.dest===null||pos(t.dest))||!['旅客','回送'].includes(t.mode)||typeof t.auto!=='boolean'||typeof t.held!=='boolean')bad();if(t.dest!==null&&(t.dest===t.at&&!t.edge||Math.sign(t.dest-t.at)!==t.dir))bad();if(t.edge!==null&&(!Array.isArray(t.edge)||t.edge.length!==2||t.edge[0]!==t.at||!pos(t.edge[1])||Math.abs(t.edge[1]-t.at)!==1||t.remaining<1||!t.crew||t.dest===null))bad();if(!t.edge&&(t.remaining!==0||t.onboard!==0))bad();}
 // 同じ設備経路をロードでも検証。方向を変えた保存で信号を迂回しない。
 for(const t of s.trains){
  if(t.auto&&autoReason(s,t))bad();
  if(!Number.isInteger(t.originPlatform)||t.originPlatform<1||t.originPlatform>capacities[t.origin])bad();
  if(t.arrivalDirection!==null){if(![-1,1].includes(t.arrivalDirection)||!route(t.at,t.platform,'arrival',t.arrivalDirection))bad();if(t.dir!==t.arrivalDirection&&!route(t.at,t.platform,'departure',t.dir))bad();}else if(t.at!==base.trains[s.trains.indexOf(t)].at||t.platform!==1)bad();
  if(!t.edge&&!route(t.at,t.platform,'departure',t.dir)){
   const arrivals=s.timetable.filter(r=>r.train===t.id).flatMap(r=>r.stops.filter(x=>x.actual!==null).map(x=>({at:x.at,time:x.actual,dir:Math.sign(r.dest-r.origin)}))).sort((a,b)=>b.time-a.time);
   if(!arrivals.length||arrivals[0].at!==t.at||arrivals[0].dir!==t.dir||!route(t.at,t.platform,'arrival',t.dir))bad();
  }
  if(t.dest!==null){const r=s.timetable.find(r=>r.id===t.service);if(!r||r.train!==t.id||r.origin!==t.origin||r.dest!==t.dest||r.mode!==t.mode||r.status!=='運行中'||Math.sign(r.dest-r.origin)!==t.dir||t.at<Math.min(r.origin,r.dest)||t.at>Math.max(r.origin,r.dest))bad();}
  if(t.edge){const d=Math.sign(t.edge[1]-t.edge[0]);if(d!==t.dir||route(t.at,t.platform,'departure',d)?.id!==t.departureRoute||route(t.edge[1],t.reserved,'arrival',d)?.id!==t.arrivalRoute)bad();if(t.edge[1]!==t.dest||t.auto){if(!route(t.edge[1],t.reserved,'departure',t.auto&&t.edge[1]===t.dest?-d:d))bad();}}
 }
 for(let i=0;i<6;i++){let c=s.crews[i];if(c.id!==`C${i+1}`||!(c.at===null||pos(c.at))||!int(c.duty)||c.duty>LIMIT||!int(c.rest)||c.rest>8)bad();if(c.rest&&!hubs.includes(c.at))bad();if(c.train!==null&&c.ride)bad();if(c.train!==null){let t=s.trains.find(t=>t.id===c.train);if(!t||t.crew!==c.id||c.at!==(t.edge?null:t.at))bad();}else if(c.ride){let t=s.trains.find(t=>t.id===c.ride);if(!t||!t.riders.includes(c.id)||c.at!==(t.edge?null:t.at))bad();}else if(!pos(c.at))bad();}
 for(let t of s.trains)if(t.crew!==null&&!s.crews.some(c=>c.id===t.crew&&c.train===t.id))bad();
 for(let i=0;i<8;i++){if(occupancy(s,i)>capacities[i])bad();const slots=platformUse(s,i).map(x=>x.platform);if(new Set(slots).size!==slots.length)bad();}let edges=s.trains.filter(t=>t.edge).map(t=>Math.min(...t.edge));if(new Set(edges).size!==edges.length)bad();if(!int(s.nextService)||s.nextService<5||typeof s.notice!=='string'||s.phase!==(s.started?phase(s):'導入')||!s.trains.some(t=>t.id===s.selected))bad();return s;}
export function result(s){return {success:s.recoveryAt!==null,wait:s.stats.wait,transported:s.stats.transported,west:s.stats.fullWest,east:s.stats.fullEast,distribution:stations.map((name,i)=>`${name} ${s.trains.filter(t=>!t.edge&&t.at===i).length}編成`).filter((_,i)=>s.trains.some(t=>!t.edge&&t.at===i)),score:Math.max(0,Math.round(s.stats.transported-s.stats.wait/100+(s.recoveryAt?500:0)))};}

export function playerInfo(s){const n=s.important.at(-1);return {constraint:s.phase==='区間閉鎖'?'川原―東川原：双方向閉鎖':s.phase==='片方向再開'?'川原 → 東川原のみ開通。西向き閉鎖':s.phase==='全線再開'?'全区間開通 / 輸送・配置復旧を実行':'全区間正常運転',reports:s.important.map(n=>({...n})),latest:n?.msg||'現在の運転制約変更はありません。'};}
