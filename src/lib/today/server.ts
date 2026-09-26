import { restoreStandardSideMetadata } from "@/lib/nutrition/standardSideDishStorage";
import type { PlanMeal } from "@/types/domain";
import type { TodayTaskBinding, TodayTaskBindings } from "@/lib/realtime/taskState";
import { getSupabaseServer } from "@/lib/supabase/server";
import { removeDefaultSideSteps, replaceSideIngredients, resolveCustomSideSteps } from "@/lib/nutrition/sideDish";

type DailyPlanStep = {
  id: string;
  phase: "morning" | "seasoning" | "evening";
  text: string;
  checked: boolean;
};

export type DailyPlanRow = {
  household_id?: string;
  plan_entry_id: string;
  meal_type: "breakfast" | "dinner";
  recipe_name: string;
  prep_minutes: number;
  cook_minutes: number;
  meta: Record<string, unknown> | null;
  steps: DailyPlanStep[] | null;
  side_mode?: "default" | "none" | "custom";
  side_dish?: { id: string; name: string; ingredients_text: string; steps_text: string } | null;
};

export type TodayPlanState = {
  today: PlanMeal;
  taskBindings: TodayTaskBindings;
  loadError?: boolean;
};

export async function getTodayPlanState(
  fallbackToday: PlanMeal,
  plannedDinner?: { recipeId: string; servings: number },
): Promise<TodayPlanState> {
  const fallback = {
    today: fallbackToday,
    taskBindings: buildTodayTaskBindings(fallbackToday, []),
    loadError: true,
  };

  try {
    const supabase = await getSupabaseServer();
    if (plannedDinner) {
      const { data: { user } } = await supabase.auth.getUser();
      const { data: profile } = user
        ? await supabase.from("profiles").select("household_id").eq("id", user.id).maybeSingle()
        : { data: null };
      if (!profile?.household_id) return fallback;
      const { error: saveError } = await supabase.from("plan_entries").upsert({
        household_id: profile.household_id,
        date: fallbackToday.date,
        meal_type: "dinner",
        recipe_id: plannedDinner.recipeId,
        servings: plannedDinner.servings,
        status: "planned",
      }, { onConflict: "household_id,date,meal_type" });
      if (saveError) return fallback;
    }
    // 夕食が未設定でも朝食を確定する。夕食の固定テンプレートは補充しない。
    const { error: ensureError } = await supabase.rpc("ensure_today_breakfast", { target_date: fallbackToday.date });
    if (ensureError) return fallback;

    const { data, error } = await supabase
      .from("v_daily_plan")
      .select("plan_entry_id,household_id,meal_type,recipe_name,prep_minutes,cook_minutes,meta,steps,side_mode,side_dish")
      .eq("date", fallbackToday.date);
    if (error) return fallback;

    const rows = ((data ?? []) as DailyPlanRow[]).filter((row) => plannedDinner || row.meal_type === "breakfast");
    const today = mergeTodayPlan(fallbackToday, rows);
    return {
      today,
      taskBindings: buildTodayTaskBindings(today, rows),
    };
  } catch {
    return fallback;
  }
}

