// Isolated local QC adapter. Never imports production stores, environment or credentials.
import {createServer} from 'node:http';
import {DatabaseSync} from 'node:sqlite';
import {readFile,mkdir} from 'node:fs/promises';
import {join,dirname,extname} from 'node:path';
import {fileURLToPath} from 'node:url';
import worker,{DailyWarehouse} from './worker.js';
const root=dirname(fileURLToPath(import.meta.url));await mkdir(join(root,'scratch'),{recursive:true});
const db=new DatabaseSync(join(root,'scratch','local-qc.sqlite'));
const sql={exec(query,...args){const s=db.prepare(query);const rows=s.columns().length?s.all(...args):(s.run(...args),[]);return {toArray:()=>rows};}};
const ctx={storage:{sql,transactionSync(fn){db.exec('BEGIN');try{const r=fn();db.exec('COMMIT');return r;}catch(e){db.exec('ROLLBACK');throw e;}}}};
const env={AI:{async run(model,input){if(model.includes('whisper'))return {text:'這是本機驗收替身的虛構口述，今天我們一起看雲。'};return {response:JSON.parse(input.messages.at(-1).content).parentNotes};}},ASSETS:{async fetch(request){const path=new URL(request.url).pathname;const file={'/':'index.html','/app.js':'app.js','/style.css':'style.css','/validation.js':'validation.js','/drafts.js':'drafts.js'}[path];if(!file)return new Response('Not found',{status:404});return new Response(await readFile(join(root,'web',file)),{headers:{'content-type':({'html':'text/html','js':'text/javascript','css':'text/css'})[extname(file).slice(1)]+'; charset=utf-8'}});}}};
const store=new DailyWarehouse(ctx,env);env.DAILY_WAREHOUSE={idFromName:n=>n,get:()=>store};
createServer(async(req,res)=>{try{if(req.url==='/__qc'){const url='http://localhost:3358';const fixture=await worker.fetch(new Request(url+'/api/register',{method:'POST',headers:{origin:url,'content-type':'application/json'},body:JSON.stringify({handle:'本機驗收'+crypto.randomUUID().slice(0,8),password:crypto.randomUUID(),name:'媽媽',child:'小禾',family:'隔離驗收家庭'})}),env);res.writeHead(302,{'set-cookie':fixture.headers.get('set-cookie'),location:'/'});res.end();return;}const parts=[];for await(const p of req)parts.push(p);const method=req.method;const request=new Request(`http://${req.headers.host}${req.url}`,{method,headers:req.headers,body:['GET','HEAD'].includes(method)?undefined:Buffer.concat(parts)});const response=await worker.fetch(request,env);res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()));}catch{res.writeHead(500);res.end('Local adapter error');}}).listen(3358,'127.0.0.1',()=>console.log('Local QC http://localhost:3358 — AI is a deterministic test adapter, not live model evidence.'));
