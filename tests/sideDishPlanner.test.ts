import { describe, expect, it } from "vitest";
import { officialNutritionRecipes } from "@/lib/nutrition/catalog";
import { applySideSelections, plannedSideName } from "@/lib/nutrition/planner";
import { toSavedDinnerEntries } from "@/lib/nutrition/month";
import { resolveDinnerIngredients, resolveDinnerSteps } from "@/lib/nutrition/sideDish";
import type { PlannedDinner, SideDish } from "@/types/nutrition";

const sideDish: SideDish = {
  id: "20000000-0000-4000-8000-000000000001",
  name: "きゅうりの塩こんぶ和え",
  ingredientsText: "きゅうり 2本\n塩こんぶ 10g",
  steps: ["きゅうりを薄切りにする", "塩こんぶと和える"],
};

const plan: PlannedDinner[] = [{
  date: "2026-09-20",
  recipe: officialNutritionRecipes[0],
  locked: false,
  sideMode: "default",
  sideDish: null,
}];

describe("副菜の選択", () => {
  it("標準、副菜なし、自作副菜を表示用の名前へ変換する", () => {
    expect(plannedSideName(plan[0])).toBe(plan[0].recipe.side);
    expect(plannedSideName({ ...plan[0], sideMode: "none" })).toBe("副菜なし");
    expect(plannedSideName({ ...plan[0], sideMode: "custom", sideDish })).toBe(sideDish.name);
  });

  it("保存済みの自作副菜を日付に反映し、存在しない指定は標準へ戻す", () => {
    const selected = applySideSelections(plan, {
      "2026-09-20": { mode: "custom", sideDishId: sideDish.id },
    }, [sideDish]);
    expect(selected[0]).toMatchObject({ sideMode: "custom", sideDish });

    const missing = applySideSelections(plan, {
      "2026-09-20": { mode: "custom", sideDishId: crypto.randomUUID() },
    }, []);
    expect(missing[0]).toMatchObject({ sideMode: "default", sideDish: null });
  });

  it("月保存へ副菜の指定も渡す", () => {
    const selected = applySideSelections(plan, {
      "2026-09-20": { mode: "custom", sideDishId: sideDish.id },
    }, [sideDish]);
    expect(toSavedDinnerEntries(selected)).toEqual([{
      date: "2026-09-20",
      recipeId: plan[0].recipe.id,
      locked: false,
      sideMode: "custom",
      sideDishId: sideDish.id,
    }]);
  });

  it("副菜なしでは標準副菜の材料を外し、自作副菜では材料を差し替える", () => {
    const salmonPlan: PlannedDinner = {
      ...plan[0],
      recipe: officialNutritionRecipes.find((recipe) => recipe.id === "salmon")!,
    };
    const withoutSide = resolveDinnerIngredients({ ...salmonPlan, sideMode: "none" })!;
    expect(withoutSide).toContain("【主菜】生鮭");
    expect(withoutSide).not.toContain("【味噌汁】");

    const custom = resolveDinnerIngredients({ ...salmonPlan, sideMode: "custom", sideDish })!;
    expect(custom).not.toContain("【味噌汁】");
    expect(custom).toContain("きゅうり 2本");
    expect(custom).toContain("塩こんぶ 10g");
  });

  it("全94品で副菜なしを選ぶと標準副菜の材料が外れる", () => {
    for (const recipe of officialNutritionRecipes) {
      const ingredients = resolveDinnerIngredients({
        date: "2026-09-20",
        recipe,
        locked: false,
        sideMode: "none",
        sideDish: null,
      });
      expect(ingredients, `${recipe.id}: ${recipe.side}`).not.toBe(recipe.ingredientsText);
    }
  });

  it("全94品で副菜なしを選ぶと標準副菜の工程が外れ、主菜工程は残る", () => {
    for (const recipe of officialNutritionRecipes) {
      const steps = resolveDinnerSteps({
        date: "2026-09-20",
        recipe,
        locked: false,
        sideMode: "none",
        sideDish: null,
      }) ?? [];
      expect(steps.length, `${recipe.id}: 主菜工程`).toBeGreaterThan(0);
      expect(steps, `${recipe.id}: ${recipe.side}`).not.toEqual(recipe.eveningSteps);
    }
  });
});
