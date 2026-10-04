// 架空の地上信号・通常列車進路。入換・代用閉塞・手信号は扱わない。
export const names=['中央','桜町','学園前','川原','東川原','丘の上','新都心','森ヶ丘'];
export const counts=[3,2,4,2,3,2,4,3];
export const stationX=i=>140+i*340;
export const platformY=p=>90+(p-1)*48;
const junction={id:'7:depot-junction',stem:'7:-1:stem3',normal:'block:6',reverse:'depot:lead'};
export function buildEquipment(){return names.map((name,at)=>{
 const x=stationX(at),n=counts[at],segments=[],points=[],routes=[],signals=[],platforms=[];
 const add=(id,a,b)=>{segments.push({id,a,b});return id;};
 const sidePaths={};
 for(const side of [-1,1]){
  const prefix=`${at}:${side}`,outer=[x+side*120,90];let stem=outer,chain=[],settings=[];
  for(let p=n;p>=2;p--){
   const node=[x+side*(100-(n-p)*14),90],end=[x+side*48,platformY(p)];
   const entry=add(`${prefix}:stem${p}`,stem,node),branch=add(`${prefix}:branch${p}`,node,end);
   const normal=`${prefix}:stem${p-1}`;
   const point={id:`${prefix}:P${p}`,stem:entry,normal,reverse:branch};points.push(point);
   sidePaths[`${side}:${p}`]={path:[...chain,entry,branch],points:[...settings,{id:point.id,state:'reverse'}]};
   chain.push(entry);settings.push({id:point.id,state:'normal'});stem=node;
  }
  const last=add(`${prefix}:stem1`,stem,[x+side*48,90]);sidePaths[`${side}:1`]={path:[...chain,last],points:settings};
 }
 for(let p=1;p<=n;p++){
  const track=add(`${at}:track${p}`,[x-48,platformY(p)],[x+48,platformY(p)]);
  const terminal=at===0||at===7;
  const bidirectional=[2,6].includes(at)?[1,4].includes(p):at===4&&p===1;
  const arrivalSides=terminal?[at===0?1:-1]:bidirectional?[-1,1]:[p===(at===4?3:at===2||at===6?3:2)?1:-1];
  const departures=terminal?[at===0?1:-1]:bidirectional?[-1,1]:arrivalSides.map(d=>-d);
  platforms.push({number:p,track,connections:terminal?[at===0?1:-1]:[-1,1],arrivalSides,departures});
  for(const side of terminal?[at===0?1:-1]:[-1,1]){
   const data=sidePaths[`${side}:${p}`];
   if(arrivalSides.includes(side))routes.push({id:`${at}:${p}:in:${side}`,kind:'arrival',at,platform:p,side,dir:-side,path:[...data.path,track],points:data.points,locks:[`${at}:throat:${side}`],signalID:`${at}:entry:${side}`});
   if(departures.includes(side)){
    const signalID=`${at}:${p}:out:${side}`;
    signals.push({id:signalID,at,platform:p,dir:side,segment:track});
    routes.push({id:`${at}:${p}:out:${side}`,kind:'departure',at,platform:p,side,dir:side,path:[track,...data.path.slice().reverse()],points:data.points,locks:[`${at}:throat:${side}`],signalID});
   }
  }
 }
 for(const side of at===0?[1]:at===7?[-1]:[-1,1])signals.push({id:`${at}:entry:${side}`,at,dir:-side,segment:sidePaths[`${side}:1`].path[0]});
 // 終端外側に分岐器は存在しない。各番線は車止めで終わる。
 if(at===0||at===7){const side=at===0?-1:1;for(let i=segments.length-1;i>=0;i--)if(segments[i].id.startsWith(`${at}:${side}:`))segments.splice(i,1);for(let i=points.length-1;i>=0;i--)if(points[i].id.startsWith(`${at}:${side}:`))points.splice(i,1);}
 if(at===7){points.push({...junction});for(const r of routes){r.points.push({id:junction.id,state:'normal'});r.boundarySegment='block:6';}}
 return {at,name,platforms,segments,points,routes,signals};
 });}
