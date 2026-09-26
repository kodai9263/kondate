import { describe, expect, it } from "vitest";
import { parseISO } from "date-fns";
import { plannerDates, plannerLabel, plannerMonths } from "@/lib/nutrition/period";
import { getShoppingPeriod } from "@/lib/shopping/period";
import { resolvePlannerPeriod } from "@/lib/nutrition/periodPlan";
import { officialNutritionRecipes } from "@/lib/nutrition/catalog";

describe("まとめ買い曜日からの週間献立", () => {
  it("土曜〜金曜、日曜〜土曜をそれぞれ7日分表示する", () => {
    expect(plannerDates("week", "2026-09-26", 6)).toEqual(["2026-09-26", "2026-09-27", "2026-09-28", "2026-09-29", "2026-09-30", "2026-10-01", "2026-10-02"]);
    expect(plannerDates("week", "2026-09-26", 0)).toEqual(["2026-09-20", "2026-09-21", "2026-09-22", "2026-09-23", "2026-09-24", "2026-09-25", "2026-09-26"]);
    expect(plannerLabel("week", "2026-09-26", 6)).toBe("2026年 9/26〜10/2");
    expect(plannerMonths("week", "2026-09-26", 6)).toHaveLength(2);
  });
  it.each([0, 1, 2, 3, 4, 5, 6])("%i曜日設定が買い物リストと一致する", (shoppingDay) => {
    for (const date of ["2026-09-26", "2027-01-01", "2028-02-29"]) {
      const days = plannerDates("week", date, shoppingDay);
      const shopping = getShoppingPeriod(shoppingDay, new Date(`${date}T12:00:00+09:00`));
      expect(days).toHaveLength(7);
      expect(parseISO(days[0]).getDay()).toBe(shoppingDay);
      expect(days[0]).toBe(shopping.start);
      expect(days[6]).toBe(shopping.end);
    }
  });
  it("月間の日付と既存の料理・固定・副菜は曜日変更で変わらない", () => {
    const context = { recipes: officialNutritionRecipes, preferredRecipeIds: [], initialRecipeIds: {"2026-09-26": officialNutritionRecipes[0].id}, initialLockedRecipeIds: {"2026-09-26": officialNutritionRecipes[0].id}, initialSideSelections: {"2026-09-26": {mode: "none" as const, sideDishId: null}} };
    const saturday = resolvePlannerPeriod("week", "2026-09-26", context, 6);
    const sunday = resolvePlannerPeriod("week", "2026-09-26", context, 0);
    expect(saturday.find((day) => day.date === "2026-09-26")).toEqual(sunday.find((day) => day.date === "2026-09-26"));
    expect(plannerDates("month", "2026-09-26", 0)).toEqual(plannerDates("month", "2026-09-26", 6));
  });
});
