import { isActiveSubscriptionStatus } from "@/lib/billing/entitlements";
import { mobileJsonError, mobileNoStore, mobileOrigin, mobileResponseHeaders } from "@/lib/mobile/request";
import { createMobileRequestClient } from "@/lib/supabase/mobile";

export function OPTIONS(request: Request) {
  const origin = mobileOrigin(request);
  if (origin === false || origin === null) return new Response(null, { status: 403, headers: mobileNoStore });
  return new Response(null, { status: 204, headers: {
    ...mobileResponseHeaders(origin), "Access-Control-Allow-Methods": "GET, OPTIONS", "Access-Control-Max-Age": "600",
  } });
}

export async function GET(request: Request) {
  const origin = mobileOrigin(request);
  if (origin === false) return mobileJsonError("origin_not_allowed", 403, null);

  const bearer = request.headers.get("authorization")?.match(/^Bearer ([A-Za-z0-9._~-]{16,4096})$/);
  if (!bearer) return mobileJsonError("unauthenticated", 401, origin);

  try {
    const supabase = createMobileRequestClient(bearer[1]);
    const { data: { user }, error: userError } = await supabase.auth.getUser(bearer[1]);
    if (userError || !user) return mobileJsonError("unauthenticated", 401, origin);

    const { data: profile, error: profileError } = await supabase.from("profiles")
      .select("household_id,display_name").eq("id", user.id).maybeSingle();
    if (profileError || !profile?.household_id) return mobileJsonError("account_unavailable", 403, origin);

    const [{ data: members, error: membersError }, { data: subscription, error: subscriptionError }] = await Promise.all([
      supabase.from("profiles").select("id").eq("household_id", profile.household_id),
      supabase.from("household_subscriptions").select("status,current_period_end,stripe_customer_id")
        .eq("household_id", profile.household_id).maybeSingle(),
    ]);
    if (membersError || subscriptionError || !members?.some((member) => member.id === user.id)) {
      return mobileJsonError("account_unavailable", 503, origin);
    }

    return Response.json({ version: 1,
      account: { displayName: profile.display_name, isAnonymous: user.is_anonymous ?? false },
      household: { memberCount: members.length, lastMember: members.length === 1 },
      subscription: { active: subscription ? isActiveSubscriptionStatus(subscription.status, subscription.current_period_end) : false,
        status: subscription?.status ?? "free", provider: subscription?.stripe_customer_id ? "stripe" : "none" },
    }, { headers: mobileResponseHeaders(origin) });
  } catch (error) {
    console.error("Mobile account deletion preview failed", error);
    return mobileJsonError("account_unavailable", 503, origin);
  }
}
