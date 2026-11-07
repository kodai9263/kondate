import { z } from "zod";
import { getFirstWeekAccess } from "@/lib/billing/firstWeek.server";
import { firstWeekDates } from "@/lib/billing/firstWeek";
import { getCurrentHouseholdPreferences } from "@/lib/family/server";
import { normalizeAllergies } from "@/lib/family/allergies";
import { toDateKey, toTokyoCalendarDate } from "@/lib/dates";
import { authorizeMobileRequest, mobileJsonError, mobileNoStore, mobileOrigin, mobileResponseHeaders } from "@/lib/mobile/request";

const setupInput = z.object({
  adults: z.number().int().min(1).max(10), children: z.number().int().min(0).max(10),
  start: z.string().date(), confirmed: z.literal(true),
  allergies: z.array(z.string().trim().min(1).max(80)).max(30),
}).strict();
export function OPTIONS(request: Request) {
  const origin = mobileOrigin(request);
  if (!origin) return new Response(null, { status: 403, headers: mobileNoStore });
  return new Response(null, { status: 204, headers: { ...mobileResponseHeaders(origin), "Access-Control-Allow-Methods": "GET, POST, OPTIONS" } });
}
export async function GET(request: Request) {
  const origin = mobileOrigin(request);
  if (origin === false) return mobileJsonError("origin_not_allowed", 403, null);
  try {
    const auth = await authorizeMobileRequest(request, origin);
    if (auth instanceof Response) return auth;
    const [access, preferences] = await Promise.all([
      getFirstWeekAccess(auth.supabase, auth.accessToken),
      getCurrentHouseholdPreferences(true, auth.supabase, auth.accessToken),
    ]);
    if (!access.canPlan) return mobileJsonError("free_trial_expired", 403, origin);
    return Response.json({ version: 1, adults: preferences.adultCount, children: preferences.childCount,
      allergies: preferences.allergies, start: access.trial?.start_date ?? access.trial?.selected_start ?? toDateKey(toTokyoCalendarDate(new Date())),
    }, { headers: mobileResponseHeaders(origin) });
  } catch { return mobileJsonError("setup_unavailable", 503, origin); }
}
export async function POST(request: Request) {
  const origin = mobileOrigin(request);
  if (origin === false) return mobileJsonError("origin_not_allowed", 403, null);
  try {
    const auth = await authorizeMobileRequest(request, origin);
    if (auth instanceof Response) return auth;
    const parsed = setupInput.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return mobileJsonError("invalid_setup", 400, origin);
    try { firstWeekDates(parsed.data.start); } catch { return mobileJsonError("invalid_setup", 400, origin); }
    const access = await getFirstWeekAccess(auth.supabase, auth.accessToken);
    if (!access.canPlan) return mobileJsonError("free_trial_expired", 403, origin);
    const { error } = await auth.supabase.rpc("configure_first_week", { start_input: parsed.data.start,
      adults: parsed.data.adults, children: parsed.data.children, allergens: normalizeAllergies(parsed.data.allergies) });
    if (error) return mobileJsonError("setup_unavailable", 503, origin);
    return Response.json({ saved: true }, { headers: mobileResponseHeaders(origin) });
  } catch { return mobileJsonError("setup_unavailable", 503, origin); }
}
