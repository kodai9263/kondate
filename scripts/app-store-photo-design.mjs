// トップページと同じ料理写真を使う掲載案。写真は画面の外に配置し、アプリ内の写真機能と混同させない。
const escape = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
const page = (title, body, styles) => `<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escape(title)}</title><style>${styles}</style></head><body>${body}</body></html>`;

export const photoScreens = [
  { id: '01-today', tab: 'today', label: '今日の献立', eyebrow: 'EVERYDAY, A LITTLE EASIER', title: ['ごはんの時間に、', 'ゆとりを。'], subtitle: '献立も、買い物も。家族のごはん支度をひとつに。', photo: 'family-dinner', alt: '焼き鮭、ごはん、みそ汁と野菜のおかずが並ぶ食卓', position: '50% 63%', background: '#FAF9F6', ink: '#292E2B', accent: '#AC3C28' },
  { id: '02-planner', tab: 'planner', label: '予定に合わせる', eyebrow: 'MAKE ROOM FOR YOUR DAY', title: ['作らない日も、', 'わが家のペースで。'], subtitle: '外食の日も、忙しい日も。予定に合わせて調整。', photo: 'udon', alt: '野菜と鶏肉が入ったうどん', position: '50% 54%', background: '#EEEEE8', ink: '#293D33', accent: '#52694C' },
  { id: '03-change', tab: 'planner', label: '献立を変える', eyebrow: 'SOMETHING YOU WANT TO EAT', title: ['食べたいものを、', '今日の献立に。'], subtitle: '主菜も副菜も変更。買い物リストにも反映。', photo: 'chicken-teriyaki', alt: '照り焼きチキンと野菜を盛りつけた食卓', position: '50% 65%', background: '#25382E', ink: '#FAF8EF', accent: '#EBC7A5' },
  { id: '04-shopping', tab: 'shopping', label: '買い物リスト', eyebrow: 'BUY ONLY WHAT YOU NEED', title: ['買いすぎを、', '減らそう。'], subtitle: '献立から、買うものリストへ。買ったらチェック。', photo: 'family-dinner', alt: '野菜のおかずと主菜が並んだ家庭の食卓', position: '50% 48%', background: '#FAF9F6', ink: '#292E2B', accent: '#AC3C28' },
  { id: '05-menu', tab: 'menu', label: 'わが家のメニュー', eyebrow: 'KEEP YOUR FAMILY FAVORITES', title: ['わが家の味を、', 'いつもの献立に。'], subtitle: '料理名も、材料も、作り方も。登録・編集は無料。', photo: 'tofu-hamburg', alt: '大根おろしを添えた豆腐ハンバーグの定食', position: '50% 62%', background: '#F0E8DF', ink: '#3B3028', accent: '#80513C' },
];

export function photoPoster(screen, device, note) {
  const ipad = device === 'ipad';
  const width = ipad ? 1024 : 393;
  const height = ipad ? 1366 : 852;
  const scale = ipad ? 2 : 3;
  const appWidth = ipad ? 1024 : 393;
  const appHeight = ipad ? 550 : 382;
  const appScale = ipad ? 880 / 1024 : 333 / 393;
  const body = `<article class="poster ${ipad ? 'ipad' : 'iphone'} design-${screen.id}" style="--paper:${screen.background};--ink:${screen.ink};--accent:${screen.accent};--photo-position:${screen.position}">
    <header><div class="brand-row"><p class="brand">きょうのごはん<span class="brand-rule" aria-hidden="true"></span></p><span class="sequence">${screen.id.slice(0, 2)} / 05</span></div><p class="eyebrow">${escape(screen.eyebrow)}</p><h1><span>${escape(screen.title[0])}</span><span>${escape(screen.title[1])}</span></h1><p class="subtitle">${escape(screen.subtitle)}</p></header>
    <figure class="food"><img src="/food/${screen.photo}.png" alt="${escape(screen.alt)}"></figure>
    <div class="device"><div class="app-screen"><iframe title="実装済みアプリの画面" src="/app?tab=${screen.tab}" width="${appWidth}" height="${appHeight}"></iframe></div></div>
    <footer><span class="section-label">${escape(screen.label)}</span><p>${escape(note)}</p></footer>
  </article>`;
  return page(`${screen.label}・${device}・料理写真を使った掲載画像案`, body, `
    *{box-sizing:border-box}html,body{margin:0;width:${width * scale}px;height:${height * scale}px;overflow:hidden}body{font-family:'Hiragino Sans','Hiragino Kaku Gothic ProN',-apple-system,BlinkMacSystemFont,sans-serif}
    .poster{position:relative;isolation:isolate;overflow:clip;width:${width}px;height:${height}px;transform:scale(${scale});transform-origin:0 0;background:var(--paper);color:var(--ink)}
    header{position:absolute;z-index:2;top:25px;left:26px;right:26px}.brand-row{display:flex;align-items:center;justify-content:space-between}.brand{display:flex;align-items:center;gap:13px;margin:0;font-family:'Hiragino Mincho ProN','Yu Mincho',serif;font-size:15px;font-weight:600;letter-spacing:.04em}.brand-rule{width:25px;height:1px;background:var(--accent)}.sequence{font-size:9px;letter-spacing:.13em;font-weight:500;color:var(--accent)}
    .eyebrow{margin:25px 0 10px;color:var(--accent);font-family:-apple-system,BlinkMacSystemFont,sans-serif;font-size:8px;letter-spacing:.18em;font-weight:650}h1{margin:0;font-family:'Hiragino Mincho ProN','Yu Mincho',serif;font-weight:600;font-size:39px;line-height:1.28;letter-spacing:-.055em;font-feature-settings:'palt'}h1 span{display:block;white-space:nowrap}h1 span:last-child{color:var(--accent)}.subtitle{margin:14px 0 0;font-size:11px;line-height:1.7;letter-spacing:-.035em}
    .food{position:absolute;left:0;right:0;top:234px;height:303px;margin:0;overflow:clip}.food img{display:block;width:100%;height:100%;object-fit:cover;object-position:var(--photo-position)}
    .device{position:absolute;z-index:3;top:500px;left:23px;width:347px;height:337px;padding:7px;border:1px solid #ffffff90;border-radius:20px;background:#fffefa;box-shadow:0 10px 24px #18251e1c}.app-screen{height:100%;overflow:clip;border-radius:12px;background:#fffaf0}iframe{display:block;border:0;transform:scale(${appScale});transform-origin:0 0;background:#fffaf0}
    footer{position:absolute;z-index:4;left:26px;right:26px;bottom:14px;font-size:8px;line-height:1.55}footer .section-label{display:none}footer p{margin:0;color:var(--ink)}
    .iphone .device{top:478px;height:328px}
    .ipad header{top:56px;left:64px;right:64px}.ipad .brand{font-size:26px;gap:24px}.ipad .brand-rule{width:50px}.ipad .sequence{font-size:15px}.ipad .eyebrow{margin-top:44px;margin-bottom:18px;font-size:13px;letter-spacing:.21em}.ipad h1{font-size:78px;line-height:1.23;letter-spacing:-.045em}.ipad .subtitle{font-size:22px;margin-top:24px}.ipad .food{top:445px;height:486px}.ipad .device{left:64px;top:805px;width:896px;height:485px;padding:7px;border-radius:26px;box-shadow:0 20px 42px #18251e24}.ipad .app-screen{border-radius:18px}.ipad footer{left:64px;right:64px;bottom:28px;font-size:15px}
  `);
}

