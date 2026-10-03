import { normalizeShoppingDay } from "@/lib/family/servings";
import type { Route } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { MonthlyPlanner } from "@/components/features/planner/MonthlyPlanner";
import { parsePlannerPeriod, plannerMonths, type PlannerSearchParams } from "@/lib/nutrition/period";
import { getHouseholdPlannerContext } from "@/lib/nutrition/server";
import { getFirstWeekAccess } from "@/lib/billing/firstWeek.server";
import { normalizeRecipeSelection } from "@/lib/billing/firstWeek";
import { isDinnerCandidate } from "@/lib/nutrition/cookingTime";
import { officialNutritionRecipes } from "@/lib/nutrition/catalog";

export default async function PlannerPage({ searchParams }: { searchParams: Promise<PlannerSearchParams & { recipe?: string; history?: string }> }) {
  const params = await searchParams;
  let access;
  try { access = await getFirstWeekAccess(); } catch {
    return <main className="mx-auto max-w-xl p-6"><h1 className="font-mincho text-2xl">献立</h1><p role="alert" className="mt-4">利用状態を確認できません。再読み込みしてください。</p></main>;
  }
  const selection = normalizeRecipeSelection(params.recipe);
  if (access.canPlan && !access.paid && !access.trial && !access.user.is_anonymous) redirect(`/app/planner/setup${selection ? `?recipe=${encodeURIComponent(selection)}` : ""}` as Route);
  const period = parsePlannerPeriod(params);
  const history = !access.canPlan || (!access.paid && params.history === "1");
  const [anchorYear, anchorMonth] = period.date.split("-").map(Number);
  const anchorContext = await getHouseholdPlannerContext(anchorYear, anchorMonth, true);
  const shoppingDay = normalizeShoppingDay(anchorContext.preferences.shoppingDay);
  const months = plannerMonths(period.view, period.date, shoppingDay);
  const contexts = await Promise.all(months.map(({ year, month }) => year === anchorYear && month === anchorMonth ? anchorContext : getHouseholdPlannerContext(year, month, true)));
  const context = contexts[0];
  const initialRecipeIds = Object.assign({}, ...contexts.map((item) => item.initialRecipeIds));
  const initialLockedRecipeIds = Object.assign({}, ...contexts.map((item) => item.initialLockedRecipeIds));
  let selectionUnavailable = false;
  if (selection && !history) {
    const [kind, id] = selection.split(":");
    const { data: source } = kind === "official" ? await access.supabase.from("recipes").select("id,name").is("household_id", null).contains("meta", { nutrition_catalog_id: id }).maybeSingle() : await access.supabase.from("recipes").select("id,name").eq("id", id).is("household_id", null).contains("meta", { visibility: "community" }).maybeSingle();
    const recipe = context.recipes.find((item) => item.id === source?.id || (kind === "official" && item.name === officialNutritionRecipes.find((item) => item.id === id)?.name));
    if (recipe && isDinnerCandidate(recipe)) { const targetDate = period.date; initialRecipeIds[targetDate] = recipe.id; initialLockedRecipeIds[targetDate] = recipe.id; }
    else selectionUnavailable = true;
  }
  return <>{!access.paid ? <nav className="mx-auto flex max-w-6xl flex-wrap gap-4 px-4 pt-4 text-sm"><Link href="/app/planner" className="inline-flex min-h-11 items-center underline">献立を開く</Link><Link href="/app/planner?history=1" className="inline-flex min-h-11 items-center underline">保存済みの献立を見る</Link><Link href="/app/planner/setup" className="inline-flex min-h-11 items-center underline">人数・アレルギーを確認</Link></nav> : null}<MonthlyPlanner key={`${period.date}-${period.view}-${shoppingDay}-${selection ?? ""}`} shoppingDay={shoppingDay} sideDishes={context.sideDishes} initialSideSelections={Object.assign({}, ...contexts.map((item) => item.initialSideSelections))} recipes={context.recipes} initialView={period.view} initialDate={period.date} today={period.today} familySize={context.preferences} allergies={context.preferences.allergies} excludedRecipeCount={context.excludedRecipeCount} preferredRecipeIds={context.preferredRecipeIds} preferenceExcludedCount={context.preferenceExcludedCount} initialRecipeIds={initialRecipeIds} initialLockedRecipeIds={initialLockedRecipeIds} trialExpiresAt={!access.paid ? access.freeTrial?.expires_at : undefined} trialExpired={!access.paid && !access.trialActive} readOnly={history} selectionUnavailable={selectionUnavailable} /></>;
}
