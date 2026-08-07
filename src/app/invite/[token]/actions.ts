"use server";

import { redirect } from "next/navigation";
import { normalizeInviteToken } from "@/lib/family/invites";
import { getSupabaseServer } from "@/lib/supabase/server";

export async function acceptFamilyInvite(formData: FormData) {
  const inviteToken = normalizeInviteToken(formData.get("inviteToken"));
  if (!inviteToken) redirect("/");

  const supabase = await getSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/login?invite=${inviteToken}`);

  const { error } = await supabase.rpc("accept_household_invite", { invite_token_input: inviteToken });
  if (error) redirect("/account?error=invite");

  redirect("/app?notice=family-joined");
}
