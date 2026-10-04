// DOMスタブで実appモジュールのイベントと再描画を実行。画面寸法の検証ではない。
import test from 'node:test';import assert from 'node:assert/strict';
import {createState,start,act} from '../engine.js';import {updateTimetable} from '../display.js';
class Element{
 constructor(){this.value='';this.dataset={};this.open=false;this.details=[];this.textContent='';}
 set innerHTML(v){this.html=v;this.details=[...v.matchAll(/<details data-(service|crew)="([^"]+)"/g)].map(m=>({dataset:{[m[1]]:m[2]},open:false}));}
 get innerHTML(){return this.html||'';}
 querySelectorAll(selector){return selector==='details'?this.details:[];}
 closest(){this.label??={};return this.label;}
 showModal(){this.open=true;}close(){this.open=false;}
}
test('所定と実績の再描画後も便詳細を保持する',()=>{const s=createState();start(s);const node=new Element();updateTimetable(node,s);node.details[0].open=true;const id=node.details[0].dataset.service;updateTimetable(node,s);assert.equal(node.details.find(d=>d.dataset.service===id).open,true);});
test('実appの連続更新で選択・行先・種別を保持、背景復帰停止・重大報告保持',async()=>{
 const nodes=new Map();const get=id=>{if(!nodes.has(id))nodes.set(id,new Element());return nodes.get(id);};const speeds=[0,1,60,240].map(n=>{const e=new Element();e.dataset.speed=String(n);e.classList={toggle(){}};return e;});let frame;const listeners={};
 globalThis.document={getElementById:get,querySelectorAll:()=>speeds,hidden:false,addEventListener:(name,fn)=>listeners[name]=fn};globalThis.requestAnimationFrame=fn=>frame=fn;
 await import('../app.js');get('closeIntro').onclick();get('start').onclick();get('trainSelect').value='T3';get('trainSelect').onchange();get('dest').value='4';get('mode').value='回送';get('actionSelect').value='assign';get('dest').onchange();const detail=get('crews').details.find(d=>d.dataset.crew==='C1');detail.open=true;speeds[2].onclick();let now=performance.now()+1000;frame(now);assert.equal(get('clock').textContent,'08:01');assert.equal(get('crews').details.find(d=>d.dataset.crew==='C1').open,true);assert.equal(get('trainSelect').value,'T3');assert.equal(get('dest').value,'4');assert.equal(get('mode').value,'回送');assert.equal(get('actionSelect').value,'assign');
 for(let i=0;i<4;i++){now+=1000;frame(now);}assert.equal(get('clock').textContent,'08:05');assert.match(get('important').textContent,/設備故障/);assert.equal(get('ack').hidden,false);speeds[3].onclick();now+=1000;frame(now);assert.equal(get('clock').textContent,'08:05');get('dest').onchange();assert.match(get('important').textContent,/設備故障/);get('ack').onclick();speeds[2].onclick();document.hidden=true;listeners.visibilitychange();document.hidden=false;listeners.visibilitychange();now+=1000;frame(now);assert.equal(get('clock').textContent,'08:05');assert.match(get('speedNote').textContent,/停止/);
 delete globalThis.document;delete globalThis.requestAnimationFrame;
});
