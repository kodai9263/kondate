import { describe, expect, it } from "vitest";
import { getMonthDateRange, isCompleteMonthPlan, parsePlannerMonth } from "@/lib/nutrition/month";

describe("planner month persistence", () => {
  it("URLの年月を解釈し、不正値は現在月へ戻す", () => {
    const fallback = new Date(2026, 7, 8);
    expect(parsePlannerMonth("2027-02", fallback)).toEqual({ year: 2027, month: 2 });
    expect(parsePlannerMonth("2027-13", fallback)).toEqual({ year: 2026, month: 8 });
    expect(parsePlannerMonth(undefined, fallback)).toEqual({ year: 2026, month: 8 });
  });

  it("うるう年を含めて月初と月末を返す", () => {
    expect(getMonthDateRange(2028, 2)).toEqual({ firstDate: "2028-02-01", lastDate: "2028-02-29", days: 29 });
  });

  it("対象月の全日付が一度ずつ揃った場合だけ保存を許可する", () => {
    const complete = Array.from({ length: 30 }, (_, index) => ({
      date: `2026-09-${String(index + 1).padStart(2, "0")}`,
      recipeId: "00000000-0000-4000-8000-000000000001",
      locked: false,
    }));
    expect(isCompleteMonthPlan(2026, 9, complete)).toBe(true);
    expect(isCompleteMonthPlan(2026, 9, complete.slice(1))).toBe(false);
    expect(isCompleteMonthPlan(2026, 9, [...complete.slice(0, -1), complete[0]])).toBe(false);
  });
});
