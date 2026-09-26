"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { setTodayTaskChecked } from "@/app/app/actions";
import { CookingBasics } from "@/components/features/recipes/CookingBasics";
import { RecipeIngredientLine, StepSeasoningGuide } from "@/components/features/recipes/SeasoningGuide";
import { getSeasoningGroups, type SeasoningGroup } from "@/lib/recipes/seasoningGroups";
import { CheckRow } from "@/components/ui/CheckRow";
import { formatServingLabel, getRecipeServings, scaleRecipeIngredient, scaleQuantityText, type FamilySize } from "@/lib/family/servings";
import { MealFeedbackForm } from "@/components/features/feedback/MealFeedbackForm";
import { countCheckedTasks, countTasks, type TodayTaskBinding, type TodayTaskBindings, updateTaskBindings } from "@/lib/realtime/taskState";
import { getSupabaseBrowser } from "@/lib/supabase/client";
import type { PlanMeal } from "@/types/domain";
import { isSeparateSideIngredient } from "@/lib/nutrition/sideDish";

export function TodayBoard({
  familySize,
  feedbackStatus,
  today,
  initialTaskBindings,
  dinnerAvailable = true,
}: {
  familySize: FamilySize;
  feedbackStatus?: string;
  today: PlanMeal;
  initialTaskBindings: TodayTaskBindings;
  dinnerAvailable?: boolean;
}) {
  const [taskBindings, setTaskBindings] = useState(initialTaskBindings);
  const [pendingStepIds, setPendingStepIds] = useState(() => new Set<string>());
  const [error, setError] = useState("");
  const totalTasks = countTasks(taskBindings);
  const checkedCount = countCheckedTasks(taskBindings);
  const planEntryIds = useMemo(() => Array.from(new Set(
    [...initialTaskBindings.breakfast, ...initialTaskBindings.seasoning, ...initialTaskBindings.morning, ...initialTaskBindings.evening]
      .map((task) => task.planEntryId)
      .filter((id): id is string => Boolean(id)),
  )), [initialTaskBindings]);
  const planEntryFilter = planEntryIds.join(",");
  const seasoningTasks = useMemo(
    () => taskBindings.seasoning.map((task) => ({ ...task, text: today.dinner.sideServingsBase && isSeparateSideIngredient(task.text)
      ? scaleRecipeIngredient(task.text, getRecipeServings(familySize), today.dinner.sideServingsBase)
      : today.dinner.ingredientsScalable ? scaleRecipeIngredient(task.text, getRecipeServings(familySize), today.dinner.servingsBase ?? 4) : today.dinner.servingsBase ? task.text : scaleQuantityText(task.text, familySize) })),
    [familySize, taskBindings.seasoning, today.dinner.ingredientsScalable, today.dinner.servingsBase, today.dinner.sideServingsBase],
  );
  const seasoningGroups = getSeasoningGroups(seasoningTasks.map((task) => task.text));

  useEffect(() => {
    const supabase = getSupabaseBrowser();
    if (!supabase || !planEntryFilter) return;
    let cancelled = false;
    const channels: ReturnType<typeof supabase.channel>[] = [];

    const receiveTaskChange = (payload: unknown) => {
      const row = getBroadcastRecord(payload);
      if (!row) return;
      setTaskBindings((current) => updateTaskBindings(current, row.stepId, row.checked));
    };

    void supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (cancelled || !user) return;
      await supabase.realtime.setAuth();
      if (cancelled) return;
      channels.push(...planEntryIds.map((planEntryId) => supabase.channel(`plan-entry:${planEntryId}:member:${user.id}`, {
        config: { private: true },
      })));
      channels.forEach((channel) => {
        channel
          .on("broadcast", { event: "*" }, receiveTaskChange)
          .subscribe((status) => {
            if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
              setError("家族との自動同期が一時停止しています。保存は続けられます。");
            }
          });
      });
    }).catch(() => {
      if (!cancelled) setError("家族との自動同期が一時停止しています。保存は続けられます。");
    });

    return () => {
      cancelled = true;
      channels.forEach((channel) => { void supabase.removeChannel(channel); });
    };
  }, [planEntryFilter, planEntryIds]);

  async function updateTask(task: TodayTaskBinding, checked: boolean) {
    if (!task.planEntryId || !task.stepId) {
      setError("タスクの保存準備ができていません。画面を再読み込みしてください。");
      return;
    }

    const previousChecked = task.checked;
    setError("");
    setTaskBindings((current) => updateTaskBindings(current, task.stepId as string, checked));
    setPendingStepIds((current) => updateSet(current, task.stepId as string, true));

    const result = await setTodayTaskChecked({ planEntryId: task.planEntryId, stepId: task.stepId, checked });
    setPendingStepIds((current) => updateSet(current, task.stepId as string, false));
    if (!result.ok) {
      setTaskBindings((current) => updateTaskBindings(current, task.stepId as string, previousChecked));
      setError("タスクを保存できませんでした。通信状態を確認してください。");
    }
  }

  return (
    <section className="space-y-8">
      <header>
        <p className="text-sm text-kondate-muted">{formatDateLabel(today)}</p>
        <h1 className="font-mincho mt-1.5 text-[27px] font-bold leading-tight">{today.dinner.dinner}</h1>
        <p className="mt-1.5 text-[15px] text-kondate-muted">{today.dinner.side}</p>
        {dinnerAvailable ? <p className="mt-3 text-xs text-kondate-faint">{formatServingLabel(familySize)}・{today.dinner.totalMin ? `完成まで約${today.dinner.totalMin}分` : `夜 ${today.dinner.cookMin}分`}</p> : <p role="status" className="mt-3 text-sm leading-7 text-kondate-muted">条件に合う40分以内の料理がありません。<Link href="/app/recipes" className="text-kondate-accent underline">メニューを確認する</Link></p>}

        <div className="mt-5 flex items-center gap-3">
          <span className="h-[3px] flex-1 overflow-hidden rounded-full bg-kondate-line">
            <span
              className="block h-full rounded-full bg-kondate-done transition-[width] duration-200 motion-reduce:transition-none"
              style={{ width: totalTasks === 0 ? "0%" : `${(checkedCount / totalTasks) * 100}%` }}
            />
          </span>
          <span aria-live="polite" className="shrink-0 text-xs tabular-nums text-kondate-muted">
            {totalTasks > 0 && checkedCount === totalTasks ? "ぜんぶ完了" : `残り ${totalTasks - checkedCount}`}
          </span>
        </div>
      </header>

      {error ? <p role="alert" className="rounded border border-kondate-alert/30 bg-kondate-alertSoft p-3 text-sm text-kondate-alert">{error}</p> : null}

      {today.breakfast ? <MealBlock
        rule="border-kondate-morningInk"
        title="朝ごはん"
        minutes={today.breakfast.minutes}
        subtitle={today.breakfast.name}
        tasks={taskBindings.breakfast}
        pendingStepIds={pendingStepIds}
        onCheckedChange={updateTask}
      /> : null}

      {taskBindings.morning.length > 0 ? <MealBlock
        rule="border-kondate-morningInk"
        title="朝の仕込み"
        seasoningGroups={seasoningGroups}
        minutes={today.dinner.prepMin}
        tasks={taskBindings.morning}
        pendingStepIds={pendingStepIds}
        onCheckedChange={updateTask}
      /> : null}

      {dinnerAvailable ? <CookingBasics /> : null}
      {today.dinner.recipeNotes?.length ? <ul className="list-disc space-y-2 pl-5 text-sm leading-7 text-kondate-muted">{today.dinner.recipeNotes.map((note) => <li key={note}>{note}</li>)}</ul> : null}

      {seasoningTasks.length > 0 ? <MealBlock
        rule="border-kondate-eveningInk"
        title="材料・調味料"
        ingredients
        note={today.dinner.ingredientsScalable ? `${getRecipeServings(familySize)}人分に換算` : today.dinner.servingsBase ? `${today.dinner.servingsBase}人分（保存した分量）` : formatServingLabel(familySize)}
        tasks={seasoningTasks}
        pendingStepIds={pendingStepIds}
        onCheckedChange={updateTask}
      /> : null}

      {dinnerAvailable ? <MealBlock
        rule="border-kondate-eveningInk"
        title="夜の手順"
        seasoningGroups={seasoningGroups}
        note={today.dinner.totalMin ? "下ごしらえから順番に進めてください" : undefined}
        numbered
        tasks={taskBindings.evening}
        pendingStepIds={pendingStepIds}
        onCheckedChange={updateTask}
      /> : null}

      {dinnerAvailable && today.dinner.sideSteps?.length ? <section className="border-l-2 border-kondate-eveningInk pl-4">
        <h2 className="text-sm font-semibold">副菜の手順</h2>
        <p className="mt-0.5 text-sm text-kondate-muted">{today.dinner.side}</p>
        <ol className="mt-3 space-y-3 text-sm leading-7">{today.dinner.sideSteps.map((step, index) => <li key={`${index}-${step}`} className="flex gap-3"><span className="font-semibold text-kondate-accent">{index + 1}.</span><span className="min-w-0">{step}<StepSeasoningGuide step={step} groups={seasoningGroups} /></span></li>)}</ol>
      </section> : null}

      {dinnerAvailable ? <MealFeedbackForm servedOn={today.date} recipeName={today.dinner.dinner} status={feedbackStatus} /> : null}
    </section>
  );
}

