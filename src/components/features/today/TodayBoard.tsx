"use client";

import { CalendarDays, ChefHat, Clock, Flame, Wheat } from "lucide-react";
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
    <section className="space-y-4">
      <div className="border-2 border-kondate-ink bg-white p-5"><p className="text-xs font-black text-kondate-accent">今日の夕ごはん</p><p className="font-mincho mt-2 text-2xl font-black">{today.dinner.dinner}</p><p className="mt-2 text-sm text-kondate-muted">{today.dinner.side}</p></div>
      <div className="rounded-lg border border-kondate-line bg-kondate-surface p-4 shadow-soft">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="flex items-center gap-2 text-sm font-bold text-kondate-accent">
              <CalendarDays size={16} />
              今日やること
            </p>
            <h1 className="mt-1 text-2xl font-black">{today.date}</h1>
            <p className="mt-1 text-sm text-kondate-muted">開いて5秒で、次の一手だけを見るための画面です。</p>
          </div>
          <div className="grid size-16 place-items-center rounded-full bg-kondate-accentSoft text-center">
            <span className="text-sm font-black text-kondate-accent">{checkedCount}/{totalTasks}</span>
          </div>
        </div>
      </div>

      {error ? <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm font-bold text-red-800">{error}</p> : null}

      <MealBlock
        icon={<Wheat size={18} />}
        tone="bg-[#fff8df] text-[#8b6508]"
        title={`朝ごはん(${today.breakfast.minutes}分)`}
        subtitle={today.breakfast.name}
        tasks={taskBindings.breakfast}
        pendingStepIds={pendingStepIds}
        onCheckedChange={updateTask}
      />

      {today.dinner.seasonings.length > 0 ? <div className="rounded-lg border border-kondate-line bg-kondate-surface p-4">
        <p className="mb-3 inline-flex items-center gap-2 rounded-full bg-[#f3eefb] px-3 py-1 text-xs font-black text-[#6741d9]">
          <ChefHat size={14} />
          調味料・分量
        </p>
        <p className="mb-3 text-xs font-bold text-kondate-muted">{formatServingLabel(familySize)}</p>
        <div className="space-y-1">
          {taskBindings.seasoning.map((task) => (
            <CheckRow
              key={task.stepId ?? task.text}
              checked={task.checked}
              disabled={!task.stepId || pendingStepIds.has(task.stepId)}
              onCheckedChange={(checked) => updateTask(task, checked)}
            >
              {scaleQuantityText(task.text, familySize)}
            </CheckRow>
          ))}
        </div>
      </div> : null}

      {taskBindings.morning.length > 0 ? <MealBlock
        icon={<Clock size={18} />}
        tone="bg-kondate-morning text-[#8b6508]"
        title={`朝の仕込み(${today.dinner.prepMin}分)`}
        subtitle={today.dinner.dinner}
        tasks={taskBindings.morning}
        pendingStepIds={pendingStepIds}
        onCheckedChange={updateTask}
      /> : null}

      <MealBlock
        icon={<Flame size={18} />}
        tone="bg-kondate-evening text-[#3155a4]"
        title={`夜の手順(${today.dinner.cookMin}分)`}
        subtitle={`${today.dinner.dinner} / ${today.dinner.side}`}
        tasks={taskBindings.evening}
        pendingStepIds={pendingStepIds}
        onCheckedChange={updateTask}
      />

      <MealFeedbackForm servedOn={today.date} recipeName={today.dinner.dinner} status={feedbackStatus} />
    </section>
  );
}

function MealBlock({
  icon,
  tone,
  title,
  subtitle,
  tasks,
  pendingStepIds,
  onCheckedChange,
}: {
  icon: React.ReactNode;
  tone: string;
  title: string;
  subtitle: string;
  tasks: TodayTaskBinding[];
  pendingStepIds: Set<string>;
  onCheckedChange: (task: TodayTaskBinding, checked: boolean) => void;
}) {
  return (
    <section className="rounded-lg border border-kondate-line bg-kondate-surface p-4">
      <p className={`mb-1 inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-black ${tone}`}>
        {icon}
        {title}
      </p>
      <h2 className="mb-3 text-lg font-black leading-snug">{subtitle}</h2>
      <div className="space-y-1">
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
