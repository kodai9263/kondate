// 本番への誤接続を拒否し、ローカルの使い捨てアカウントだけでAuth/Storageを検証する。
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";
import { POST } from "../src/app/api/mobile/v1/account/deletion/route";

async function main() {
  const file = process.env.DELETION_LOCAL_ENV;
  assert(file, "ローカル環境ファイルの明示が必要です");
  const settings = Object.fromEntries(readFileSync(file, "utf8").split("\n").filter(line => /^[A-Z_]+=/.test(line)).map(line => {
    const index = line.indexOf("="); return [line.slice(0, index), line.slice(index + 1).replace(/^"|"$/g, "")];
  }));
  const endpoint = new URL(settings.API_URL);
  assert(["127.0.0.1", "localhost"].includes(endpoint.hostname) && endpoint.protocol === "http:", "ローカル以外への接続は禁止です");
  process.env.NEXT_PUBLIC_SUPABASE_URL = endpoint.origin;
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = settings.ANON_KEY;
  process.env.SUPABASE_SERVICE_ROLE_KEY = settings.SERVICE_ROLE_KEY;
  process.env.ACCOUNT_DELETION_ENABLED = "true";
  const options = { auth: { persistSession: false, autoRefreshToken: false } };
  const admin = createClient(endpoint.origin, settings.SERVICE_ROLE_KEY, options);
  const run = randomUUID();
  async function account(label: string) {
    const email = `${label}-${run}@example.test`, password = randomUUID()+"Aa1!";
    const created = await admin.auth.admin.createUser({ email, password, email_confirm: true });
    assert(!created.error && created.data.user, "テスト用Authアカウント作成");
    const client = createClient(endpoint.origin, settings.ANON_KEY, options);
    const login = await client.auth.signInWithPassword({ email, password });
    assert(!login.error && login.data.session, "実際のAuthログイン");
    const profile = await admin.from("profiles").select("household_id").eq("id", created.data.user.id).single();
    assert(!profile.error && profile.data, "プロフィール作成");
    return { id: created.data.user.id, client, token: login.data.session.access_token, home: profile.data.household_id as string };
  }
  const owner = await account("deletion-owner"), member = await account("deletion-member");
  // この実行で作ったローカル家族だけに、家族参加用の契約fixtureを設定する。
  const billing = await admin.from("household_subscriptions").update({ status: "active", current_period_end: new Date(Date.now()+86400000).toISOString() }).eq("household_id",owner.home);
  assert(!billing.error, "ローカル家族の契約fixture");
  const invite = await admin.from("household_invites").insert({ household_id: owner.home, created_by: owner.id }).select("invite_token").single();
  assert(!invite.error && invite.data, "テスト家族招待");
  const joined = await member.client.rpc("accept_household_invite", { invite_token_input: invite.data.invite_token });
  assert(!joined.error, `実際の認証で家族参加: ${joined.error?.message}`);
  const pixel = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aRfkAAAAASUVORK5CYII=", "base64");
  const paths = [`${owner.home}/owner-${run}.png`, `${owner.home}/member-${run}.png`];
  for (const [index, person] of [owner, member].entries()) {
    const upload = await person.client.storage.from("recipe-images").upload(paths[index], pixel, { contentType: "image/png" });
    assert(!upload.error, "本人の認証で写真アップロード");
    const { data } = admin.storage.from("recipe-images").getPublicUrl(paths[index]);
    const recipe = await admin.from("recipes").insert({ household_id: owner.home, name: `削除検証${index}`, image_url: data.publicUrl });
    assert(!recipe.error, "写真参照を持つ共有料理を作成");
  }
  const purchase = await admin.from("apple_purchase_accounts").insert({ user_id: owner.id, household_id: owner.home }).select("token").single();
  assert(!purchase.error && purchase.data, "Apple購入者fixture");
  async function remove(person: typeof owner) {
    const response = await POST(new Request("http://localhost/api/mobile/v1/account/deletion", {
      method: "POST", headers: { Authorization: `Bearer ${person.token}`, "Content-Type": "application/json", Origin: "capacitor://localhost" },
      body: JSON.stringify({ action: "delete", confirmation: "削除" }),
    }));
    const body = await response.json();
    assert(response.status === 200 && body.status === "completed", `退会API完了: status=${response.status}, result=${body.status ?? body.error}`);
    const auth = await admin.auth.admin.getUserById(person.id);
    assert(!auth.data.user, "Authから本人が削除される");
    const oldSession = await person.client.auth.getUser(person.token);
    assert(oldSession.error, "旧トークンで本人確認できない");
    console.log("PASS: 退会API・実Auth削除・旧トークン拒否");
  }
  await remove(owner);
  const ownImage = await admin.storage.from("recipe-images").download(paths[0]);
  const familyImage = await admin.storage.from("recipe-images").download(paths[1]);
  assert(ownImage.error && !familyImage.error, "本人写真だけが削除される");
  const recipes = await member.client.from("recipes").select("name,image_url").eq("household_id",owner.home);
  assert(!recipes.error && recipes.data?.length === 2 && recipes.data.some(row => row.image_url === null), "残る家族の共有料理を維持し削除写真の参照を外す");
  const tombstone = await admin.from("apple_purchase_accounts").select("user_id,household_id,deleted_at").eq("token",purchase.data.token).single();
  assert(tombstone.data?.deleted_at && tombstone.data.user_id === null && tombstone.data.household_id === null, "購入者の個人情報との関連を解除");
  console.log("PASS: 本人写真削除・家族写真保持・共有料理保持・Apple購入者切り離し");
  await remove(member);
  const finalImage = await admin.storage.from("recipe-images").download(paths[1]);
  const household = await admin.from("households").select("id").eq("id",owner.home).maybeSingle();
  assert(finalImage.error && !household.error && !household.data, "最後の家族と写真を削除");
  console.log("PASS: 最後の家族と写真の削除");
  console.log("ローカルSupabaseの実認証・実Storageによる退会検証完了。本番への接続なし。");
}
main().catch(error => { console.error(error instanceof Error ? error.message : "検証失敗"); process.exitCode=1; });
