import { describe, expect, it } from "vitest";
import { officialNutritionRecipes } from "@/lib/nutrition/catalog";
import { officialRecipeDetails } from "@/lib/nutrition/recipeDetails";
import { standardSideDishes, availableStandardSideDishes } from "@/lib/nutrition/standardSideDishes";
import { restoreStandardSideMetadata, standardSideDishId } from "@/lib/nutrition/standardSideDishStorage";
import { resolveDinnerIngredients, resolveDinnerSteps } from "@/lib/nutrition/sideDish";
import { generateMonthlyDinnerPlan } from "@/lib/nutrition/planner";
import { menuData } from "@/lib/menuData";
import inventory from "../scripts/data/standard-recipe-review-2026-11-14.json";
import drafts from "@/lib/nutrition/reviewedRecipes.json";

describe("出所確認後の標準レシピ", () => {
  it("未確認の旧IDを公開せず、履歴確認済み15品と新規12品だけを使う", () => {
    expect(officialNutritionRecipes).toHaveLength(27);
    expect(officialNutritionRecipes.filter(r => r.id.startsWith("quick-"))).toHaveLength(15);
    const heldKeys = inventory.filter(r => !r.catalog_key?.startsWith("quick-")).map(r => r.catalog_key);
    expect(inventory.filter(r => !r.catalog_key?.startsWith("quick-")).length).toBe(126);
    for (const recipe of officialNutritionRecipes) expect(heldKeys).not.toContain(recipe.id);
    expect(Object.keys(officialRecipeDetails).sort()).toEqual(officialNutritionRecipes.map(r => r.id).sort());
    for (const day of menuData.weeks.flatMap(w => w.days)) expect(officialNutritionRecipes.some(r => r.name === day.dinner)).toBe(true);
  });
  it.each(drafts)("$name: 副菜なしでも新しい主菜の材料と手順を欠落させない", (draft) => {
    const recipe = officialNutritionRecipes.find(r => r.id === `reviewed-${draft.key.toLowerCase()}`)!;
    const day = { date: "2026-11-14", recipe, locked: false, sideMode: "none" as const };
    expect(resolveDinnerIngredients(day)).toBe(draft.ingredients.join("\n"));
    expect(resolveDinnerSteps(day)).toEqual(draft.steps);
    expect(recipe.nutrition).toBeNull();
    expect(recipe.servingsBase).toBe(4);
    expect(recipe.totalMinutes).toBeGreaterThan(0);
  });
  it("全月の献立を生成でき、未確認の旧標準へ戻らない", () => {
    for (let month = 1; month <= 12; month++) {
      const plan = generateMonthlyDinnerPlan({ year: 2026, month, recipes: officialNutritionRecipes });
      expect(plan.length).toBe(new Date(2026, month, 0).getDate());
      for (const day of plan) expect(officialNutritionRecipes.map(r => r.id)).toContain(day.recipe.id);
    }
  });
  it("新しい副菜でアレルギーを判定し、旧副菜は候補へ戻さない", () => {
    expect(standardSideDishes).toHaveLength(6);
    expect(availableStandardSideDishes(["乳"]).map(r => r.key)).not.toContain("reviewed-potato-butter");
    expect(availableStandardSideDishes(["卵"]).map(r => r.key)).not.toContain("reviewed-cabbage-egg");
    expect(availableStandardSideDishes(["大豆"]).map(r => r.key)).not.toContain("reviewed-beans-cucumber");
    expect(standardSideDishes.map(r => r.key)).not.toContain("chilled-tofu");
  });
  it("保存済みの家庭内副菜は本文・名前を変更せず4人分の換算情報を維持する", () => {
    const household = "10000000-0000-4000-8000-000000000001";
    const saved = { id: standardSideDishId(household, "chilled-tofu"), name: "自分で変更した名前", ingredientsText: "自分の材料", steps: ["自分の手順"] };
    expect(restoreStandardSideMetadata(saved, household)).toEqual({ ...saved, standardKey: "chilled-tofu", servingsBase: 4 });
    expect(restoreStandardSideMetadata(saved, "another-household")).toEqual(saved);
  });
});
