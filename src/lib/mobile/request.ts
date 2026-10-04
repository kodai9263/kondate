import { registerMobileContext } from "./context";
import { canAccessHousehold } from "@/lib/billing/entitlements";
import { createMobileRequestClient } from "@/lib/supabase/mobile";

export const mobileNoStore = { "Cache-Control": "private, no-store", Vary: "Origin" };

export function mobileOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return null;
  if (origin === "capacitor://localhost" || origin === "http://localhost") return origin;
  if (process.env.NODE_ENV !== "production" && origin === process.env.MOBILE_DEV_ORIGIN) return origin;
  return false;
}

export function mobileResponseHeaders(origin: string | null) {
  return {
    ...mobileNoStore,
    ...(origin ? { "Access-Control-Allow-Origin": origin, "Access-Control-Allow-Headers": "Authorization, Content-Type" } : {}),
  };
}

export function mobileJsonError(error: string, status: number, origin: string | null) {
  return Response.json({ error }, { status, headers: mobileResponseHeaders(origin) });
}

export async function authorizeMobileRequest(request: Request, origin: string | null) {
  const bearer = request.headers.get("authorization")?.match(/^Bearer ([A-Za-z0-9._~-]{16,4096})$/);
  if (!bearer) return mobileJsonError("unauthenticated", 401, origin);

  const supabase = createMobileRequestClient(bearer[1]);
  const { data: { user }, error: userError } = await supabase.auth.getUser(bearer[1]);
  if (userError || !user) return mobileJsonError("unauthenticated", 401, origin);

  const { data: profile, error: profileError } = await supabase.from("profiles")
    .select("household_id").eq("id", user.id).single();
  if (profileError || !profile?.household_id) return mobileJsonError("household_unavailable", 403, origin);

  const [{ data: subscription, error: subscriptionError }, { data: firstMember, error: firstMemberError }] = await Promise.all([
    supabase.from("household_subscriptions").select("status,current_period_end")
      .eq("household_id", profile.household_id).maybeSingle(),
    supabase.from("profiles").select("id").eq("household_id", profile.household_id)
      .order("created_at", { ascending: true }).limit(1).maybeSingle(),
  ]);
  if (subscriptionError || firstMemberError || !firstMember) return mobileJsonError("household_unavailable", 503, origin);
  if (!canAccessHousehold({ userId: user.id, firstMemberId: firstMember.id,
    status: subscription?.status, currentPeriodEnd: subscription?.current_period_end })) {
    return mobileJsonError("family_access_required", 403, origin);
  }
  registerMobileContext(supabase, { user, householdId: profile.household_id, subscription });
  return { supabase, accessToken: bearer[1], userId: user.id, householdId: profile.household_id };
}
