import { MonthlyPlanner } from "@/components/features/planner/MonthlyPlanner";
import { parsePlannerPeriod, plannerMonths, type PlannerSearchParams } from "@/lib/nutrition/period";
import { getHouseholdPlannerContext } from "@/lib/nutrition/server";

export default async function PlannerPage({ searchParams }: { searchParams: Promise<PlannerSearchParams> }) {
  const period = parsePlannerPeriod(await searchParams);
  // 月をまたぐ週は、それぞれの月の保存済み献立をまとめて読む。
  const contexts = await Promise.all(plannerMonths(period.view, period.date).map(({ year, month }) => getHouseholdPlannerContext(year, month, true)));
  const context = contexts[0];
  return <MonthlyPlanner key={`${period.view}-${period.date}`} recipes={context.recipes} sideDishes={context.sideDishes} initialSideSelections={Object.assign({}, ...contexts.map((item) => item.initialSideSelections))} initialView={period.view} initialDate={period.date} today={period.today} familySize={context.preferences} allergies={context.preferences.allergies} excludedRecipeCount={context.excludedRecipeCount} preferredRecipeIds={context.preferredRecipeIds} preferenceExcludedCount={context.preferenceExcludedCount} initialRecipeIds={Object.assign({}, ...contexts.map((item) => item.initialRecipeIds))} initialLockedRecipeIds={Object.assign({}, ...contexts.map((item) => item.initialLockedRecipeIds))} />;
}
