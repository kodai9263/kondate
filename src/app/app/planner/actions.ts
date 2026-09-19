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
  })).min(28).max(31),
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
  const { firstDate, lastDate } = getMonthDateRange(parsed.data.year, parsed.data.month);
  const [{ data: recipes, error: recipeError }, { data: saved, error: savedError }] = await Promise.all([
    supabase.from("recipes").select("id,name,cook_minutes,meta,category,household_id").in("id", recipeIds).is("archived_at", null),
    supabase.from("plan_entries").select("date,recipe_id").eq("household_id", profile.household_id).eq("meal_type", "dinner").gte("date", firstDate).lte("date", lastDate),
  ]);
  if (recipeError || savedError || recipes?.length !== recipeIds.length) {
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
  }));
  const { error } = await supabase.from("plan_entries").upsert(rows, { onConflict: "household_id,date,meal_type" });
  if (error) return { ok: false, message: "献立を保存できませんでした。" };

  revalidatePath("/app");
  revalidatePath("/app/planner");
  revalidatePath("/app/shopping");
  return { ok: true };
}
