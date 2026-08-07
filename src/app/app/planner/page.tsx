import { MonthlyPlanner } from "@/components/features/planner/MonthlyPlanner";
import { officialNutritionRecipes } from "@/lib/nutrition/catalog";
import { getSupabaseServer } from "@/lib/supabase/server";
import { filterRecipesForAllergies } from "@/lib/family/allergies";
import { getCurrentHouseholdPreferences } from "@/lib/family/server";
import type { NutritionRecipe, ProteinSource } from "@/types/nutrition";

export default async function PlannerPage() {
  const now = new Date();
  const preferences = await getCurrentHouseholdPreferences();
  const supabase = await getSupabaseServer();
  const [{ data: rows }, { data: feedbackRows }] = await Promise.all([
    supabase.from("recipes").select("id,name,cook_minutes,image_url,protein_source,meta,recipe_nutrition(energy_kcal,protein_g,fat_g,carbs_g,fiber_g,salt_g,vegetables_g)").not("household_id", "is", null),
    supabase.from("meal_preferences").select("recipe_name,rating,updated_at").order("updated_at", { ascending: false }).limit(500),
  ]);
  const custom = (rows ?? []).flatMap((row: Record<string, unknown>) => mapCustomRecipe(row));
  const recipes = [...officialNutritionRecipes, ...custom];
  const filtered = filterRecipesForAllergies(recipes, preferences.allergies);
  const latestRatings = new Map<string, string>();
  for (const row of feedbackRows ?? []) {
    if (!latestRatings.has(row.recipe_name)) latestRatings.set(row.recipe_name, row.rating);
  }
  const preferenceAllowed = filtered.allowed.filter((recipe) => latestRatings.get(recipe.name) !== "avoid");
  const availableRecipes = preferenceAllowed.length > 0 ? preferenceAllowed : filtered.allowed;
  const preferredRecipeIds = availableRecipes.filter((recipe) => latestRatings.get(recipe.name) === "love").map((recipe) => recipe.id);
  const preferenceExcludedCount = filtered.allowed.length - availableRecipes.length;
  return <MonthlyPlanner recipes={availableRecipes} initialYear={now.getFullYear()} initialMonth={now.getMonth() + 1} familySize={preferences} allergies={preferences.allergies} excludedRecipeCount={filtered.excluded.length} preferredRecipeIds={preferredRecipeIds} preferenceExcludedCount={preferenceExcludedCount} />;
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
      energyKcal: Number(nutrition.energy_kcal), proteinG: Number(nutrition.protein_g), fatG: Number(nutrition.fat_g), carbsG: Number(nutrition.carbs_g),
      fiberG: Number(nutrition.fiber_g), saltG: Number(nutrition.salt_g), vegetablesG: Number(nutrition.vegetables_g),
    },
    ingredientsText: typeof meta.ingredients_text === "string" ? meta.ingredients_text : undefined,
    isCustom: true,
  }];
}
