import http from 'node:http';
import {readFile} from 'node:fs/promises';
const files={'/':['index.html','text/html'],'/index.html':['index.html','text/html'],'/display.js':['display.js','text/javascript'],'/app.js':['app.js','text/javascript'],'/engine.js':['engine.js','text/javascript'],'/style.css':['style.css','text/css'],'/references.md':['references.md','text/plain']};
const server=http.createServer(async(req,res)=>{const file=files[new URL(req.url,'http://localhost').pathname];if(!file){res.writeHead(404);res.end('見つかりません');return;}try{const bytes=await readFile(new URL(file[0],import.meta.url));res.writeHead(200,{'Content-Type':file[1]+'; charset=utf-8','Cache-Control':'no-store'});res.end(bytes);}catch{res.writeHead(500);res.end('ファイルを読めません');}});
server.on('error',e=>{console.error('起動できません：',e.message);process.exitCode=1;});
server.listen(8765,'127.0.0.1',()=>console.log('折り返しの先へ：http://127.0.0.1:8765 （終了は Ctrl+C）'));
