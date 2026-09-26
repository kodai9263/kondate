import { resolveMonthlyDinnerPlan } from "@/lib/nutrition/planner";
import { plannerMonths, type PlannerView } from "@/lib/nutrition/period";
import type { NutritionRecipe, PlannedDinner, SideDish, SideMode } from "@/types/nutrition";

export function resolvePlannerPeriod(view: PlannerView, date: string, context: Parameters<typeof resolveMonthlyDinnerPlan>[2]) {
  return plannerMonths(view, date).flatMap(({ year, month, key }) => resolveMonthlyDinnerPlan(year, month, {
    ...context,
    // materializeDinnerPlan は保存済み日付を補完するため、他の月を混ぜない。
    initialRecipeIds: Object.fromEntries(Object.entries(context.initialRecipeIds).filter(([day]) => day.startsWith(key))),
    initialLockedRecipeIds: Object.fromEntries(Object.entries(context.initialLockedRecipeIds).filter(([day]) => day.startsWith(key))),
  }));
}

export function updatePlannerDay(plan: PlannedDinner[], date: string, change: { recipe?: NutritionRecipe; locked?: boolean; sideMode?: SideMode; sideDish?: SideDish | null }) {
  const [year, month] = date.split("-").map(Number);
  const entries = plan.filter((day) => day.date.startsWith(date.slice(0, 7))).map((day) => day.date === date ? {
    ...day, recipe: change.recipe ?? day.recipe, locked: change.locked ?? day.locked,
    sideMode: change.recipe ? "default" : change.sideMode ?? day.sideMode,
    sideDish: change.recipe ? null : change.sideMode ? change.sideDish ?? null : day.sideDish,
  } : day);
  return { year, month, entries };
}
