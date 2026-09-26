import { MonthlyPlanner } from "@/components/features/planner/MonthlyPlanner";
import { officialNutritionRecipes } from "@/lib/nutrition/catalog";
import { parsePlannerPeriod, type PlannerSearchParams } from "@/lib/nutrition/period";

export const dynamic = "force-dynamic";

export default async function PlannerDemoPage({ searchParams }: { searchParams: Promise<PlannerSearchParams> }) {
  const period = parsePlannerPeriod(await searchParams);
  return <MonthlyPlanner recipes={officialNutritionRecipes} initialView={period.view} initialDate={period.date} today={period.today} demo />;
}
