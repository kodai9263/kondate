import { describe, expect, it } from "vitest";
import { monthCalendarDates, movePlannerDate, parsePlannerPeriod, plannerDates, plannerMonths } from "@/lib/nutrition/period";
import { resolvePlannerPeriod, updatePlannerDay } from "@/lib/nutrition/periodPlan";
import { isCompleteMonthPlan, toSavedDinnerEntries } from "@/lib/nutrition/month";
import { officialNutritionRecipes } from "@/lib/nutrition/catalog";
import { isDinnerCandidate } from "@/lib/nutrition/cookingTime";

const recipes = officialNutritionRecipes.filter((recipe) => isDinnerCandidate(recipe));
const context = { recipes, preferredRecipeIds: [], initialRecipeIds: {}, initialLockedRecipeIds: {} };

describe("週間・月間の日付", () => {
  it("日本時間の今日を基準に週間を開き、従来のmonthリンクも扱う", () => {
    const now = new Date("2026-09-30T15:30:00Z");
    expect(parsePlannerPeriod({}, now)).toEqual({ view: "week", date: "2026-10-01", today: "2026-10-01" });
    expect(parsePlannerPeriod({ month: "2026-09" }, now)).toMatchObject({ view: "month", date: "2026-09-01" });
    for (const date of ["2026-02-30", "2026-13-01", "no", "1900-01-01"]) {
      expect(parsePlannerPeriod({ date }, now).date).toBe("2026-10-01");
    }
  });
  it("月曜から日曜まで、月・年をまたいでも7日になる", () => {
    expect(plannerDates("week", "2026-10-01")).toEqual(["2026-09-28", "2026-09-29", "2026-09-30", "2026-10-01", "2026-10-02", "2026-10-03", "2026-10-04"]);
    expect(plannerMonths("week", "2027-01-01")).toEqual([{ year: 2026, month: 12, key: "2026-12" }, { year: 2027, month: 1, key: "2027-01" }]);
    expect(plannerDates("week", "2026-09-27")[0]).toBe("2026-09-21");
    expect(movePlannerDate("week", "2026-12-28", 1)).toBe("2027-01-04");
    expect(movePlannerDate("month", "2026-01-31", 1)).toBe("2026-02-01");
  });
  it("うるう年と6行の月を正しい曜日位置に並べる", () => {
    const leap = monthCalendarDates("2028-02-01");
    expect(leap[0]).toBeNull();
    expect(leap[1]).toBe("2028-02-01");
    expect(leap.filter(Boolean)).toHaveLength(29);
    expect(monthCalendarDates("2026-03-01")).toHaveLength(42);
    expect(monthCalendarDates("2026-03-01")[6]).toBe("2026-03-01");
  });
});

describe("表示間で共有する献立と月単位保存", () => {
  it("週間と月間の同じ日には同じ献立を表示する", () => {
    const week = resolvePlannerPeriod("week", "2026-10-01", context);
    const september = resolvePlannerPeriod("month", "2026-09-01", context);
    const october = resolvePlannerPeriod("month", "2026-10-01", context);
    expect(week).toEqual([...september, ...october]);
    expect(new Set(week.map((day) => day.date)).size).toBe(61);
  });
  it("翌月の日を変更したときは翌月全体だけを保存し、他の日は維持する", () => {
    const plan = resolvePlannerPeriod("week", "2026-10-01", context);
    const updated = updatePlannerDay(plan, "2026-10-01", { recipe: recipes[0], locked: true });
    expect(updated.year).toBe(2026);
    expect(updated.month).toBe(10);
    expect(isCompleteMonthPlan(2026, 10, toSavedDinnerEntries(updated.entries))).toBe(true);
    expect(updated.entries[0]).toMatchObject({ date: "2026-10-01", recipe: recipes[0], locked: true });
    expect(updated.entries.slice(1)).toEqual(plan.filter((day) => day.date > "2026-10-01"));
    const savedContext = { ...context,
      initialRecipeIds: Object.fromEntries(updated.entries.map((day) => [day.date, day.recipe.id])),
      initialLockedRecipeIds: { "2026-10-01": recipes[0].id },
    };
    const reloaded = resolvePlannerPeriod("month", "2026-10-01", savedContext);
    expect(reloaded).toEqual(updated.entries);
    expect(resolvePlannerPeriod("week", "2026-10-01", savedContext).filter((day) => day.date.startsWith("2026-10"))).toEqual(reloaded);
  });
  it("保存済みの日付を別の月へ混入させず、候補ゼロ時も読み出せる", () => {
    const saved = { ...context, recipes: [{ ...recipes[0], totalMinutes: 60 }],
      initialRecipeIds: { "2026-09-30": recipes[0].id, "2026-10-01": recipes[0].id },
      initialLockedRecipeIds: { "2026-10-01": recipes[0].id },
    };
    expect(resolvePlannerPeriod("month", "2026-09-01", saved).map((day) => day.date)).toEqual(["2026-09-30"]);
    expect(resolvePlannerPeriod("week", "2026-10-01", saved).map((day) => day.date)).toEqual(["2026-09-30", "2026-10-01"]);
  });
});


describe("週間・月間と既存の副菜設定", () => {
  const sideDish = { id: "test-side", name: "テスト副菜", ingredientsText: "小松菜", steps: [] };
  it("両月の副菜なし・自作副菜を表示し、固定で消さない", () => {
    const withSides = { ...context, sideDishes: [sideDish], initialSideSelections: {
      "2026-09-30": { mode: "none" as const, sideDishId: null },
      "2026-10-01": { mode: "custom" as const, sideDishId: sideDish.id },
    } };
    const plan = resolvePlannerPeriod("week", "2026-10-01", withSides);
    expect(plan.find((day) => day.date === "2026-09-30")?.sideMode).toBe("none");
    const locked = updatePlannerDay(plan, "2026-10-01", { locked: true });
    expect(locked.entries[0].sideDish).toEqual(sideDish);
    expect(toSavedDinnerEntries(locked.entries)[0]).toMatchObject({ sideMode: "custom", sideDishId: sideDish.id });
    const changed = updatePlannerDay(plan, "2026-10-01", { recipe: recipes[0] });
    expect(changed.entries[0]).toMatchObject({ sideMode: "default", sideDish: null });
  });
});
