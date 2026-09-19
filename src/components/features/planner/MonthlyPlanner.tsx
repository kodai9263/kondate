"use client";

import { AlertTriangle, ChevronLeft, ChevronRight, Search, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import { saveMonthlyDinnerPlan } from "@/app/app/planner/actions";
import { Button, buttonClass } from "@/components/ui/Button";
import { generateMonthlyDinnerPlan, isRecipeInSeason, materializeDinnerPlan, rankAlternativeRecipes } from "@/lib/nutrition/planner";
import { isDinnerCandidate, MAX_DINNER_MINUTES } from "@/lib/nutrition/cookingTime";
import { toSavedDinnerEntries } from "@/lib/nutrition/month";
import type { NutritionRecipe, PlannedDinner } from "@/types/nutrition";
import { defaultFamilySize, type FamilySize } from "@/lib/family/servings";

type MonthlyPlannerProps = {
  recipes: NutritionRecipe[];
  initialYear: number;
  initialMonth: number;
  familySize?: FamilySize;
  allergies?: string[];
  excludedRecipeCount?: number;
  preferredRecipeIds?: string[];
  preferenceExcludedCount?: number;
  initialRecipeIds?: Record<string, string>;
  initialLockedRecipeIds?: Record<string, string>;
  demo?: boolean;
};

export function MonthlyPlanner({ recipes, initialYear, initialMonth, familySize = defaultFamilySize, allergies = [], excludedRecipeCount = 0, preferredRecipeIds = [], preferenceExcludedCount = 0, initialRecipeIds = {}, initialLockedRecipeIds = {}, demo = false }: MonthlyPlannerProps) {
  const router = useRouter();
  const [isNavigating, startNavigation] = useTransition();
  const [year, setYear] = useState(initialYear);
  const [month, setMonth] = useState(initialMonth);
  const maxCookMinutes = MAX_DINNER_MINUTES;
  const candidateCount = recipes.filter((recipe) => isDinnerCandidate(recipe)).length;
  const [lockedRecipeIds, setLockedRecipeIds] = useState<Record<string, string>>(initialLockedRecipeIds);
  const [changedRecipeIds, setChangedRecipeIds] = useState<Record<string, string>>(initialRecipeIds);
  const [pickerDate, setPickerDate] = useState<string | null>(null);
  const [pickerQuery, setPickerQuery] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"saved" | "error" | null>(null);

  const generatedPlan = useMemo(() => generateMonthlyDinnerPlan({ year, month, recipes, lockedRecipeIds, seed: 1, maxCookMinutes, preferredRecipeIds }), [year, month, recipes, lockedRecipeIds, maxCookMinutes, preferredRecipeIds]);
  const plan = useMemo(() => materializeDinnerPlan(generatedPlan, recipes, changedRecipeIds, lockedRecipeIds), [changedRecipeIds, generatedPlan, lockedRecipeIds, recipes]);
  const seasonalDays = useMemo(() => plan.filter((day) => isRecipeInSeason(day.recipe, month)).length, [month, plan]);
  const pickerDay = pickerDate ? plan.find((day) => day.date === pickerDate) : undefined;
  const isPickerFiltered = pickerQuery.trim().length > 0;
  const pickerRecipes = useMemo(() => {
    if (!pickerDay) return [];
    const dayIndex = plan.findIndex((day) => day.date === pickerDay.date);
    const nearbyRecipeIds = plan.slice(Math.max(0, dayIndex - 2), dayIndex + 3).map((day) => day.recipe.id);
    const ranked = rankAlternativeRecipes({ currentRecipe: pickerDay.recipe, recipes, month, maxCookMinutes, nearbyRecipeIds, preferredRecipeIds });
    const query = pickerQuery.trim().toLocaleLowerCase("ja");
    return query ? ranked.filter((recipe) => recipe.name.toLocaleLowerCase("ja").includes(query)) : ranked;
  }, [maxCookMinutes, month, pickerDay, pickerQuery, plan, preferredRecipeIds, recipes]);

  useEffect(() => {
    if (!pickerDate) return;
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setPickerDate(null);
    }
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [pickerDate]);

  function moveMonth(offset: number) {
    const next = new Date(year, month - 1 + offset, 1);
    if (!demo) {
      startNavigation(() => router.push(`/app/planner?month=${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}`));
      return;
    }
    setYear(next.getFullYear());
    setMonth(next.getMonth() + 1);
    setLockedRecipeIds({});
    setChangedRecipeIds({});
    setPickerDate(null);
  }

  function openRecipePicker(date: string) {
    setPickerDate(date);
    setPickerQuery("");
  }

  async function selectRecipe(date: string, recipeId: string) {
    if (isSaving) return;
    const previousChanged = changedRecipeIds;
    const previousLocked = lockedRecipeIds;
    const nextChanged = { ...changedRecipeIds, [date]: recipeId };
    const nextLocked = lockedRecipeIds[date] ? { ...lockedRecipeIds, [date]: recipeId } : lockedRecipeIds;
    const nextPlan = materializeDinnerPlan(generatedPlan, recipes, nextChanged, nextLocked);
    setChangedRecipeIds(nextChanged);
    setLockedRecipeIds(nextLocked);
    setPickerDate(null);
    if (!await persistPlan(nextPlan)) {
      setChangedRecipeIds(previousChanged);
      setLockedRecipeIds(previousLocked);
    }
  }

  async function toggleLock(date: string, recipeId: string) {
    if (isSaving) return;
    const previous = lockedRecipeIds;
    const next = { ...lockedRecipeIds };
    if (next[date]) delete next[date]; else next[date] = recipeId;
    const nextPlan = materializeDinnerPlan(generatedPlan, recipes, changedRecipeIds, next);
    setLockedRecipeIds(next);
    if (!await persistPlan(nextPlan)) setLockedRecipeIds(previous);
  }

  async function persistPlan(nextPlan: PlannedDinner[]) {
    if (demo) return true;
    setIsSaving(true);
    setSaveStatus(null);
    const result = await saveMonthlyDinnerPlan({
      year,
      month,
      servings: Math.max(1, Math.ceil(familySize.adultCount + familySize.childCount * 0.6)),
      entries: toSavedDinnerEntries(nextPlan),
    });
    setIsSaving(false);
    setSaveStatus(result.ok ? "saved" : "error");
    return result.ok;
  }

  return (
    <main className="mx-auto min-h-dvh w-full max-w-6xl px-4 pb-28 pt-5 sm:px-6">
      {demo ? <div className="mb-5 flex flex-col gap-3 border-b border-kondate-line pb-4 sm:flex-row sm:items-center sm:justify-between"><Link href="/" className="text-kondate-ink">きょうのごはん</Link><div className="flex items-center gap-3"><p className="text-xs text-kondate-faint">公式メニュー{candidateCount}品を使うデモです</p><Link href="/signup" className={buttonClass({ variant: "ink", size: "sm", className: "min-h-11 px-4 text-sm" })}>無料登録</Link></div></div> : null}
      <header className="flex flex-col gap-4 border-b border-kondate-line pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex w-fit items-center rounded border border-kondate-line bg-white"><button type="button" aria-label="前の月" disabled={isSaving || isNavigating} onClick={() => moveMonth(-1)} className="grid size-11 place-items-center border-r border-kondate-line text-kondate-muted transition-colors hover:text-kondate-ink disabled:opacity-30"><ChevronLeft size={20} /></button><h1 className="min-w-32 text-center font-normal tabular-nums">{year}年 {month}月</h1><button type="button" aria-label="次の月" disabled={isSaving || isNavigating} onClick={() => moveMonth(1)} className="grid size-11 place-items-center border-l border-kondate-line text-kondate-muted transition-colors hover:text-kondate-ink disabled:opacity-30"><ChevronRight size={20} /></button></div>
        <p className="w-fit rounded border border-kondate-line bg-white px-4 py-3 text-sm">完成まで40分以内</p>
      </header>

      {!demo && (isSaving || saveStatus) ? <p role="status" className={`mt-4 text-right text-xs ${saveStatus === "error" ? "text-kondate-alert" : "text-kondate-faint"}`}>{isSaving ? "保存中..." : saveStatus === "saved" ? "保存しました" : "保存できませんでした。もう一度お試しください。"}</p> : null}

      {allergies.length > 0 ? <section role="status" className="mt-5 rounded border border-kondate-alert/30 bg-kondate-alertSoft p-4"><p className="flex items-center gap-2 text-sm font-semibold text-kondate-alert"><AlertTriangle size={18} aria-hidden="true" />{excludedRecipeCount > 0 ? `${excludedRecipeCount}品をアレルギー候補として除外中` : "登録したアレルギーを照合中"}</p><p className="mt-2 text-xs leading-6 text-kondate-muted">料理名・副菜・登録材料による補助判定です。調味料や加工品の原材料表示は必ず確認してください。</p></section> : null}

      {preferredRecipeIds.length > 0 || preferenceExcludedCount > 0 ? <p className="mt-4 border-l-2 border-kondate-accent bg-white px-4 py-3 text-sm text-kondate-muted">献立評価を反映中：好評 {preferredRecipeIds.length}品・除外 {preferenceExcludedCount}品</p> : null}

      <section className="mt-8"><div className="mb-4 flex items-end justify-between gap-3"><div><h2 className="font-mincho text-xl font-bold">今月の夕食</h2><p className="mt-1 text-xs text-kondate-muted">40分以内の料理で、旬や主菜の偏りを見て組んでいます。</p></div><div className="shrink-0 whitespace-nowrap text-right text-xs tabular-nums text-kondate-faint"><p>{candidateCount}品から生成</p><p className="mt-1">旬 {seasonalDays}日・固定 {Object.keys(lockedRecipeIds).length}日</p></div></div>
        {candidateCount === 0 ? <p role="status" className="mb-4 rounded border border-kondate-line p-4 text-sm text-kondate-muted">条件に合う40分以内の料理がありません。保存済みの献立だけを表示しています。</p> : null}
        <div className="grid gap-3 sm:grid-cols-2">{plan.map((day) => <article key={day.date} className={["grid grid-cols-[3rem_minmax(0,1fr)] items-start gap-3 rounded border border-kondate-line bg-white px-3 py-4", day.locked ? "border-l-2 border-l-kondate-accent" : ""].join(" ")}><div className="border-r border-kondate-line pr-3 pt-0.5 text-center"><p className="text-sm tabular-nums text-kondate-ink">{formatDay(day.date)}</p><p className="mt-0.5 text-xs text-kondate-faint">{formatWeekday(day.date)}</p></div><div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-start gap-x-3"><div className="min-w-0"><h3 className="font-mincho text-base font-bold leading-snug">{day.recipe.name}</h3><p className="mt-1 truncate text-xs leading-6 text-kondate-muted">{day.recipe.side}</p>{!isDinnerCandidate(day.recipe) ? <p className="mt-1 text-xs text-kondate-faint">保存済み・新しい献立の候補対象外</p> : null}</div><div className="flex shrink-0 gap-1.5"><Button variant="secondary" size="sm" disabled={isSaving || candidateCount === 0} onClick={() => openRecipePicker(day.date)} className="min-h-8">変更</Button><Button variant={day.locked ? "primary" : "secondary"} size="sm" disabled={isSaving || plan.length !== new Date(year, month, 0).getDate()} aria-pressed={day.locked} onClick={() => void toggleLock(day.date, day.recipe.id)} className="min-h-8">{day.locked ? "固定中" : "固定"}</Button></div></div></article>)}</div>
      </section>

      {pickerDay ? <div className="fixed inset-0 z-50 grid items-end p-0 sm:place-items-center sm:p-6" role="dialog" aria-modal="true" aria-labelledby="recipe-picker-title"><button type="button" aria-label="献立選択を閉じる" onClick={() => setPickerDate(null)} className="absolute inset-0 bg-kondate-ink/55" /><section className="relative z-10 flex max-h-[88dvh] w-full max-w-3xl flex-col overflow-hidden rounded-t border border-kondate-line bg-white sm:rounded"><header className="flex items-start justify-between gap-4 border-b border-kondate-line p-4 sm:p-5"><div><p className="text-xs tabular-nums text-kondate-muted">{formatDay(pickerDay.date)} {formatWeekday(pickerDay.date)}曜日</p><h2 id="recipe-picker-title" className="font-mincho mt-1 text-xl font-bold">献立を変更</h2><p className="mt-1 text-xs text-kondate-faint">現在：{pickerDay.recipe.name}</p></div><Button variant="secondary" size="icon" aria-label="閉じる" onClick={() => setPickerDate(null)}><X size={20} /></Button></header><div className="border-b border-kondate-line p-4 sm:p-5"><label className="flex min-h-11 items-center gap-2 rounded-lg border border-kondate-line bg-white px-3 transition-colors focus-within:border-kondate-accent focus-within:ring-2 focus-within:ring-kondate-accent/20"><Search size={18} aria-hidden="true" className="shrink-0 text-kondate-muted" /><span className="sr-only">料理名で検索</span><input type="search" value={pickerQuery} onChange={(event) => setPickerQuery(event.target.value)} placeholder="料理名で検索" autoComplete="off" enterKeyHint="search" className="min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-kondate-muted sm:text-sm" /></label></div><div className="overflow-y-auto p-4 sm:p-5"><div className="grid gap-2 sm:grid-cols-2">{pickerRecipes.map((recipe) => <button key={recipe.id} type="button" onClick={() => selectRecipe(pickerDay.date, recipe.id)} className={["rounded border border-kondate-line text-left font-mincho font-bold leading-snug transition-colors hover:border-kondate-ink hover:bg-kondate-bg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-kondate-accent focus-visible:ring-offset-2", isPickerFiltered ? "min-h-20 px-5 py-4 text-lg sm:min-h-24 sm:px-6 sm:py-5 sm:text-xl" : "min-h-14 px-4 py-3"].join(" ")}>{recipe.name}</button>)}</div>{pickerRecipes.length === 0 ? <p className="py-10 text-center text-sm text-kondate-muted">料理名が見つかりません。別の言葉で検索してください。</p> : null}</div></section></div> : null}
    </main>
  );
}

function formatDay(date: string) { const [, month, day] = date.split("-"); return `${Number(month)}/${Number(day)}`; }

function formatWeekday(date: string) {
  const [year, month, day] = date.split("-").map(Number);
  return ["日", "月", "火", "水", "木", "金", "土"][new Date(year, month - 1, day).getDay()];
}
