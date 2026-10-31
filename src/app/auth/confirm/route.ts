import { sameOriginRequest } from "@/lib/auth/requestOrigin";
import { createHmac, timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase/server";
import { getSafeAuthRedirect } from "@/lib/auth/redirects";
import { confirmationPage, escapeHtml, loginGuidance } from "@/lib/auth/confirmationPage";

const cookieName = "kondate-email-confirmed";
const tokenPattern = /^[a-zA-Z0-9_-]{32,256}$/;
function signature(hash: string) {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return key ? createHmac("sha256", key).update(`email-confirmed:${hash}`).digest("hex") : null;
}
function confirmed(request: NextRequest, hash: string) {
  const expected = signature(hash);
  const actual = request.cookies.get(cookieName)?.value;
  return !!expected && !!actual && /^[0-9a-f]{64}$/.test(actual)
    && timingSafeEqual(Buffer.from(actual), Buffer.from(expected));
}
function destination(raw: string | null, origin: string) {
  if (!raw) return "/app";
  try {
    const url = new URL(raw, origin);
    if (url.origin !== origin) return "/app";
    return getSafeAuthRedirect(url.pathname === "/auth/callback" ? url.searchParams.get("next") : url.pathname + url.search);
  } catch { return "/app"; }
}
function success(next: string) {
  return confirmationPage("メールアドレスの確認が完了しました", `${loginGuidance}<a class="button" href="${escapeHtml(next)}">Web版で続ける</a>`);
}
function unavailable() {
  return confirmationPage("ログインをお試しください", `${loginGuidance}<p class="note">このリンクは確認済みか、有効期限が切れています。ログインできる場合、メールの再確認は不要です。未確認と表示される場合は、アプリから確認メールを再送してください。</p>`);
}
export async function GET(request: NextRequest) {
  const hash = request.nextUrl.searchParams.get("token_hash") ?? "";
  const next = destination(request.nextUrl.searchParams.get("redirect_to"), request.nextUrl.origin);
  if (!tokenPattern.test(hash)) return unavailable();
  if (confirmed(request, hash)) return success(next);
  // メールのリンク先確認（自動アクセス）ではワンタイムトークンを消費しない。
  return confirmationPage("メールアドレスを確認", `<p>下のボタンを押すと「きょうのごはん」の登録が完了します。</p><form method="post" action="/auth/confirm"><input type="hidden" name="token_hash" value="${escapeHtml(hash)}"><input type="hidden" name="next" value="${escapeHtml(next)}"><button type="submit">メールアドレスを確認する</button></form><p class="note">すでにアプリでログインできている場合、もう一度確認する必要はありません。</p>`, `document.querySelector('form').addEventListener('submit', () => { const button = document.querySelector('button'); button.disabled = true; button.textContent = '確認しています…'; });`);
}
export async function POST(request: NextRequest) {
  if (!sameOriginRequest(request)) return new Response(null, { status: 403 });
  const text = await request.text();
  if (text.length > 4096) return new Response(null, { status: 400 });
  const form = new URLSearchParams(text);
  const hash = form.get("token_hash") ?? "";
  const next = destination(form.get("next"), request.nextUrl.origin);
  if (!tokenPattern.test(hash)) return unavailable();
  if (confirmed(request, hash)) return success(next);
  try {
    const client = await getSupabaseServer();
    const { data, error } = await client.auth.verifyOtp({ token_hash: hash, type: "email" });
    if (error && error.status && error.status >= 500) throw error;
    if (error || !data.user?.email_confirmed_at) return unavailable();
    const signed = signature(hash);
    const response = new NextResponse(null, { status: 303, headers: { Location: `/auth/confirm?token_hash=${encodeURIComponent(hash)}&redirect_to=${encodeURIComponent(next)}`, "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer" } });
    if (!signed) return success(next);
    response.cookies.set(cookieName, signed, { httpOnly: true, secure: request.nextUrl.protocol === "https:", sameSite: "lax", maxAge: 86400, path: "/auth/confirm" });
    return response;
  } catch {
    return confirmationPage("通信を確認して再度お試しください", '<p>メールアドレスの確認結果を取得できませんでした。通信を戻して、メールのリンクをもう一度開いてください。</p>', "", 503);
  }
}
