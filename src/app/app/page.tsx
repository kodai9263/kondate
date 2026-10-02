import { getFirstWeekAccess } from "@/lib/billing/firstWeek.server";
import { firstWeekDates } from "@/lib/billing/firstWeek";
import { getBreakfastVersions } from "@/lib/breakfast/server";
import { breakfastForDate } from "@/lib/breakfast/settings";
import { Settings } from "lucide-react";
import Link from "next/link";
import { buttonClass } from "@/components/ui/Button";
import { ShoppingSummaryLink } from "@/components/features/shopping/ShoppingSummaryLink";
import { TodayBoard } from "@/components/features/today/TodayBoard";
import { formatShoppingDay, getAdultEquivalent } from "@/lib/family/servings";
import { menuData } from "@/lib/menuData";
import { plannedSideName, resolveMonthlyDinnerPlan } from "@/lib/nutrition/planner";
import { resolveCustomSideSteps, resolveDinnerIngredients, resolveDinnerSteps } from "@/lib/nutrition/sideDish";
import { getHouseholdPlannerContext } from "@/lib/nutrition/server";
import { findTodayPlan } from "@/lib/services/planService";
import { getPlannedShopping } from "@/lib/shopping/server";
import { formatShoppingPeriod } from "@/lib/shopping/period";
import { getTodayPlanState } from "@/lib/today/server";

export default async function AppHomePage({ searchParams }: { searchParams: Promise<{ mealFeedback?: string; notice?: string }> }) {
  const params = await searchParams;
  const baseToday = findTodayPlan(menuData);
  const access = await getFirstWeekAccess();
  if (!access.paid && (!access.trial?.start_date || !firstWeekDates(access.trial.start_date).includes(baseToday.date))) {
    return <main className="mx-auto max-w-xl px-4 pb-28 pt-6"><h1 className="font-mincho text-2xl font-bold">きょうのごはん</h1><p className="mt-4 leading-7">{!access.trial?.start_date ? "人数とアレルギーを確認して、最初の7日分の献立と買い物を無料で試しましょう。" : "最初の7日分は、引き続き無料で編集・買い物チェックができます。"}</p><div className="mt-5 grid gap-3"><Link href="/app/planner" className={buttonClass({})}>{access.trial?.start_date ? "無料の7日分を開く" : "最初の7日分を作る"}</Link><Link href="/menus" className={buttonClass({ variant: "secondary" })}>無料でメニューを見る</Link><Link href="/app/favorites" className={buttonClass({ variant: "secondary" })}>お気に入りを見る</Link>{access.trial?.start_date ? <><Link href="/pricing?required=next_week" className={buttonClass({ variant: "secondary" })}>来週も献立と買い物をまとめて準備する</Link><Link href="/app/planner?history=1" className="inline-flex min-h-11 items-center underline">保存済みの献立を見る</Link></> : null}</div><p className="mt-5 text-sm leading-7 text-kondate-muted">最初の7日分は期限なし・カード登録なし・自動課金なし。次の7日分から月480円・年4,800円です。</p></main>;
  }
  const [year, month] = baseToday.date.split("-").map(Number);
  const [plannerContext, breakfastState] = await Promise.all([getHouseholdPlannerContext(year, month), getBreakfastVersions()]);
  const breakfast = breakfastForDate(breakfastState.versions, baseToday.date);
  const fallbackToday = { ...baseToday, breakfast: breakfast ? { ...breakfast, minutes: breakfast.minutes ?? undefined } : null };
  const monthlyPlan = resolveMonthlyDinnerPlan(year, month, plannerContext);
  const plannedDinner = monthlyPlan.find((day) => day.date === fallbackToday.date);
  const selectedRecipe = plannedDinner?.recipe;
  const selectedIngredientsText = plannedDinner ? resolveDinnerIngredients(plannedDinner) : undefined;
  const selectedToday = { ...fallbackToday, dinner: {
    ...fallbackToday.dinner,
    dinner: selectedRecipe?.name ?? "夕食の候補がありません",
    side: plannedDinner ? plannedSideName(plannedDinner) : "",
    prepMin: 0,
    cookMin: selectedRecipe?.cookMinutes ?? 0,
    totalMin: selectedRecipe?.timeUnconfirmed ? undefined : selectedRecipe?.totalMinutes,
    recipeNotes: selectedRecipe?.recipeNotes,
    servingsBase: selectedRecipe?.servingsBase,
    ingredientsScalable: Boolean(selectedRecipe?.servingsBase),
    morning: [],
    evening: plannedDinner ? resolveDinnerSteps(plannedDinner) ?? [] : [],
    seasonings: selectedIngredientsText?.split("\n").filter(Boolean) ?? [],
    sideSteps: resolveCustomSideSteps(plannedDinner?.sideDish),
    sideServingsBase: plannedDinner?.sideDish?.servingsBase,
  } };
  const preferences = plannerContext.preferences;
  const planState = await getTodayPlanState(selectedToday, plannedDinner ? {
    recipeId: plannedDinner.recipe.id,
    servings: Math.max(1, Math.ceil(getAdultEquivalent(preferences))),
  } : undefined);
  const { today, taskBindings } = planState;
  const familySize = { adultCount: preferences.adultCount, childCount: preferences.childCount };
  const shoppingDayLabel = formatShoppingDay(preferences.shoppingDay);
  const shopping = await getPlannedShopping().catch(() => null);
  const shoppingItemCount = shopping?.groups.reduce((total, group) => total + group.items.length, 0) ?? 0;
  const shoppingPeriodLabel = shopping ? formatShoppingPeriod(shopping.period.start, shopping.period.end) : "読み込みできませんでした";
  return (
    <main className="mx-auto min-h-dvh w-full max-w-[560px] px-4 pb-24 pt-5">
      <header className="mb-6 flex items-center justify-between gap-3">
        <p className="text-sm text-kondate-muted">きょうのごはん</p>
        <div className="flex items-center gap-1">
          <Link href="/pricing" className="inline-flex min-h-11 items-center px-2 text-sm text-kondate-accent">家族プラン</Link>
          <Link href="/account" aria-label="アカウント設定" title="アカウント設定" className={buttonClass({ variant: "secondary", size: "icon" })}><Settings size={19} /></Link>
        </div>
      </header>
      {params.notice === "family-joined" ? <p role="status" className="mb-5 rounded border border-kondate-done/30 bg-kondate-doneSoft p-3 text-sm text-kondate-ink">家族グループに参加しました。</p> : null}
      {breakfastState.error || planState.loadError ? <p role="alert" className="mb-4 text-sm text-kondate-alert">献立やチェック状態を読み込めませんでした。再読み込みしてお試しください。</p> : null}
      <div className="space-y-8"><TodayBoard familySize={familySize} feedbackStatus={params.mealFeedback} today={today} initialTaskBindings={taskBindings} dinnerAvailable={Boolean(plannedDinner)} /><ShoppingSummaryLink shoppingDayLabel={shoppingDayLabel} itemCount={shoppingItemCount} periodLabel={shoppingPeriodLabel} loadError={!shopping} /></div>
    </main>
  );
}
