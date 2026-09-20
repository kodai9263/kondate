"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getMonthDateRange, isCompleteMonthPlan } from "@/lib/nutrition/month";
import { officialNutritionRecipes } from "@/lib/nutrition/catalog";
import { databaseRecipeTime, isDinnerCandidate } from "@/lib/nutrition/cookingTime";
import { getSupabaseServer } from "@/lib/supabase/server";

const monthlyPlanSchema = z.object({
  year: z.number().int().min(2020).max(2100),
  month: z.number().int().min(1).max(12),
  servings: z.number().int().min(1).max(20),
  entries: z.array(z.object({
    date: z.string().date(),
    recipeId: z.string().uuid(),
    locked: z.boolean(),
    sideMode: z.enum(["default", "none", "custom"]).default("default"),
    sideDishId: z.string().uuid().nullable().default(null),
  }).superRefine((entry, context) => {
    if ((entry.sideMode === "custom") !== Boolean(entry.sideDishId)) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "副菜の指定が正しくありません。" });
    }
  })).min(28).max(31),
});

const sideDishSchema = z.object({
  name: z.string().trim().min(1).max(80),
  ingredientsText: z.string().trim().max(4000),
  stepsText: z.string().trim().max(4000),
});

export async function saveMonthlyDinnerPlan(input: unknown): Promise<{ ok: boolean; message?: string }> {
  const parsed = monthlyPlanSchema.safeParse(input);
  if (!parsed.success || !isCompleteMonthPlan(parsed.data.year, parsed.data.month, parsed.data.entries)) {
    return { ok: false, message: "保存する献立の内容が正しくありません。" };
  }

  const supabase = await getSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "ログイン状態を確認してください。" };

  const { data: profile } = await supabase.from("profiles").select("household_id").eq("id", user.id).maybeSingle();
  if (!profile?.household_id) return { ok: false, message: "家族情報を確認してください。" };

  const recipeIds = [...new Set(parsed.data.entries.map((entry) => entry.recipeId))];
  const sideDishIds = [...new Set(parsed.data.entries.flatMap((entry) => entry.sideDishId ? [entry.sideDishId] : []))];
  const { firstDate, lastDate } = getMonthDateRange(parsed.data.year, parsed.data.month);
  const [{ data: recipes, error: recipeError }, { data: saved, error: savedError }, { data: sideDishes, error: sideDishError }] = await Promise.all([
    supabase.from("recipes").select("id,name,cook_minutes,meta,category,household_id").in("id", recipeIds).is("archived_at", null),
    supabase.from("plan_entries").select("date,recipe_id").eq("household_id", profile.household_id).eq("meal_type", "dinner").gte("date", firstDate).lte("date", lastDate),
    sideDishIds.length > 0
      ? supabase.from("side_dishes").select("id").eq("household_id", profile.household_id).in("id", sideDishIds).is("archived_at", null)
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (recipeError || savedError || sideDishError || recipes?.length !== recipeIds.length || sideDishes?.length !== sideDishIds.length) {
    return { ok: false, message: "保存できないレシピが含まれています。" };
  }

  const candidateIds = new Set(recipes.filter((recipe) => {
    if (recipe.category === "breakfast") return false;
    const meta = recipe.meta && typeof recipe.meta === "object" ? recipe.meta as Record<string, unknown> : {};
    const catalog = recipe.household_id === null && meta.visibility !== "community"
      ? officialNutritionRecipes.find((item) => item.id === meta.nutrition_catalog_id || item.name === recipe.name)
      : undefined;
    return isDinnerCandidate(catalog ?? databaseRecipeTime(recipe));
  }).map((recipe) => recipe.id));
  const savedByDate = new Map((saved ?? []).map((entry) => [entry.date, entry.recipe_id]));
  if (parsed.data.entries.some((entry) => !candidateIds.has(entry.recipeId) && savedByDate.get(entry.date) !== entry.recipeId)) {
    return { ok: false, message: "新しい献立には、完成まで40分以内の料理を選んでください。" };
  }

  const rows = parsed.data.entries.map((entry) => ({
    household_id: profile.household_id,
    date: entry.date,
    meal_type: "dinner",
    recipe_id: entry.recipeId,
    servings: parsed.data.servings,
    status: "planned",
    locked: entry.locked,
    side_mode: entry.sideMode,
    side_dish_id: entry.sideDishId,
  }));
  const { error } = await supabase.from("plan_entries").upsert(rows, { onConflict: "household_id,date,meal_type" });
  if (error) return { ok: false, message: "献立を保存できませんでした。" };

  revalidatePath("/app");
  revalidatePath("/app/planner");
  revalidatePath("/app/shopping");
  return { ok: true };
}

export async function createSideDish(input: unknown): Promise<{ ok: boolean; message?: string; sideDish?: { id: string; name: string; ingredientsText: string; steps: string[] } }> {
  const parsed = sideDishSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "副菜の内容を確認してください。" };

  const supabase = await getSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "ログイン状態を確認してください。" };
  const { data: profile } = await supabase.from("profiles").select("household_id").eq("id", user.id).maybeSingle();
  if (!profile?.household_id) return { ok: false, message: "家族情報を確認してください。" };

  const { data, error } = await supabase.from("side_dishes").insert({
    household_id: profile.household_id,
    name: parsed.data.name,
    ingredients_text: parsed.data.ingredientsText,
    steps_text: parsed.data.stepsText,
  }).select("id,name,ingredients_text,steps_text").single();
  if (error || !data) return { ok: false, message: "副菜を保存できませんでした。" };

  revalidatePath("/app/planner");
  return {
    ok: true,
    sideDish: {
      id: data.id,
      name: data.name,
      ingredientsText: data.ingredients_text,
      steps: data.steps_text.split(/\r?\n/).map((step: string) => step.trim()).filter(Boolean),
    },
  };
}
