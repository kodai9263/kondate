import { createMobileRequestClient } from "@/lib/supabase/mobile";
import { canAccessHousehold } from "@/lib/billing/entitlements";
import { buildMobileShoppingSnapshot } from "@/lib/shopping/mobileSnapshot";
import { getPlannedShopping, getSavedShoppingState } from "@/lib/shopping/server";

const noStore = { "Cache-Control": "private, no-store", Vary: "Origin" };

function allowedOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return null;
  if (origin === "capacitor://localhost" || origin === "http://localhost") return origin;
  if (process.env.NODE_ENV !== "production" && origin === process.env.MOBILE_DEV_ORIGIN) return origin;
  return false;
}

function responseHeaders(origin: string | null) {
  return {
    ...noStore,
    ...(origin ? { "Access-Control-Allow-Origin": origin, "Access-Control-Allow-Headers": "Authorization, Content-Type" } : {}),
  };
}

function json(error: string, status: number, origin: string | null) {
  return Response.json({ error }, { status, headers: responseHeaders(origin) });
}

export function OPTIONS(request: Request) {
  const origin = allowedOrigin(request);
  if (origin === false || origin === null) return new Response(null, { status: 403, headers: noStore });
  return new Response(null, { status: 204, headers: {
    ...responseHeaders(origin),
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Max-Age": "600",
  } });
}

export async function GET(request: Request) {
  const origin = allowedOrigin(request);
  if (origin === false) return json("origin_not_allowed", 403, null);
  const bearer = request.headers.get("authorization")?.match(/^Bearer ([A-Za-z0-9._~-]{16,4096})$/);
  if (!bearer) return json("unauthenticated", 401, origin);

  try {
    const supabase = createMobileRequestClient(bearer[1]);
    const { data: { user }, error: userError } = await supabase.auth.getUser(bearer[1]);
    if (userError || !user) return json("unauthenticated", 401, origin);

    const { data: profile, error: profileError } = await supabase.from("profiles")
      .select("household_id").eq("id", user.id).single();
    if (profileError || !profile?.household_id) return json("household_unavailable", 403, origin);

    const [{ data: subscription, error: subscriptionError }, { data: firstMember, error: firstMemberError }] = await Promise.all([
      supabase.from("household_subscriptions").select("status,current_period_end")
        .eq("household_id", profile.household_id).maybeSingle(),
      supabase.from("profiles").select("id").eq("household_id", profile.household_id)
        .order("created_at", { ascending: true }).limit(1).maybeSingle(),
    ]);
    if (subscriptionError || firstMemberError || !firstMember) return json("household_unavailable", 503, origin);
    if (!canAccessHousehold({ userId: user.id, firstMemberId: firstMember.id,
      status: subscription?.status, currentPeriodEnd: subscription?.current_period_end })) {
      return json("family_access_required", 403, origin);
    }

    const shopping = await getPlannedShopping(supabase, bearer[1]);
    const saved = await getSavedShoppingState(shopping);
    return Response.json(buildMobileShoppingSnapshot(shopping, saved), { headers: responseHeaders(origin) });
  } catch (error) {
    console.error("Mobile shopping snapshot failed", error);
    return json("shopping_unavailable", 503, origin);
  }
}
