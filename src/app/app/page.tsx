import { Settings } from "lucide-react";
import Link from "next/link";
import { ShoppingSummaryLink } from "@/components/features/shopping/ShoppingSummaryLink";
import { TodayBoard } from "@/components/features/today/TodayBoard";
import { formatShoppingDay, getAdultEquivalent } from "@/lib/family/servings";
import { menuData } from "@/lib/menuData";
import { generateMonthlyDinnerPlan, materializeDinnerPlan } from "@/lib/nutrition/planner";
import { getHouseholdPlannerContext } from "@/lib/nutrition/server";
import { findTodayPlan } from "@/lib/services/planService";
import { getShoppingCycle } from "@/lib/services/shoppingService";
import { getTodayPlanState } from "@/lib/today/server";

export default async function AppHomePage({ searchParams }: { searchParams: Promise<{ mealFeedback?: string; notice?: string }> }) {
  const params = await searchParams;
  const fallbackToday = findTodayPlan(menuData);
  const [year, month] = fallbackToday.date.split("-").map(Number);
  const plannerContext = await getHouseholdPlannerContext(year, month);
  const generatedPlan = generateMonthlyDinnerPlan({
    year,
    month,
    recipes: plannerContext.recipes,
    lockedRecipeIds: plannerContext.initialLockedRecipeIds,
    seed: 1,
    maxCookMinutes: 30,
    preferredRecipeIds: plannerContext.preferredRecipeIds,
  });
  const monthlyPlan = materializeDinnerPlan(generatedPlan, plannerContext.recipes, plannerContext.initialRecipeIds, plannerContext.initialLockedRecipeIds);
  const plannedDinner = monthlyPlan.find((day) => day.date === fallbackToday.date);
  const preferences = plannerContext.preferences;
  const planState = await getTodayPlanState(fallbackToday, plannedDinner ? {
    recipeId: plannedDinner.recipe.id,
    servings: Math.max(1, Math.ceil(getAdultEquivalent(preferences))),
  } : undefined);
  const { today, taskBindings } = planState;
  const familySize = { adultCount: preferences.adultCount, childCount: preferences.childCount };
  const shoppingDayLabel = formatShoppingDay(preferences.shoppingDay);
  const shoppingCycle = getShoppingCycle(menuData, preferences.shoppingDay);
  const shoppingWeek = menuData.weeks[shoppingCycle.weekIndex];
  const shoppingItemCount = Object.values(shoppingWeek.shopping).reduce((total, items) => total + items.length, 0);
  return (
    <main className="mx-auto min-h-dvh w-full max-w-[560px] px-4 pb-24 pt-5">
      <header className="mb-6 flex items-center justify-between gap-3">
        <p className="text-sm text-kondate-muted">きょうのごはん</p>
        <div className="flex items-center gap-1">
          <Link href="/pricing" className="inline-flex min-h-11 items-center px-2 text-sm text-kondate-accent">家族プラン</Link>
          <Link href="/account" aria-label="アカウント設定" title="アカウント設定" className="grid size-11 place-items-center rounded border border-kondate-line bg-white text-kondate-muted"><Settings size={19} /></Link>
        </div>
      </header>
      {params.notice === "family-joined" ? <p role="status" className="mb-5 rounded border border-kondate-done/30 bg-kondate-doneSoft p-3 text-sm text-kondate-ink">家族グループに参加しました。</p> : null}
      <div className="space-y-8"><TodayBoard familySize={familySize} feedbackStatus={params.mealFeedback} today={today} initialTaskBindings={taskBindings} /><ShoppingSummaryLink shoppingDayLabel={shoppingDayLabel} itemCount={shoppingItemCount} /></div>
    </main>
  );
}
