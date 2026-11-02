import { build } from 'esbuild';
import { createServer } from 'node:http';
import { readFileSync, existsSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { todaySnapshot, shoppingSnapshot, plannerSnapshot, recipes, menuDetail, editorData } from '../tests/fixtures/app-store-data.mjs';
import { vibrantScreens, vibrantPoster, vibrantGallery } from './app-store-vibrant-design.mjs';

const root = process.cwd();
const assetsRoot = resolve(root, 'docs/app-store-assets/ja');
const listing = JSON.parse(readFileSync(resolve(assetsRoot, 'listing.json'), 'utf8'));
const vibrantRoot = resolve(assetsRoot, 'vibrant');
const escape = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));

// 本番のApp/CSSをそのまま描画し、認証と読み取りデータだけを掲載用に差し替える。
// 環境ファイルや本番への認証キーは読み込まず、外部通信と変更APIは許可しない。
const bundle = await build({
  entryPoints: ['mobile/src/main.tsx'], bundle: true, write: false, outdir: '/private/tmp/kondate-app-store-preview',
  format: 'esm', jsx: 'automatic', define: { 'import.meta.env.VITE_API_BASE_URL': '""', 'process.env.NODE_ENV': '"production"' },
  plugins: [{ name: 'store-preview-only', setup(builder) {
    builder.onResolve({ filter: /^\.\/supabase$/ }, args => args.importer.endsWith('/mobile/src/App.tsx') ? { path: 'preview-auth', namespace: 'store-preview' } : undefined);
    builder.onLoad({ filter: /.*/, namespace: 'store-preview' }, () => ({ contents: `
      export const isConfigured = true;
      export const supabase = {
        rpc: async () => ({ error: null }),
        auth: { onAuthStateChange(callback) {
          let active = true;
          queueMicrotask(() => { if (active) callback('INITIAL_SESSION', { access_token: 'local-preview-not-a-token', user: { id: '30000000-0000-4000-8000-000000000001' } }); });
          return { data: { subscription: { unsubscribe() { active = false; } } } };
        } }
      };
    `, loader: 'js' }));
    builder.onLoad({ filter: /\/mobile\/src\/App\.tsx$/ }, args => {
      let contents = readFileSync(args.path, 'utf8');
      const target = 'useState<"today" | "planner" | "menu" | "shopping" | "settings">("today")';
      if (!contents.includes(target)) throw new Error('掲載用の初期画面を再確認してください。');
      contents = contents.replace(target, `useState<"today" | "planner" | "menu" | "shopping" | "settings">((new URLSearchParams(location.search).get('tab') || 'today') as 'today')`);
      return { contents, loader: 'tsx', resolveDir: resolve(root, 'mobile/src') };
    });
  } }],
});
const js = bundle.outputFiles.find(file => file.path.endsWith('.js')).contents;
// デスクトップ側の常時表示スクロールバーだけを撮影から除く。
const css = Buffer.concat([bundle.outputFiles.find(file => file.path.endsWith('.css')).contents,
  Buffer.from('\n*{scrollbar-width:none}*::-webkit-scrollbar{display:none}')]);
const html = (title, body, styles = '') => `<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escape(title)}</title><style>${styles}</style></head><body>${body}</body></html>`;

