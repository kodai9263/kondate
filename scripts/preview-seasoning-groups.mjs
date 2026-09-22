import { build } from 'esbuild';
import { createServer } from 'node:http';
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const root = process.cwd();
const out = '/tmp/kondate-seasoning-preview';
mkdirSync(out, { recursive: true });
await build({ entryPoints: ['tests/ui/seasoning-preview.tsx'], outfile: join(out, 'app.js'), bundle: true, platform: 'browser', format: 'esm', alias: { '@': join(root, 'src') }, define: { 'process.env.NODE_ENV': '"production"' }, plugins: [{ name: 'preview-only', setup(b) {
  b.onResolve({ filter: /app\/(app|feedback)\/actions$/ }, () => ({ path: 'actions', namespace: 'preview' }));
  b.onResolve({ filter: /lib\/supabase\/client$/ }, () => ({ path: 'supabase', namespace: 'preview' }));
  b.onResolve({ filter: /^next\/link$/ }, () => ({ path: 'link', namespace: 'preview' }));
  b.onLoad({ filter: /.*/, namespace: 'preview' }, (a) => ({ contents: a.path === 'actions'
    ? 'export async function setTodayTaskChecked(){return {ok:false}} export async function submitMealFeedback(){}'
    : a.path === 'supabase' ? 'export const getSupabaseBrowser=()=>null;'
    : 'import React from "react";export default function Link({prefetch,...props}){return React.createElement("a",props)}', loader: 'js', resolveDir: root }));
} }] });
execFileSync(process.execPath, [resolve('node_modules/tailwindcss/lib/cli.js'), '-i', 'src/app/globals.css', '-o', join(out, 'app.css'), '--content', './src/**/*.{ts,tsx},./tests/ui/seasoning-preview.tsx', '--minify'], { stdio: 'pipe' });
createServer((req, res) => {
  if (req.url === '/app.js' || req.url === '/app.css') {
    res.setHeader('Content-Type', req.url.endsWith('.js') ? 'text/javascript' : 'text/css');
    res.end(readFileSync(join(out, req.url.slice(1))));
  } else {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.end('<!doctype html><html lang="ja"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>合わせ調味料 · ローカル検証</title><link rel="stylesheet" href="/app.css"><body><div id="root"></div><script type="module" src="/app.js"></script></body></html>');
  }
}).listen(4322, '127.0.0.1', () => console.log('表示確認: http://127.0.0.1:4322'));
