import { describe, expect, it } from "vitest";
import { officialNutritionRecipes } from "@/lib/nutrition/catalog";
import { resolvePlannerPeriod, updatePlannerDay } from "@/lib/nutrition/periodPlan";
import { toSavedDinnerEntries } from "@/lib/nutrition/month";
import { buildPlannedShopping } from "@/lib/shopping/build";
import type { BreakfastVersion } from "@/lib/breakfast/settings";

const date = "2026-10-12";
const context = { recipes: officialNutritionRecipes, preferredRecipeIds: [], initialRecipeIds: {}, initialLockedRecipeIds: {} };
describe("夕食を作らない日", () => {
  it("月間・週間・再生成で維持し、戻すと同じ料理になる", () => {
    const plan = resolvePlannerPeriod("month", date, context);
    const original = plan.find((day) => day.date === date)!;
    const skipped = updatePlannerDay(plan, date, { skipped: true });
    const entries = toSavedDinnerEntries(skipped.entries);
    const saved = { ...context, initialRecipeIds: Object.fromEntries(entries.map((entry) => [entry.date, entry.recipeId])), initialSkippedDates: [date] };
    const reloaded = resolvePlannerPeriod("week", date, saved);
    expect(reloaded.find((day) => day.date === date)).toMatchObject({ recipe: original.recipe, skipped: true });
    expect(resolvePlannerPeriod("month", date, saved)).toEqual(skipped.entries);
    const restored = updatePlannerDay(reloaded, date, { skipped: false });
    expect(toSavedDinnerEntries(restored.entries).find((entry) => entry.date === date)).toEqual({ date, recipeId: original.recipe.id, locked: original.locked, sideMode: "default", sideDishId: null });
    expect(skipped.entries.filter((day) => day.date !== date)).toEqual(plan.filter((day) => day.date !== date));
  });
  it("固定と自作副菜を作らない日の切替でも維持する", () => {
    const side = { id: "side", name: "冷ややっこ", ingredientsText: "豆腐 150g", steps: ["盛りつける"] };
    const plan = resolvePlannerPeriod("month", date, { ...context, sideDishes: [side], initialSideSelections: { [date]: { mode: "custom", sideDishId: side.id } }, initialLockedRecipeIds: { [date]: officialNutritionRecipes[0].id } });
    const skipped = updatePlannerDay(plan, date, { skipped: true });
    const saved = toSavedDinnerEntries(skipped.entries).find((entry) => entry.date === date)!;
    expect(saved).toMatchObject({ skipped: true, locked: true, sideMode: "custom", sideDishId: side.id });
    const restored = updatePlannerDay(skipped.entries, date, { skipped: false });
    expect(restored.entries.find((day) => day.date === date)?.sideDish).toEqual(side);
  });
  it("主菜・副菜の材料を除外し、未設定の警告を出さず朝食は残す", () => {
    const breakfast: BreakfastVersion = { revision: "test", effective_date: "2026-01-01", rotation_start: "2026-01-01", legacy_rotation: false, enabled: true,
      items: [{ id: "test", name: "朝食", sourceKey: null, tasks: [], minutes: null, shoppingItems: ["牛乳 200ml"] }] };
    const recipe = { ...officialNutritionRecipes[0], ingredientsText: "鶏もも肉 300g\n大根 100g", servingsBase: 4, isCustom: true };
    const result = buildPlannedShopping({ start: date, end: date, dinners: [{ date, recipe, locked: false, skipped: true }], breakfastVersions: [breakfast], servings: 4 });
    expect(result.warnings).toEqual([]);
    expect(result.meals[0]).toMatchObject({ dinner: "作らない日", breakfast: "朝食" });
    expect(result.groups.flatMap((group) => group.items.map((item) => item.label))).toEqual(["牛乳 200ml"]);
    const restored = buildPlannedShopping({ start: date, end: date, dinners: [{ date, recipe, locked: false }], breakfastVersions: [], servings: 4 });
    expect(restored.groups.flatMap((group) => group.items)).toHaveLength(2);
  });
});
