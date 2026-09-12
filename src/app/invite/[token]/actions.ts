"use server";

import { redirect } from "next/navigation";
import { normalizeInviteToken } from "@/lib/family/invites";
import { getSupabaseServer } from "@/lib/supabase/server";

export async function acceptFamilyInvite(formData: FormData) {
  const inviteToken = normalizeInviteToken(formData.get("inviteToken"));
  if (!inviteToken) redirect("/");

  const supabase = await getSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    const { data: invite, error: previewError } = await supabase
      .rpc("get_household_invite", { invite_token_input: inviteToken }).maybeSingle();
    if (previewError || !invite) redirect(`/invite/${inviteToken}?error=accept`);

    // 招待の消費と家族への所属は、匿名ユーザー作成時のDBトリガーで同時に確定する。
    const { data, error } = await supabase.auth.signInAnonymously({
      options: { data: { family_invite_token: inviteToken } },
    });
    if (error || !data.user || !data.session) redirect(`/invite/${inviteToken}?error=guest`);
  }

  const { error } = await supabase.rpc("accept_household_invite", { invite_token_input: inviteToken });
  if (error) redirect(`/invite/${inviteToken}?error=accept`);

  redirect("/app?notice=family-joined");
}
