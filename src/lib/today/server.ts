import type { PlanMeal } from "@/types/domain";
import type { TodayTaskBinding, TodayTaskBindings } from "@/lib/realtime/taskState";
import { getSupabaseServer } from "@/lib/supabase/server";

type DailyPlanStep = {
  id: string;
  phase: "morning" | "evening";
  text: string;
  checked: boolean;
};

type DailyPlanRow = {
  plan_entry_id: string;
  meal_type: "breakfast" | "dinner";
  steps: DailyPlanStep[] | null;
};

export async function getTodayTaskBindings(today: PlanMeal): Promise<TodayTaskBindings> {
  const fallback = buildBindings(today, []);

  try {
    const supabase = await getSupabaseServer();
    const { error: ensureError } = await supabase.rpc("ensure_today_plan", { target_date: today.date });
    if (ensureError) return fallback;

    const { data, error } = await supabase
      .from("v_daily_plan")
      .select("plan_entry_id,meal_type,steps")
      .eq("date", today.date);
    if (error) return fallback;

    return buildBindings(today, (data ?? []) as DailyPlanRow[]);
  } catch {
    return fallback;
  }
}

function buildBindings(today: PlanMeal, rows: DailyPlanRow[]): TodayTaskBindings {
  const breakfast = rows.find((row) => row.meal_type === "breakfast");
  const dinner = rows.find((row) => row.meal_type === "dinner");

  return {
    breakfast: bindTasks(today.breakfast.tasks, breakfast, "morning"),
    morning: bindTasks(today.dinner.morning, dinner, "morning"),
    evening: bindTasks(today.dinner.evening, dinner, "evening"),
  };
}

function bindTasks(texts: string[], row: DailyPlanRow | undefined, phase: DailyPlanStep["phase"]): TodayTaskBinding[] {
  const steps = (row?.steps ?? []).filter((step) => step.phase === phase);
  return texts.map((text) => {
    const step = steps.find((candidate) => candidate.text === text);
    return {
      planEntryId: step ? row?.plan_entry_id ?? null : null,
      stepId: step?.id ?? null,
      text,
      checked: step?.checked ?? false,
    };
  });
}
