import { randomUUID } from "node:crypto";
export function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!);
}
export function confirmationPage(title: string, content: string, script = "", status = 200) {
  const nonce = randomUUID();
  return new Response(`<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="referrer" content="no-referrer"><title>${escapeHtml(title)}｜きょうのごはん</title>
<style nonce="${nonce}">*{box-sizing:border-box}body{margin:0;padding:24px 20px;background:#fffaf0;color:#342b26;font:16px/1.8 -apple-system,BlinkMacSystemFont,sans-serif}main{max-width:480px;margin:24px auto;padding:28px;background:#fff;border:1px solid #e6ddd3;border-radius:20px}h1{font-size:25px;line-height:1.5}small{color:#a6402d;font-weight:700}p{overflow-wrap:anywhere}.note{color:#74695f;font-size:14px}button,.button{display:block;width:100%;border:0;border-radius:12px;padding:16px;background:#bf4028;color:#fff;font:inherit;font-weight:700;text-align:center;text-decoration:none}a{color:#a6402d}button:disabled{opacity:.6}</style></head><body><main><small>きょうのごはん</small><h1>${escapeHtml(title)}</h1>${content}</main><script nonce="${nonce}">const confirmationHash = location.hash.slice(1);history.replaceState(null, '', location.pathname);${script}</script></body></html>`, { status, headers: {
    "Content-Type": "text/html; charset=utf-8", "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer", "X-Content-Type-Options": "nosniff",
    "Content-Security-Policy": `default-src 'none'; script-src 'nonce-${nonce}'; style-src 'nonce-${nonce}'; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'`,
  } });
}
export const loginGuidance = '<p>「きょうのごはん」アプリを開き、登録したメールアドレスとパスワードでログインしてください。</p><p class="note">この画面は閉じて大丈夫です。もう一度登録する必要はありません。</p>';
