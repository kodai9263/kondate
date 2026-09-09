"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { getAppUrl } from "@/lib/billing/stripe";
import { normalizeInviteToken } from "@/lib/family/invites";
import { normalizeSignupSource } from "@/lib/marketing/signupSource";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { getSupabaseServer, isSupabaseConfigured } from "@/lib/supabase/server";

const emailSchema = z.string().trim().email();
const passwordSchema = z.string().min(8).max(128);

function authReady(destination: "/login" | "/signup" | "/forgot-password" | "/reset-password") {
  if (!isSupabaseConfigured()) {
    if (destination === "/login") redirect("/login?error=setup");
    if (destination === "/signup") redirect("/signup?error=setup");
    if (destination === "/forgot-password") redirect("/forgot-password?error=setup");
    redirect("/reset-password?error=setup");
  }
}

async function joinInviteIfPresent(supabase: Awaited<ReturnType<typeof getSupabaseServer>>, inviteToken: string | null) {
  if (!inviteToken) return false;
  const { error } = await supabase.rpc("accept_household_invite", { invite_token_input: inviteToken });
  return !error;
}

async function reserveMonitorTrialSlot(reservationToken: string): Promise<"claimed" | "full" | "unavailable"> {
  try {
    const admin = getSupabaseAdmin();
    const { data: claimed, error } = await admin.rpc("claim_monitor_trial_slot", { reservation_token: reservationToken });
    if (error) {
      console.error("Monitor trial claim failed", { code: error.code, message: error.message });
      return "unavailable";
    }
    return claimed ? "claimed" : "full";
  } catch (error) {
    console.error("Monitor trial claim unavailable", error);
    return "unavailable";
  }
}

async function releaseMonitorTrialSlot(reservationToken: string) {
  try {
    const admin = getSupabaseAdmin();
    const { error } = await admin.rpc("release_monitor_trial_slot", { reservation_token: reservationToken });
    if (error) console.error("Monitor trial release failed", { code: error.code, message: error.message });
  } catch (error) {
    console.error("Monitor trial release unavailable", error);
  }
}

export async function login(formData: FormData) {
  authReady("/login");
  const parsed = z
    .object({ email: emailSchema, password: passwordSchema })
    .safeParse({ email: formData.get("email"), password: formData.get("password") });
  const inviteToken = normalizeInviteToken(formData.get("inviteToken"));

  if (!parsed.success) redirect("/login?error=invalid");

  const supabase = await getSupabaseServer();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) redirect("/login?error=credentials");

  await supabase.rpc("ensure_current_user_household");
  if (await joinInviteIfPresent(supabase, inviteToken)) redirect("/app?notice=family-joined");
  redirect("/app");
}

export async function signup(formData: FormData) {
  authReady("/signup");
  const signupSource = normalizeSignupSource(formData.get("signupSource"));
  const parsed = z
    .object({
      displayName: z.string().trim().min(1).max(40),
      email: emailSchema,
      password: passwordSchema,
    })
    .safeParse({
      displayName: formData.get("displayName"),
      email: formData.get("email"),
      password: formData.get("password"),
    });
  const inviteToken = normalizeInviteToken(formData.get("inviteToken"));

  if (!parsed.success) redirect("/signup?error=invalid");

  const supabase = await getSupabaseServer();
  const monitorClaimToken = signupSource === "monitor" ? crypto.randomUUID() : null;
  if (monitorClaimToken) {
    const reservation = await reserveMonitorTrialSlot(monitorClaimToken);
    if (reservation === "full") redirect("/signup?source=monitor&error=monitor-full");
    if (reservation === "unavailable") redirect("/signup?source=monitor&error=monitor-unavailable");
  }

  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: {
        display_name: parsed.data.displayName,
        ...(signupSource ? { signup_source: signupSource } : {}),
        ...(monitorClaimToken ? { monitor_claim_token: monitorClaimToken } : {}),
      },
      emailRedirectTo: `${getAppUrl()}/auth/callback?next=${inviteToken ? `/invite/${inviteToken}` : "/app"}`,
    },
  });

  if (error) {
    if (monitorClaimToken) await releaseMonitorTrialSlot(monitorClaimToken);
    redirect(`/signup?${signupSource === "monitor" ? "source=monitor&" : ""}error=signup`);
  }
  if (!data.session) redirect("/signup?success=check-email");

  await supabase.rpc("ensure_current_user_household");
  if (await joinInviteIfPresent(supabase, inviteToken)) redirect("/app?notice=family-joined");
  redirect("/app");
}

export async function requestPasswordReset(formData: FormData) {
  authReady("/forgot-password");
  const parsed = emailSchema.safeParse(formData.get("email"));
  if (!parsed.success) redirect("/forgot-password?error=invalid");

  const supabase = await getSupabaseServer();
  await supabase.auth.resetPasswordForEmail(parsed.data, {
    redirectTo: `${getAppUrl()}/auth/callback?next=/reset-password`,
  });
  redirect("/forgot-password?success=sent");
}

export async function updatePassword(formData: FormData) {
  authReady("/reset-password");
  const parsed = passwordSchema.safeParse(formData.get("password"));
  if (!parsed.success) redirect("/reset-password?error=invalid");

  const supabase = await getSupabaseServer();
  const { error } = await supabase.auth.updateUser({ password: parsed.data });
  if (error) redirect("/reset-password?error=expired");
  redirect("/app?notice=password-updated");
}
