// 実時間と1分tickの橋渡し。背景・停止・通知では余剰時間を捨てる。
export function createPacer(){return {speed:0,elapsed:0};}
export function setSpeed(p,speed){p.speed=speed;p.elapsed=0;}
export function advance(p,ms,{active=true,step,eventKey}){
 if(!active||ms<0||ms>2000){p.elapsed=0;return 0;}
 p.elapsed+=ms*p.speed;let count=0;
 while(p.speed&&p.elapsed>=60000){const before=eventKey();p.elapsed-=60000;step();count++;if(eventKey()!==before){setSpeed(p,0);break;}}
 return count;
}
export function progress(p){return p.elapsed/60000;}