function poster(screen, device) {
  const ipad = device === 'ipad';
  const config = ipad ? { width: 1024, height: 1366, scale: 2, appWidth: 1024, appHeight: 1097, appScale: 0.890625 } : { width: 393, height: 852, scale: 3, appWidth: 393, appHeight: 678, appScale: 361 / 393 };
  return html(`${screen.id}・${device}・掲載画像案`, `<article class="poster ${ipad ? 'ipad' : 'iphone'}"><header><p class="brand">きょうのごはん</p><h1>${screen.title.map(escape).join('<br>')}</h1><p class="sub">${escape(screen.subtitle)}</p></header><div class="screen"><iframe title="実装済みアプリの画面" src="/app?tab=${screen.tab}" width="${config.appWidth}" height="${config.appHeight}"></iframe></div><p class="note">${escape(screen.note)}</p></article>`, `
    *{box-sizing:border-box}body{margin:0;width:${config.width * config.scale}px;height:${config.height * config.scale}px;overflow:hidden;font-family:-apple-system,BlinkMacSystemFont,'Hiragino Kaku Gothic ProN',sans-serif;color:#342b26;background:#f7efe4}
    .poster{position:relative;width:${config.width}px;height:${config.height}px;transform:scale(${config.scale});transform-origin:0 0;background:linear-gradient(160deg,#fffaf0 45%,#f2dfcd)}
    header{position:absolute;left:24px;top:24px;right:24px}.brand{margin:0 0 10px;color:#bf4028;font-size:12px;font-weight:700;letter-spacing:.08em}h1{margin:0;font-size:31px;line-height:1.28;letter-spacing:-.025em;font-weight:750}.sub{margin:12px 0 0;font-size:12px;line-height:1.6;color:#715b4a}
    .screen{position:absolute;left:16px;top:180px;width:361px;height:623px;background:#fffaf0;border-radius:22px;overflow:hidden;outline:1px solid #dac8b8;box-shadow:0 16px 28px #62432820}iframe{border:0;display:block;transform:scale(${config.appScale});transform-origin:0 0;background:#fffaf0}.note{position:absolute;left:21px;right:21px;bottom:13px;margin:0;font-size:8.8px;line-height:1.6;color:#725f50}
    .ipad header{left:64px;top:48px;right:64px}.ipad .brand{font-size:20px;margin-bottom:16px}.ipad h1{font-size:55px;line-height:1.22}.ipad .sub{font-size:22px;margin-top:15px}.ipad .screen{left:56px;top:318px;width:912px;height:977px;border-radius:24px}.ipad .note{left:64px;right:64px;bottom:26px;font-size:16px}
  `);
}

function gallery() {
  return html('きょうのごはん・App Store掲載内容の確認', `<main><p class="brand">きょうのごはん / App Store掲載準備</p><h1>献立と買い物を、家族の手のひらに。</h1><p>掲載画像と説明文の確認ページです。アプリ本体の画面を、架空の家族データで表示しています。</p><p class="status">Appleには未登録です。画像はブラウザでの描画で、端末での最終照合前の掲載案です。</p><h2>iPhone掲載画像案</h2><div class="gallery">${listing.screens.map(screen => `<a href="/poster?screen=${screen.id}&device=iphone"><img src="/assets/iphone-${screen.id}.jpg" alt="${escape(screen.title.join(''))}" loading="lazy"><strong>${escape(screen.title.join(''))}</strong></a>`).join('')}</div><h2>iPad掲載画像案</h2><div class="gallery tablets">${listing.screens.map(screen => `<a href="/poster?screen=${screen.id}&device=ipad"><img src="/assets/ipad-${screen.id}.jpg" alt="${escape(screen.title.join(''))}" loading="lazy"><strong>${escape(screen.title.join(''))}</strong></a>`).join('')}</div><h2>登録する文面</h2><dl><dt>名前</dt><dd>${escape(listing.name)}</dd><dt>サブタイトル</dt><dd>${escape(listing.subtitle)}</dd><dt>紹介文</dt><dd>${escape(listing.promotionalText)}</dd><dt>キーワード</dt><dd>${escape(listing.keywords)}</dd></dl><h2>説明文</h2><div class="description">${escape(listing.description)}</div><p><a href="/listing.json">登録用の文面ファイル</a></p></main>`, `*{box-sizing:border-box}body{margin:0;background:#fffaf0;color:#342b26;font-family:-apple-system,BlinkMacSystemFont,'Hiragino Kaku Gothic ProN',sans-serif}main{max-width:1440px;margin:auto;padding:36px}.brand{color:#bf4028;font-size:14px;font-weight:bold}h1{font-size:32px}h2{font-size:22px;margin-top:40px}.status{background:#f1e6d8;padding:14px 18px;border-radius:12px;font-size:13px}.gallery{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:20px}.gallery a{display:grid;gap:10px;text-decoration:none;color:inherit;font-size:13px}.gallery img{width:100%;height:auto;border:1px solid #e6d8ca;border-radius:10px;box-shadow:0 6px 20px #62432812}.description{white-space:pre-wrap;font-size:15px;line-height:1.9;max-width:900px;background:white;padding:28px;border:1px solid #eaded1;border-radius:16px}dt{font-weight:bold;margin-top:18px}dd{margin:5px 0;line-height:1.7}@media(max-width:700px){main{padding:20px}.gallery{grid-template-columns:repeat(2,minmax(0,1fr))}h1{font-size:24px}}`);
}

