import {createState,start,tick,act,validate} from '../engine.js';
export function strategy(policy='local',onMinute=()=>{}){
 const s=createState();start(s);const cmd=(id,a,arg={})=>{if(!act(s,id,a,arg))throw Error(`${s.time} ${id} ${a}: ${s.notice}`);};
 while(!s.ended){
 if(s.time===5&&policy==='local'){cmd('T1','resume',{service:'AM012'});cmd('T3','resume',{service:'DM008'});cmd('T1','shorten',{service:'A024',dest:4});cmd('T3','shorten',{service:'D028',dest:2});}
 if(policy==='local'){
 if(s.time===38){cmd('T1','dispatch',{dest:7,crew:'C3'});cmd('T3','dispatch',{dest:0,crew:'C11'});cmd('T4','prepare',{crew:'C8'});}
 if(s.time===44)cmd('T4','depotOut',{crew:'C8'});
 if(s.time===57){cmd('T3','endBreak',{crew:'C11'});cmd('T3','transfer',{crew:'C11'});}
 if(s.time===60){cmd('T4','endBreak',{crew:'C3'});cmd('T4','transfer',{crew:'C3'});}
 if(s.time===55)cmd('T1','depotIn',{crew:'C20'});
 if(s.time===52)cmd('T3','reassignCycle',{service:'A060',crew:'C1'});
 if(s.time===55)cmd('T4','reassignCycle',{service:'D064',crew:'C9'});
 }
 if(policy==='wait-rescue'){
 if(s.time===8)cmd('T4','prepare',{crew:'C8'});
 if(s.time===14)cmd('T4','depotOut',{crew:'C8'});
 if(s.time===20)cmd('T4','dispatch',{dest:4,crew:'C8'});
 if(s.time===35)cmd('T4','dispatch',{dest:7,crew:'C8'});
 if(s.time===65){for(const service of ['A024','A060','D028','D064'])cmd(service[0]==='A'?'T1':'T3','cancel',{service});cmd('T1','resume',{service:'AM012'});cmd('T3','resume',{service:'DM008'});}
 if(s.time===90){cmd('T1','endBreak',{crew:'C2'});cmd('T1','transfer',{crew:'C3'});}
 if(s.time===126)cmd('T1','transfer',{crew:'C1'});
 if(s.time===130)cmd('T3','transfer',{crew:'C9'});
 if(s.time===94){cmd('T3','endBreak',{crew:'C10'});cmd('T3','transfer',{crew:'C11'});}
 }
 if(policy==='wait-only'&&s.time===65){cmd('T1','resume',{service:'AM012'});cmd('T3','resume',{service:'DM008'});}
 tick(s);validate(s);onMinute(s);
 }return s;
}
