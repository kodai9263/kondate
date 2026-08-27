import { MonthlyPlanner } from "@/components/features/planner/MonthlyPlanner";
import { parsePlannerMonth } from "@/lib/nutrition/month";
import { getHouseholdPlannerContext } from "@/lib/nutrition/server";

export default async function PlannerPage({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  const now = new Date();
  const { month: monthParam } = await searchParams;
  const { year, month } = parsePlannerMonth(monthParam, now);
  const context = await getHouseholdPlannerContext(year, month);
  return <MonthlyPlanner key={`${year}-${month}`} recipes={context.recipes} initialYear={year} initialMonth={month} familySize={context.preferences} allergies={context.preferences.allergies} excludedRecipeCount={context.excludedRecipeCount} preferredRecipeIds={context.preferredRecipeIds} preferenceExcludedCount={context.preferenceExcludedCount} initialRecipeIds={context.initialRecipeIds} initialLockedRecipeIds={context.initialLockedRecipeIds} />;
}
