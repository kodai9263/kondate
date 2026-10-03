import { build } from 'esbuild';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createServer } from 'node:http';
const root = process.cwd();
const out = process.env.SHOPPING_TEST_SOCKET;
if (!out?.includes('kondate-free-trial-preview.')) throw new Error('専用一時DBのみ');
const serverFixture = { name: 'server-fixture', setup(b) {
  b.onResolve({ filter: /^next\/(cache|navigation|headers)$/ }, (a) => ({ path: a.path, namespace: 'fixture' }));
  b.onLoad({ filter: /.*/, namespace: 'fixture' }, (a) => ({ contents: a.path.endsWith('headers') ? 'export async function cookies(){throw new Error("Unexpected production auth import")}' : a.path.endsWith('cache') ? 'export function revalidatePath() {}' : 'export function redirect(url){throw Object.assign(new Error("redirect"),{redirect:url})}', loader: 'js' }));
} };
await build({ stdin: { contents: `export * from './src/lib/billing/firstWeek.server'; export * from './src/lib/family/server'; export * from './src/lib/nutrition/server'; export * from './src/lib/shopping/server'; export * from './src/lib/nutrition/period'; export * from './src/app/app/planner/actions'; export * from './src/app/app/planner/setup/actions'; export * from './src/app/app/shopping/actions';`, resolveDir: root }, outfile: join(out,'server.cjs'), bundle: true, platform: 'node', format: 'cjs', alias: { '@': join(root,'src'), '@/lib/supabase/server': resolve('tests/ui/free-trial-db-adapter.ts') }, plugins:[serverFixture] });
const service = (await import(pathToFileURL(join(out,'server.cjs')))).default;
await build({ entryPoints: ['tests/ui/free-trial-preview.tsx'], outfile: join(out,'app.js'), bundle:true, platform:'browser', format:'esm', alias:{'@':join(root,'src')}, define:{'process.env.NODE_ENV':'"production"'}, plugins:[{name:'client-fixture',setup(b){
  b.onResolve({filter:/^\.\/actions$/},a=>a.importer.endsWith('/planner/setup/page.tsx')?{path:'app/app/planner/setup/actions',namespace:'fixture'}:null);
  b.onResolve({filter:/app\/app\/(planner\/setup\/actions|planner\/actions|shopping\/actions)$/},a=>({path:a.path,namespace:'fixture'}));
  b.onResolve({filter:/lib\/shopping\/server$/},a=>({path:a.path,namespace:'fixture'}));
  b.onResolve({filter:/lib\/(billing\/firstWeek.server|family\/server|supabase\/client)$/},a=>({path:a.path,namespace:'fixture'}));
  b.onResolve({filter:/^next\/(navigation|link)$/},a=>({path:a.path,namespace:'fixture'}));
  b.onLoad({filter:/.*/,namespace:'fixture'},a=>({contents:
    a.path.endsWith('planner/setup/actions') ? 'export async function configureFirstWeek(form){const res=await fetch("/setup-action",{method:"POST",body:form});const data=await res.json();if(data.redirect)location.href=data.redirect;else throw new Error("setup failed");}'
    : a.path.endsWith('planner/actions') || a.path.endsWith('shopping/actions') ? ['saveFirstWeekPlan','saveMonthlyDinnerPlan','setShoppingItemChecked','addManualShoppingItem','deleteManualShoppingItem','dismissSeasoningShoppingItem','restoreShoppingSeasonings','changeShoppingPeriod','completeShopping','undoShoppingCompletion','createSideDish','createStandardSideDish'].map(name=>`export async function ${name}(input){return (await fetch('/action/${name}',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(input)})).json()}`).join('\n')
    : a.path.endsWith('shopping/server') ? 'export async function getPlannedShopping(){const res=await fetch("/shopping-state");if(!res.ok)throw new Error("shopping_unavailable");return res.json()};export async function getSavedShoppingState(context){return context.saved}'
    : a.path.endsWith('firstWeek.server') ? 'export async function getFirstWeekAccess(){const data=await(await fetch("/access")).json();return {...data,user:data.user??{is_anonymous:false}}}'
    : a.path.endsWith('family/server') ? 'export async function getCurrentHouseholdPreferences(){return(await fetch("/preferences")).json()}'
    : a.path.endsWith('supabase/client') ? 'export const getSupabaseBrowser=()=>null;'
    : a.path==='next/navigation' ? 'const router={push:url=>location.href=url,replace:url=>history.replaceState(null,"",url),refresh:()=>window.dispatchEvent(new Event("first-week-refresh"))}; export const useRouter=()=>router; export const redirect=url=>{location.href=url;throw new Error("redirect")};'
    : 'import React from "react"; export default function Link({prefetch,...props}){return React.createElement("a",props)}',loader:'js',resolveDir:root}));
}}] });
execFileSync(process.execPath,[resolve('node_modules/tailwindcss/lib/cli.js'),'-i','src/app/globals.css','-o',join(out,'app.css'),'--minify'],{stdio:'pipe'});
const allowed=new Set(['saveMonthlyDinnerPlan','completeShopping','saveFirstWeekPlan','setShoppingItemChecked','addManualShoppingItem','deleteManualShoppingItem','dismissSeasoningShoppingItem','restoreShoppingSeasonings','changeShoppingPeriod']);
if (process.env.FIRST_WEEK_REBUILD_ONLY === '1') process.exit(0);
createServer(async(req,res)=>{
  const url=new URL(req.url,'http://127.0.0.1:4340');
  const json=data=>{res.setHeader('Content-Type','application/json');res.end(JSON.stringify(data));};
  try{
    if(url.pathname==='/access'){const {trial,paid,canPlan,freeTrial}=await service.getFirstWeekAccess();json({trial,paid,canPlan,freeTrial,user:{is_anonymous:false}});}
    else if(url.pathname==='/preferences')json(await service.getCurrentHouseholdPreferences(true));
    else if(url.pathname==='/planner-state'){
      const access=await service.getFirstWeekAccess(); if(!access.trial && access.canPlan) throw new Error('setup_required');
      const params = Object.fromEntries(url.searchParams);
      const period = service.parsePlannerPeriod(params);
      const months = service.plannerMonths(period.view,period.date,6);
      const contexts=await Promise.all(months.map(({year,month})=>service.getHouseholdPlannerContext(year,month,true)));
      const context=contexts[0];json({recipes:context.recipes,sideDishes:context.sideDishes,initialView:period.view,initialDate:period.date,today:period.today,familySize:context.preferences,allergies:context.preferences.allergies,trialExpiresAt:access.freeTrial?.expires_at,readOnly:!access.canPlan,trialExpired:!access.canPlan,initialRecipeIds:Object.assign({},...contexts.map(x=>x.initialRecipeIds)),initialLockedRecipeIds:Object.assign({},...contexts.map(x=>x.initialLockedRecipeIds)),initialSideSelections:Object.assign({},...contexts.map(x=>x.initialSideSelections))});
    }
    else if(url.pathname==='/shopping-state'){const shopping=await service.getPlannedShopping();const saved=await service.getSavedShoppingState(shopping);json({...shopping,supabase:undefined,saved});}
    else if(url.pathname==='/expire-trial' && req.method==='POST') {
      execFileSync('psql',['-X','-q','-v','ON_ERROR_STOP=1','-h',out,'-d','postgres','-c',"update household_free_trials set started_at=now()-interval '336 hours', expires_at=now() where household_id=(select household_id from profiles where id='10000000-0000-4000-8000-000000000021');"],{stdio:'pipe'});
      json({ok:true});
    }
    else if(url.pathname==='/setup-action'  && req.method==='POST'){
      const body=[];for await(const chunk of req)body.push(chunk);
      const form=await new Request('http://localhost',{method:'POST',headers:{'Content-Type':req.headers['content-type']},body:Buffer.concat(body)}).formData();
      try{await service.configureFirstWeek(form);json({ok:true});}catch(error){if(error.redirect)json({redirect:error.redirect});else throw error;}
    }
    else if(req.method==='POST'&&allowed.has(url.pathname.slice('/action/'.length))){let body='';for await(const chunk of req)body+=chunk;json(await service[url.pathname.slice('/action/'.length)](JSON.parse(body)));}
    else if(url.pathname==='/app.js'||url.pathname==='/app.css'){res.setHeader('Content-Type',url.pathname.endsWith('.js')?'text/javascript':'text/css');res.end(readFileSync(join(out,url.pathname.slice(1))));}
    else{res.setHeader('Content-Type','text/html; charset=utf-8');res.end('<!doctype html><html lang="ja"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>14日間無料体験 · ローカルDB検証</title><link rel="stylesheet" href="/app.css"><body><div id="root"></div><script type="module" src="/app.js"></script></body></html>');}
  }catch(error){console.error(error);res.statusCode=500;json({error:error.message});}
}).listen(4340,'127.0.0.1',()=>console.log('14日間無料体験検証: http://127.0.0.1:4340/setup'));
