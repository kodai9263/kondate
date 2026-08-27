import type { PlanMeal } from "@/types/domain";
import type { TodayTaskBinding, TodayTaskBindings } from "@/lib/realtime/taskState";
import { getSupabaseServer } from "@/lib/supabase/server";

type DailyPlanStep = {
  id: string;
  phase: "morning" | "evening";
  text: string;
  checked: boolean;
};

export type DailyPlanRow = {
  plan_entry_id: string;
  meal_type: "breakfast" | "dinner";
  recipe_name: string;
  prep_minutes: number;
  cook_minutes: number;
  meta: Record<string, unknown> | null;
  steps: DailyPlanStep[] | null;
};

export type TodayPlanState = {
  today: PlanMeal;
  taskBindings: TodayTaskBindings;
};

export async function getTodayPlanState(
  fallbackToday: PlanMeal,
  plannedDinner?: { recipeId: string; servings: number },
): Promise<TodayPlanState> {
  const fallback = {
    today: fallbackToday,
    taskBindings: buildBindings(fallbackToday, []),
  };

  try {
    const supabase = await getSupabaseServer();
    if (plannedDinner) {
      const { data: { user } } = await supabase.auth.getUser();
      const { data: profile } = user
        ? await supabase.from("profiles").select("household_id").eq("id", user.id).maybeSingle()
        : { data: null };
      if (profile?.household_id) {
        await supabase.from("plan_entries").upsert({
          household_id: profile.household_id,
          date: fallbackToday.date,
          meal_type: "dinner",
          recipe_id: plannedDinner.recipeId,
          servings: plannedDinner.servings,
          status: "planned",
        }, { onConflict: "household_id,date,meal_type" });
      }
    }
    const { error: ensureError } = await supabase.rpc("ensure_today_plan", { target_date: fallbackToday.date });
    if (ensureError) return fallback;

    const { data, error } = await supabase
      .from("v_daily_plan")
      .select("plan_entry_id,meal_type,recipe_name,prep_minutes,cook_minutes,meta,steps")
      .eq("date", fallbackToday.date);
    if (error) return fallback;

    const rows = (data ?? []) as DailyPlanRow[];
    const today = mergeTodayPlan(fallbackToday, rows);
    return {
      today,
      taskBindings: buildBindings(today, rows),
    };
  } catch {
    return fallback;
  }
}

export function mergeTodayPlan(fallbackToday: PlanMeal, rows: DailyPlanRow[]): PlanMeal {
  const dinner = rows.find((row) => row.meal_type === "dinner");
  if (!dinner) return fallbackToday;

  const meta = dinner.meta ?? {};
  const morning = getStepTexts(dinner, "morning");
  const evening = getStepTexts(dinner, "evening");
  const ingredients = typeof meta.ingredients_text === "string"
    ? meta.ingredients_text.split("\n").map((item) => item.trim()).filter(Boolean)
    : [];

  return {
    ...fallbackToday,
    dinner: {
      ...fallbackToday.dinner,
      dinner: dinner.recipe_name,
      side: typeof meta.side === "string" ? meta.side : "",
      prepMin: dinner.prep_minutes,
      cookMin: dinner.cook_minutes,
      morning,
      evening,
      seasonings: ingredients,
    },
  };
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

function getStepTexts(row: DailyPlanRow, phase: DailyPlanStep["phase"]): string[] {
  return (row.steps ?? [])
    .filter((step) => step.phase === phase)
    .map((step) => step.text);
}
