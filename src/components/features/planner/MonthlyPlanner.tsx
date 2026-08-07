"use client";

import { AlertTriangle, ChevronLeft, ChevronRight, Clock3, Leaf, RefreshCw, Search, Sparkles, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { dinnerNutritionTarget, generateMonthlyDinnerPlan, isRecipeInSeason, rankAlternativeRecipes, summarizeNutrition } from "@/lib/nutrition/planner";
import type { NutritionRecipe } from "@/types/nutrition";
import { defaultFamilySize, formatServingLabel, type FamilySize } from "@/lib/family/servings";

export function MonthlyPlanner({ recipes, initialYear, initialMonth, familySize = defaultFamilySize, allergies = [], excludedRecipeCount = 0, preferredRecipeIds = [], preferenceExcludedCount = 0, demo = false }: { recipes: NutritionRecipe[]; initialYear: number; initialMonth: number; familySize?: FamilySize; allergies?: string[]; excludedRecipeCount?: number; preferredRecipeIds?: string[]; preferenceExcludedCount?: number; demo?: boolean }) {
  const [year, setYear] = useState(initialYear);
  const [month, setMonth] = useState(initialMonth);
  const [seed, setSeed] = useState(1);
  const [maxCookMinutes, setMaxCookMinutes] = useState(30);
  const [lockedRecipeIds, setLockedRecipeIds] = useState<Record<string, string>>({});
  const [changedRecipeIds, setChangedRecipeIds] = useState<Record<string, string>>({});
  const [pickerDate, setPickerDate] = useState<string | null>(null);
  const [pickerMode, setPickerMode] = useState<"recommended" | "all">("recommended");
  const [pickerQuery, setPickerQuery] = useState("");

  const generatedPlan = useMemo(() => generateMonthlyDinnerPlan({ year, month, recipes, lockedRecipeIds, seed, maxCookMinutes, preferredRecipeIds }), [year, month, recipes, lockedRecipeIds, seed, maxCookMinutes, preferredRecipeIds]);
  const recipeById = useMemo(() => new Map(recipes.map((recipe) => [recipe.id, recipe])), [recipes]);
  const plan = useMemo(() => generatedPlan.map((day) => {
    const changedRecipe = recipeById.get(changedRecipeIds[day.date]);
    return changedRecipe ? { ...day, recipe: changedRecipe } : day;
  }), [changedRecipeIds, generatedPlan, recipeById]);
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

  function selectRecipe(date: string, recipeId: string) {
    setChangedRecipeIds((current) => ({ ...current, [date]: recipeId }));
    if (lockedRecipeIds[date]) setLockedRecipeIds((current) => ({ ...current, [date]: recipeId }));
    setPickerDate(null);
  }

  function toggleLock(date: string, recipeId: string) {
    setLockedRecipeIds((current) => {
      const next = { ...current };
      if (next[date]) delete next[date]; else next[date] = recipeId;
      return next;
    });
  }

  return (
    <main className="mx-auto min-h-dvh w-full max-w-6xl px-4 pb-28 pt-5 sm:px-6">
      {demo ? <div className="mb-5 flex flex-col gap-3 border-b border-kondate-line pb-4 sm:flex-row sm:items-center sm:justify-between"><Link href="/" className="font-black text-kondate-ink">きょうのごはん</Link><div className="flex items-center gap-3"><p className="text-xs font-bold text-kondate-muted">公式メニュー{recipes.length}品を使うデモです</p><Link href="/signup" className="inline-flex min-h-11 items-center bg-kondate-ink px-4 text-sm font-black text-white">無料登録</Link></div></div> : null}
      <header className="border-b-2 border-kondate-ink pb-5">
        <p className="flex items-center gap-2 text-sm font-black text-kondate-accent"><Sparkles size={18} />NUTRITION PLANNER</p>
        <div className="mt-2 flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><h1 className="font-mincho text-3xl font-black">栄養バランス献立</h1><p className="mt-2 text-sm leading-6 text-kondate-muted">夕食の栄養目安、主菜の偏り、調理時間を見ながら1か月分を組みます。</p></div><div className="flex items-center border-2 border-kondate-ink bg-white"><button type="button" aria-label="前の月" onClick={() => moveMonth(-1)} className="grid size-11 place-items-center border-r border-kondate-ink"><ChevronLeft size={20} /></button><p className="min-w-32 text-center font-black tabular-nums">{year}年 {month}月</p><button type="button" aria-label="次の月" onClick={() => moveMonth(1)} className="grid size-11 place-items-center border-l border-kondate-ink"><ChevronRight size={20} /></button></div></div>
      </header>

      {allergies.length > 0 ? <section role="status" className="mt-5 border border-amber-300 bg-amber-50 p-4 text-amber-950"><p className="flex items-center gap-2 text-sm font-black"><AlertTriangle size={18} />{excludedRecipeCount > 0 ? `${excludedRecipeCount}品をアレルギー候補として除外中` : "登録したアレルギーを照合中"}</p><p className="mt-2 text-xs font-bold leading-5">料理名・副菜・登録材料による補助判定です。調味料や加工品の原材料表示は必ず確認してください。</p></section> : null}

      {preferredRecipeIds.length > 0 || preferenceExcludedCount > 0 ? <p className="mt-4 border-l-4 border-kondate-accent bg-white px-4 py-3 text-sm font-bold text-kondate-muted">献立評価を反映中：好評 {preferredRecipeIds.length}品・除外 {preferenceExcludedCount}品</p> : null}

      <section className="mt-6 grid gap-5 border-y border-kondate-line py-5 lg:grid-cols-[1fr_auto] lg:items-center">
        <div><div className="flex items-baseline gap-3"><p className="font-mincho text-4xl font-black tabular-nums">{summary.score}</p><p className="text-sm font-black">/ 100</p></div><p className="mt-1 text-sm font-bold text-kondate-muted">{summary.message}</p><p className="mt-2 text-xs font-bold text-kondate-accent">{formatServingLabel(familySize)}で分量を計算</p><p className="mt-1 text-xs leading-5 text-kondate-muted">夕食だけを対象にした目安です。体調や治療に関する判断には使用しないでください。</p></div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end"><label className="text-xs font-black text-kondate-muted">調理時間の上限<select value={maxCookMinutes} onChange={(event) => setMaxCookMinutes(Number(event.target.value))} className="mt-1 block min-h-11 min-w-32 rounded-lg border border-kondate-line bg-white px-3 text-sm font-black text-kondate-ink"><option value={20}>20分</option><option value={30}>30分</option><option value={45}>45分</option></select></label><button type="button" onClick={() => { setSeed((current) => current + 1); setChangedRecipeIds({}); setPickerDate(null); }} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg bg-kondate-accent px-5 font-black text-white"><RefreshCw size={18} />固定以外を組み直す</button></div>
      </section>

      <NutritionOverview summary={summary.average} />

      <section className="mt-8"><div className="mb-4 flex items-end justify-between gap-3"><div><h2 className="font-mincho text-2xl font-black">今月の夕食</h2><p className="mt-1 text-xs text-kondate-muted">旬、栄養バランス、主菜の偏りを見て組んでいます。</p></div><div className="shrink-0 whitespace-nowrap text-right text-xs font-black text-kondate-muted"><p>{recipes.length}品から生成</p><p className="mt-1">旬 {seasonalDays}日・固定 {Object.keys(lockedRecipeIds).length}日</p></div></div>
        <div className="grid overflow-hidden border-x border-t border-kondate-line bg-white sm:grid-cols-2 lg:grid-cols-3">{plan.map((day) => { const seasonal = isRecipeInSeason(day.recipe, month); return <article key={day.date} className={["grid min-h-32 grid-cols-[3.25rem_minmax(0,1fr)_4.25rem] items-center gap-3 border-b border-kondate-line px-3 py-4", day.locked ? "bg-[#fff7f2]" : "bg-white"].join(" ")}><div className="self-stretch border-r border-kondate-line pr-3 text-center"><p className="text-sm font-black tabular-nums text-kondate-ink">{formatDay(day.date)}</p><p className="mt-1 text-xs font-bold text-kondate-muted">{formatWeekday(day.date)}</p></div><div className="min-w-0"><div className="flex items-start gap-2"><h3 className="font-mincho text-base font-black leading-snug">{day.recipe.name}</h3>{seasonal ? <span className="shrink-0 bg-[#e5f0df] px-1.5 py-0.5 text-xs font-black text-[#2f6b38]">旬</span> : null}</div><p className="mt-1 truncate text-xs leading-5 text-kondate-muted">{day.recipe.side}</p><div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-bold text-kondate-muted"><span className="flex items-center gap-1"><Clock3 size={14} />{day.recipe.cookMinutes}分</span><span>{Math.round(day.recipe.nutrition.energyKcal)} kcal</span></div></div><div className="grid gap-2"><button type="button" onClick={() => openRecipePicker(day.date)} className="min-h-9 border border-kondate-line bg-white px-2 text-xs font-black text-kondate-ink">変更</button><button type="button" aria-pressed={day.locked} onClick={() => toggleLock(day.date, day.recipe.id)} className={["min-h-9 border px-2 text-xs font-black", day.locked ? "border-kondate-accent bg-kondate-accent text-white" : "border-kondate-line bg-white text-kondate-ink"].join(" ")}>{day.locked ? "固定中" : "固定"}</button></div></article>; })}</div>
      </section>

      {pickerDay ? <div className="fixed inset-0 z-50 grid items-end p-0 sm:place-items-center sm:p-6" role="dialog" aria-modal="true" aria-labelledby="recipe-picker-title"><button type="button" aria-label="献立選択を閉じる" onClick={() => setPickerDate(null)} className="absolute inset-0 bg-kondate-ink/55" /><section className="relative z-10 flex max-h-[88dvh] w-full max-w-3xl flex-col overflow-hidden border-2 border-kondate-ink bg-white"><header className="flex items-start justify-between gap-4 border-b-2 border-kondate-ink p-4 sm:p-5"><div><p className="text-xs font-black text-kondate-accent">{formatDay(pickerDay.date)} {formatWeekday(pickerDay.date)}曜日</p><h2 id="recipe-picker-title" className="font-mincho mt-1 text-xl font-black sm:text-2xl">献立を変更</h2><p className="mt-1 text-xs text-kondate-muted">現在：{pickerDay.recipe.name}</p></div><button type="button" aria-label="閉じる" onClick={() => setPickerDate(null)} className="grid size-11 shrink-0 place-items-center border border-kondate-line"><X size={20} /></button></header><div className="border-b border-kondate-line p-4 sm:p-5"><div className="flex gap-1 bg-kondate-bg p-1" aria-label="候補の表示方法"><button type="button" aria-pressed={pickerMode === "recommended"} onClick={() => setPickerMode("recommended")} className={["min-h-10 flex-1 px-3 text-sm font-black", pickerMode === "recommended" ? "bg-kondate-ink text-white" : "text-kondate-muted"].join(" ")}>おすすめ</button><button type="button" aria-pressed={pickerMode === "all"} onClick={() => setPickerMode("all")} className={["min-h-10 flex-1 px-3 text-sm font-black", pickerMode === "all" ? "bg-kondate-ink text-white" : "text-kondate-muted"].join(" ")}>すべて</button></div><label className="mt-3 flex min-h-11 items-center gap-2 border border-kondate-line px-3"><Search size={18} className="shrink-0 text-kondate-muted" /><span className="sr-only">料理名で検索</span><input value={pickerQuery} onChange={(event) => setPickerQuery(event.target.value)} placeholder="料理名や副菜で検索" className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-kondate-muted" /></label></div><div className="overflow-y-auto p-4 sm:p-5"><div className="grid gap-2 sm:grid-cols-2">{pickerRecipes.map((recipe) => <button key={recipe.id} type="button" onClick={() => selectRecipe(pickerDay.date, recipe.id)} className="grid min-h-24 grid-cols-[minmax(0,1fr)_auto] gap-3 border border-kondate-line p-3 text-left transition hover:border-kondate-ink hover:bg-kondate-bg"><span className="min-w-0"><span className="flex items-start gap-2"><span className="font-mincho font-black leading-snug">{recipe.name}</span>{isRecipeInSeason(recipe, month) ? <span className="shrink-0 bg-[#e5f0df] px-1.5 py-0.5 text-xs font-black text-[#2f6b38]">旬</span> : null}</span><span className="mt-1 block truncate text-xs text-kondate-muted">{recipe.side}</span>{recipe.isCustom ? <span className="mt-2 inline-block text-xs font-black text-kondate-accent">わが家のメニュー</span> : null}</span><span className="text-right text-xs font-bold tabular-nums text-kondate-muted"><span className="block">{recipe.cookMinutes}分</span><span className="mt-1 block">{Math.round(recipe.nutrition.energyKcal)} kcal</span></span></button>)}</div>{pickerRecipes.length === 0 ? <p className="py-10 text-center text-sm font-bold text-kondate-muted">条件に合う献立がありません。</p> : null}</div></section></div> : null}
    </main>
  );
}

function NutritionOverview({ summary }: { summary: ReturnType<typeof summarizeNutrition>["average"] }) {
  const items = [
    { label: "たんぱく質", value: summary.proteinG, target: dinnerNutritionTarget.proteinG, unit: "g", color: "bg-[#3155a4]" },
    { label: "食物繊維", value: summary.fiberG, target: dinnerNutritionTarget.fiberG, unit: "g", color: "bg-[#2f7a42]" },
    { label: "野菜", value: summary.vegetablesG, target: dinnerNutritionTarget.vegetablesG, unit: "g", color: "bg-[#ca4b24]" },
    { label: "塩分", value: summary.saltG, target: dinnerNutritionTarget.saltG, unit: "g", color: "bg-[#8b6508]", reverse: true },
  ];
  return <section className="mt-6"><h2 className="flex items-center gap-2 text-sm font-black"><Leaf size={18} className="text-[#2f7a42]" />1食あたりの月平均</h2><div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{items.map((item) => { const ratio = item.reverse ? Math.min(1, item.target / Math.max(item.value, 0.1)) : Math.min(1, item.value / item.target); return <div key={item.label} className="rounded-lg border border-kondate-line bg-white p-4"><div className="flex items-baseline justify-between gap-2"><p className="text-xs font-black text-kondate-muted">{item.label}</p><p className="font-black tabular-nums">{item.value}<span className="ml-1 text-xs text-kondate-muted">{item.unit}</span></p></div><div className="mt-3 h-2 overflow-hidden rounded-full bg-kondate-bg"><div className={`h-full rounded-full ${item.color}`} style={{ width: `${Math.round(ratio * 100)}%` }} /></div><p className="mt-2 text-xs text-kondate-muted">目安 {item.target}{item.unit}</p></div>; })}</div></section>;
}

function formatDay(date: string) { const [, month, day] = date.split("-"); return `${Number(month)}/${Number(day)}`; }

function formatWeekday(date: string) {
  const [year, month, day] = date.split("-").map(Number);
  return ["日", "月", "火", "水", "木", "金", "土"][new Date(year, month - 1, day).getDay()];
}
