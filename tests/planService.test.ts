import { describe, expect, it } from "vitest";
import { menuData } from "@/lib/menuData";
import { buildRotationPlan, findTodayPlan } from "@/lib/services/planService";

describe("buildRotationPlan", () => {
  it("日曜始まりで28日分を展開する", () => {
    const plan = buildRotationPlan(menuData, "2026-07-26");

    expect(plan).toHaveLength(28);
    expect(plan[0]).toMatchObject({ date: "2026-07-26", dow: "日", dayIndex: 0 });
    expect(plan[27]).toMatchObject({ date: "2026-08-22", dow: "土", dayIndex: 27 });
  });

  it("曜日に応じて朝食ローテーションを割り当てる", () => {
    const plan = buildRotationPlan(menuData, "2026-07-26");

    expect(plan[0].breakfast.name).toContain("納豆");
    expect(plan[1].breakfast.name).toContain("目玉焼き");
    expect(plan[2].breakfast.name).toContain("鮭フレーク");
  });

  it("基準日からの経過日数で今日の献立を選ぶ", () => {
    expect(findTodayPlan(menuData, new Date("2026-08-07T12:00:00+09:00"))).toMatchObject({
      date: "2026-08-07",
      dayIndex: 12,
      dow: "金",
      dinner: { dinner: "たらのムニエル" },
    });
  });

  it("4週間を越えた日付は先頭から繰り返す", () => {
    expect(findTodayPlan(menuData, new Date("2026-08-23T12:00:00+09:00"))).toMatchObject({
      date: "2026-07-26",
      dayIndex: 0,
    });
  });
});
