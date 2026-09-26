"use client";

import { AlertTriangle, ChevronLeft, ChevronRight, Clock3, LockKeyhole, Search, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState, useTransition } from "react";
import { saveMonthlyDinnerPlan } from "@/app/app/planner/actions";
import { Button, buttonClass } from "@/components/ui/Button";
import { SideDishPicker } from "@/components/features/planner/SideDishPicker";
import { PlannerDialog } from "@/components/features/planner/PlannerDialog";
import { isRecipeInSeason, plannedSideName, rankAlternativeRecipes } from "@/lib/nutrition/planner";
import { isDinnerCandidate, MAX_DINNER_MINUTES } from "@/lib/nutrition/cookingTime";
import { isCompleteMonthPlan, toSavedDinnerEntries } from "@/lib/nutrition/month";
import { monthCalendarDates, movePlannerDate, plannerDates, plannerHref, plannerLabel, type PlannerView } from "@/lib/nutrition/period";
import { resolvePlannerPeriod, updatePlannerDay } from "@/lib/nutrition/periodPlan";
import type { NutritionRecipe, PlannedDinner, SideDish, SideSelection } from "@/types/nutrition";
import { defaultFamilySize, type FamilySize } from "@/lib/family/servings";

type MonthlyPlannerProps = {
  recipes: NutritionRecipe[];
  initialView: PlannerView;
  initialDate: string;
  today: string;
  familySize?: FamilySize;
  allergies?: string[];
  excludedRecipeCount?: number;
  preferredRecipeIds?: string[];
  preferenceExcludedCount?: number;
  initialRecipeIds?: Record<string, string>;
  initialLockedRecipeIds?: Record<string, string>;
  sideDishes?: SideDish[];
  initialSideSelections?: Record<string, SideSelection>;
  demo?: boolean;
};

