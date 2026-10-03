import { cache } from "react";
import { isFreeTrialActive, type FreeTrial } from "./freeTrial";
import { isActiveSubscriptionStatus } from "./entitlements";
import { getSupabaseServer } from "@/lib/supabase/server";

export const getFirstWeekAccess = cache(async (client?: Awaited<ReturnType<typeof getSupabaseServer>>, accessToken?: string) => {
  const supabase = client ?? await getSupabaseServer();
  const { data: { user }, error: authError } = await supabase.auth.getUser(accessToken);
  if (authError || !user) throw new Error("first_week_auth_required");
  const { data: profile, error: profileError } = await supabase.from("profiles").select("household_id").eq("id", user.id).single();
  if (profileError || !profile?.household_id) throw new Error("first_week_household_unavailable");
  const [{ data: subscription, error: subscriptionError }, { data: trial, error: trialError }, { data: freeTrial, error: freeTrialError }] = await Promise.all([
    supabase.from("household_subscriptions").select("status,current_period_end").eq("household_id", profile.household_id).maybeSingle(),
    supabase.from("household_first_weeks").select("selected_start,start_date,allergies_confirmed_at").eq("household_id", profile.household_id).maybeSingle(),
    supabase.from("household_free_trials").select("started_at,expires_at").eq("household_id", profile.household_id).maybeSingle(),
  ]);
  if (subscriptionError || trialError || freeTrialError) throw new Error("first_week_access_unavailable");
  const paid = Boolean(subscription && isActiveSubscriptionStatus(subscription.status, subscription.current_period_end));
  if (user.is_anonymous && !paid) throw new Error("first_week_auth_required");
  return { supabase, user, householdId: profile.household_id as string,
    paid,
    freeTrial: freeTrial as FreeTrial | null,
    trialActive: !user.is_anonymous && isFreeTrialActive(freeTrial as FreeTrial | null),
    canPlan: paid || (!user.is_anonymous && isFreeTrialActive(freeTrial as FreeTrial | null)),
    trial: trial as { selected_start: string; start_date: string | null; allergies_confirmed_at: string } | null };
});
