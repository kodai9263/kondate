"use client";

import { useEffect, useMemo, useState } from "react";
import { setTodayTaskChecked } from "@/app/app/actions";
import { CheckRow } from "@/components/ui/CheckRow";
import { formatServingLabel, scaleQuantityText, type FamilySize } from "@/lib/family/servings";
import { MealFeedbackForm } from "@/components/features/feedback/MealFeedbackForm";
import { countCheckedTasks, countTasks, type TodayTaskBinding, type TodayTaskBindings, updateTaskBindings } from "@/lib/realtime/taskState";
import { getSupabaseBrowser } from "@/lib/supabase/client";
import type { PlanMeal } from "@/types/domain";

export function TodayBoard({
  familySize,
  feedbackStatus,
  today,
  initialTaskBindings,
}: {
  familySize: FamilySize;
  feedbackStatus?: string;
  today: PlanMeal;
  initialTaskBindings: TodayTaskBindings;
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
    () => taskBindings.seasoning.map((task) => ({ ...task, text: scaleQuantityText(task.text, familySize) })),
    [familySize, taskBindings.seasoning],
  );

  useEffect(() => {
    const supabase = getSupabaseBrowser();
    if (!supabase || !planEntryFilter) return;
    let cancelled = false;
    const channels = planEntryIds.map((planEntryId) => supabase.channel(`plan-entry:${planEntryId}`, {
      config: { private: true },
    }));

    const receiveTaskChange = (payload: unknown) => {
      const row = getBroadcastRecord(payload);
      if (!row) return;
      setTaskBindings((current) => updateTaskBindings(current, row.stepId, row.checked));
    };

    void supabase.realtime.setAuth().then(() => {
      if (cancelled) return;
      channels.forEach((channel) => {
        channel
          .on("broadcast", { event: "*" }, receiveTaskChange)
          .subscribe((status) => {
            if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
              setError("家族との自動同期が一時停止しています。保存は続けられます。");
            }
          });
      });
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
        <p className="mt-3 text-xs text-kondate-faint">{formatServingLabel(familySize)}・夜 {today.dinner.cookMin}分</p>

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

      <MealBlock
        rule="border-kondate-morningInk"
        title="朝ごはん"
        minutes={today.breakfast.minutes}
        subtitle={today.breakfast.name}
        tasks={taskBindings.breakfast}
        pendingStepIds={pendingStepIds}
        onCheckedChange={updateTask}
      />

      {taskBindings.morning.length > 0 ? <MealBlock
        rule="border-kondate-morningInk"
        title="朝の仕込み"
        minutes={today.dinner.prepMin}
        tasks={taskBindings.morning}
        pendingStepIds={pendingStepIds}
        onCheckedChange={updateTask}
      /> : null}

      {seasoningTasks.length > 0 ? <MealBlock
        rule="border-kondate-eveningInk"
        title="調味料"
        note={formatServingLabel(familySize)}
        tasks={seasoningTasks}
        pendingStepIds={pendingStepIds}
        onCheckedChange={updateTask}
      /> : null}

      <MealBlock
        rule="border-kondate-eveningInk"
        title="夜の手順"
        minutes={today.dinner.cookMin}
        tasks={taskBindings.evening}
        pendingStepIds={pendingStepIds}
        onCheckedChange={updateTask}
      />

      <MealFeedbackForm servedOn={today.date} recipeName={today.dinner.dinner} status={feedbackStatus} />
    </section>
  );
}

function MealBlock({
  rule,
  title,
  minutes,
  note,
  subtitle,
  tasks,
  pendingStepIds,
  onCheckedChange,
}: {
  rule: string;
  title: string;
  minutes?: number;
  note?: string;
  subtitle?: string;
  tasks: TodayTaskBinding[];
  pendingStepIds: Set<string>;
  onCheckedChange: (task: TodayTaskBinding, checked: boolean) => void;
}) {
  return (
    <section className={`border-l-2 pl-4 ${rule}`}>
      <div className="flex items-baseline gap-2">
        <h2 className="text-sm font-semibold">{title}</h2>
        {typeof minutes === "number" ? <span className="text-xs tabular-nums text-kondate-faint">{minutes}分</span> : null}
        {note ? <span className="text-xs text-kondate-faint">{note}</span> : null}
      </div>
      {subtitle ? <p className="mt-0.5 text-sm text-kondate-muted">{subtitle}</p> : null}
      <div className="mt-1.5 divide-y divide-kondate-line">
        {tasks.map((task) => (
          <CheckRow
            key={task.stepId ?? task.text}
            checked={task.checked}
            disabled={task.stepId ? pendingStepIds.has(task.stepId) : false}
            onCheckedChange={(checked) => onCheckedChange(task, checked)}
          >
            {task.text}
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
