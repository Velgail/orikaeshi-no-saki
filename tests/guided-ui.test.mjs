import test from 'node:test';import assert from 'node:assert/strict';
class Node{
 constructor(){this.value='';this.dataset={};this.open=false;this.hidden=false;this.disabled=false;this.children=[];this.details=[];this.classList={toggle(){}};}
 set innerHTML(html){this.html=html;this.children=[...html.matchAll(/<button\b([^>]*)>(.*?)<\/button>/gs)].map(m=>{const n=new Node();n.textContent=m[2];n.disabled=/\bdisabled\b/.test(m[1]);for(const d of m[1].matchAll(/data-([a-z]+)="([^"]*)"/g))n.dataset[d[1]]=d[2];n.id=m[1].match(/id="([^"]+)"/)?.[1];return n;});this.details=[...html.matchAll(/<details data-(service|crew)="([^"]+)"/g)].map(m=>({dataset:{[m[1]]:m[2]},open:false}));}
 get innerHTML(){return this.html||'';}
 querySelectorAll(sel){if(sel==='details')return this.details;const k=sel.match(/^\[data-([a-z]+)\]$/)?.[1];return k?this.children.filter(n=>k in n.dataset):[];}
 closest(){return this;}showModal(){this.open=true;}close(){this.open=false;}addEventListener(name,fn){this['on'+name]=fn;}
}
test('実appの目的選択→予備準備→取消・対象変更・二重クリック・復元を確認（DOMスタブ）',async()=>{
 const nodes=new Map(),get=id=>{for(const n of nodes.values()){const found=n.children.find(c=>c.id===id);if(found)return found;}if(!nodes.has(id))nodes.set(id,new Node());return nodes.get(id);};let saved;globalThis.localStorage={setItem:(k,v)=>saved=v,getItem:()=>saved};globalThis.document={getElementById:get,querySelectorAll:()=>[],addEventListener(){},hidden:false};globalThis.requestAnimationFrame=()=>{};
 try{await import('../app.js?guided-test');get('closeIntro').onclick();get('start').onclick();for(let i=0;i<8;i++){get('ack').onclick();get('step').onclick();}get('trainSelect').value='T4';get('trainSelect').onchange();assert.match(get('context').textContent,/車庫予備/);assert.ok(get('goals').children.length<=6);
 get('goals').querySelectorAll('[data-group]')[0].onclick();get('goals').querySelectorAll('[data-goal]')[0].onclick();assert.match(get('actions').innerHTML,/準備5分/);get('cancelDraft').onclick();assert.equal(get('actionExecute').querySelectorAll('[data-action]').length,0);
 get('goals').querySelectorAll('[data-group]')[0].onclick();get('goals').querySelectorAll('[data-goal]')[0].onclick();const old=get('actionExecute').querySelectorAll('[data-action]')[0];get('trainSelect').value='T1';get('trainSelect').onchange();old.onclick();assert.doesNotMatch(get('history').innerHTML,/T4\/F4 車庫車両準備/);
 get('trainSelect').value='T4';get('trainSelect').onchange();get('goals').querySelectorAll('[data-group]')[0].onclick();get('goals').querySelectorAll('[data-goal]')[0].onclick();const execute=get('actionExecute').querySelectorAll('[data-action]')[0];execute.onclick();execute.onclick();assert.equal((get('history').innerHTML.match(/T4\/F4 車庫車両準備/g)||[]).length,1);get('save').onclick();get('load').onclick();assert.equal(get('actionExecute').querySelectorAll('[data-action]').length,0);
 }finally{delete globalThis.document;delete globalThis.requestAnimationFrame;delete globalThis.localStorage;}
});
