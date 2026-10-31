import { randomUUID } from "node:crypto";

// モバイルのimplicit認証結果はURLのフラグメントにあり、サーバーには届かない。
// ブラウザではセッションを作らず、トークンをURLから除去してアプリでのログインへ案内する。
export function mobileConfirmationResponse() {
  const nonce = randomUUID();
  const html = `<!doctype html><html lang="ja"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><meta name="referrer" content="no-referrer">
<title>アプリへ戻ってログイン｜きょうのごはん</title>
<style nonce="${nonce}">*{box-sizing:border-box}body{margin:0;padding:32px 20px;background:#fffaf0;color:#342b26;font:16px/1.8 -apple-system,BlinkMacSystemFont,sans-serif}main{max-width:480px;margin:32px auto;padding:28px;background:white;border:1px solid #e6ddd3;border-radius:20px}h1{font-size:25px;line-height:1.5}small{color:#a6402d;font-weight:700}p{overflow-wrap:anywhere}.note{color:#74695f;font-size:14px}</style>
</head><body><main><small>きょうのごはん</small><h1>アプリへ戻って<br>ログインしてください</h1>
<p id="message" role="status">メールの確認後は「きょうのごはん」アプリを開き、登録したメールアドレスとパスワードでログインしてください。</p>
<p class="note">このブラウザでログインする必要はありません。この画面は閉じて大丈夫です。</p></main>
<script nonce="${nonce}">
(() => {
  const query = new URLSearchParams(location.search);
  const fragment = new URLSearchParams(location.hash.slice(1));
  const failed = query.has('error') || query.has('error_code') || fragment.has('error') || fragment.has('error_code');
  history.replaceState(null, '', location.pathname);
  if (failed) {
    document.querySelector('h1').textContent = '確認リンクを利用できませんでした';
    document.getElementById('message').textContent = 'リンクの有効期限が切れているか、すでに使用されています。認証済みの場合はアプリでログインできます。まだ認証できない場合は、最新の確認メールを開いてください。';
  }
})();
</script></body></html>`;
  return new Response(html, { headers: {
    "Content-Type": "text/html; charset=utf-8", "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer",
    "X-Content-Type-Options": "nosniff",
    "Content-Security-Policy": `default-src 'none'; script-src 'nonce-${nonce}'; style-src 'nonce-${nonce}'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'`,
  } });
}