function MealBlock({
  rule,
  title,
  minutes,
  note,
  subtitle,
  numbered = false,
  ingredients = false,
  seasoningGroups = [],
  tasks,
  pendingStepIds,
  onCheckedChange,
}: {
  rule: string;
  title: string;
  minutes?: number;
  note?: string;
  subtitle?: string;
  numbered?: boolean;
  ingredients?: boolean;
  seasoningGroups?: SeasoningGroup[];
  tasks: TodayTaskBinding[];
  pendingStepIds: Set<string>;
  onCheckedChange: (task: TodayTaskBinding, checked: boolean) => void;
}) {
  return (
    <section className={`border-l-2 pl-4 ${rule}`}>
      <div className="flex flex-wrap items-baseline gap-2">
        <h2 className="text-sm font-semibold">{title}</h2>
        {typeof minutes === "number" ? <span className="text-xs tabular-nums text-kondate-faint">{minutes}分</span> : null}
        {note ? <span className="text-xs text-kondate-faint">{note}</span> : null}
      </div>
      {subtitle ? <p className="mt-0.5 text-sm text-kondate-muted">{subtitle}</p> : null}
      <div className="mt-1.5 divide-y divide-kondate-line">
        {tasks.map((task, index) => (
          <CheckRow
            key={task.stepId ?? task.text}
            checked={task.checked}
            disabled={task.stepId ? pendingStepIds.has(task.stepId) : false}
            onCheckedChange={(checked) => onCheckedChange(task, checked)}
          >
            {numbered ? <span className="mr-2 font-semibold text-kondate-accent">{index + 1}.</span> : null}
            {ingredients ? <RecipeIngredientLine text={task.text} /> : task.text}
            <StepSeasoningGuide step={task.text} groups={seasoningGroups} />
          </CheckRow>
        ))}
      </div>
    </section>
  );
}

function formatDateLabel(meal: PlanMeal) {
  const [, month, day] = meal.date.split("-");
  return `${Number(month)}月${Number(day)}日 (${meal.dow})`;
}

function updateSet(current: Set<string>, key: string, included: boolean): Set<string> {
  const next = new Set(current);
  if (included) next.add(key);
  else next.delete(key);
  return next;
}

function getBroadcastRecord(payload: unknown): { stepId: string; checked: boolean } | null {
  const message = payload as { payload?: { record?: { step_id?: unknown; checked?: unknown } } };
  const record = message.payload?.record;
  if (typeof record?.step_id !== "string" || typeof record.checked !== "boolean") return null;
  return { stepId: record.step_id, checked: record.checked };
}
