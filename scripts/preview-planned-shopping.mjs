import { build } from 'esbuild';
import { createServer } from 'node:http';
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';

const root = process.cwd();
const out = '/tmp/kondate-planned-shopping-preview';
mkdirSync(out, { recursive: true });
if (!process.env.SHOPPING_TEST_SOCKET?.includes('kondate-shopping.')) throw new Error('専用の一時DBだけを使ってください');
const fixture = { name: 'fixture', setup(b) {
  b.onResolve({ filter: /^next\/cache$/ }, () => ({ path: 'cache', namespace: 'fixture' }));
  b.onLoad({ filter: /.*/, namespace: 'fixture' }, () => ({ contents: 'export function revalidatePath() {}', loader: 'js' }));
} };
await build({ stdin: { contents: `export * from './src/lib/shopping/server'; export * from './src/app/app/shopping/actions';`, resolveDir: root }, outfile: join(out, 'server.cjs'), bundle: true, platform: 'node', format: 'cjs', alias: { '@': join(root, 'src'), '@/lib/supabase/server': join(root, 'tests/ui/shopping-db-adapter.ts') }, plugins: [fixture] });
const service = (await import(pathToFileURL(join(out, 'server.cjs')))).default;
await build({ entryPoints: ['tests/ui/shopping-preview.tsx'], outfile: join(out, 'app.js'), bundle: true, platform: 'browser', format: 'esm', alias: { '@': join(root, 'src') }, define: { 'process.env.NODE_ENV': '"production"' }, plugins: [{ name: 'transport', setup(b) {
  b.onResolve({ filter: /app\/app\/shopping\/actions$/ }, () => ({ path: 'actions', namespace: 'transport' }));
  b.onResolve({ filter: /lib\/supabase\/client$/ }, () => ({ path: 'supabase', namespace: 'transport' }));
  b.onResolve({ filter: /^next\/(navigation|link)$/ }, (a) => ({ path: a.path, namespace: 'transport' }));
  b.onLoad({ filter: /.*/, namespace: 'transport' }, (a) => ({ contents: a.path === 'actions' ? ['setShoppingItemChecked','addManualShoppingItem','deleteManualShoppingItem','dismissSeasoningShoppingItem','changeShoppingPeriod','restoreShoppingSeasonings'].map((name) => `export async function ${name}(input){ return (await fetch('/action/${name}',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(input)})).json(); }`).join('\n')
    : a.path === 'supabase' ? 'export const getSupabaseBrowser = () => null;'
    : a.path === 'next/navigation' ? 'const router={refresh:()=>window.dispatchEvent(new Event("shopping-refresh"))}; export const useRouter=()=>router;'
    : 'import React from "react"; export default function Link({prefetch,...props}){return React.createElement("a",props)}', loader: 'js', resolveDir: root }));
} }] });
execFileSync(process.execPath, [resolve('node_modules/tailwindcss/lib/cli.js'), '-i', 'src/app/globals.css', '-o', join(out,'app.css'), '--minify'], { stdio: 'pipe' });
const allowed = new Set(['setShoppingItemChecked','addManualShoppingItem','deleteManualShoppingItem','dismissSeasoningShoppingItem','changeShoppingPeriod','restoreShoppingSeasonings']);
createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://127.0.0.1:4319');
    if (url.pathname === '/state') {
      const shopping = await service.getPlannedShopping();
      const saved = await service.getSavedShoppingState(shopping);
      const { period, groups, warnings, meals, preferences, listId } = shopping;
      const revision = createHash('sha256').update(JSON.stringify([period,groups,saved])).digest('hex');
      res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify({ period, groups, warnings, meals, preferences, listId: listId ?? null, saved, revision }));
    } else if (req.method === 'POST' && allowed.has(url.pathname.slice('/action/'.length))) {
      let body = ''; for await (const chunk of req) { body += chunk; if (body.length > 100000) throw new Error('too large'); }
      res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(await service[url.pathname.slice('/action/'.length)](JSON.parse(body))));
    } else if (url.pathname === '/app.js' || url.pathname === '/app.css') {
      res.setHeader('Content-Type', url.pathname.endsWith('.js') ? 'text/javascript' : 'text/css'); res.end(readFileSync(join(out, url.pathname.slice(1))));
    } else {
      res.setHeader('Content-Type', 'text/html; charset=utf-8'); res.end('<!doctype html><html lang="ja"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>買い物リスト · ローカル検証</title><link rel="stylesheet" href="/app.css"><body><div id="root"></div><script type="module" src="/app.js"></script></body></html>');
    }
  } catch (error) { res.statusCode = 500; res.end(String(error.message)); }
}).listen(4319, '127.0.0.1', () => console.log('買い物リスト検証: http://127.0.0.1:4319'));
