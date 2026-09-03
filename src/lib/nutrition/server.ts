import { filterRecipesForAllergies } from "@/lib/family/allergies";
import { getCurrentHouseholdPreferences } from "@/lib/family/server";
import { officialNutritionRecipes } from "@/lib/nutrition/catalog";
import { getMonthDateRange } from "@/lib/nutrition/month";
import { getSupabaseServer } from "@/lib/supabase/server";
import type { NutritionRecipe, ProteinSource } from "@/types/nutrition";

export async function getHouseholdPlannerContext(year: number, month: number) {
  const { firstDate, lastDate } = getMonthDateRange(year, month);
  const preferences = await getCurrentHouseholdPreferences();
  const supabase = await getSupabaseServer();
  const [{ data: rows }, { data: officialRows }, { data: feedbackRows }, { data: savedRows }] = await Promise.all([
    supabase.from("recipes").select("id,name,cook_minutes,image_url,protein_source,meta,recipe_nutrition(energy_kcal,protein_g,fat_g,carbs_g,fiber_g,salt_g,vegetables_g)").not("household_id", "is", null).is("archived_at", null),
    supabase.from("recipes").select("id,name,meta").is("household_id", null),
    supabase.from("meal_preferences").select("recipe_name,rating,updated_at").order("updated_at", { ascending: false }).limit(500),
    supabase.from("plan_entries").select("date,recipe_id,locked").eq("meal_type", "dinner").gte("date", firstDate).lte("date", lastDate),
  ]);

  const custom = (rows ?? []).flatMap((row: Record<string, unknown>) => mapCustomRecipe(row));
  const officialIdsByKey = new Map<string, string>();
  const officialIdsByName = new Map<string, string>();
  for (const row of officialRows ?? []) {
    const meta = row.meta && typeof row.meta === "object" ? row.meta as Record<string, unknown> : {};
    if (typeof meta.nutrition_catalog_id === "string") officialIdsByKey.set(meta.nutrition_catalog_id, row.id);
    officialIdsByName.set(row.name, row.id);
  }

  const official = officialNutritionRecipes.flatMap((recipe) => {
    const databaseId = officialIdsByKey.get(recipe.id) ?? officialIdsByName.get(recipe.name);
    return databaseId ? [{ ...recipe, id: databaseId }] : [];
  });
  const filtered = filterRecipesForAllergies([...official, ...custom], preferences.allergies);
  const latestRatings = new Map<string, string>();
  for (const row of feedbackRows ?? []) {
    if (!latestRatings.has(row.recipe_name)) latestRatings.set(row.recipe_name, row.rating);
  }

  const preferenceAllowed = filtered.allowed.filter((recipe) => latestRatings.get(recipe.name) !== "avoid");
  const recipes = preferenceAllowed.length > 0 ? preferenceAllowed : filtered.allowed;
  const preferredRecipeIds = recipes.filter((recipe) => latestRatings.get(recipe.name) === "love").map((recipe) => recipe.id);
  const availableRecipeIds = new Set(recipes.map((recipe) => recipe.id));
  const initialRecipeIds: Record<string, string> = {};
  const initialLockedRecipeIds: Record<string, string> = {};
  for (const row of savedRows ?? []) {
    if (!availableRecipeIds.has(row.recipe_id)) continue;
    initialRecipeIds[row.date] = row.recipe_id;
    if (row.locked) initialLockedRecipeIds[row.date] = row.recipe_id;
  }

  return {
    preferences,
    recipes,
    preferredRecipeIds,
    initialRecipeIds,
    initialLockedRecipeIds,
    excludedRecipeCount: filtered.excluded.length,
    preferenceExcludedCount: filtered.allowed.length - recipes.length,
  };
}

function mapCustomRecipe(row: Record<string, unknown>): NutritionRecipe[] {
  const nutritionValue = Array.isArray(row.recipe_nutrition) ? row.recipe_nutrition[0] : row.recipe_nutrition;
  if (!nutritionValue || typeof nutritionValue !== "object") return [];
  const nutrition = nutritionValue as Record<string, number>;
  const meta = row.meta && typeof row.meta === "object" ? row.meta as Record<string, unknown> : {};
  return [{
    id: String(row.id),
    name: String(row.name),
    side: typeof meta.side === "string" ? meta.side : "わが家の副菜",
    cookMinutes: Number(row.cook_minutes ?? 0),
    proteinSource: String(row.protein_source ?? "meat") as ProteinSource,
    imageUrl: typeof row.image_url === "string" ? row.image_url : "/images/family-dinner.png",
    nutrition: {
      energyKcal: Number(nutrition.energy_kcal),
      proteinG: Number(nutrition.protein_g),
      fatG: Number(nutrition.fat_g),
      carbsG: Number(nutrition.carbs_g),
      fiberG: Number(nutrition.fiber_g),
      saltG: Number(nutrition.salt_g),
      vegetablesG: Number(nutrition.vegetables_g),
    },
    ingredientsText: typeof meta.ingredients_text === "string" ? meta.ingredients_text : undefined,
    isCustom: true,
  }];
}