export const equipment=buildEquipment();
export function route(at,p,kind,dir){const e=equipment[at];return e.routes.find(r=>r.platform===p&&r.kind===kind&&r.dir===dir&&validRoute(e,r));}
export function validRoute(e,r){
 if(r.points.some(p=>!['normal','reverse'].includes(p.state)||!e.points.some(q=>q.id===p.id)))return false;
 const signal=e.signals.find(s=>s.id===r.signalID&&s.dir===r.dir);if(!signal||!r.path.includes(signal.segment)||!r.locks.includes(`${e.at}:throat:${r.side}`))return false;
 const seg=r.path.map(id=>e.segments.find(s=>s.id===id));if(seg.some(s=>!s))return false;
 const equal=(a,b)=>a[0]===b[0]&&a[1]===b[1];
 const x=stationX(e.at),y=platformY(r.platform);
 let cursor=r.kind==='arrival'?[x+r.side*120,90]:[x-r.side*48,y];
 for(const line of seg){if(equal(cursor,line.a))cursor=line.b;else if(equal(cursor,line.b))cursor=line.a;else return false;}
 const end=r.kind==='arrival'?[x-r.side*48,y]:[x+r.side*120,90];if(!equal(cursor,end))return false;
 if(r.kind==='arrival'?r.dir!==-r.side:r.dir!==r.side)return false;
 if(!e.platforms.some(p=>p.number===r.platform&&p.connections.includes(r.side)))return false;
 for(const point of e.points){const used=[...r.path,...(r.boundarySegment?[r.boundarySegment]:[])].filter(id=>[point.stem,point.normal,point.reverse].includes(id));if(used.length>=2){const setting=r.points.find(p=>p.id===point.id);if(!used.includes(point.stem)||!setting||!used.includes(point[setting.state]))return false;}}
 return true;
}
export function canReverse(t){return !!route(t.at,t.platform,'departure',-t.dir);}
export function reverseReason(t){return canReverse(t)?'':`${names[t.at]}${t.platform}番線には${t.dir===1?'西':'東'}向き出発信号／列車進路がありません。入換による別番線移動は扱いません。`;}
// 森ヶ丘西喉部に接続する限定出入庫経路。旅客進路と喉部鎖錠を共有。
export const yardEquipment={at:7,connection:[stationX(7)-120,90],segments:[],points:[],tracks:[],routes:[]};
const yard=yardEquipment,join=yard.connection;
yard.segments.push({id:'depot:lead',a:join,b:[2380,330]});
for(let p=1;p<=4;p++){
 const y=330+(p-1)*36,stem=p===1?'depot:lead':`depot:stem${p}`;
 if(p>1)yard.segments.push({id:stem,a:[2380,y-36],b:[2380,y]});
 const track=`depot:${p}`;yard.segments.push({id:track,a:[2380,y],b:[2580,y]});yard.tracks.push({number:p,segment:track,capacity:1});
 if(p<4)yard.points.push({id:`depot:point${p}`,stem,normal:`depot:stem${p+1}`,reverse:track});
 const path=['depot:lead',...Array.from({length:p-1},(_,i)=>`depot:stem${i+2}`),track];
 yard.routes.push({id:`depot:${p}:move`,track:p,path,points:yard.points.slice(0,p).map((q,i)=>({id:q.id,state:i===p-1?'reverse':'normal'})),locks:['7:throat:-1','depot:lead:lock'],duration:3});
}
export function yardPath(track,platform,kind){if(!['depotOut','depotIn'].includes(kind))return null;const move=yard.routes.find(r=>r.track===track),normal=route(7,platform,kind==='depotOut'?'arrival':'departure',kind==='depotOut'?1:-1);if(!move||!normal||!validYardRoute(move))return null;const combined={id:'depot:out',path:kind==='depotOut'?[...move.path].reverse().concat(normal.path):normal.path.concat(move.path),points:[...move.points,...normal.points.map(p=>p.id===junction.id?{id:p.id,state:'reverse'}:p)],locks:[...new Set([...move.locks,...normal.locks])]};const live=equipment[7].points.find(p=>p.id===junction.id);if(!live||!combined.path.includes(live.stem)||!combined.path.includes(live.reverse))return null;for(const point of [...equipment[7].points,...yardEquipment.points]){const used=combined.path.filter(id=>[point.stem,point.normal,point.reverse].includes(id));if(used.length>=2){const setting=combined.points.find(p=>p.id===point.id);if(!used.includes(point.stem)||!setting||!used.includes(point[setting.state]))return null;}}return combined;}

export function validYardRoute(r){let cursor=yardEquipment.connection;const equal=(a,b)=>a[0]===b[0]&&a[1]===b[1];for(const id of r.path){const seg=yardEquipment.segments.find(s=>s.id===id);if(!seg)return false;if(equal(cursor,seg.a))cursor=seg.b;else if(equal(cursor,seg.b))cursor=seg.a;else return false;}if(!equal(cursor,[2580,330+(r.track-1)*36])||!r.locks.includes('7:throat:-1'))return false;for(const p of yardEquipment.points){const used=r.path.filter(id=>[p.stem,p.normal,p.reverse].includes(id));if(used.length>=2){const setting=r.points.find(q=>q.id===p.id);if(!used.includes(p.stem)||!setting||!used.includes(p[setting.state]))return false;}}return true;}
