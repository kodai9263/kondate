import { officialNutritionRecipes } from "@/lib/nutrition/catalog";
import { databaseRecipeTime, isDinnerCandidate } from "@/lib/nutrition/cookingTime";

export type MenuRow = { id: string; name: string; household_id: string | null; category?: string; cook_minutes: number; servings_base?: number; meta: unknown };
export type MenuItem = { id: string; name: string; minutes: number; kind: "custom" | "community" | "official"; customized: boolean };
export function recipeMeta(value: unknown): Record<string, unknown> { return value && typeof value === "object" ? value as Record<string, unknown> : {}; }
export function menuEntries(rows: MenuRow[], excluded: string[], householdId: string) {
  const hidden = new Set(excluded);
  const own = rows.filter((row) => row.household_id === householdId);
  const customizations = own.filter((row) => recipeMeta(row.meta).step_customization === true);
  const sourceIds = new Set(customizations.map((row) => recipeMeta(row.meta).source_recipe_id));
  const officialKeys = new Set(customizations.map((row) => recipeMeta(row.meta).nutrition_catalog_id));
  const result: MenuItem[] = own.filter((row) => row.category !== "breakfast" && recipeMeta(row.meta).step_customization !== true && isDinnerCandidate(databaseRecipeTime(row)))
    .map((row) => ({ id: row.id, name: row.name, minutes: databaseRecipeTime(row).totalMinutes ?? row.cook_minutes, kind: "custom", customized: false }));
  for (const row of rows) {
    const meta = recipeMeta(row.meta);
    if (row.household_id !== null || meta.visibility !== "community" || hidden.has(String(meta.community_key ?? `community:${row.id}`)) || sourceIds.has(row.id) || !isDinnerCandidate(databaseRecipeTime(row))) continue;
    result.push({ id: row.id, name: row.name, minutes: databaseRecipeTime(row).totalMinutes ?? row.cook_minutes, kind: "community", customized: false });
  }
  for (const recipe of officialNutritionRecipes) {
    if (hidden.has(recipe.id) || officialKeys.has(recipe.id) || !isDinnerCandidate(recipe)) continue;
    result.push({ id: recipe.id, name: recipe.name, minutes: recipe.totalMinutes ?? recipe.cookMinutes, kind: "official", customized: false });
  }
  return result;
}
