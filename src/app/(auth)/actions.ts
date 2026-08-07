"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { getAppUrl } from "@/lib/billing/stripe";
import { normalizeInviteToken } from "@/lib/family/invites";
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
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: { display_name: parsed.data.displayName },
      emailRedirectTo: `${getAppUrl()}/auth/callback?next=${inviteToken ? `/invite/${inviteToken}` : "/app"}`,
    },
  });

  if (error) redirect("/signup?error=signup");
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
