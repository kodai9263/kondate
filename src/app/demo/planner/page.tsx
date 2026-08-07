import { MonthlyPlanner } from "@/components/features/planner/MonthlyPlanner";
import { officialNutritionRecipes } from "@/lib/nutrition/catalog";

export const dynamic = "force-dynamic";

export default function PlannerDemoPage() {
  const now = new Date();
  return <MonthlyPlanner recipes={officialNutritionRecipes} initialYear={now.getFullYear()} initialMonth={now.getMonth() + 1} demo />;
}
