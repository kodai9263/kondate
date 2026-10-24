import { getRecipeServings } from "@/lib/family/servings";
import { mobileJsonError, mobileNoStore, mobileOrigin, mobileResponseHeaders } from "@/lib/mobile/request";
import { createMobileRequestClient } from "@/lib/supabase/mobile";

export function OPTIONS(request: Request) {
  const origin = mobileOrigin(request);
  if (origin === false || origin === null) return new Response(null, { status: 403, headers: mobileNoStore });
  return new Response(null, { status: 204, headers: {
    ...mobileResponseHeaders(origin), "Access-Control-Allow-Methods": "GET, PATCH, OPTIONS", "Access-Control-Max-Age": "600",
  } });
}

async function identify(request: Request, origin: string | null) {
  const bearer = request.headers.get("authorization")?.match(/^Bearer ([A-Za-z0-9._~-]{16,4096})$/);
  if (!bearer) return mobileJsonError("unauthenticated", 401, origin);
  const supabase = createMobileRequestClient(bearer[1]);
  const { data: { user }, error: userError } = await supabase.auth.getUser(bearer[1]);
  if (userError || !user) return mobileJsonError("unauthenticated", 401, origin);
  const { data: profile, error: profileError } = await supabase.from("profiles")
    .select("household_id").eq("id", user.id).maybeSingle();
  if (profileError || !profile?.household_id) return mobileJsonError("household_unavailable", 403, origin);
  return { supabase, householdId: profile.household_id };
}

function familySizeResponse(origin: string | null, adultCount: number, childCount: number) {
  return Response.json({ version: 1, adultCount, childCount }, { headers: mobileResponseHeaders(origin) });
}

export async function GET(request: Request) {
  const origin = mobileOrigin(request);
  if (origin === false) return mobileJsonError("origin_not_allowed", 403, null);
  try {
    const identified = await identify(request, origin);
    if (identified instanceof Response) return identified;
    const { data, error } = await identified.supabase.from("household_settings")
      .select("adult_count,child_count").eq("household_id", identified.householdId).maybeSingle();
    if (error || !data) return mobileJsonError("settings_unavailable", 503, origin);
    return familySizeResponse(origin, data.adult_count, data.child_count);
  } catch (error) {
    console.error("Mobile family size read failed", error);
    return mobileJsonError("settings_unavailable", 503, origin);
  }
}

export async function PATCH(request: Request) {
  const origin = mobileOrigin(request);
  if (origin === false) return mobileJsonError("origin_not_allowed", 403, null);
  let identified: Awaited<ReturnType<typeof identify>>;
  try { identified = await identify(request, origin); }
  catch (error) {
    console.error("Mobile family size authentication failed", error);
    return mobileJsonError("settings_unavailable", 503, origin);
  }
  if (identified instanceof Response) return identified;
  let body: unknown;
  try { body = await request.json(); }
  catch { return mobileJsonError("invalid_family_size", 400, origin); }
  if (!body || typeof body !== "object") return mobileJsonError("invalid_family_size", 400, origin);
  const { adultCount, childCount } = body as { adultCount?: unknown; childCount?: unknown };
  if (!Number.isInteger(adultCount) || !Number.isInteger(childCount)
    || (adultCount as number) < 1 || (adultCount as number) > 10
    || (childCount as number) < 0 || (childCount as number) > 10) {
    return mobileJsonError("invalid_family_size", 400, origin);
  }
  try {
    const adult = adultCount as number;
    const child = childCount as number;
    const { data, error } = await identified.supabase.from("household_settings")
      .update({ adult_count: adult, child_count: child,
        default_servings: getRecipeServings({ adultCount: adult, childCount: child }) })
      .eq("household_id", identified.householdId).select("adult_count,child_count").single();
    if (error || !data) return mobileJsonError("settings_unavailable", 503, origin);
    return familySizeResponse(origin, data.adult_count, data.child_count);
  } catch (error) {
    console.error("Mobile family size update failed", error);
    return mobileJsonError("settings_unavailable", 503, origin);
  }
}