export function mergeTodayPlan(fallbackToday: PlanMeal, rows: DailyPlanRow[]): PlanMeal {
  const breakfast = rows.find((row) => row.meal_type === "breakfast");
  if (breakfast) fallbackToday = { ...fallbackToday, breakfast: {
    name: breakfast.recipe_name,
    minutes: breakfast.meta?.breakfast_snapshot === true && breakfast.meta.minutes === null ? undefined : breakfast.cook_minutes,
    tasks: getStepTexts(breakfast, "morning"),
  } };
  const dinner = rows.find((row) => row.meal_type === "dinner");
  if (!dinner) return fallbackToday;

  const meta = dinner.meta ?? {};
  const morning = getStepTexts(dinner, "morning");
  const defaultEvening = getStepTexts(dinner, "evening");
  const seasoningSteps = getStepTexts(dinner, "seasoning");
  const defaultIngredients = seasoningSteps.length > 0 ? seasoningSteps : typeof meta.ingredients_text === "string"
    ? meta.ingredients_text.split("\n").map((item) => item.trim()).filter(Boolean)
    : [];
  const sideMode = dinner.side_mode ?? "default";
  const selectedSide = dinner.side_dish ? restoreStandardSideMetadata({
    id: dinner.side_dish.id, name: dinner.side_dish.name,
    ingredientsText: dinner.side_dish.ingredients_text,
    steps: dinner.side_dish.steps_text.split(/\r?\n/).map((step) => step.trim()).filter(Boolean),
  }, dinner.household_id) : null;
  const evening = sideMode === "default" ? defaultEvening : removeDefaultSideSteps(
    defaultEvening,
    defaultIngredients.join("\n"),
    typeof meta.side === "string" ? meta.side : "",
  );
  const ingredients = sideMode === "default" ? defaultIngredients : replaceSideIngredients(
    defaultIngredients.join("\n"),
    typeof meta.side === "string" ? meta.side : "",
    sideMode,
    selectedSide,
  )?.split("\n") ?? [];

  return {
    ...fallbackToday,
    dinner: {
      ...fallbackToday.dinner,
      dinner: dinner.recipe_name,
      side: dinner.side_mode === "none" ? "副菜なし" : dinner.side_mode === "custom" && dinner.side_dish
        ? dinner.side_dish.name : typeof meta.side === "string" ? meta.side : "",
      prepMin: dinner.prep_minutes,
      cookMin: dinner.cook_minutes,
      ...(meta.step_customization !== true && typeof meta.total_minutes === "number" ? { totalMin: meta.total_minutes } : {}),
      ...(Array.isArray(meta.recipe_notes) ? { recipeNotes: meta.recipe_notes.filter((note): note is string => typeof note === "string") } : {}),
      ...(typeof meta.servings_base === "number" ? { servingsBase: meta.servings_base } : {}),
      ingredientsScalable: meta.recipe_detail_version === 2 && meta.step_customization !== true,
      morning,
      evening,
      seasonings: ingredients,
      sideSteps: sideMode === "custom" ? resolveCustomSideSteps(selectedSide) : undefined,
      sideServingsBase: sideMode === "custom" ? selectedSide?.servingsBase : undefined,
    },
  };
}

export function buildTodayTaskBindings(today: PlanMeal, rows: DailyPlanRow[]): TodayTaskBindings {
  const breakfast = rows.find((row) => row.meal_type === "breakfast");
  const dinner = rows.find((row) => row.meal_type === "dinner");

  return {
    breakfast: bindTasks(today.breakfast?.tasks ?? [], breakfast, "morning"),
    seasoning: bindTasks(today.dinner.seasonings, dinner, "seasoning"),
    morning: bindTasks(today.dinner.morning, dinner, "morning"),
    evening: bindTasks(today.dinner.evening, dinner, "evening"),
  };
}

function bindTasks(texts: string[], row: DailyPlanRow | undefined, phase: DailyPlanStep["phase"]): TodayTaskBinding[] {
  const steps = (row?.steps ?? []).filter((step) => step.phase === phase);
  const sideChanged = row?.side_mode && row.side_mode !== "default";
  const ingredients = (row ? getStepTexts(row, "seasoning").join("\n") : "") || (typeof row?.meta?.ingredients_text === "string" ? row.meta.ingredients_text : "");
  const sideName = typeof row?.meta?.side === "string" ? row.meta.side : "";
  const candidates = steps.map((step) => ({
    step,
    text: sideChanged && phase === "evening" ? removeDefaultSideSteps([step.text], ingredients, sideName)[0]
      : sideChanged && phase === "seasoning" ? replaceSideIngredients(step.text, sideName, "none", null)
      : step.text,
  }));
  const boundIds = new Set<string>();
  return texts.map((text) => {
    // 副菜を除いた後の表示順ではなく、元の保存済み工程IDへ結び付ける。
    const step = candidates.find((candidate) => candidate.text === text && !boundIds.has(candidate.step.id))?.step;
    if (step) boundIds.add(step.id);
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
