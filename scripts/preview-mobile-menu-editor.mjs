import { build } from 'esbuild';
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
const bundle=await build({entryPoints:['mobile/src/menu-preview.tsx'],bundle:true,write:false,format:'esm',jsx:'automatic',define:{'import.meta.env.VITE_API_BASE_URL':'""'}});
const entries=new Map();const requests=new Set();const revision=f=>createHash('md5').update(JSON.stringify(f)).digest('hex');
createServer(async(req,res)=>{
 const url=new URL(req.url,'http://127.0.0.1:4330');
 const json=(value,status=200)=>{res.writeHead(status,{'Content-Type':'application/json'});res.end(JSON.stringify(value));};
 if(url.pathname==='/api/mobile/v1/recipes/editor'){
  if(req.method==='GET'){const fields=entries.get(url.searchParams.get('id'));return fields?json({version:1,fields,revision:revision(fields)}):json({},404);}
  let raw='';for await(const chunk of req)raw+=chunk;const body=JSON.parse(raw);const old=entries.get(body.id);
  if(!requests.has(body.requestId)){if(old&&revision(old)!==body.revision)return json({},409);entries.set(body.id,body.fields);requests.add(body.requestId);}
  return json({version:1,id:body.id});
 }
 if(url.pathname==='/api/mobile/v1/recipes'){
  const id=url.searchParams.get('id'), f=entries.get(id);
  const item=(id,f)=>({id,name:f.name,minutes:f.cookMinutes,kind:'custom',customized:false});
  return f?json({version:1,recipe:{...item(id,f),servings:f.servings,ingredients:f.ingredients.split('\n'),morning:f.morning?f.morning.split('\n'):[],steps:f.steps.split('\n'),notes:[],sourceUrl:null}}):json({version:1,items:[...entries].map(([id,f])=>item(id,f))});
 }
 if(url.pathname==='/app.js'){res.setHeader('Content-Type','text/javascript');return res.end(bundle.outputFiles[0].contents);}
 if(url.pathname==='/app.css'){res.setHeader('Content-Type','text/css');return res.end(readFileSync('mobile/src/style.css'));}
 res.setHeader('Content-Type','text/html; charset=utf-8');res.end('<!doctype html><html lang="ja"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>メニュー登録・編集の動作確認</title><link rel="stylesheet" href="/app.css"><div id="root"></div><script type="module" src="/app.js"></script></html>');
}).listen(Number(process.env.PORT ?? 4330),'127.0.0.1',()=>console.log(`http://127.0.0.1:${process.env.PORT ?? 4330}`));
