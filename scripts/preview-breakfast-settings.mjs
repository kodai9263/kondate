// 実コンポーネント・保存アクション・一時Postgresをつなぐ、公開しないUI検証サーバー。
import { build } from 'esbuild';
import { createServer } from 'node:http';
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
const root = process.cwd();
const out = process.env.BREAKFAST_PREVIEW_DIR;
if (!out || !process.env.BREAKFAST_PG_SOCKET) throw new Error('一時DBが必要です。start-breakfast-preview.sh から起動してください。');
mkdirSync(out, { recursive: true });
const userId = '10000000-0000-4000-8000-000000000041';
const pgBin = execFileSync('pg_config', ['--bindir'], { encoding: 'utf8' }).trim();
function sql(statement) {
  return execFileSync(join(pgBin, 'psql'), ['-X','-q','-At','-v','ON_ERROR_STOP=1','-h',process.env.BREAKFAST_PG_SOCKET,'-d','postgres','-c',statement], { encoding: 'utf8' }).trim().split('\n').at(-1);
}
sql(`insert into auth.users (id,email) values ('${userId}','preview@example.test');
update household_breakfast_versions set enabled = true, items = (select jsonb_agg(item || jsonb_build_object('id',gen_random_uuid()) order by key) from breakfast_templates where key in ('A','D')) where household_id = (select household_id from profiles where id = '${userId}');`);
const rpcModule = join(out, 'supabase.mjs');
writeFileSync(rpcModule, `import { execFileSync } from 'node:child_process';
export async function getSupabaseServer() { return { rpc: async (name,args) => {
 if (name !== 'save_household_breakfast') throw new Error('unsupported');
 const quote = (v) => "'" + String(v).replaceAll("'", "''") + "'";
 const statement = "set role authenticated; select set_config('request.jwt.claim.sub','${userId}',false); select save_household_breakfast(" + quote(args.expected_revision) + "," + quote(JSON.stringify(args.settings)) + "::jsonb);";
 try { const result = execFileSync(${JSON.stringify(join(pgBin, 'psql'))}, ['-X','-q','-At','-v','ON_ERROR_STOP=1','-h',process.env.BREAKFAST_PG_SOCKET,'-d','postgres','-c',statement], {encoding:'utf8'}); return {data:JSON.parse(result.trim().split('\\n').at(-1)),error:null}; }
 catch(e) {return {data:null,error:{message:String(e.stderr || e.message)}};}
}};}
`);
await build({ entryPoints: ['src/app/account/breakfast-actions.ts'], outfile: join(out,'action.mjs'), bundle:true, platform:'node', format:'esm', alias:{'@':join(root,'src'),'@/lib/supabase/server':rpcModule}, plugins:[{name:'cache-fixture',setup(b){b.onResolve({filter:/^next\/cache$/},()=>({path:'cache',namespace:'fixture'}));b.onLoad({filter:/.*/,namespace:'fixture'},()=>({contents:'export function revalidatePath() {}',loader:'js'}));}}] });
const { saveBreakfastSettings } = await import(pathToFileURL(join(out,'action.mjs')));
await build({ entryPoints:['tests/ui/breakfast-preview.tsx'], outfile:join(out,'app.js'), bundle:true, platform:'browser', format:'esm', alias:{'@':join(root,'src')}, define:{'process.env.NODE_ENV':'"production"'}, plugins:[{name:'action-transport',setup(b){b.onResolve({filter:/account\/breakfast-actions$/},()=>({path:'save',namespace:'fixture'}));b.onLoad({filter:/.*/,namespace:'fixture'},()=>({contents:`export async function saveBreakfastSettings(input) {return (await fetch('/save'+location.search,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(input)})).json();}`,loader:'js'}));}}] });
execFileSync(process.execPath, [resolve('node_modules/tailwindcss/lib/cli.js'),'-i','src/app/globals.css','-o',join(out,'app.css'),'--minify'],{stdio:'pipe'});
createServer(async (req,res)=>{
 try {
  const url = new URL(req.url,'http://localhost:4317');
  if (url.pathname === '/state') {
   res.setHeader('Content-Type','application/json');
   res.end(sql(`set role authenticated; select set_config('request.jwt.claim.sub','${userId}',false); select jsonb_build_object('versions',(select jsonb_agg(to_jsonb(v) order by effective_date) from household_breakfast_versions v),'tomorrow',(timezone('Asia/Tokyo',now()))::date+1);`));
  } else if (url.pathname === '/save' && req.method === 'POST') {
   let body=''; for await (const chunk of req) {body+=chunk; if(body.length>100000) throw new Error('too large');}
   res.setHeader('Content-Type','application/json');
   res.end(JSON.stringify(url.searchParams.has('failure') ? {ok:false,error:'朝食を保存できませんでした。入力は残っています。もう一度お試しください。'} : await saveBreakfastSettings(JSON.parse(body))));
  } else if (url.pathname === '/app.js' || url.pathname === '/app.css') {
   res.setHeader('Content-Type',url.pathname.endsWith('.js')?'text/javascript':'text/css');res.end(readFileSync(join(out,url.pathname.slice(1))));
  } else {
   res.setHeader('Content-Type','text/html; charset=utf-8');res.end('<!doctype html><html lang="ja"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>朝食設定 · ローカル検証</title><link rel="stylesheet" href="/app.css"><div id="root"></div><script type="module" src="/app.js"></script></html>');
  }
 } catch(e) {res.statusCode=500;res.end(String(e.message));}
}).listen(4317,'127.0.0.1',()=>console.log('朝食設定プレビュー: http://127.0.0.1:4317/account'));