export function MonthlyPlanner({ recipes, initialView, initialDate, today, familySize = defaultFamilySize, allergies = [], excludedRecipeCount = 0, preferredRecipeIds = [], preferenceExcludedCount = 0, initialRecipeIds = {}, initialLockedRecipeIds = {}, sideDishes = [], initialSideSelections = {}, demo = false }: MonthlyPlannerProps) {
  const router = useRouter();
  const [isNavigating, startNavigation] = useTransition();
  const [view, setView] = useState(initialView);
  const [date, setDate] = useState(initialDate);
  const candidateCount = recipes.filter((recipe) => isDinnerCandidate(recipe)).length;
  const [lockedRecipeIds, setLockedRecipeIds] = useState(initialLockedRecipeIds);
  const [changedRecipeIds, setChangedRecipeIds] = useState(initialRecipeIds);
  const [detailDate, setDetailDate] = useState<string | null>(null);
  const [pickerDate, setPickerDate] = useState<string | null>(null);
  const [sidePickerDate, setSidePickerDate] = useState<string | null>(null);
  const [sideDishList, setSideDishList] = useState(sideDishes);
  const [sideSelections, setSideSelections] = useState(initialSideSelections);
  const [pickerQuery, setPickerQuery] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const savingRef = useRef(false);
  const [saveStatus, setSaveStatus] = useState<"saved" | "error" | null>(null);
  const busy = isSaving || isNavigating;
  const plan = useMemo(() => resolvePlannerPeriod(view, date, { recipes, preferredRecipeIds, initialRecipeIds: changedRecipeIds, initialLockedRecipeIds: lockedRecipeIds, sideDishes: sideDishList, initialSideSelections: sideSelections }), [view, date, recipes, preferredRecipeIds, changedRecipeIds, lockedRecipeIds, sideDishList, sideSelections]);
  const days = plannerDates(view, date);
  const byDate = new Map(plan.map((day) => [day.date, day]));
  const visiblePlan = days.flatMap((day) => byDate.get(day) ? [byDate.get(day)!] : []);
  const seasonalDays = visiblePlan.filter((day) => isRecipeInSeason(day.recipe, Number(day.date.slice(5, 7)))).length;
  const detailDay = detailDate ? byDate.get(detailDate) : undefined;
  const sidePickerDay = sidePickerDate ? plan.find((day) => day.date === sidePickerDate) : undefined;
  const pickerDay = pickerDate ? plan.find((day) => day.date === pickerDate) : undefined;
  const pickerRecipes = useMemo(() => {
    if (!pickerDay) return [];
    const dayIndex = plan.findIndex((day) => day.date === pickerDay.date);
    const nearbyRecipeIds = plan.slice(Math.max(0, dayIndex - 2), dayIndex + 3).map((day) => day.recipe.id);
    const ranked = rankAlternativeRecipes({ currentRecipe: pickerDay.recipe, recipes, month: Number(pickerDay.date.slice(5, 7)), maxCookMinutes: MAX_DINNER_MINUTES, nearbyRecipeIds, preferredRecipeIds });
    const query = pickerQuery.trim().toLocaleLowerCase("ja");
    return query ? ranked.filter((recipe) => recipe.name.toLocaleLowerCase("ja").includes(query)) : ranked;
  }, [pickerDay, pickerQuery, plan, preferredRecipeIds, recipes]);

  function navigate(nextView: PlannerView, nextDate: string) {
    if (busy || savingRef.current) return;
    setDetailDate(null);
    setPickerDate(null);
    setSidePickerDate(null);
    setSaveStatus(null);
    if (demo) {
      setView(nextView);
      setDate(nextDate);
      // デモの変更は画面内で保持し、日付・表示はURLにも反映する。
      window.history.replaceState(null, "", plannerHref(nextView, nextDate, true));
    } else {
      startNavigation(() => router.push(plannerHref(nextView, nextDate), { scroll: false }));
    }
  }

  function switchView(nextView: PlannerView) {
    navigate(nextView, date);
  }

  function openRecipePicker(day: string) {
    setDetailDate(null);
    setPickerDate(day);
    setPickerQuery("");
  }

  function openSidePicker(day: string) {
    setDetailDate(null);
    setSidePickerDate(day);
    setSaveStatus(null);
  }

  function canEdit(day: PlannedDinner) {
    const monthPlan = updatePlannerDay(plan, day.date, {});
    return monthPlan.year >= 2020 && monthPlan.year <= 2100 && isCompleteMonthPlan(monthPlan.year, monthPlan.month, toSavedDinnerEntries(monthPlan.entries));
  }

  async function updateDay(day: PlannedDinner, change: Parameters<typeof updatePlannerDay>[2]) {
    if (savingRef.current || busy) return false;
    const next = updatePlannerDay(plan, day.date, change);
    const entries = toSavedDinnerEntries(next.entries);
    if (!isCompleteMonthPlan(next.year, next.month, entries)) {
      setSaveStatus("error");
      return false;
    }
    savingRef.current = true;
    setIsSaving(true);
    setSaveStatus(null);
    try {
      const result = demo ? { ok: true } : await saveMonthlyDinnerPlan({
        year: next.year, month: next.month,
        servings: Math.max(1, Math.ceil(familySize.adultCount + familySize.childCount * 0.6)), entries,
      });
      if (!result.ok) throw new Error("plan_save_failed");
      // 保存した月をそのまま保持し、固定の切替で他の日の料理が変わらないようにする。
      setChangedRecipeIds((previous) => ({ ...previous, ...Object.fromEntries(entries.map((entry) => [entry.date, entry.recipeId])) }));
      setLockedRecipeIds((previous) => {
        const updated = { ...previous };
        for (const entry of entries) {
          if (entry.locked) updated[entry.date] = entry.recipeId;
          else delete updated[entry.date];
        }
        return updated;
      });
      setSideSelections((previous) => ({ ...previous, ...Object.fromEntries(entries.map((entry) => [entry.date, { mode: entry.sideMode ?? "default", sideDishId: entry.sideDishId ?? null }])) }));
      setPickerDate(null);
      setSidePickerDate(null);
      setSaveStatus("saved");
      return true;
    } catch {
      setSaveStatus("error");
      return false;
    } finally {
      savingRef.current = false;
      setIsSaving(false);
    }
  }

  const status = <p role={saveStatus === "error" ? "alert" : "status"} className={`text-sm ${saveStatus === "error" ? "text-kondate-alert" : "text-kondate-muted"}`}>
    {isSaving ? "保存中…" : saveStatus === "error" ? "保存できませんでした。変更は反映されていません。もう一度お試しください。" : saveStatus === "saved" ? demo ? "デモに反映しました（保存されません）" : "保存しました" : ""}
  </p>;
  const previousDate = movePlannerDate(view, date, -1);
  const nextDate = movePlannerDate(view, date, 1);

  return (
    <main className="mx-auto min-h-dvh w-full max-w-6xl px-4 pb-28 pt-5 sm:px-6" aria-busy={busy}>
      {demo ? <div className="mb-5 flex flex-wrap items-center justify-between gap-3 border-b border-kondate-line pb-4"><Link href="/">きょうのごはん</Link><Link href="/signup" className={buttonClass({ variant: "ink", size: "sm", className: "min-h-11" })}>無料登録</Link><p className="w-full text-xs text-kondate-muted">デモです。献立の変更は保存されません。</p></div> : null}
      <header className="border-b border-kondate-line pb-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div><h1 className="font-mincho text-2xl font-bold">夕食の献立</h1><p className="mt-1 text-xs text-kondate-muted">一週間の準備も、一か月の見通しも。</p></div>
          <div role="group" aria-label="献立の表示期間" className="flex rounded-lg border border-kondate-line bg-white p-1">
            {(["week", "month"] as const).map((item) => <button key={item} type="button" disabled={busy} aria-pressed={view === item} onClick={() => switchView(item)} className={`min-h-11 rounded-md px-5 text-sm font-semibold disabled:opacity-40 ${view === item ? "bg-kondate-ink text-white" : "text-kondate-muted hover:bg-kondate-bg"}`}>{item === "week" ? "週間" : "月間"}</button>)}
          </div>
        </div>
        <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-1 sm:gap-3">
            <Button variant="secondary" size="icon" aria-label={view === "week" ? "前の週" : "前の月"} disabled={busy || previousDate < "2020-01-01"} onClick={() => navigate(view, previousDate)}><ChevronLeft size={20} /></Button>
            <h2 className="text-center text-sm font-semibold tabular-nums sm:text-lg" aria-live="polite">{plannerLabel(view, date)}</h2>
            <Button variant="secondary" size="icon" aria-label={view === "week" ? "次の週" : "次の月"} disabled={busy || nextDate > "2100-12-31"} onClick={() => navigate(view, nextDate)}><ChevronRight size={20} /></Button>
          </div>
          <Button variant="secondary" size="sm" className="min-h-11" disabled={busy} onClick={() => navigate(view, today)}>{view === "week" ? "今週に戻る" : "今月に戻る"}</Button>
        </div>
      </header>
      <div className="mt-3 min-h-6">{status}</div>
      {allergies.length > 0 ? <section role="status" className="mt-3 rounded border border-kondate-alert/30 bg-kondate-alertSoft p-4"><p className="flex items-center gap-2 text-sm font-semibold text-kondate-alert"><AlertTriangle size={18} aria-hidden="true" />{excludedRecipeCount > 0 ? `${excludedRecipeCount}品をアレルギー候補として除外中` : "登録したアレルギーを照合中"}</p><p className="mt-2 text-xs leading-6 text-kondate-muted">料理名・副菜・登録材料による補助判定です。調味料や加工品の原材料表示は必ず確認してください。</p></section> : null}
      {preferredRecipeIds.length > 0 || preferenceExcludedCount > 0 ? <p className="mt-4 border-l-2 border-kondate-accent bg-white px-4 py-3 text-sm text-kondate-muted">献立評価を反映中：好評 {preferredRecipeIds.length}品・除外 {preferenceExcludedCount}品</p> : null}
      <section className="mt-4" aria-label={view === "week" ? "週間献立" : "月間献立"}>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2 text-xs text-kondate-muted"><p>完成まで40分以内の料理から提案</p><p>旬 {seasonalDays}日・固定 {visiblePlan.filter((day) => day.locked).length}日</p></div>
        {candidateCount === 0 ? <p role="status" className="mb-4 rounded border border-kondate-line p-4 text-sm text-kondate-muted">条件に合う40分以内の料理がありません。保存済みの献立だけを表示しています。</p> : null}
        {view === "week" ? <div className="grid gap-3">{days.map((day) => {
          const dinner = byDate.get(day);
          return dinner ? <DinnerCard key={day} day={dinner} today={today} disabled={busy || !canEdit(dinner)} canChange={candidateCount > 0} onChange={() => openRecipePicker(day)} onSideChange={() => openSidePicker(day)} onLock={() => void updateDay(dinner, { locked: !dinner.locked })} /> : <article key={day} className="rounded-lg border border-kondate-line p-4 text-sm">{formatDay(day)}（{formatWeekday(day)}）<p className="mt-1 text-kondate-muted">条件に合う献立がありません。</p></article>;
        })}</div> : <>
          <p className="mb-3 text-xs text-kondate-muted">日付を押すと、副菜の確認や献立の変更ができます。</p>
          <div className="overflow-hidden rounded-lg border border-kondate-line bg-white">
            <div className="grid grid-cols-7 border-b border-kondate-line bg-kondate-bg text-center text-xs">{["月", "火", "水", "木", "金", "土", "日"].map((day) => <span key={day} className={`py-2 ${day === "日" ? "text-kondate-alert" : "text-kondate-muted"}`}>{day}</span>)}</div>
            <div className="grid grid-cols-7 gap-px bg-kondate-line">{monthCalendarDates(date).map((day, index) => {
              const dinner = day ? byDate.get(day) : undefined;
              return day ? <button key={day} type="button" disabled={busy || !dinner} aria-label={`${formatDay(day)}（${formatWeekday(day)}） ${dinner?.recipe.name ?? "献立なし"}${dinner?.locked ? " 固定中" : ""}`} aria-current={day === today ? "date" : undefined} onClick={() => setDetailDate(day)} className={`flex min-h-28 min-w-0 flex-col items-start gap-1 px-1 py-2 text-left transition-colors hover:bg-kondate-doneSoft focus-visible:z-10 disabled:opacity-60 sm:min-h-36 sm:px-3 ${day === today ? "bg-kondate-doneSoft" : "bg-white"}`}>
                <span className={`inline-flex size-6 items-center justify-center rounded-full text-xs tabular-nums ${day === today ? "bg-kondate-accent font-bold text-white" : "text-kondate-muted"}`}>{Number(day.slice(8))}</span>
                <span className="line-clamp-3 break-words text-[10px] font-semibold leading-relaxed sm:text-sm">{dinner?.recipe.name ?? "献立なし"}</span>
                {dinner?.locked ? <LockKeyhole size={12} aria-hidden="true" className="mt-auto shrink-0 text-kondate-accent" /> : null}
              </button> : <div key={`empty-${index}`} aria-hidden="true" className="bg-kondate-bg" />;
            })}</div>
          </div>
        </>}
      </section>
      {detailDay ? <PlannerDialog labelId="dinner-detail-title" onClose={() => setDetailDate(null)}>
        <div className="flex items-center justify-between gap-3 border-b border-kondate-line p-4"><h2 id="dinner-detail-title" className="font-mincho text-lg font-bold">{formatDay(detailDay.date)}の夕食</h2><Button variant="secondary" size="icon" aria-label="閉じる" onClick={() => setDetailDate(null)}><X size={20} /></Button></div>
        <div className="overflow-y-auto p-4"><DinnerCard day={detailDay} today={today} disabled={busy || !canEdit(detailDay)} canChange={candidateCount > 0} onChange={() => openRecipePicker(detailDay.date)} onSideChange={() => openSidePicker(detailDay.date)} onLock={() => void updateDay(detailDay, { locked: !detailDay.locked })} /><div className="mt-3">{status}</div><Button variant="secondary" className="mt-3 w-full" disabled={busy} onClick={() => navigate("week", detailDay.date)}>この週を見る</Button></div>
      </PlannerDialog> : null}
      {sidePickerDay ? <SideDishPicker day={sidePickerDay} sideDishes={sideDishList} allergies={allergies} demo={demo} onClose={() => setSidePickerDate(null)} onCreated={(sideDish) => setSideDishList((previous) => [sideDish, ...previous.filter((dish) => dish.id !== sideDish.id)])} onSelect={(mode, sideDish) => updateDay(sidePickerDay, { sideMode: mode, sideDish })} /> : null}
      {pickerDay ? <PlannerDialog labelId="recipe-picker-title" onClose={() => { if (!savingRef.current) setPickerDate(null); }}>
        <header className="flex items-start justify-between gap-4 border-b border-kondate-line p-4 sm:p-5"><div><p className="text-xs tabular-nums text-kondate-muted">{formatDay(pickerDay.date)} {formatWeekday(pickerDay.date)}曜日</p><h2 id="recipe-picker-title" className="font-mincho mt-1 text-xl font-bold">献立を変更</h2><p className="mt-1 text-xs text-kondate-muted">現在：{pickerDay.recipe.name}</p></div><Button variant="secondary" size="icon" aria-label="閉じる" disabled={busy} onClick={() => setPickerDate(null)}><X size={20} /></Button></header>
        <div className="border-b border-kondate-line p-4 sm:p-5"><label className="flex min-h-11 items-center gap-2 rounded-lg border border-kondate-line bg-white px-3 focus-within:border-kondate-accent focus-within:ring-2 focus-within:ring-kondate-accent/20"><Search size={18} aria-hidden="true" className="shrink-0 text-kondate-muted" /><span className="sr-only">料理名で検索</span><input type="search" value={pickerQuery} onChange={(event) => setPickerQuery(event.target.value)} placeholder="料理名で検索" autoComplete="off" enterKeyHint="search" className="min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-kondate-muted sm:text-sm" /></label><div className="mt-2">{status}</div></div>
        <div className="overflow-y-auto p-4 sm:p-5"><div className="grid gap-2 sm:grid-cols-2">{pickerRecipes.map((recipe) => <button key={recipe.id} type="button" disabled={busy} onClick={() => void updateDay(pickerDay, { recipe })} className={`rounded border border-kondate-line text-left font-mincho font-bold leading-snug transition-colors hover:border-kondate-ink hover:bg-kondate-bg disabled:opacity-40 ${pickerQuery.trim() ? "min-h-20 px-5 py-4 text-lg sm:min-h-24 sm:px-6 sm:py-5 sm:text-xl" : "min-h-14 px-4 py-3"}`}>{recipe.name}</button>)}</div>{pickerRecipes.length === 0 ? <p className="py-10 text-center text-sm text-kondate-muted">料理名が見つかりません。別の言葉で検索してください。</p> : null}</div>
      </PlannerDialog> : null}
    </main>
  );
}

