import {createState,start,tick,act,validate} from '../engine.js';
export function strategy(policy='local',onMinute=()=>{}){const s=createState();start(s);const cmd=(id,a,arg)=>{if(!act(s,id,a,arg))throw Error(`${s.time} ${id} ${a}: ${s.notice}`);};
while(!s.ended){if(s.time===5){if(policy==='local'){cmd('T1','shorten',{service:'A000',dest:2});cmd('T1','resume',{service:'A000'});}else if(policy.startsWith('wait'))for(const service of ['A000','A036','B032'])cmd(service[0]==='B'?'T2':'T1','hold',{service});}
if(policy==='local'&&s.time===10){cmd('T1','dispatch',{dest:0});cmd('T3','assign',{service:'A036',crew:'C2'});}
if(policy==='local'&&s.time===102)cmd('T1','assign',{service:'A108',crew:'C4'});
if(policy.startsWith('wait')&&s.time===65){cmd('T1','resume',{service:'A000'});cmd('T1','resume',{service:'A036'});cmd('T2','resume',{service:'B032'});if(policy==='wait-rescue')cmd('T3','assign',{service:'A036',crew:'C2'});}
if(policy==='wait-rescue'&&s.time===100)cmd('T3','assign',{service:'A072',crew:'C3'});
if(policy==='wait-rescue'&&s.time===105){cmd('T1','endBreak',{crew:'C1'});cmd('T1','assign',{service:'A108',crew:'C1'});}
tick(s);validate(s);onMinute(s);}return s;}
