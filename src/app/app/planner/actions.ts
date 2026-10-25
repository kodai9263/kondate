"use server";

import { filterRecipesForAllergies } from "@/lib/family/allergies";
import { getCurrentHouseholdPreferences } from "@/lib/family/server";
import { getFirstWeekAccess } from "@/lib/billing/firstWeek.server";
import { isCompleteFirstWeek } from "@/lib/billing/firstWeek";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { monthlyPlanSchema, saveMonthlyDinnerPlanForClient } from "@/lib/nutrition/savePlan.server";
import { officialNutritionRecipes } from "@/lib/nutrition/catalog";
import { databaseRecipeTime, isDinnerCandidate } from "@/lib/nutrition/cookingTime";
import { getSupabaseServer } from "@/lib/supabase/server";
import { availableStandardSideDishes, standardSideDishes } from "@/lib/nutrition/standardSideDishes";
import { restoreStandardSideMetadata, standardSideDishId } from "@/lib/nutrition/standardSideDishStorage";
import { normalizeAllergies } from "@/lib/family/allergies";
import type { SideDish } from "@/types/nutrition";

const sideDishSchema = z.object({
  name: z.string().trim().min(1).max(80),
  ingredientsText: z.string().trim().max(4000),
  stepsText: z.string().trim().max(4000),
});

export async function saveMonthlyDinnerPlan(input: unknown): Promise<{ ok: boolean; message?: string }> {
  return saveMonthlyDinnerPlanForClient(input);
}

const firstWeekSchema = z.object({
  servings: z.number().int().min(1).max(20),
  entries: z.array(monthlyPlanSchema.shape.entries.element).length(7),
});

export async function saveFirstWeekPlan(input: unknown): Promise<{ ok: boolean; message?: string }> {
  const parsed = firstWeekSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "献立の内容を確認してください。" };
  const access = await getFirstWeekAccess();
  if (!access.canPlan || !access.trial || !isCompleteFirstWeek(parsed.data.entries.map((entry) => entry.date).sort()[0], parsed.data.entries)) return { ok: false, message: "利用期間と7日分の献立を確認してください。" };
  const ids = [...new Set(parsed.data.entries.map((entry) => entry.recipeId))];
  const { data: recipes, error: recipeError } = await access.supabase.from("recipes").select("id,name,cook_minutes,meta,category,household_id").in("id", ids).is("archived_at", null);
  if (recipeError || recipes?.length !== ids.length || recipes.some((recipe) => {
    if (recipe.category === "breakfast") return true;
    const meta = recipe.meta && typeof recipe.meta === "object" ? recipe.meta as Record<string, unknown> : {};
    const official = recipe.household_id === null && meta.visibility !== "community" ? officialNutritionRecipes.find((item) => item.id === meta.nutrition_catalog_id || item.name === recipe.name) : undefined;
    return !isDinnerCandidate(official ?? databaseRecipeTime(recipe));
  })) return { ok: false, message: "40分以内の夕食メニューを選んでください。" };
  const sideIds = [...new Set(parsed.data.entries.flatMap((entry) => entry.sideDishId ? [entry.sideDishId] : []))];
  const { data: sides, error: sideError } = sideIds.length ? await access.supabase.from("side_dishes").select("id,name,ingredients_text").eq("household_id", access.householdId).in("id", sideIds).is("archived_at", null) : { data: [], error: null };
  if (sideError || sides?.length !== sideIds.length) return { ok: false, message: "副菜の内容を確認してください。" };
  const preferences = await getCurrentHouseholdPreferences(true);
  if (filterRecipesForAllergies((sides ?? []).map((side) => ({ name: side.name, ingredientsText: side.ingredients_text })), preferences.allergies).excluded.length) return { ok: false, message: "副菜のアレルギー条件を確認してください。" };
  const allergyTargets = recipes.map((recipe) => {
    const meta = recipe.meta && typeof recipe.meta === "object" ? recipe.meta as Record<string, unknown> : {};
    return { name: recipe.name, side: typeof meta.side === "string" ? meta.side : "", ingredientsText: typeof meta.ingredients_text === "string" ? meta.ingredients_text : "" };
  });
  if (filterRecipesForAllergies(allergyTargets, preferences.allergies).excluded.length) return { ok: false, message: "アレルギー条件を確認し、別の料理を選んでください。" };
  const { error } = await access.supabase.rpc("save_first_week", { entries: parsed.data.entries, servings_input: parsed.data.servings });
  if (error) return { ok: false, message: "献立を保存できませんでした。" };
  revalidatePath("/app"); revalidatePath("/app/planner"); revalidatePath("/app/shopping");
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

export async function createStandardSideDish(key: unknown): Promise<{ ok: boolean; message?: string; sideDish?: SideDish }> {
  const standard = standardSideDishes.find((dish) => dish.key === key);
  if (!standard) return { ok: false, message: "副菜を選び直してください。" };

  const supabase = await getSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "ログイン状態を確認してください。" };
  const { data: profile, error: profileError } = await supabase.from("profiles").select("household_id").eq("id", user.id).maybeSingle();
  if (profileError || !profile?.household_id) return { ok: false, message: "家族情報を確認してください。" };
  const { data: settings, error: settingsError } = await supabase.from("household_settings").select("allergies").eq("household_id", profile.household_id).maybeSingle();
  if (settingsError) return { ok: false, message: "アレルギー設定を確認できませんでした。もう一度お試しください。" };
  if (!availableStandardSideDishes(normalizeAllergies(settings?.allergies)).some((dish) => dish.key === key)) {
    return { ok: false, message: "登録したアレルギーに該当する副菜です。別の副菜を選んでください。" };
  }

  const id = standardSideDishId(profile.household_id, standard.key);
  const { error } = await supabase.from("side_dishes").upsert({
    id, household_id: profile.household_id, name: standard.name,
    ingredients_text: standard.ingredientsText, steps_text: standard.steps.join("\n"),
  }, { onConflict: "id", ignoreDuplicates: true });
  if (error) return { ok: false, message: "副菜を保存できませんでした。" };
  // 保存済みの材料・手順を使い、レシピ更新や再選択で過去の献立を書き換えない。
  const { data, error: readError } = await supabase.from("side_dishes")
    .select("id,name,ingredients_text,steps_text").eq("id", id).eq("household_id", profile.household_id).is("archived_at", null).maybeSingle();
  if (readError || !data) return { ok: false, message: "副菜を読み込めませんでした。別の副菜を選んでください。" };
  revalidatePath("/app/planner");
  return { ok: true, sideDish: restoreStandardSideMetadata({
    id: data.id, name: data.name, ingredientsText: data.ingredients_text,
    steps: data.steps_text.split(/\r?\n/).map((step: string) => step.trim()).filter(Boolean),
  }, profile.household_id) };
}