function contactSheet() {
  return html('きょうのごはん・掲載画像案10枚', `<main><p>きょうのごはん / App Store掲載準備</p><h1>掲載画像案 — iPhone・iPad 各5枚</h1><p>架空の家族データを使ったブラウザ描画です。Appleへの登録・端末での最終照合は未実施です。</p>${['iphone', 'ipad'].map(device => `<h2>${device === 'iphone' ? 'iPhone' : 'iPad'}</h2><div class="grid">${listing.screens.map(screen => `<img src="/assets/${device}-${screen.id}.jpg" alt="${escape(screen.title.join(''))}">`).join('')}</div>`).join('')}</main>`, `*{box-sizing:border-box}body{margin:0;background:#fffaf0;color:#342b26;font-family:-apple-system,BlinkMacSystemFont,'Hiragino Kaku Gothic ProN',sans-serif}main{width:1440px;padding:28px 36px}h1{margin:8px 0;font-size:28px}p{font-size:13px;margin:6px 0;color:#80634f}h2{font-size:18px;margin:22px 0 12px}.grid{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:20px}.grid img{display:block;width:100%;border:1px solid #e6d8ca;border-radius:9px}`);
}

// 確認ページは撮影済みの画像に直接リンクし、公開前に完成形を見比べられるようにする。
function reviewPage() {
  return gallery().replace(/href="\/poster\?screen=([^&"]+)&device=(iphone|ipad)"/g, 'href="/assets/$2-$1.jpg"');
}

if (process.argv.includes('--export-review')) {
  writeFileSync(resolve(assetsRoot, 'index.html'), reviewPage().replaceAll('/assets/', './').replaceAll('/listing.json', './listing.json'));
  for (const [key, name] of [['name', 'name'], ['subtitle', 'subtitle'], ['promotionalText', 'promotional-text'], ['description', 'description'], ['keywords', 'keywords']]) {
    writeFileSync(resolve(assetsRoot, `${name}.txt`), `${listing[key]}\n`);
  }
  console.log('掲載内容の確認ページと登録用テキストを保存しました。');
  process.exit(0);
}

if (process.argv.includes('--export-vibrant')) {
  mkdirSync(vibrantRoot, { recursive: true });
  writeFileSync(resolve(vibrantRoot, 'index.html'), vibrantGallery());
  writeFileSync(resolve(vibrantRoot, 'design.json'), `${JSON.stringify(vibrantScreens, null, 2)}\n`);
  console.log('新しい掲載画像案の確認ページを保存しました。');
  process.exit(0);
}

