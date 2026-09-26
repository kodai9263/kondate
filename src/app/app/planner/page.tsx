import { normalizeShoppingDay } from "@/lib/family/servings";
import { MonthlyPlanner } from "@/components/features/planner/MonthlyPlanner";
import { parsePlannerPeriod, plannerMonths, type PlannerSearchParams } from "@/lib/nutrition/period";
import { getHouseholdPlannerContext } from "@/lib/nutrition/server";

export default async function PlannerPage({ searchParams }: { searchParams: Promise<PlannerSearchParams> }) {
  const period = parsePlannerPeriod(await searchParams);
  const [anchorYear, anchorMonth] = period.date.split("-").map(Number);
  const context = await getHouseholdPlannerContext(anchorYear, anchorMonth, true);
  const shoppingDay = normalizeShoppingDay(context.preferences.shoppingDay);
  // 設定した曜日で週を区切り、必要な隣接月だけを追加で取得する。
  const contexts = await Promise.all(plannerMonths(period.view, period.date, shoppingDay).map(({ year, month }) =>
    year === anchorYear && month === anchorMonth ? context : getHouseholdPlannerContext(year, month, true)));

  return <MonthlyPlanner key={`${period.view}-${period.date}-${shoppingDay}`} shoppingDay={shoppingDay} recipes={context.recipes} sideDishes={context.sideDishes} initialSideSelections={Object.assign({}, ...contexts.map((item) => item.initialSideSelections))} initialView={period.view} initialDate={period.date} today={period.today} familySize={context.preferences} allergies={context.preferences.allergies} excludedRecipeCount={context.excludedRecipeCount} preferredRecipeIds={context.preferredRecipeIds} preferenceExcludedCount={context.preferenceExcludedCount} initialRecipeIds={Object.assign({}, ...contexts.map((item) => item.initialRecipeIds))} initialLockedRecipeIds={Object.assign({}, ...contexts.map((item) => item.initialLockedRecipeIds))} />;
}
