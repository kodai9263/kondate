import { build } from 'esbuild';
import { createServer } from 'node:http';
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';
const root = process.cwd();
const port = Number(process.env.SIDE_PREVIEW_PORT ?? 4326);
const out = '/tmp/kondate-standard-side-preview';
mkdirSync(out, { recursive: true });
if (!process.env.SHOPPING_TEST_SOCKET?.includes('kondate-side-dishes.')) throw new Error('専用の一時DBだけを使ってください');
const actions = ['createSideDish', 'createStandardSideDish', 'saveMonthlyDinnerPlan'];
await build({ stdin: { contents: `export * from './src/lib/nutrition/server'; export * from './src/lib/nutrition/planner'; export * from './src/lib/nutrition/sideDish'; export * from './src/app/app/planner/actions'; export * from './src/lib/shopping/build'; export * from './src/lib/today/server';`, resolveDir: root }, outfile: join(out,'server.cjs'), bundle: true, platform: 'node', format: 'cjs', alias: { '@': join(root,'src'), '@/lib/supabase/server': join(root,'tests/ui/side-dish-db-adapter.ts') }, plugins: [{ name: 'cache', setup(b) {
  b.onResolve({ filter: /^next\/cache$/ }, () => ({ path: 'cache', namespace: 'fixture' }));
  b.onLoad({ filter: /.*/, namespace: 'fixture' }, () => ({ contents: 'export function revalidatePath() {}', loader: 'js' }));
} }] });
const service = (await import(pathToFileURL(join(out,'server.cjs')))).default;
await build({ entryPoints: ['tests/ui/side-dish-preview.tsx'], outfile: join(out,'app.js'), bundle: true, platform: 'browser', format: 'esm', alias: { '@': join(root,'src') }, define: { 'process.env.NODE_ENV': '"production"' }, plugins: [{ name: 'transport', setup(b) {
  b.onResolve({ filter: /app\/app\/planner\/actions$/ }, () => ({ path: 'planner-actions', namespace: 'transport' }));
  b.onResolve({ filter: /app\/app\/actions$/ }, () => ({ path: 'today-actions', namespace: 'transport' }));
  b.onResolve({ filter: /app\/feedback\/actions$/ }, () => ({ path: 'feedback-actions', namespace: 'transport' }));
  b.onResolve({ filter: /lib\/supabase\/client$/ }, () => ({ path: 'supabase', namespace: 'transport' }));
  b.onResolve({ filter: /^next\/(navigation|link)$/ }, (a) => ({ path: a.path, namespace: 'transport' }));
  b.onLoad({ filter: /.*/, namespace: 'transport' }, (a) => ({ contents: a.path === 'planner-actions' ? actions.map((name) => `export async function ${name}(input) { return (await fetch('/action/${name}'+location.search,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(input)})).json(); }`).join('\n')
    : a.path === 'today-actions' ? 'export async function setTodayTaskChecked() { return {ok:false}; }'
    : a.path === 'feedback-actions' ? 'export async function submitMealFeedback() { return {ok:false}; }'
    : a.path === 'supabase' ? 'export const getSupabaseBrowser = () => null;'
    : a.path === 'next/navigation' ? 'const router={refresh:()=>location.reload(),push:()=>location.reload()}; export const useRouter=()=>router;'
    : 'import React from "react"; export default function Link({prefetch,...props}){return React.createElement("a",props)}', loader:'js', resolveDir:root }));
} }] });
execFileSync(process.execPath, [resolve('node_modules/tailwindcss/lib/cli.js'),'-i','src/app/globals.css','-o',join(out,'app.css'),'--minify'], {stdio:'pipe'});
createServer(async (req,res) => {
  try {
    const url = new URL(req.url, 'http://127.0.0.1:4326');
    if (url.pathname === '/state') {
      const context = await service.getHouseholdPlannerContext(2026,9,true);
      const [day] = service.resolveMonthlyDinnerPlan(2026,9,context);
      const today = {date:day.date,dayIndex:0,dow:'火',breakfast:null,dinner:{dow:'火',dinner:day.recipe.name,side:service.plannedSideName(day),fish:false,kids:true,prepMin:0,cookMin:day.recipe.cookMinutes,servingsBase:day.recipe.servingsBase,ingredientsScalable:Boolean(day.recipe.servingsBase),morning:[],evening:service.resolveDinnerSteps(day),seasonings:service.resolveDinnerIngredients(day)?.split('\n')??[],sideSteps:service.resolveCustomSideSteps(day.sideDish),sideServingsBase:day.sideDish?.servingsBase}};
      res.setHeader('Content-Type','application/json');
      res.end(JSON.stringify({planner:{...context,initialView:"week",initialDate:"2026-09-01",today:"2026-09-01",familySize:{adultCount:4,childCount:0}},today:{today,familySize:{adultCount:4,childCount:0},initialTaskBindings:service.buildTodayTaskBindings(today,[])},shopping:service.buildPlannedShopping({start:day.date,end:day.date,dinners:[day],breakfastVersions:[],servings:4})}));
    } else if (req.method === 'POST' && actions.includes(url.pathname.slice('/action/'.length))) {
      let body=''; for await (const chunk of req) {body+=chunk; if(body.length>100000)throw new Error('too large');}
      res.setHeader('Content-Type','application/json');
      const action=url.pathname.slice('/action/'.length);
      res.end(JSON.stringify(url.searchParams.has('failSave') && action==='saveMonthlyDinnerPlan' ? {ok:false} : await service[action](JSON.parse(body))));
    } else if (url.pathname === '/app.js' || url.pathname === '/app.css') {
      res.setHeader('Content-Type',url.pathname.endsWith('.js')?'text/javascript':'text/css');res.end(readFileSync(join(out,url.pathname.slice(1))));
    } else {
      res.setHeader('Content-Type','text/html; charset=utf-8');res.end('<!doctype html><html lang="ja"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>副菜 · ローカル検証</title><link rel="stylesheet" href="/app.css"><body><div id="root"></div><script type="module" src="/app.js"></script></body></html>');
    }
  } catch (error) { console.error(error);res.statusCode=500;res.end('ローカル検証エラー'); }
}).listen(port,'127.0.0.1',()=>console.log(`副菜検証: http://127.0.0.1:${port}`));
