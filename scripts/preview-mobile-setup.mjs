import { build } from "esbuild";
import { createServer } from "node:http";
import { readFileSync } from "node:fs";
const bundled = await build({ stdin: { contents: `import {createRoot} from 'react-dom/client'; import {useState} from 'react'; import {FirstWeekSetup} from './src/FirstWeekSetup'; function Preview(){const [done,setDone]=useState(false);return <div className="app-shell"><main style={{maxWidth:390,margin:'auto'}}><p>画面確認用サンプル・本番データは変更しません</p>{done?<p role="status">設定を保存しました（表示確認用）</p>:<FirstWeekSetup accessToken="sample" online={true} onSaved={()=>setDone(true)}/>}</main></div>};createRoot(document.getElementById('root')).render(<Preview/>);`, resolveDir: process.cwd() + '/mobile', loader: 'tsx' }, bundle: true, write: false, format: 'esm', jsx: 'automatic', define: { 'import.meta.env.VITE_API_BASE_URL': '""' } });
createServer((req, res) => {
 if(req.url==='/api/mobile/v1/setup'){res.setHeader('Content-Type','application/json');res.end(JSON.stringify(req.method==='POST'?{saved:true}:{version:1,adults:2,children:1,allergies:['卵'],start:'2026-11-08'}));}
 else if(req.url==='/app.js'){res.setHeader('Content-Type','text/javascript');res.end(bundled.outputFiles[0].contents);}
 else if(req.url==='/app.css'){res.setHeader('Content-Type','text/css');res.end(readFileSync('mobile/src/style.css'));}
 else {res.setHeader('Content-Type','text/html; charset=utf-8');res.end('<!doctype html><html lang="ja"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>初回設定の確認</title><link rel="stylesheet" href="/app.css"><div id="root"></div><script type="module" src="/app.js"></script></html>');}
}).listen(4336,'127.0.0.1',()=>console.log('http://127.0.0.1:4336'));
