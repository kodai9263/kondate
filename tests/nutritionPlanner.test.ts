import { describe, expect, it } from "vitest";
import { officialNutritionRecipes } from "@/lib/nutrition/catalog";
import { generateMonthlyDinnerPlan, isRecipeInSeason, rankAlternativeRecipes, summarizeNutrition } from "@/lib/nutrition/planner";

describe("generateMonthlyDinnerPlan", () => {
  it("公式メニューを78品持ち、旬月が正しい範囲にある", () => {
    expect(officialNutritionRecipes).toHaveLength(78);
    expect(new Set(officialNutritionRecipes.map((recipe) => recipe.id)).size).toBe(78);
    for (const recipe of officialNutritionRecipes) {
      expect(recipe.seasonMonths?.every((month) => month >= 1 && month <= 12)).toBe(true);
    }
  });

  it("追加した定番メニューは材料データを持つ", () => {
    const stapleIds = [
      "nikujaga", "omelet-rice", "vegetable-yakisoba", "salmon-chan-chan",
      "three-color-soboro-bowl", "pork-kimchi", "mushroom-cream-stew", "atsuage-sweet-savory",
      "basic-curry", "hamburg", "gyudon", "fried-chicken", "hoikoro",
      "vegetable-stir-fry", "fried-rice", "napolitan", "yaki-udon", "salt-grilled-mackerel",
    ];
    const staples = officialNutritionRecipes.filter((recipe) => stapleIds.includes(recipe.id));

    expect(staples).toHaveLength(stapleIds.length);
    expect(staples.every((recipe) => (recipe.ingredientsText?.match(/\d+(?:\/\d+)?/g)?.length ?? 0) >= 9)).toBe(true);
  });

  it("指定月の日数分を決定的に生成する", () => {
    const first = generateMonthlyDinnerPlan({ year: 2026, month: 8, recipes: officialNutritionRecipes, seed: 10 });
    const second = generateMonthlyDinnerPlan({ year: 2026, month: 8, recipes: officialNutritionRecipes, seed: 10 });
    expect(first).toHaveLength(31);
    expect(first.map((day) => day.recipe.id)).toEqual(second.map((day) => day.recipe.id));
  });

  it("固定した日の献立を保持する", () => {
    const plan = generateMonthlyDinnerPlan({
      year: 2026,
      month: 8,
      recipes: officialNutritionRecipes,
      lockedRecipeIds: { "2026-08-12": "salmon" },
      seed: 20,
    });
    expect(plan.find((day) => day.date === "2026-08-12")).toMatchObject({ locked: true, recipe: { id: "salmon" } });
  });

  it("同じ料理を連続させず栄養スコアを算出する", () => {
    const plan = generateMonthlyDinnerPlan({ year: 2026, month: 9, recipes: officialNutritionRecipes, seed: 30 });
    for (let index = 1; index < plan.length; index += 1) {
      expect(plan[index].recipe.id).not.toBe(plan[index - 1].recipe.id);
    }
    expect(summarizeNutrition(plan).score).toBeGreaterThanOrEqual(70);
  });

  it("選択月の旬を優先しながら栄養バランスを維持する", () => {
    for (const month of [1, 4, 8, 10]) {
      const plan = generateMonthlyDinnerPlan({ year: 2026, month, recipes: officialNutritionRecipes, seed: month * 100 });
      const seasonalRatio = plan.filter((day) => isRecipeInSeason(day.recipe, month)).length / plan.length;
      expect(seasonalRatio).toBeGreaterThanOrEqual(0.7);
      expect(summarizeNutrition(plan).score).toBeGreaterThanOrEqual(85);
    }
  });

  it("1日変更では現在と近隣の料理を避けて旬の候補を返す", () => {
    const currentRecipe = officialNutritionRecipes.find((recipe) => recipe.id === "tofu-mapo")!;
    const alternatives = rankAlternativeRecipes({
      currentRecipe,
      recipes: officialNutritionRecipes,
      month: 8,
      maxCookMinutes: 30,
      nearbyRecipeIds: ["aji-nanban", "eggplant-miso-pork"],
    });

    expect(alternatives[0].id).not.toBe(currentRecipe.id);
    expect(["aji-nanban", "eggplant-miso-pork"]).not.toContain(alternatives[0].id);
    expect(isRecipeInSeason(alternatives[0], 8)).toBe(true);
  });

  it("家族に好評な料理を候補選びで優先する", () => {
    const currentRecipe = officialNutritionRecipes.find((recipe) => recipe.id === "tofu-mapo")!;
    const preferred = officialNutritionRecipes.find((recipe) => recipe.id === "pork-ginger")!;
    const alternatives = rankAlternativeRecipes({
      currentRecipe,
      recipes: [currentRecipe, preferred, { ...preferred, id: "plain-option", name: "比較用メニュー" }],
      month: 8,
      preferredRecipeIds: [preferred.id],
    });

    expect(alternatives[0].id).toBe(preferred.id);
  });
});
