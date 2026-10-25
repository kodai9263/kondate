import { createHash } from "node:crypto";
import { z } from "zod";
import { filterRecipesForAllergies } from "@/lib/family/allergies";
import { getFirstWeekAccess } from "@/lib/billing/firstWeek.server";
import { authorizeMobileRequest, mobileJsonError, mobileNoStore, mobileOrigin, mobileResponseHeaders } from "@/lib/mobile/request";
import { getHouseholdPlannerContext } from "@/lib/nutrition/server";
import { resolveMonthlyDinnerPlan, plannedSideName, rankAlternativeRecipes } from "@/lib/nutrition/planner";
import { plannerDates, plannerMonths, plannerLabel, movePlannerDate, parsePlannerPeriod } from "@/lib/nutrition/period";
import { updatePlannerDay } from "@/lib/nutrition/periodPlan";
import { toSavedDinnerEntries } from "@/lib/nutrition/month";
import { isDinnerCandidate } from "@/lib/nutrition/cookingTime";
import { saveMonthlyDinnerPlanForClient } from "@/lib/nutrition/savePlan.server";

const dateSchema = z.string().date().refine((date) => Number(date.slice(0, 4)) >= 2020 && Number(date.slice(0, 4)) <= 2100);
const changeSchema = z.object({ date: dateSchema, revision: z.string().length(64), change: z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("recipe"), recipeId: z.string().uuid() }).strict(),
  z.object({ kind: z.literal("skip"), skipped: z.boolean() }).strict(),
  z.object({ kind: z.literal("lock"), locked: z.boolean() }).strict(),
  z.object({ kind: z.literal("side"), mode: z.enum(["default", "none", "custom"]), sideDishId: z.string().uuid().nullable() }).strict(),
]) }).strict();
type Context = Awaited<ReturnType<typeof getHouseholdPlannerContext>>;
function revision(plan: ReturnType<typeof resolveMonthlyDinnerPlan>, context: Context) {
  return createHash("sha256").update(JSON.stringify([toSavedDinnerEntries(plan), context.preferences])).digest("hex");
}

export function OPTIONS(request: Request) {
  const origin = mobileOrigin(request);
  if (!origin) return new Response(null, { status: 403, headers: mobileNoStore });
  return new Response(null, { status: 204, headers: { ...mobileResponseHeaders(origin), "Access-Control-Allow-Methods": "GET, PATCH, OPTIONS" } });
}
async function identify(request: Request, origin: string | null) {
  const authorized = await authorizeMobileRequest(request, origin);
  if (authorized instanceof Response) return authorized;
  const access = await getFirstWeekAccess(authorized.supabase, authorized.accessToken);
  if (!access.canPlan) return mobileJsonError("free_trial_expired", 403, origin);
  if (!access.paid && !access.trial) return mobileJsonError("planner_setup_required", 403, origin);
  return authorized;
}

