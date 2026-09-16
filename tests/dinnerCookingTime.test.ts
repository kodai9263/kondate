import { describe, expect, it } from "vitest";
import { officialNutritionRecipes } from "@/lib/nutrition/catalog";
import { databaseRecipeTime, isDinnerCandidate } from "@/lib/nutrition/cookingTime";
import { generateMonthlyDinnerPlan, materializeDinnerPlan, rankAlternativeRecipes } from "@/lib/nutrition/planner";

const short = { ...officialNutritionRecipes[0], id: "short", cookMinutes: 15, totalMinutes: 40 };
const long = { ...short, id: "long", totalMinutes: 41 };

describe("アプリ共通の40分条件", () => {
  it("夜の作業時間ではなく完成までの時間で判定し、40分を含む", () => {
    expect(isDinnerCandidate(short)).toBe(true);
    expect(isDinnerCandidate(long)).toBe(false);
    expect(isDinnerCandidate({ ...short, totalMinutes: 110 }, 120)).toBe(false);
    expect(isDinnerCandidate(short, 20)).toBe(false);
  });

  it("時間未確認・不正値は短い料理と見なさない", () => {
    for (const cook_minutes of [0, -1, NaN, Infinity]) {
      expect(isDinnerCandidate(databaseRecipeTime({ cook_minutes, meta: null }))).toBe(false);
    }
    expect(isDinnerCandidate(databaseRecipeTime({ cook_minutes: 20, meta: { step_customization: true, total_minutes: 20 } }))).toBe(false);
    expect(isDinnerCandidate(databaseRecipeTime({ cook_minutes: 20, meta: { total_minutes: 41 } }))).toBe(false);
    expect(isDinnerCandidate(databaseRecipeTime({ cook_minutes: 20, meta: {} }))).toBe(true);
  });

  it("公式データは残し、新しい候補だけを56品に絞る", () => {
    expect(officialNutritionRecipes).toHaveLength(94);
    expect(officialNutritionRecipes.filter((recipe) => isDinnerCandidate(recipe))).toHaveLength(56);
    expect(isDinnerCandidate(officialNutritionRecipes.find((recipe) => recipe.id === "salmon")!)).toBe(true);
    expect(isDinnerCandidate(officialNutritionRecipes.find((recipe) => recipe.id === "mackerel-miso")!)).toBe(true);
    for (let month = 1; month <= 12; month += 1) {
      const plan = generateMonthlyDinnerPlan({ year: 2026, month, recipes: officialNutritionRecipes });
      expect(plan).toHaveLength(new Date(2026, month, 0).getDate());
      expect(plan.every((day) => isDinnerCandidate(day.recipe))).toBe(true);
    }
  });

  it("候補ゼロでも時間超過や時間未確認の料理で埋めない", () => {
    expect(generateMonthlyDinnerPlan({ year: 2026, month: 9, recipes: [long, { ...short, timeUnconfirmed: true }] })).toEqual([]);
    expect(rankAlternativeRecipes({ currentRecipe: short, recipes: [short, long], month: 9 })).toEqual([]);
    expect(rankAlternativeRecipes({ currentRecipe: long, recipes: [long], month: 9, maxCookMinutes: 45 })).toEqual([]);
  });

  it("候補が1品ならその料理だけで生成し、時間を緩めない", () => {
    const plan = generateMonthlyDinnerPlan({ year: 2026, month: 9, recipes: [short, long] });
    expect(plan).toHaveLength(30);
    expect(new Set(plan.map((day) => day.recipe.id))).toEqual(new Set([short.id]));
  });

  it("時間条件から外れても保存済みの献立と固定を保持する", () => {
    const locked = { "2026-09-12": long.id };
    const generated = generateMonthlyDinnerPlan({ year: 2026, month: 9, recipes: [long], lockedRecipeIds: locked });
    const plan = materializeDinnerPlan(generated, [long], { "2026-09-03": long.id, ...locked }, locked);
    expect(plan.map((day) => [day.date, day.recipe.id, day.locked])).toEqual([
      ["2026-09-03", long.id, false], ["2026-09-12", long.id, true],
    ]);
  });
});
