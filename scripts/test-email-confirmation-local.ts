// 本番への通信と実メール送信を行わず、実際のAuthで確認リンクを検証する。
import { readFileSync, writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";
async function main() {
  const file = process.env.CONFIRMATION_LOCAL_ENV;
  const pageOrigin = process.env.CONFIRMATION_LOCAL_ORIGIN;
  assert(file && pageOrigin);
  const settings = Object.fromEntries(readFileSync(file, "utf8").split("\n").filter(line => /^[A-Z_]+=/.test(line)).map(line => {
    const i = line.indexOf("="); return [line.slice(0,i), line.slice(i+1).replace(/^"|"$/g, "")];
  }));
  for (const value of [settings.API_URL, pageOrigin]) {
    const url = new URL(value);
    assert(url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname));
  }
  const admin = createClient(settings.API_URL, settings.SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  const generated = await admin.auth.admin.generateLink({ type: "signup", email: `confirm-${randomUUID()}@example.test`, password: randomUUID()+"Aa1!" });
  assert(!generated.error && generated.data.user && generated.data.properties);
  const userId = generated.data.user.id;
  const hash = generated.data.properties.hashed_token;
  const link = `${pageOrigin}/auth/confirm?token_hash=${hash}`;
  assert(!(await admin.auth.admin.getUserById(userId)).data.user?.email_confirmed_at);
  const landing = await fetch(link);
  assert((await landing.text()).includes("メールアドレスを確認する"));
  assert(!(await admin.auth.admin.getUserById(userId)).data.user?.email_confirmed_at, "リンク先読みで確認済みにならない");
  const result = await fetch(`${pageOrigin}/auth/confirm`, { method: "POST", redirect: "manual", headers: { origin: pageOrigin, "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ token_hash: hash, next: "/app" }) });
  assert.equal(result.status,303);
  assert((await admin.auth.admin.getUserById(userId)).data.user?.email_confirmed_at, "ボタン操作で実認証完了");
  const cookie = result.headers.getSetCookie().map(value=>value.split(";")[0]).join("; ");
  const again = await fetch(link,{headers:{cookie}});
  assert((await again.text()).includes("メールアドレスの確認が完了しました"));
  const used = await fetch(`${pageOrigin}/auth/confirm`, { method: "POST", headers: { origin: pageOrigin, "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ token_hash: hash, next: "/app" }) });
  assert((await used.text()).includes("ログインをお試しください"), "別ブラウザの使用済みリンクは登録失敗と断定しない");
  console.log("PASS: real Auth / prefetch / confirmation / repeat / used-link guidance (local only)");
  if (process.env.CONFIRMATION_PREVIEW_FILE) writeFileSync(process.env.CONFIRMATION_PREVIEW_FILE, link, {mode:0o600});
}
main().catch(() => { console.error("Local confirmation verification failed"); process.exitCode=1; });
