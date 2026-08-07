import { describe, expect, it } from "vitest";
import { menuData } from "@/lib/menuData";
import { buildRotationPlan } from "@/lib/services/planService";

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
});
