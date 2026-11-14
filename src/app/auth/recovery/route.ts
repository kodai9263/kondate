import { NextRequest, NextResponse } from "next/server";
import { confirmationPage } from "@/lib/auth/confirmationPage";
import { sameOriginRequest } from "@/lib/auth/requestOrigin";
import { getSupabaseServer } from "@/lib/supabase/server";

function recoveryPage(title: string, content: string, script = "", status = 200) {
  // 同一サイトのフォーム送信にはOriginが必要。外部への参照元は送らない。
  return confirmationPage(title, content, script, status, "same-origin");
}

const tokenPattern = /^[a-zA-Z0-9_-]{32,256}$/;
const retry = '<p>リンクの有効期限が切れているか、すでに使用されています。もう一度再設定メールをお申し込みください。</p><a class="button" href="/forgot-password">再設定メールを送る</a>';

export async function GET() {
  // フラグメント内のトークンはアクセスログへ送らず、本人の操作時だけ検証する。
  return recoveryPage("パスワードを再設定", '<p>下のボタンを押して、新しいパスワードの入力へ進んでください。</p><form method="post" action="/auth/recovery"><input type="hidden" name="token_hash"><button type="submit" disabled>新しいパスワードを設定する</button></form><p id="invalid" hidden>リンクを確認できません。メールにある最新のリンクを開いてください。</p><noscript>JavaScriptを有効にして、メールのリンクをもう一度開いてください。</noscript>', `const token = new URLSearchParams(confirmationHash).get('token_hash') || '';const form = document.querySelector('form');const button = form.querySelector('button');if (/^[a-zA-Z0-9_-]{32,256}$/.test(token)) {form.elements.token_hash.value = token;button.disabled = false;} else {form.hidden = true;document.getElementById('invalid').hidden = false;}form.addEventListener('submit', () => {button.disabled = true;button.textContent = '確認しています…';});`);
}

export async function POST(request: NextRequest) {
  if (!sameOriginRequest(request)) return recoveryPage("メールのリンクを開き直してください", '<p>安全のため、この操作を受け付けられませんでした。メールのリンクを開き直してお試しください。</p><a href="/forgot-password">再設定メールを送る</a>', "", 403);
  if (!request.headers.get("content-type")?.startsWith("application/x-www-form-urlencoded")) return new Response(null, { status: 415 });
  const body = await request.text();
  if (body.length > 4096) return new Response(null, { status: 400 });
  const token = new URLSearchParams(body).get("token_hash") ?? "";
  if (!tokenPattern.test(token)) return recoveryPage("再設定リンクを確認できません", retry, "", 400);
  try {
    const client = await getSupabaseServer();
    const { data, error } = await client.auth.verifyOtp({ token_hash: token, type: "recovery" });
    if (error && error.status && error.status >= 500) throw error;
    if (error || !data.user || !data.session) return recoveryPage("再設定メールをもう一度お申し込みください", retry, "", 400);
    // verifyOtpで、このブラウザに再設定対象のセッションを保存する。
    return new NextResponse(null, { status: 303, headers: { Location: "/reset-password", "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer" } });
  } catch {
    return recoveryPage("通信を確認して再度お試しください", '<p>確認結果を取得できませんでした。メールのリンクを開き直してください。再度失敗する場合は、再設定メールをお申し込みください。</p><a href="/forgot-password">再設定メールを送る</a>', "", 503);
  }
}
