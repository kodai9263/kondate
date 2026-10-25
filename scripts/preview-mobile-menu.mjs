import { build } from "esbuild";
import { createServer } from "node:http";
import { readFileSync } from "node:fs";
const bundle = await build({ entryPoints: ['mobile/src/menu-preview.tsx'], bundle: true, write: false, format: 'esm', jsx: 'automatic', define: { 'import.meta.env.VITE_API_BASE_URL': '""' } });
const items = [{ id: 'salmon', name: '鮭の塩焼き', minutes: 30, kind: 'official', customized: false }, { id: 'curry', name: 'わが家の野菜たっぷりカレー', minutes: 40, kind: 'custom', customized: false }];
createServer((req,res) => {
 const url = new URL(req.url,'http://127.0.0.1:4329');
 if(url.pathname === '/api/mobile/v1/recipes') { res.setHeader('Content-Type','application/json'); const item = items.find(item => item.id === url.searchParams.get('id')); res.end(JSON.stringify(item ? { version: 1, recipe: { ...item, servings: 4, ingredients: ['鮭 4切れ','塩 少々','小松菜 1束'], morning: [], steps: ['材料を用意する。','魚の中心まで十分に火を通す。'], notes: ['作り方は画面確認用のサンプルです。'], sourceUrl: null } } : { version: 1, items })); }
 else if(url.pathname === '/app.js') { res.setHeader('Content-Type','text/javascript'); res.end(bundle.outputFiles[0].contents); }
 else if(url.pathname === '/app.css') { res.setHeader('Content-Type','text/css'); res.end(readFileSync('mobile/src/style.css')); }
 else { res.setHeader('Content-Type','text/html; charset=utf-8'); res.end('<!doctype html><html lang="ja"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>アプリのメニュー画面確認</title><link rel="stylesheet" href="/app.css"><div id="root"></div><script type="module" src="/app.js"></script></html>'); }
}).listen(4329,'127.0.0.1',() => console.log('http://127.0.0.1:4329'));