export async function GET(request: Request) {
  const origin = mobileOrigin(request);
  if (origin === false) return mobileJsonError("origin_not_allowed", 403, null);
  try {
    const authorized = await identify(request, origin);
    if (authorized instanceof Response) return authorized;
    const params = new URL(request.url).searchParams;
    const date = params.get("date"); const view = params.get("view") ?? "week";
    if ((date && !dateSchema.safeParse(date).success) || !["week", "month"].includes(view)) return mobileJsonError("invalid_period", 400, origin);
    const period = parsePlannerPeriod({ date: date ?? undefined, view });
    const [year, month] = period.date.split("-").map(Number);
    const anchor = await getHouseholdPlannerContext(year, month, true, authorized.supabase, authorized.accessToken);
    const months = plannerMonths(period.view, period.date, anchor.preferences.shoppingDay);
    const contexts = await Promise.all(months.map((item) => item.year === year && item.month === month ? anchor
      : getHouseholdPlannerContext(item.year, item.month, true, authorized.supabase, authorized.accessToken)));
    const dates = new Set(plannerDates(period.view, period.date, anchor.preferences.shoppingDay));
    const days = months.flatMap((item, index) => {
      const context = contexts[index]; const plan = resolveMonthlyDinnerPlan(item.year, item.month, context);
      const monthRevision = revision(plan, context);
      return plan.flatMap((day, dayIndex) => dates.has(day.date) ? [{ date: day.date, revision: monthRevision,
        recipeId: day.recipe.id, name: day.recipe.name, side: plannedSideName(day),
        minutes: day.recipe.totalMinutes ?? day.recipe.cookMinutes, skipped: Boolean(day.skipped), locked: day.locked,
        sideMode: day.sideMode ?? "default", sideDishId: day.sideDish?.id ?? null,
        alternatives: rankAlternativeRecipes({ currentRecipe: day.recipe, recipes: context.recipes,
          month: item.month, preferredRecipeIds: context.preferredRecipeIds,
          nearbyRecipeIds: plan.slice(Math.max(0, dayIndex - 2), dayIndex + 3).map((entry) => entry.recipe.id),
        }).map((recipe) => ({ id: recipe.id, name: recipe.name, side: recipe.side, minutes: recipe.totalMinutes ?? recipe.cookMinutes })),
      }] : []);
    });
    return Response.json({ version: 1, date: period.date, view: period.view, today: period.today,
      label: plannerLabel(period.view, period.date, anchor.preferences.shoppingDay),
      previousDate: movePlannerDate(period.view, period.date, -1), nextDate: movePlannerDate(period.view, period.date, 1),
      days, sideDishes: filterRecipesForAllergies(anchor.sideDishes, anchor.preferences.allergies).allowed.map((side) => ({ id: side.id, name: side.name })),
    }, { headers: mobileResponseHeaders(origin) });
  } catch {
    return mobileJsonError("planner_unavailable", 503, origin);
  }
}

export async function PATCH(request: Request) {
  const origin = mobileOrigin(request);
  if (origin === false) return mobileJsonError("origin_not_allowed", 403, null);
  try {
    const authorized = await identify(request, origin);
    if (authorized instanceof Response) return authorized;
    const body = changeSchema.safeParse(await request.json().catch(() => null));
    if (!body.success) return mobileJsonError("invalid_change", 400, origin);
    const { date, change, revision: expectedRevision } = body.data;
    const [year, month] = date.split("-").map(Number);
    // ブラウザから月全体を受け取らず、現在の保存状態から変更対象を組み立てる。
    const context = await getHouseholdPlannerContext(year, month, true, authorized.supabase, authorized.accessToken);
    const plan = resolveMonthlyDinnerPlan(year, month, context);
    if (revision(plan, context) !== expectedRevision) return mobileJsonError("plan_changed", 409, origin);
    const day = plan.find((entry) => entry.date === date);
    if (!day) return mobileJsonError("day_unavailable", 422, origin);
    let patch: Parameters<typeof updatePlannerDay>[2];
    if (change.kind === "recipe") {
      const recipe = context.recipes.find((entry) => entry.id === change.recipeId && isDinnerCandidate(entry));
      if (!recipe || day.skipped) return mobileJsonError("recipe_unavailable", 422, origin);
      patch = { recipe };
    } else if (change.kind === "skip") patch = { skipped: change.skipped };
    else if (change.kind === "lock") patch = { locked: change.locked };
    else {
      const side = filterRecipesForAllergies(context.sideDishes, context.preferences.allergies).allowed.find((entry) => entry.id === change.sideDishId);
      if ((change.mode === "custom" && !side) || (change.mode !== "custom" && change.sideDishId !== null)) return mobileJsonError("side_unavailable", 422, origin);
      patch = { sideMode: change.mode, sideDish: side ?? null };
    }
    const next = updatePlannerDay(plan, date, patch);
    const result = await saveMonthlyDinnerPlanForClient({ year, month,
      servings: Math.max(1, Math.ceil(context.preferences.adultCount + context.preferences.childCount * 0.6)),
      entries: toSavedDinnerEntries(next.entries),
    }, authorized.supabase, authorized.accessToken);
    if (!result.ok) return mobileJsonError("plan_save_failed", 422, origin);
    return Response.json({ version: 1, saved: true }, { headers: mobileResponseHeaders(origin) });
  } catch {
    return mobileJsonError("planner_unavailable", 503, origin);
  }
}
