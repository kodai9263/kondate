import { getBreakfastVersions } from "@/lib/breakfast/server";
import { getFirstWeekAccess } from "@/lib/billing/firstWeek.server";
import { breakfastForDate } from "@/lib/breakfast/settings";
import { getAdultEquivalent } from "@/lib/family/servings";
import { menuData } from "@/lib/menuData";
import { authorizeMobileRequest, mobileJsonError, mobileNoStore, mobileOrigin, mobileResponseHeaders } from "@/lib/mobile/request";
import { plannedSideName, resolveMonthlyDinnerPlan } from "@/lib/nutrition/planner";
import { resolveCustomSideSteps, resolveDinnerIngredients, resolveDinnerSteps } from "@/lib/nutrition/sideDish";
import { getHouseholdPlannerContext } from "@/lib/nutrition/server";
import { findTodayPlan } from "@/lib/services/planService";
import { buildTodayTaskBindings, mergeTodayPlan, type DailyPlanRow } from "@/lib/today/server";

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

  try {
    const authorized = await authorizeMobileRequest(request, origin);
    if (authorized instanceof Response) return authorized;
    const access = await getFirstWeekAccess(authorized.supabase, authorized.accessToken);
    if (!access.canPlan) return mobileJsonError("free_trial_expired", 403, origin);
    if (!access.paid && !access.trial) return mobileJsonError("planner_setup_required", 403, origin);
    const baseToday = findTodayPlan(menuData);
    const [year, month] = baseToday.date.split("-").map(Number);
    const [planner, breakfastState] = await Promise.all([
      getHouseholdPlannerContext(year, month, true, authorized.supabase, authorized.accessToken),
      getBreakfastVersions(authorized.supabase),
    ]);
    if (breakfastState.error) return mobileJsonError("today_unavailable", 503, origin);
    const breakfast = breakfastForDate(breakfastState.versions, baseToday.date);
    const fallbackToday = { ...baseToday, breakfast: breakfast
      ? { ...breakfast, minutes: breakfast.minutes ?? undefined } : null };
    const monthlyPlan = resolveMonthlyDinnerPlan(year, month, planner);
    const plannedDinner = monthlyPlan.find((day) => day.date === baseToday.date);
    const dinnerSkipped = Boolean(plannedDinner?.skipped);
    const cookingDinner = dinnerSkipped ? undefined : plannedDinner;
    const recipe = cookingDinner?.recipe;
    const ingredients = cookingDinner ? resolveDinnerIngredients(cookingDinner) : undefined;
    const selectedToday = { ...fallbackToday, dinner: {
      ...fallbackToday.dinner,
      dinner: dinnerSkipped ? "今日は作らない日" : recipe?.name ?? "夕食の候補がありません",
      side: cookingDinner ? plannedSideName(cookingDinner) : "",
      prepMin: 0,
      cookMin: recipe?.cookMinutes ?? 0,
      totalMin: recipe?.timeUnconfirmed ? undefined : recipe?.totalMinutes,
      recipeNotes: recipe?.recipeNotes,
      servingsBase: recipe?.servingsBase,
      ingredientsScalable: Boolean(recipe?.servingsBase),
      morning: [],
      evening: cookingDinner ? resolveDinnerSteps(cookingDinner) ?? [] : [],
      seasonings: ingredients?.split("\n").filter(Boolean) ?? [],
      sideSteps: resolveCustomSideSteps(cookingDinner?.sideDish),
      sideServingsBase: cookingDinner?.sideDish?.servingsBase,
    } };

    const { data, error } = await authorized.supabase.from("v_daily_plan")
      .select("plan_entry_id,household_id,meal_type,recipe_name,prep_minutes,cook_minutes,meta,steps,side_mode,side_dish")
      .eq("household_id", authorized.householdId).eq("date", baseToday.date);
    if (error) return mobileJsonError("today_unavailable", 503, origin);
    const rows = ((data ?? []) as DailyPlanRow[]).filter((row) => !dinnerSkipped || row.meal_type === "breakfast");
    const today = mergeTodayPlan(selectedToday, rows);
    return Response.json({ version: 1, fetchedAt: new Date().toISOString(), today,
      taskBindings: buildTodayTaskBindings(today, rows),
      familySize: { adultCount: planner.preferences.adultCount, childCount: planner.preferences.childCount },
      servings: Math.max(1, Math.ceil(getAdultEquivalent(planner.preferences))),
    }, { headers: mobileResponseHeaders(origin) });
  } catch (error) {
    console.error("Mobile today snapshot failed", error);
    return mobileJsonError("today_unavailable", 503, origin);
  }
}
