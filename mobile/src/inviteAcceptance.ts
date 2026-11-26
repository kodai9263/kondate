import type { SupabaseClient } from "@supabase/supabase-js";

export async function previewFamilyInvite(client: SupabaseClient, token: string) {
  const { data, error } = await client.rpc("get_household_invite", { invite_token_input: token }).maybeSingle();
  const invite = data as { household_name?: unknown } | null;
  if (error || !invite || typeof invite.household_name !== "string") {
    throw new Error("招待リンクが期限切れ・使用済み、または共有解除されています。家族から新しいリンクをもらってください。");
  }
  return invite.household_name;
}

export async function joinFamilyInvite(client: SupabaseClient, token: string) {
  const { data: { session }, error: sessionError } = await client.auth.getSession();
  if (sessionError) throw new Error("ログイン状態を確認できませんでした。再度お試しください。");
  if (!session) {
    // 招待の消費と所属は既存のDBトリガーで同時に確定する。
    await previewFamilyInvite(client, token);
    const { data, error } = await client.auth.signInAnonymously({ options: { data: { family_invite_token: token } } });
    if (error || !data.session) throw new Error("参加できませんでした。通信を確認するか、登録済みのアカウントでログインしてください。");
  }
  const { data, error } = await client.rpc("accept_household_invite", { invite_token_input: token });
  if (error || typeof data !== "string") {
    throw new Error("参加できませんでした。招待の期限・使用状況を家族に確認してください。");
  }
}
