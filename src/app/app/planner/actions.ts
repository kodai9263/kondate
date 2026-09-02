"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { isCompleteMonthPlan } from "@/lib/nutrition/month";
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
  const { data: recipes, error: recipeError } = await supabase.from("recipes").select("id").in("id", recipeIds).is("archived_at", null);
  if (recipeError || recipes?.length !== recipeIds.length) {
    return { ok: false, message: "保存できないレシピが含まれています。" };
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
  return { ok: true };
}
