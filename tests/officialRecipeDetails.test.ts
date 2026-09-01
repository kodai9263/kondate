import { describe, expect, it } from "vitest";
import { officialNutritionRecipes } from "@/lib/nutrition/catalog";
import { officialRecipeDetails } from "@/lib/nutrition/recipeDetails";

describe("公式献立の調理詳細", () => {
  it("全68献立に材料と4〜7個の個別工程がある", () => {
    expect(officialNutritionRecipes).toHaveLength(68);
    expect(Object.keys(officialRecipeDetails)).toHaveLength(68);

    officialNutritionRecipes.forEach((recipe) => {
      const detail = officialRecipeDetails[recipe.id];
      expect(detail, recipe.id).toBeDefined();
      expect(detail.ingredients.length, `${recipe.id}: 材料`).toBeGreaterThanOrEqual(3);
      expect(detail.steps.length, `${recipe.id}: 工程`).toBeGreaterThanOrEqual(4);
      expect(detail.steps.length, `${recipe.id}: 工程`).toBeLessThanOrEqual(7);
      expect(recipe.ingredientsText).toBe(detail.ingredients.join("\n"));
      expect(recipe.eveningSteps).toEqual(detail.steps);
    });
  });

  it("分量、火加減または加熱時間、完成までの手掛かりがある", () => {
    Object.entries(officialRecipeDetails).forEach(([id, detail]) => {
      expect(detail.ingredients.every((line) => /\d|少々|適量/.test(line)), `${id}: 分量`).toBe(true);
      expect(detail.steps.some((step) => /弱火|中火|強火|弱めの中火|℃|600W|炊飯/.test(step)), `${id}: 加熱方法`).toBe(true);
      expect(detail.steps.some((step) => /\d+分|\d+〜\d+分|\d+秒/.test(step)), `${id}: 時間`).toBe(true);
      expect(detail.steps.at(-1), `${id}: 仕上げ`).toMatch(/盛る|添える|かける|よそう/);
    });
  });

  it("料理を判断できない汎用工程を含まない", () => {
    const steps = Object.values(officialRecipeDetails).flatMap((detail) => detail.steps);
    expect(steps).not.toContain("食材を洗って食べやすく切る");
    expect(steps.some((step) => /材料をそろえる|食材を洗って食べやすく切る|主菜と副菜を仕上げて盛り付ける/.test(step))).toBe(false);
  });
});
