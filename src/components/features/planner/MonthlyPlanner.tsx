"use client";

import { AlertTriangle, ChevronLeft, ChevronRight, RefreshCw, Search, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import { saveMonthlyDinnerPlan } from "@/app/app/planner/actions";
import { dinnerNutritionTarget, generateMonthlyDinnerPlan, isRecipeInSeason, materializeDinnerPlan, rankAlternativeRecipes, summarizeNutrition } from "@/lib/nutrition/planner";
import { toSavedDinnerEntries } from "@/lib/nutrition/month";
import type { NutritionRecipe, PlannedDinner } from "@/types/nutrition";
import { defaultFamilySize, formatServingLabel, type FamilySize } from "@/lib/family/servings";

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
  const [seed, setSeed] = useState(1);
  const [maxCookMinutes, setMaxCookMinutes] = useState(30);
  const [lockedRecipeIds, setLockedRecipeIds] = useState<Record<string, string>>(initialLockedRecipeIds);
  const [changedRecipeIds, setChangedRecipeIds] = useState<Record<string, string>>(initialRecipeIds);
  const [pickerDate, setPickerDate] = useState<string | null>(null);
  const [pickerMode, setPickerMode] = useState<"recommended" | "all">("recommended");
  const [pickerQuery, setPickerQuery] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"saved" | "error" | null>(null);

  const generatedPlan = useMemo(() => generateMonthlyDinnerPlan({ year, month, recipes, lockedRecipeIds, seed, maxCookMinutes, preferredRecipeIds }), [year, month, recipes, lockedRecipeIds, seed, maxCookMinutes, preferredRecipeIds]);
  const plan = useMemo(() => materializeDinnerPlan(generatedPlan, recipes, changedRecipeIds, lockedRecipeIds), [changedRecipeIds, generatedPlan, lockedRecipeIds, recipes]);
  const summary = useMemo(() => summarizeNutrition(plan), [plan]);
  const seasonalDays = useMemo(() => plan.filter((day) => isRecipeInSeason(day.recipe, month)).length, [month, plan]);
  const pickerDay = pickerDate ? plan.find((day) => day.date === pickerDate) : undefined;
  const pickerRecipes = useMemo(() => {
    if (!pickerDay) return [];
    const dayIndex = plan.findIndex((day) => day.date === pickerDay.date);
    const nearbyRecipeIds = plan.slice(Math.max(0, dayIndex - 2), dayIndex + 3).map((day) => day.recipe.id);
    const ranked = rankAlternativeRecipes({ currentRecipe: pickerDay.recipe, recipes, month, maxCookMinutes, nearbyRecipeIds, preferredRecipeIds });
    const candidates = pickerMode === "recommended" ? ranked.slice(0, 12) : ranked;
    const query = pickerQuery.trim().toLocaleLowerCase("ja");
    return query ? candidates.filter((recipe) => `${recipe.name} ${recipe.side}`.toLocaleLowerCase("ja").includes(query)) : candidates;
  }, [maxCookMinutes, month, pickerDay, pickerMode, pickerQuery, plan, preferredRecipeIds, recipes]);

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
    setSeed(1);
  }

  function openRecipePicker(date: string) {
    setPickerDate(date);
    setPickerMode("recommended");
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

  async function regeneratePlan() {
    if (isSaving) return;
    const nextSeed = seed + 1;
    const nextGenerated = generateMonthlyDinnerPlan({ year, month, recipes, lockedRecipeIds, seed: nextSeed, maxCookMinutes, preferredRecipeIds });
    const nextPlan = materializeDinnerPlan(nextGenerated, recipes, {}, lockedRecipeIds);
    const previousChanged = changedRecipeIds;
    setSeed(nextSeed);
    setChangedRecipeIds({});
    setPickerDate(null);
    if (!await persistPlan(nextPlan)) {
      setSeed(seed);
      setChangedRecipeIds(previousChanged);
    }
  }

  async function changeMaxCookMinutes(nextMinutes: number) {
    if (isSaving) return;
    const nextGenerated = generateMonthlyDinnerPlan({ year, month, recipes, lockedRecipeIds, seed, maxCookMinutes: nextMinutes, preferredRecipeIds });
    const nextPlan = materializeDinnerPlan(nextGenerated, recipes, {}, lockedRecipeIds);
    const previous = maxCookMinutes;
    const previousChanged = changedRecipeIds;
    setMaxCookMinutes(nextMinutes);
    setChangedRecipeIds({});
    if (!await persistPlan(nextPlan)) {
      setMaxCookMinutes(previous);
      setChangedRecipeIds(previousChanged);
    }
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
      {demo ? <div className="mb-5 flex flex-col gap-3 border-b border-kondate-line pb-4 sm:flex-row sm:items-center sm:justify-between"><Link href="/" className="text-kondate-ink">きょうのごはん</Link><div className="flex items-center gap-3"><p className="text-xs text-kondate-faint">公式メニュー{recipes.length}品を使うデモです</p><Link href="/signup" className="inline-flex min-h-11 items-center rounded bg-kondate-ink px-4 text-sm font-semibold text-white">無料登録</Link></div></div> : null}
      <header className="pb-1">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><h1 className="font-mincho text-[26px] font-bold">栄養バランス献立</h1><p className="mt-1.5 text-sm text-kondate-muted">夕食の栄養目安、主菜の偏り、調理時間を見ながら1か月分を組みます。</p></div><div className="flex w-fit items-center rounded border border-kondate-line bg-white"><button type="button" aria-label="前の月" disabled={isSaving || isNavigating} onClick={() => moveMonth(-1)} className="grid size-11 place-items-center border-r border-kondate-line text-kondate-muted transition-colors hover:text-kondate-ink disabled:opacity-30"><ChevronLeft size={20} /></button><p className="min-w-32 text-center tabular-nums">{year}年 {month}月</p><button type="button" aria-label="次の月" disabled={isSaving || isNavigating} onClick={() => moveMonth(1)} className="grid size-11 place-items-center border-l border-kondate-line text-kondate-muted transition-colors hover:text-kondate-ink disabled:opacity-30"><ChevronRight size={20} /></button></div></div>
      </header>

      {!demo && (isSaving || saveStatus) ? <p role="status" className={`mt-4 text-right text-xs ${saveStatus === "error" ? "text-kondate-alert" : "text-kondate-faint"}`}>{isSaving ? "保存中..." : saveStatus === "saved" ? "保存しました" : "保存できませんでした。もう一度お試しください。"}</p> : null}

      {allergies.length > 0 ? <section role="status" className="mt-5 rounded border border-kondate-alert/30 bg-kondate-alertSoft p-4"><p className="flex items-center gap-2 text-sm font-semibold text-kondate-alert"><AlertTriangle size={18} aria-hidden="true" />{excludedRecipeCount > 0 ? `${excludedRecipeCount}品をアレルギー候補として除外中` : "登録したアレルギーを照合中"}</p><p className="mt-2 text-xs leading-6 text-kondate-muted">料理名・副菜・登録材料による補助判定です。調味料や加工品の原材料表示は必ず確認してください。</p></section> : null}

      {preferredRecipeIds.length > 0 || preferenceExcludedCount > 0 ? <p className="mt-4 border-l-2 border-kondate-accent bg-white px-4 py-3 text-sm text-kondate-muted">献立評価を反映中：好評 {preferredRecipeIds.length}品・除外 {preferenceExcludedCount}品</p> : null}

      <section className="mt-6 grid gap-5 border-y border-kondate-line py-5 lg:grid-cols-[1fr_auto] lg:items-center">
        <div><p className="text-xs text-kondate-muted">栄養バランス</p><div className="mt-1 flex items-baseline gap-2"><p className="font-mincho text-4xl font-bold tabular-nums">{summary.score}</p><p className="text-sm text-kondate-muted">/ 100</p></div><p className="mt-1 text-sm text-kondate-muted">{summary.message}</p><p className="mt-2 text-xs text-kondate-faint">{formatServingLabel(familySize)}で分量を計算。夕食だけを対象にした目安です。</p></div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end"><label className="text-xs text-kondate-muted">調理時間の上限<select value={maxCookMinutes} disabled={isSaving} onChange={(event) => void changeMaxCookMinutes(Number(event.target.value))} className="mt-1 block min-h-11 min-w-32 rounded border border-kondate-line bg-white px-3 text-sm text-kondate-ink disabled:opacity-40"><option value={20}>20分</option><option value={30}>30分</option><option value={45}>45分</option></select></label><button type="button" disabled={isSaving} onClick={() => void regeneratePlan()} className="inline-flex min-h-12 items-center justify-center gap-2 rounded bg-kondate-accent px-5 font-semibold text-white transition-colors hover:bg-kondate-accentDark disabled:opacity-40"><RefreshCw size={18} aria-hidden="true" />固定以外を組み直す</button></div>
      </section>

      <NutritionOverview summary={summary.average} />

      <section className="mt-8"><div className="mb-4 flex items-end justify-between gap-3"><div><h2 className="font-mincho text-xl font-bold">今月の夕食</h2><p className="mt-1 text-xs text-kondate-muted">旬、栄養バランス、主菜の偏りを見て組んでいます。</p></div><div className="shrink-0 whitespace-nowrap text-right text-xs tabular-nums text-kondate-faint"><p>{recipes.length}品から生成</p><p className="mt-1">旬 {seasonalDays}日・固定 {Object.keys(lockedRecipeIds).length}日</p></div></div>
        <div className="grid overflow-hidden border-x border-t border-kondate-line bg-white sm:grid-cols-2 lg:grid-cols-3">{plan.map((day) => { const seasonal = isRecipeInSeason(day.recipe, month); return <article key={day.date} className={["grid grid-cols-[3rem_minmax(0,1fr)] items-start gap-3 border-b border-l-2 border-kondate-line bg-white px-3 py-4", day.locked ? "border-l-kondate-accent" : "border-l-transparent"].join(" ")}><div className="self-stretch border-r border-kondate-line pr-3 text-center"><p className="text-sm tabular-nums text-kondate-ink">{formatDay(day.date)}</p><p className="mt-0.5 text-xs text-kondate-faint">{formatWeekday(day.date)}</p></div><div className="min-w-0"><h3 className="font-mincho text-base font-bold leading-snug">{day.recipe.name}</h3><p className="mt-1 truncate text-xs leading-6 text-kondate-muted">{day.recipe.side}</p><div className="mt-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-2"><p className="flex items-center gap-2 text-xs tabular-nums text-kondate-faint">{seasonal ? <span className="rounded-sm bg-kondate-doneSoft px-1.5 py-0.5 text-kondate-done">旬</span> : null}<span>{day.recipe.cookMinutes}分</span><span>{Math.round(day.recipe.nutrition.energyKcal)} kcal</span></p><div className="flex shrink-0 gap-1.5"><button type="button" disabled={isSaving} onClick={() => openRecipePicker(day.date)} className="min-h-8 rounded border border-kondate-line bg-white px-2.5 text-xs text-kondate-muted transition-colors hover:border-kondate-ink hover:text-kondate-ink disabled:opacity-40">変更</button><button type="button" disabled={isSaving} aria-pressed={day.locked} onClick={() => void toggleLock(day.date, day.recipe.id)} className={["min-h-8 rounded border px-2.5 text-xs transition-colors disabled:opacity-40", day.locked ? "border-kondate-accent bg-kondate-accent text-white" : "border-kondate-line bg-white text-kondate-muted hover:border-kondate-ink hover:text-kondate-ink"].join(" ")}>{day.locked ? "固定中" : "固定"}</button></div></div></div></article>; })}</div>
      </section>

      {pickerDay ? <div className="fixed inset-0 z-50 grid items-end p-0 sm:place-items-center sm:p-6" role="dialog" aria-modal="true" aria-labelledby="recipe-picker-title"><button type="button" aria-label="献立選択を閉じる" onClick={() => setPickerDate(null)} className="absolute inset-0 bg-kondate-ink/55" /><section className="relative z-10 flex max-h-[88dvh] w-full max-w-3xl flex-col overflow-hidden rounded-t border border-kondate-line bg-white sm:rounded"><header className="flex items-start justify-between gap-4 border-b border-kondate-line p-4 sm:p-5"><div><p className="text-xs tabular-nums text-kondate-muted">{formatDay(pickerDay.date)} {formatWeekday(pickerDay.date)}曜日</p><h2 id="recipe-picker-title" className="font-mincho mt-1 text-xl font-bold">献立を変更</h2><p className="mt-1 text-xs text-kondate-faint">現在：{pickerDay.recipe.name}</p></div><button type="button" aria-label="閉じる" onClick={() => setPickerDate(null)} className="grid size-11 shrink-0 place-items-center rounded border border-kondate-line text-kondate-muted transition-colors hover:text-kondate-ink"><X size={20} /></button></header><div className="border-b border-kondate-line p-4 sm:p-5"><div className="flex gap-1 rounded bg-kondate-bg p-1" aria-label="候補の表示方法"><button type="button" aria-pressed={pickerMode === "recommended"} onClick={() => setPickerMode("recommended")} className={["min-h-10 flex-1 rounded-sm px-3 text-sm transition-colors", pickerMode === "recommended" ? "bg-kondate-ink font-semibold text-white" : "text-kondate-muted"].join(" ")}>おすすめ</button><button type="button" aria-pressed={pickerMode === "all"} onClick={() => setPickerMode("all")} className={["min-h-10 flex-1 rounded-sm px-3 text-sm transition-colors", pickerMode === "all" ? "bg-kondate-ink font-semibold text-white" : "text-kondate-muted"].join(" ")}>すべて</button></div><label className="mt-3 flex min-h-11 items-center gap-2 rounded border border-kondate-line px-3"><Search size={18} className="shrink-0 text-kondate-muted" /><span className="sr-only">料理名で検索</span><input value={pickerQuery} onChange={(event) => setPickerQuery(event.target.value)} placeholder="料理名や副菜で検索" className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-kondate-muted" /></label></div><div className="overflow-y-auto p-4 sm:p-5"><div className="grid gap-2 sm:grid-cols-2">{pickerRecipes.map((recipe) => <button key={recipe.id} type="button" onClick={() => selectRecipe(pickerDay.date, recipe.id)} className="grid min-h-24 grid-cols-[minmax(0,1fr)_auto] gap-3 rounded border border-kondate-line p-3 text-left transition-colors hover:border-kondate-ink hover:bg-kondate-bg"><span className="min-w-0"><span className="flex items-start gap-2"><span className="font-mincho font-bold leading-snug">{recipe.name}</span>{isRecipeInSeason(recipe, month) ? <span className="shrink-0 rounded-sm bg-kondate-doneSoft px-1.5 py-0.5 text-xs text-kondate-done">旬</span> : null}</span><span className="mt-1 block truncate text-xs text-kondate-muted">{recipe.side}</span>{recipe.isCustom ? <span className="mt-2 inline-block text-xs text-kondate-accent">わが家のメニュー</span> : null}</span><span className="text-right text-xs tabular-nums text-kondate-faint"><span className="block">{recipe.cookMinutes}分</span><span className="mt-1 block">{Math.round(recipe.nutrition.energyKcal)} kcal</span></span></button>)}</div>{pickerRecipes.length === 0 ? <p className="py-10 text-center text-sm text-kondate-muted">条件に合う献立がありません。</p> : null}</div></section></div> : null}
    </main>
  );
}

function NutritionOverview({ summary }: { summary: ReturnType<typeof summarizeNutrition>["average"] }) {
  const items = [
    { label: "たんぱく質", value: summary.proteinG, target: dinnerNutritionTarget.proteinG, unit: "g" },
    { label: "食物繊維", value: summary.fiberG, target: dinnerNutritionTarget.fiberG, unit: "g" },
    { label: "野菜", value: summary.vegetablesG, target: dinnerNutritionTarget.vegetablesG, unit: "g" },
    { label: "塩分", value: summary.saltG, target: dinnerNutritionTarget.saltG, unit: "g", reverse: true },
  ];
  return <section className="mt-6"><h2 className="text-sm font-semibold">1食あたりの月平均</h2><div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-4">{items.map((item) => { const ratio = item.reverse ? Math.min(1, item.target / Math.max(item.value, 0.1)) : Math.min(1, item.value / item.target); const met = ratio >= 1; return <div key={item.label} className="rounded border border-kondate-line bg-white p-4"><div className="flex items-baseline justify-between gap-2"><p className="text-xs text-kondate-muted">{item.label}</p><p className="tabular-nums">{item.value}<span className="ml-1 text-xs text-kondate-faint">{item.unit}</span></p></div><div className="mt-3 h-[3px] overflow-hidden rounded-full bg-kondate-line"><div className={`h-full rounded-full ${met ? "bg-kondate-done" : "bg-kondate-accent"}`} style={{ width: `${Math.round(ratio * 100)}%` }} /></div><p className="mt-2 text-xs tabular-nums text-kondate-faint">目安 {item.target}{item.unit}</p></div>; })}</div></section>;
}

function formatDay(date: string) { const [, month, day] = date.split("-"); return `${Number(month)}/${Number(day)}`; }

function formatWeekday(date: string) {
  const [year, month, day] = date.split("-").map(Number);
  return ["日", "月", "火", "水", "木", "金", "土"][new Date(year, month - 1, day).getDay()];
}
