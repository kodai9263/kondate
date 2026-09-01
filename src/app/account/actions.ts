"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { normalizeAllergies, parseCustomAllergies } from "@/lib/family/allergies";
import { isActiveSubscriptionStatus } from "@/lib/billing/entitlements";
import { getSupabaseServer } from "@/lib/supabase/server";

export async function signOut() {
  const supabase = await getSupabaseServer();
  await supabase.auth.signOut();
  redirect("/");
}

export async function updateAccount(formData: FormData) {
  const parsed = z.object({
    displayName: z.string().trim().min(1).max(40),
    householdName: z.string().trim().min(1).max(60),
    adultCount: z.coerce.number().int().min(1).max(10),
    childCount: z.coerce.number().int().min(0).max(10),
    shoppingDay: z.coerce.number().int().min(0).max(6),
    allergies: z.array(z.string().trim().min(1).max(40)).max(30),
  }).safeParse({
    displayName: formData.get("displayName"),
    householdName: formData.get("householdName"),
    adultCount: formData.get("adultCount"),
    childCount: formData.get("childCount"),
    shoppingDay: formData.get("shoppingDay"),
    allergies: normalizeAllergies([
      ...formData.getAll("allergies"),
      ...parseCustomAllergies(formData.get("customAllergies")),
    ]),
  });
  if (!parsed.success) redirect("/account?error=invalid");

  const supabase = await getSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { error } = await supabase.rpc("update_current_household_account", {
    display_name_input: parsed.data.displayName,
    household_name_input: parsed.data.householdName,
    adult_count_input: parsed.data.adultCount,
    child_count_input: parsed.data.childCount,
    shopping_day_input: parsed.data.shoppingDay,
    allergies_input: parsed.data.allergies,
  });
  if (error) {
    console.error("Account update failed", { code: error.code, message: error.message });
    redirect("/account?error=update");
  }
  redirect("/account?success=updated#account-top");
}

export async function createFamilyInvite() {
  const supabase = await getSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase.from("profiles").select("household_id").eq("id", user.id).single();
  if (!profile) redirect("/account?error=profile");

  const { data: subscription } = await supabase
    .from("household_subscriptions")
    .select("status,current_period_end")
    .eq("household_id", profile.household_id)
    .maybeSingle();
  if (!subscription || !isActiveSubscriptionStatus(subscription.status, subscription.current_period_end)) {
    redirect("/pricing?required=family_sharing");
  }

  const { data, error } = await supabase
    .from("household_invites")
    .insert({ household_id: profile.household_id, created_by: user.id })
    .select("invite_token")
    .single();

  if (error || !data?.invite_token) redirect("/account?error=invite");
  redirect(`/account?success=invite&invite=${data.invite_token}`);
}
