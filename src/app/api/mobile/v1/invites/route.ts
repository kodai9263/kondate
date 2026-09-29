import { isActiveSubscriptionStatus } from "@/lib/billing/entitlements";
import { buildInviteUrl } from "@/lib/family/invites";
import { mobileJsonError, mobileNoStore, mobileOrigin, mobileResponseHeaders } from "@/lib/mobile/request";
import { createMobileRequestClient } from "@/lib/supabase/mobile";

export function OPTIONS(request: Request) {
  const origin = mobileOrigin(request);
  if (origin === false || origin === null) return new Response(null, { status: 403, headers: mobileNoStore });
  return new Response(null, { status: 204, headers: {
    ...mobileResponseHeaders(origin), "Access-Control-Allow-Methods": "GET, POST, OPTIONS", "Access-Control-Max-Age": "600",
  } });
}

async function identify(request: Request, origin: string | null) {
  const bearer = request.headers.get("authorization")?.match(/^Bearer ([A-Za-z0-9._~-]{16,4096})$/);
  if (!bearer) return mobileJsonError("unauthenticated", 401, origin);
  const supabase = createMobileRequestClient(bearer[1]);
  const { data: { user }, error: userError } = await supabase.auth.getUser(bearer[1]);
  if (userError || !user) return mobileJsonError("unauthenticated", 401, origin);
  if (user.is_anonymous) return mobileJsonError("registered_account_required", 403, origin);
  const { data: profile, error: profileError } = await supabase.from("profiles")
    .select("household_id").eq("id", user.id).maybeSingle();
  if (profileError || !profile?.household_id) return mobileJsonError("household_unavailable", 403, origin);
  return { supabase, userId: user.id, householdId: profile.household_id };
}

export async function GET(request: Request) {
  const origin = mobileOrigin(request);
  if (origin === false) return mobileJsonError("origin_not_allowed", 403, null);
  try {
    const identified = await identify(request, origin);
    if (identified instanceof Response) return identified;
    const { data, error } = await identified.supabase.from("household_invites")
      .select("id,invite_token,expires_at").eq("household_id", identified.householdId)
      .eq("created_by", identified.userId).is("accepted_at", null).is("revoked_at", null)
      .gt("expires_at", new Date().toISOString()).order("created_at", { ascending: false }).limit(20);
    if (error) return mobileJsonError("invites_unavailable", 503, origin);
    return Response.json({ version: 1, invites: (data ?? []).map((invite) => ({
      id: invite.id, url: buildInviteUrl(invite.invite_token), expiresAt: invite.expires_at,
    })) }, { headers: mobileResponseHeaders(origin) });
  } catch (error) {
    console.error("Mobile invite list failed", error);
    return mobileJsonError("invites_unavailable", 503, origin);
  }
}

export async function POST(request: Request) {
  const origin = mobileOrigin(request);
  if (origin === false) return mobileJsonError("origin_not_allowed", 403, null);
  try {
    const identified = await identify(request, origin);
    if (identified instanceof Response) return identified;
    const { data: subscription, error: subscriptionError } = await identified.supabase
      .from("household_subscriptions").select("status,current_period_end")
      .eq("household_id", identified.householdId).maybeSingle();
    if (subscriptionError) return mobileJsonError("subscription_unavailable", 503, origin);
    if (!subscription || !isActiveSubscriptionStatus(subscription.status, subscription.current_period_end)) {
      return mobileJsonError("family_plan_required", 403, origin);
    }
    const { data, error } = await identified.supabase.from("household_invites")
      .insert({ household_id: identified.householdId, created_by: identified.userId })
      .select("id,invite_token,expires_at").single();
    if (error || !data) return mobileJsonError("invite_creation_failed", 503, origin);
    return Response.json({ version: 1, invite: {
      id: data.id, url: buildInviteUrl(data.invite_token), expiresAt: data.expires_at,
    } }, { status: 201, headers: mobileResponseHeaders(origin) });
  } catch (error) {
    console.error("Mobile invite creation failed", error);
    return mobileJsonError("invite_creation_failed", 503, origin);
  }
}