function DinnerCard({ day, today, disabled, canChange, onChange, onSideChange, onLock }: { day: PlannedDinner; today: string; disabled: boolean; canChange: boolean; onChange: () => void; onSideChange: () => void; onLock: () => void }) {
  return <article aria-label={`${formatDay(day.date)}の夕食`} className={`grid grid-cols-[3rem_minmax(0,1fr)] gap-3 rounded-lg border bg-white p-4 sm:grid-cols-[4rem_minmax(0,1fr)] sm:gap-5 sm:p-5 ${day.date === today ? "border-kondate-accent" : "border-kondate-line"}`}>
    <div className="border-r border-kondate-line pr-3 text-center"><p className="text-sm font-semibold tabular-nums">{formatDay(day.date)}</p><p className="mt-1 text-xs text-kondate-muted">{formatWeekday(day.date)}</p>{day.date === today ? <span className="mt-2 block text-[10px] font-semibold text-kondate-accent">今日</span> : null}</div>
    <div className="flex min-w-0 flex-wrap items-center justify-between gap-3"><div className="min-w-0 flex-1 basis-48"><h3 className="font-mincho text-lg font-bold leading-snug">{day.recipe.name}</h3><p className="mt-1 text-sm text-kondate-muted">{plannedSideName(day)}</p><p className="mt-2 flex items-center gap-1.5 text-xs text-kondate-muted"><Clock3 size={14} aria-hidden="true" />{day.recipe.timeUnconfirmed ? "調理時間は未確認" : `完成まで${day.recipe.totalMinutes ?? day.recipe.cookMinutes}分`}{day.locked ? <span className="ml-2 text-kondate-accent">固定中</span> : null}</p>{!isDinnerCandidate(day.recipe) ? <p className="mt-1 text-xs text-kondate-muted">保存済み・新しい献立の候補対象外</p> : null}</div>
      <div className="flex max-w-full flex-wrap gap-2"><Button variant="secondary" size="sm" disabled={disabled || !canChange} onClick={onChange} className="min-h-11">主菜を変更</Button><Button variant={day.locked ? "primary" : "secondary"} size="sm" disabled={disabled} aria-pressed={day.locked} onClick={onLock} className="min-h-11">{day.locked ? "固定中" : "固定"}</Button><Button variant="secondary" size="sm" disabled={disabled} onClick={onSideChange} className="min-h-11">副菜を変更</Button></div>
    </div>
  </article>;
}

function formatDay(date: string) { const [, month, day] = date.split("-"); return `${Number(month)}/${Number(day)}`; }
function formatWeekday(date: string) {
  const [year, month, day] = date.split("-").map(Number);
  return ["日", "月", "火", "水", "木", "金", "土"][new Date(year, month - 1, day).getDay()];
}