export function photoGallery({ contactSheet = false } = {}) {
  const groups = ['iphone', 'ipad'].map(device => `<section><div class="section-head"><h2>${device === 'iphone' ? 'iPhone' : 'iPad'}</h2><span>05 SCREENS</span></div><div class="gallery">${photoScreens.map(screen => `<a href="./${device}-${screen.id}.jpg"><img src="./${device}-${screen.id}.jpg" width="${device === 'iphone' ? 1179 : 2048}" height="${device === 'iphone' ? 2556 : 2732}" alt="${escape(screen.title.join(''))}"></a>`).join('')}</div></section>`).join('');
  const compare = `<details><summary>前の案と見比べる</summary><div class="compare"><figure><figcaption>鮮やかな配色の案</figcaption><img src="../vibrant/iphone-01-today.jpg" alt="前の鮮やかな案"></figure><figure><figcaption>料理写真を使った今回の案</figcaption><img src="./iphone-01-today.jpg" alt="今回の料理写真を使った案"></figure></div></details><p><a class="back" href="../index.html">説明文・料金案内を見る</a></p>`;
  return page('きょうのごはん・料理写真を使った掲載画像案', `<main><header><p class="eyebrow">きょうのごはん / APP STORE DESIGN</p><h1>ごはんの時間に、ゆとりを。</h1><p>食卓の写真と、余白のあるモダンなデザイン。トップページの雰囲気を掲載画像にも。</p><p class="status">アプリ画面は架空データによる表示例です。Appleへの登録・実機との最終照合はまだ行っていません。</p></header>${groups}${contactSheet ? '' : compare}</main>`, `
    *{box-sizing:border-box}body{margin:0;background:#f6f5f1;color:#292e2b;font-family:'Hiragino Sans',-apple-system,BlinkMacSystemFont,sans-serif}main{max-width:1600px;margin:auto;padding:42px 40px 48px}header{padding-bottom:26px;border-bottom:1px solid #cccfc7}h1{font-family:'Hiragino Mincho ProN','Yu Mincho',serif;font-size:36px;line-height:1.5;font-weight:600;margin:14px 0}p{font-size:14px;line-height:1.8}.eyebrow{font-size:11px;letter-spacing:.16em;color:#80513c;font-weight:600;margin:0}.status{font-size:12px;color:#5d645f}.section-head{display:flex;align-items:baseline;justify-content:space-between;margin:27px 0 14px}.section-head h2{font-size:18px;font-weight:500;margin:0}.section-head span{font-size:10px;letter-spacing:.18em;color:#5d645f}.gallery{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:22px}.gallery a{display:block;border-radius:3px}.gallery img{display:block;width:100%;height:auto;box-shadow:0 6px 20px #25382e14;border:1px solid #e0e0d8}.gallery a:focus-visible,summary:focus-visible,.back:focus-visible{outline:3px solid #ac3c28;outline-offset:5px}details{margin-top:36px;border-top:1px solid #cccfc7;padding-top:15px}summary{min-height:44px;padding:12px 0;cursor:pointer;font-size:15px}.compare{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:24px;max-width:640px;margin:16px 0}figure{margin:0}.compare img{width:100%;display:block}figcaption{font-size:13px;margin-bottom:12px}.back{display:inline-flex;min-height:44px;align-items:center;color:#80513c;text-underline-offset:5px}
    @media(max-width:700px){main{padding:24px 18px}h1{font-size:25px}.gallery{grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}header p{font-size:12px}.compare{gap:16px}figcaption{font-size:11px}}
    ${contactSheet ? 'main{width:1480px;padding:26px 32px 32px}header{padding-bottom:18px}h1{font-size:30px;margin:8px 0}p{font-size:12px;margin:6px 0}.section-head{margin:23px 0 12px}.gallery{gap:20px}' : ''}
  `);
}
