import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
const child=spawn(process.execPath,['server.mjs'],{stdio:['ignore','pipe','pipe']});
try{
 await new Promise((resolve,reject)=>{child.stdout.once('data',resolve);child.once('exit',c=>reject(Error(`server exited ${c}`)));child.once('error',reject);});
 for(const [path,type] of [['/labor.js','text/javascript'],['/equipment.js','text/javascript'],['/','text/html'],['/app.js','text/javascript'],['/realtime.js','text/javascript'],['/display.js','text/javascript'],['/engine.js','text/javascript'],['/style.css','text/css'],['/references.md','text/plain']]){const r=await fetch('http://127.0.0.1:8765'+path);assert.equal(r.status,200);assert.ok(r.headers.get('content-type').startsWith(type));assert.ok((await r.text()).length>0);console.log('PASS',path,r.status,type);}
 for(const path of ['/missing','/AGENTS.md','/%2e%2e/package.json']){const r=await fetch('http://127.0.0.1:8765'+path);assert.equal(r.status,404);console.log('PASS',path,404);}
}finally{child.kill();}
