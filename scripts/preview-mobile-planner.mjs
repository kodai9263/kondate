import { build } from "esbuild";
import { createServer } from "node:http";
import { readFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
const out = '/private/tmp/kondate-mobile-planner-preview'; mkdirSync(out, { recursive: true });
const root = process.cwd();
await build({ entryPoints: ['src/app/api/mobile/v1/planner/route.ts'], bundle: true, platform: 'node', format: 'esm', outfile: `${out}/route.mjs`, plugins: [{ name: 'local-only-data', setup(builder) {
 builder.onResolve({ filter: /^@\/lib\/(mobile\/request|billing\/firstWeek.server|nutrition\/server|nutrition\/savePlan.server)$/ }, () => ({ path: resolve(root, 'tests/ui/mobile-planner-adapter.ts') }));
} }] });
const api = await import(`${out}/route.mjs`);
const bundle = await build({ entryPoints: ['mobile/src/planner-preview.tsx'], bundle: true, write: false, format: 'esm', jsx: 'automatic', define: { 'import.meta.env.VITE_API_BASE_URL': '""' } });
createServer(async (req, res) => {
 try {
 if (req.url.startsWith('/api/mobile/v1/planner')) {
  let body = ''; for await (const chunk of req) body += chunk;
  const result = await api[req.method](new Request(`http://127.0.0.1:4328${req.url}`, { method: req.method, ...(body ? { body } : {}) }));
  res.writeHead(result.status, Object.fromEntries(result.headers)); res.end(await result.text());
 } else if (req.url === '/app.js') { res.setHeader('Content-Type','text/javascript'); res.end(bundle.outputFiles[0].contents); }
 else if (req.url === '/app.css') { res.setHeader('Content-Type','text/css'); res.end(readFileSync('mobile/src/style.css')); }
 else { res.setHeader('Content-Type','text/html; charset=utf-8'); res.end('<!doctype html><html lang="ja"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>アプリの献立調整・動作確認</title><link rel="stylesheet" href="/app.css"><div id="root"></div><script type="module" src="/app.js"></script></html>'); }
 } catch { res.statusCode = 500; res.end('preview_error'); }
}).listen(4328, '127.0.0.1', () => console.log('http://127.0.0.1:4328'));
