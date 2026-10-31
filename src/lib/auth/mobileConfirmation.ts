import { confirmationPage, loginGuidance } from "./confirmationPage";

// 旧メールの認証結果を扱う。期限切れと認証済みを、URLのエラーだけで断定しない。
export function mobileConfirmationResponse() {
  return confirmationPage("アプリでログインしてください", `<div id="message" role="status">${loginGuidance}</div><p class="note" id="help">ログイン時に「メールアドレスの確認が必要」と表示された場合は、アプリから確認メールを再送できます。</p>`, `
(async () => {
  const fragment = new URLSearchParams(confirmationHash);
  const token = fragment.get('access_token');
  if (!token) return;
  try {
    const response = await fetch('/auth/mobile-result', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ accessToken: token }), cache: 'no-store' });
    if (response.ok) {
      document.querySelector('h1').textContent = 'メールアドレスの確認が完了しました';
      document.getElementById('help').textContent = 'アプリへ戻ってログインすると、使い始められます。';
    }
  } catch {}
})();`);
}
