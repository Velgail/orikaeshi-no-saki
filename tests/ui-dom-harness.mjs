// 実appのDOMイベント用テスト補助。実ブラウザーQAではない。
// select.valueは存在しないoptionを受理せず、描画後detailsは別の要素になる。
import assert from 'node:assert/strict';

const attributes = text => Object.fromEntries([...text.matchAll(/([\w-]+)="([^"]*)"/g)].map(m => [m[1],m[2]]));
class Element {
 constructor(select=false){this.isSelect=select;this.options=null;this._value='';this.dataset={};this.open=false;this.hidden=false;this.disabled=false;this.children=[];this.details=[];this.scrollTop=0;this.scrollLeft=0;this.textContent='';this.classList={toggle(){}};}
 set value(value){const string=String(value);this._value=this.isSelect&&this.options&&!this.options.includes(string)?'':string;}
 get value(){return this._value;}
 set innerHTML(html){
  this.html=html;
  if(this.isSelect){this.options=[...html.matchAll(/<option\b([^>]*)>(.*?)<\/option>/gs)].map(m=>attributes(m[1]).value??m[2]);this._value=this.options[0]??'';}
  this.children=[...html.matchAll(/<button\b([^>]*)>(.*?)<\/button>/gs)].map(m=>{const element=new Element();const attrs=attributes(m[1]);element.id=attrs.id;element.textContent=m[2];element.disabled=/\bdisabled\b/.test(m[1]);for(const [key,value] of Object.entries(attrs))if(key.startsWith('data-'))element.dataset[key.slice(5).replace(/-([a-z])/g,(_,c)=>c.toUpperCase())]=value;return element;});
  this.details=[...html.matchAll(/<details\b([^>]*)>\s*<summary>(.*?)<\/summary>/gs)].map(m=>{const element=new Element();element.textContent=m[2];for(const [key,value] of Object.entries(attributes(m[1])))if(key.startsWith('data-'))element.dataset[key.slice(5).replace(/-([a-z])/g,(_,c)=>c.toUpperCase())]=value;return element;});
 }
 get innerHTML(){return this.html??'';}
 querySelectorAll(selector){if(selector==='details')return this.details;const key=selector.match(/^\[data-([\w-]+)\]$/)?.[1]?.replace(/-([a-z])/g,(_,c)=>c.toUpperCase());return key?this.children.filter(node=>key in node.dataset):[];}
 closest(){this.label??={};return this.label;}
 showModal(){this.open=true;}close(){this.open=false;}
 scrollTo({left,top}){this.scrollLeft=left??this.scrollLeft;this.scrollTop=top??this.scrollTop;}
 scrollIntoView(){}
 addEventListener(name,handler){this['on'+name]=handler;}
}
let importNumber=0;
async function app(){
 const nodes=new Map(),selectIDs=new Set(['trainSelect','dest','crewSelect','serviceSelect','actionSelect']);
 const get=id=>{for(const node of nodes.values()){const child=node.children.find(child=>child.id===id);if(child)return child;}if(!nodes.has(id))nodes.set(id,new Element(selectIDs.has(id)));return nodes.get(id);};
 const speeds=[0,1,60,240].map(speed=>{const node=new Element();node.dataset.speed=String(speed);return node;});
 let frame,saved;
 globalThis.document={getElementById:get,querySelectorAll:selector=>selector==='[data-speed]'?speeds:[],hidden:false,addEventListener(){}};
 globalThis.requestAnimationFrame=handler=>{frame=handler;};
 globalThis.localStorage={getItem:()=>saved,setItem:(_key,value)=>{saved=value;}};
 const source=process.env.REGRESSION_APP_ROOT?new URL('app.js',new URL(process.env.REGRESSION_APP_ROOT,import.meta.url)):new URL('../app.js',import.meta.url);
 source.search='vm-regression='+ ++importNumber;
 await import(source.href);
 get('closeIntro').onclick();
 return {get,speeds,frame:now=>frame(now),saveState(){get('save').onclick();return JSON.parse(saved);},savedState(){return saved;},normal(){get('scenario').value='normal';get('scenario').onchange();get('start').onclick();},step(count=1){for(let i=0;i<count;i++){get('ack').onclick();get('step').onclick();}},select(id){get('trainSelect').value=id;get('trainSelect').onchange();},cleanup(){delete globalThis.document;delete globalThis.requestAnimationFrame;delete globalThis.localStorage;}};
}
const pickService=(ui,parent,id)=>{const button=ui.get(parent).querySelectorAll('[data-pick]').find(node=>node.dataset.pickservice===id);assert.ok(button,`${parent}の${id}便ボタン`);button.onclick();};
const choosePrepare=ui=>{const group=ui.get('goals').querySelectorAll('[data-group]').find(node=>node.textContent==='予備を投入する');assert.ok(group);group.onclick();const goal=ui.get('goals').querySelectorAll('[data-goal]').find(node=>node.textContent.includes('車庫で準備を始める'));assert.ok(goal);goal.onclick();};
const comparison=ui=>ui.get('actions').querySelectorAll('details').find(node=>node.textContent==='担当候補を比較・変更');
const explanation=ui=>ui.get('actions').querySelectorAll('details').find(node=>node.textContent==='所要・勤務枠・次便の詳細');
const crewIDs=ui=>ui.get('actions').querySelectorAll('[data-choosecrew]').map(node=>node.dataset.choosecrew);
const chooseCrew=(ui,id)=>{const panel=comparison(ui);assert.ok(panel,'担当比較欄を開いて選ぶ');panel.open=true;const button=ui.get('actions').querySelectorAll('[data-choosecrew]').find(node=>node.dataset.choosecrew===id);assert.ok(button,`${id}担当候補`);button.onclick();};

export {Element,app,pickService,choosePrepare,comparison,explanation,crewIDs,chooseCrew};
