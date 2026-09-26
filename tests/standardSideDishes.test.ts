import { describe, expect, it, vi } from "vitest";
vi.mock("@/lib/supabase/server", () => ({ getSupabaseServer: vi.fn() }));
import { z } from "zod";
import { availableStandardSideDishes, standardSideDishes, standardSideServings } from "@/lib/nutrition/standardSideDishes";
import { restoreStandardSideMetadata, standardSideDishId } from "@/lib/nutrition/standardSideDishStorage";
import { officialNutritionRecipes } from "@/lib/nutrition/catalog";
import { applySideSelections } from "@/lib/nutrition/planner";
import { toSavedDinnerEntries } from "@/lib/nutrition/month";
import { resolveCustomSideSteps, resolveDinnerIngredients, resolveDinnerSteps } from "@/lib/nutrition/sideDish";
import { buildPlannedShopping } from "@/lib/shopping/build";
import { getSeasoningGroups, getStepSeasoningIds } from "@/lib/recipes/seasoningGroups";
import { mergeTodayPlan } from "@/lib/today/server";
import type { SideDish } from "@/types/nutrition";
import type { PlanMeal } from "@/types/domain";

const householdId = "10000000-0000-4000-8000-000000000001";
const savedSide = (key: string): SideDish => {
  const dish = standardSideDishes.find((item) => item.key === key)!;
  return restoreStandardSideMetadata({ id: standardSideDishId(householdId, key),
    name: dish.name, ingredientsText: dish.ingredientsText, steps: dish.steps }, householdId);
};
const recipe = officialNutritionRecipes.find((dish) => dish.id === "salmon")!;
const date = "2026-09-26";

describe("定番の副菜", () => {
  it("10品に材料・工程があり、工程の調味料記号を材料に結び付けられる", () => {
    expect(standardSideDishes).toHaveLength(10);
    expect(new Set(standardSideDishes.map((dish) => dish.key)).size).toBe(10);
    for (const dish of standardSideDishes) {
      expect(dish.ingredientsText.trim().length).toBeGreaterThan(0);
      expect(dish.steps.length).toBeGreaterThan(1);
      const groupIds = getSeasoningGroups(dish.ingredientsText.split("\n")).map((group) => group.id);
      for (const id of dish.steps.flatMap(getStepSeasoningIds)) expect(groupIds).toContain(id);
    }
  });
  it("再選択は同じUUIDになり、他の家庭とは異なる", () => {
    for (const dish of standardSideDishes) {
      const id = standardSideDishId(householdId, dish.key);
      expect(z.string().uuid().safeParse(id).success).toBe(true);
      expect(standardSideDishId(householdId, dish.key)).toBe(id);
      expect(standardSideDishId("another-household", dish.key)).not.toBe(id);
      expect(savedSide(dish.key)).toMatchObject({ standardKey: dish.key, servingsBase: 4 });
    }
  });
  it("自作副菜の名前が同じでも定番扱いにせず、別家庭のIDからも復元しない", () => {
    const side = savedSide("chilled-tofu");
    const original = { id: side.id, name: side.name, ingredientsText: side.ingredientsText, steps: side.steps };
    expect(restoreStandardSideMetadata(original, "another-household")).toEqual(original);
    expect(restoreStandardSideMetadata({ ...original, id: crypto.randomUUID() }, householdId).servingsBase).toBeUndefined();
  });
  it("しょうゆ・塩こんぶ・マヨネーズ由来のアレルギーと自由入力を候補に反映する", () => {
    expect(availableStandardSideDishes(["小麦"]).map((dish) => dish.key)).not.toContain("chilled-tofu");
    expect(availableStandardSideDishes(["卵"]).map((dish) => dish.key)).not.toContain("cabbage-tuna");
    expect(availableStandardSideDishes(["ごま"]).map((dish) => dish.key)).not.toContain("bean-sprout-namul");
    expect(availableStandardSideDishes(["トマト"]).map((dish) => dish.key)).not.toContain("tomato-salad");
    expect(availableStandardSideDishes([])).toHaveLength(10);
  });
  it.each(standardSideDishes)("$name を保存して読み直しても材料と副菜の指定が一致する", (dish) => {
    const side = savedSide(dish.key);
    const plan = [{ date, recipe, locked: true }];
    const selections = { [date]: { mode: "custom" as const, sideDishId: side.id } };
    const selected = applySideSelections(plan, selections, [side]);
    const [saved] = toSavedDinnerEntries(selected);
    const restored = applySideSelections(plan, { [saved.date]: { mode: saved.sideMode ?? "default", sideDishId: saved.sideDishId ?? null } }, [savedSide(dish.key)]);
    expect(restored).toEqual(selected);
    const ingredients = resolveDinnerIngredients(restored[0])!;
    expect(ingredients).toContain("【主菜】生鮭");
    expect(ingredients).not.toContain("【味噌汁】");
    for (const line of dish.ingredientsText.split("\n")) expect(ingredients).toContain(line.replace(/^【A/, "【副菜A"));
    expect(resolveDinnerSteps(restored[0])).toEqual(resolveDinnerSteps({ ...plan[0], sideMode: "none" }));
    expect(resolveCustomSideSteps(side)).toHaveLength(dish.steps.length);
  });
  it.each([2, 4, 6, undefined])("主菜が%s人分でも、4人分の副菜を家庭の2人分に正しく集計する", (servingsBase) => {
    const selected = { date, recipe: { ...recipe, servingsBase }, locked: false, sideMode: "custom" as const, sideDish: savedSide("chilled-tofu") };
    const shopping = buildPlannedShopping({ start: date, end: date, dinners: [selected], breakfastVersions: [], servings: 2 });
    const labels = shopping.groups.flatMap((group) => group.items.map((item) => item.label));
    expect(labels).toContain("絹ごし豆腐 150g");
    expect(labels.filter((label) => label.startsWith("絹ごし豆腐"))).toHaveLength(1);
    expect(labels.some((label) => label.includes("わかめ"))).toBe(false);
  });
  it("今日のDB読み込みでも定番の手順・基準人数を復元し、副菜なしへ戻すと消す", () => {
    const side = savedSide("bean-sprout-namul");
    const fallback: PlanMeal = { date, dayIndex: 0, dow: "土", breakfast: null, dinner: {
      dinner: recipe.name, side: recipe.side, dow: "土", fish: true, kids: true, prepMin: 0, cookMin: 20,
      morning: [], evening: [], seasonings: [],
    } };
    const row = { plan_entry_id: "entry", household_id: householdId, meal_type: "dinner" as const,
      recipe_name: recipe.name, prep_minutes: 0, cook_minutes: 20,
      meta: { ingredients_text: recipe.ingredientsText, side: recipe.side, servings_base: 2, recipe_detail_version: 2 }, steps: [],
      side_mode: "custom" as const, side_dish: { id: side.id, name: side.name, ingredients_text: side.ingredientsText, steps_text: side.steps.join("\n") } };
    const today = mergeTodayPlan(fallback, [row]);
    expect(today.dinner.sideServingsBase).toBe(standardSideServings);
    expect(today.dinner.side).toBe(side.name);
    expect(today.dinner.sideSteps).toEqual(resolveCustomSideSteps(side));
    expect(today.dinner.seasonings).toContain("【副菜】もやし 200g");
    const noSide = mergeTodayPlan(today, [{ ...row, side_mode: "none", side_dish: null }]);
    expect(noSide.dinner.sideServingsBase).toBeUndefined();
    expect(noSide.dinner.sideSteps).toBeUndefined();
  });
});
