import { z } from "zod";
import { revalidatePath } from "next/cache";
import { getFirstWeekAccess } from "@/lib/billing/firstWeek.server";
import { getSupabaseServer } from "@/lib/supabase/server";
import { getMonthDateRange, isCompleteMonthPlan } from "./month";
import { officialNutritionRecipes } from "./catalog";
import { databaseRecipeTime, isManualDinnerCandidate } from "./cookingTime";

export const monthlyPlanSchema = z.object({
  year: z.number().int().min(2020).max(2100),
  month: z.number().int().min(1).max(12),
  servings: z.number().int().min(1).max(20),
  entries: z.array(z.object({
    date: z.string().date(),
    recipeId: z.string().uuid(),
    locked: z.boolean(),
    skipped: z.boolean().optional(),
    sideMode: z.enum(["default", "none", "custom"]).default("default"),
    sideDishId: z.string().uuid().nullable().default(null),
  }).superRefine((entry, context) => {
    if ((entry.sideMode === "custom") !== Boolean(entry.sideDishId)) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "副菜の指定が正しくありません。" });
    }
  })).min(28).max(31),
});

export async function saveMonthlyDinnerPlanForClient(input: unknown, client?: Awaited<ReturnType<typeof getSupabaseServer>>, accessToken?: string): Promise<{ ok: boolean; message?: string }> {
  const parsed = monthlyPlanSchema.safeParse(input);
  if (!parsed.success || !isCompleteMonthPlan(parsed.data.year, parsed.data.month, parsed.data.entries)) {
    return { ok: false, message: "保存する献立の内容が正しくありません。" };
  }

  const access = await getFirstWeekAccess(client, accessToken);
  if (!access.canPlan || (!access.paid && !access.trial)) return { ok: false, message: "無料体験が終了しました。継続利用には家族プランが必要です。" };
  const supabase = client ?? await getSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser(accessToken);
  if (!user) return { ok: false, message: "ログイン状態を確認してください。" };

  const { data: profile } = await supabase.from("profiles").select("household_id").eq("id", user.id).maybeSingle();
  if (!profile?.household_id) return { ok: false, message: "家族情報を確認してください。" };

  const recipeIds = [...new Set(parsed.data.entries.map((entry) => entry.recipeId))];
  const sideDishIds = [...new Set(parsed.data.entries.flatMap((entry) => entry.sideDishId ? [entry.sideDishId] : []))];
  const { firstDate, lastDate } = getMonthDateRange(parsed.data.year, parsed.data.month);
  const [{ data: recipes, error: recipeError }, { data: saved, error: savedError }, { data: sideDishes, error: sideDishError }] = await Promise.all([
    supabase.from("recipes").select("id,name,cook_minutes,meta,category,household_id,archived_at").in("id", recipeIds),
    supabase.from("plan_entries").select("date,recipe_id").eq("household_id", profile.household_id).eq("meal_type", "dinner").gte("date", firstDate).lte("date", lastDate),
    sideDishIds.length > 0
      ? supabase.from("side_dishes").select("id").eq("household_id", profile.household_id).in("id", sideDishIds).is("archived_at", null)
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (recipeError || savedError || sideDishError || recipes?.length !== recipeIds.length || sideDishes?.length !== sideDishIds.length) {
    return { ok: false, message: "保存できないレシピが含まれています。" };
  }

  const candidateIds = new Set(recipes.filter((recipe) => {
    if (recipe.category === "breakfast" || recipe.archived_at) return false;
    const meta = recipe.meta && typeof recipe.meta === "object" ? recipe.meta as Record<string, unknown> : {};
    const catalog = recipe.household_id === null && meta.visibility !== "community"
      ? officialNutritionRecipes.find((item) => item.id === meta.nutrition_catalog_id || item.name === recipe.name)
      : undefined;
    return isManualDinnerCandidate(catalog ?? databaseRecipeTime(recipe));
  }).map((recipe) => recipe.id));
  const savedByDate = new Map((saved ?? []).map((entry) => [entry.date, entry.recipe_id]));
  if (parsed.data.entries.some((entry) => !candidateIds.has(entry.recipeId) && savedByDate.get(entry.date) !== entry.recipeId)) {
    return { ok: false, message: "選択できない料理が含まれています。最新の献立を確認してください。" };
  }

  const rows = parsed.data.entries.map((entry) => ({
    household_id: profile.household_id,
    date: entry.date,
    meal_type: "dinner",
    recipe_id: entry.recipeId,
    servings: parsed.data.servings,
    status: entry.skipped ? "skipped" : "planned",
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

