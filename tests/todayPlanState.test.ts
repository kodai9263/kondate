import { describe, expect, it } from "vitest";
import { mergeTodayPlan, type DailyPlanRow } from "@/lib/today/server";
import type { PlanMeal } from "@/types/domain";

const fallbackToday: PlanMeal = {
  date: "2026-08-24",
  dayIndex: 1,
  dow: "月",
  breakfast: { name: "朝食", minutes: 10, tasks: ["朝食を作る"] },
  dinner: {
    dow: "月",
    dinner: "固定ローテーションの夕食",
    side: "固定ローテーションの副菜",
    fish: false,
    kids: true,
    prepMin: 5,
    cookMin: 15,
    morning: ["固定の仕込み"],
    evening: ["固定の手順"],
    seasonings: ["固定の調味料"],
  },
};

describe("mergeTodayPlan", () => {
  it("当日の保存済み献立を今日画面へ反映する", () => {
    const rows: DailyPlanRow[] = [{
      plan_entry_id: "dinner-entry",
      meal_type: "dinner",
      recipe_name: "うなぎと夏野菜のちらし丼",
      prep_minutes: 0,
      cook_minutes: 25,
      meta: { side: "冬瓜のすまし汁", ingredients_text: "うなぎ 4枚\nきゅうり 2本" },
      steps: [
        { id: "evening", phase: "evening", text: "ちらし丼を作る", checked: false },
      ],
    }];

    expect(mergeTodayPlan(fallbackToday, rows)).toEqual({
      ...fallbackToday,
      dinner: {
        ...fallbackToday.dinner,
        dinner: "うなぎと夏野菜のちらし丼",
        side: "冬瓜のすまし汁",
        prepMin: 0,
        cookMin: 25,
        morning: [],
        evening: ["ちらし丼を作る"],
        seasonings: ["うなぎ 4枚", "きゅうり 2本"],
      },
    });
  });

  it("保存済み献立がない場合は固定ローテーションを維持する", () => {
    expect(mergeTodayPlan(fallbackToday, [])).toBe(fallbackToday);
  });

  it("材料情報がない献立に固定ローテーションの調味料を混ぜない", () => {
    const rows: DailyPlanRow[] = [{
      plan_entry_id: "dinner-entry",
      meal_type: "dinner",
      recipe_name: "豆腐たっぷり麻婆豆腐",
      prep_minutes: 0,
      cook_minutes: 20,
      meta: { side: "小松菜のナムル" },
      steps: [{ id: "evening", phase: "evening", text: "麻婆豆腐を作る", checked: false }],
    }];

    expect(mergeTodayPlan(fallbackToday, rows).dinner.seasonings).toEqual([]);
  });
});