const server = createServer((req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; frame-src 'self'; object-src 'none'; base-uri 'none'");
  const url = new URL(req.url, 'http://127.0.0.1');
  if (req.method !== 'GET') { res.writeHead(405); res.end('掲載用プレビューでは保存できません。'); return; }
  const json = value => { res.setHeader('Content-Type', 'application/json; charset=utf-8'); res.end(JSON.stringify(value)); };
  if (url.pathname.startsWith('/api/')) {
    switch (url.pathname) {
      case '/api/mobile/v1/today': return json(todaySnapshot);
      case '/api/mobile/v1/shopping': return json(shoppingSnapshot);
      case '/api/mobile/v1/planner': return json(plannerSnapshot(url.searchParams.get('view') === 'month' ? 'month' : 'week'));
      case '/api/mobile/v1/recipes': return json(url.searchParams.has('id') ? menuDetail(url.searchParams.get('id')) : { version: 1, items: recipes });
      case '/api/mobile/v1/recipes/editor': return json(editorData(url.searchParams.get('id')));
      case '/api/mobile/v1/account/family-size': return json({ version: 1, adultCount: 2, childCount: 2 });
      case '/api/mobile/v1/account/deletion-preview': return json({ version: 1, deletionAvailable: false, account: { displayName: 'ごはん', isAnonymous: false }, household: { memberCount: 2, lastMember: false }, subscription: { active: true, status: 'active', provider: 'apple' } });
      case '/api/mobile/v1/invites': return json({ version: 1, invites: [] });
      default: res.writeHead(404); res.end(); return;
    }
  }
  if (url.pathname === '/app.js' || url.pathname === '/app.css') {
    res.setHeader('Content-Type', url.pathname.endsWith('.js') ? 'text/javascript' : 'text/css'); res.end(url.pathname.endsWith('.js') ? js : css); return;
  }
  if (url.pathname === '/listing.json') return json(listing);
  if (url.pathname === '/vibrant/poster') {
    const screen = vibrantScreens.find(item => item.id === url.searchParams.get('screen'));
    const device = url.searchParams.get('device');
    if (!screen || !['iphone', 'ipad'].includes(device)) { res.writeHead(404); return res.end(); }
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.end(vibrantPoster(screen, device, listing.screens.find(item => item.id === screen.id).note));
  }
  if (url.pathname === '/vibrant/' || url.pathname === '/vibrant/contact-sheet') {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.end(vibrantGallery({ contactSheet: url.pathname.endsWith('contact-sheet') }).replaceAll('src="../', 'src="/assets/').replaceAll('href="../index.html"', 'href="/"'));
  }
  if (/^\/vibrant\/(iphone|ipad)-0[1-5]-(today|planner|change|shopping|menu)\.jpg$/.test(url.pathname)) {
    const file = resolve(vibrantRoot, url.pathname.split('/').at(-1));
    if (existsSync(file)) { res.setHeader('Content-Type', 'image/jpeg'); return res.end(readFileSync(file)); }
    res.writeHead(404); return res.end();
  }
  if (/^\/assets\/(iphone|ipad)-0[1-5]-(today|planner|change|shopping|menu)\.jpg$/.test(url.pathname)) {
    const file = resolve(assetsRoot, url.pathname.split('/').at(-1));
    if (existsSync(file)) { res.setHeader('Content-Type', 'image/jpeg'); res.end(readFileSync(file)); return; }
    res.writeHead(404); res.end(); return;
  }
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  if (url.pathname === '/app') return res.end(html('掲載用データで表示したアプリ', '<link rel="stylesheet" href="/app.css"><div id="root"></div><script type="module" src="/app.js"></script>'));
  if (url.pathname === '/poster') {
    const screen = listing.screens.find(item => item.id === url.searchParams.get('screen'));
    if (!screen || !['iphone', 'ipad'].includes(url.searchParams.get('device'))) { res.writeHead(404); res.end(); return; }
    return res.end(poster(screen, url.searchParams.get('device')));
  }
  if (url.pathname === '/contact-sheet') return res.end(contactSheet());
  if (url.pathname === '/') return res.end(reviewPage());
  res.writeHead(404); res.end();
});
server.listen(0, '127.0.0.1', () => console.log(`PREVIEW_URL=http://127.0.0.1:${server.address().port}`));
