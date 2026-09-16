import { describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ rows: [] as unknown[], readError: null as unknown, rpc: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ getSupabaseServer: async () => ({
  rpc: mocks.rpc,
  from: () => ({ select: () => ({ eq: async () => ({ data: mocks.rows, error: mocks.readError }) }) }),
}) }));
import { getTodayPlanState } from "@/lib/today/server";
import { findTodayPlan } from "@/lib/services/planService";
import { menuData } from "@/lib/menuData";

describe("今日の朝食と工程チェック", () => {
  it("同じ文章が2回あっても、それぞれ保存先が違う", async () => {
    mocks.rpc.mockResolvedValue({ error: null });
    mocks.rows = [{ plan_entry_id: "breakfast-plan", meal_type: "breakfast", recipe_name: "わが家の朝食", cook_minutes: 0,
      meta: { breakfast_snapshot: true, minutes: null }, steps: [
        { id: "step1", phase: "morning", text: "温める", checked: true },
        { id: "step2", phase: "morning", text: "温める", checked: false },
      ] }];
    const state = await getTodayPlanState(findTodayPlan(menuData));
    expect(mocks.rpc).toHaveBeenCalledWith("ensure_today_breakfast", expect.any(Object));
    expect(state.today.breakfast).toEqual({ name: "わが家の朝食", minutes: undefined, tasks: ["温める", "温める"] });
    expect(state.taskBindings.breakfast.map((step) => [step.stepId, step.checked])).toEqual([["step1", true], ["step2", false]]);
  });
  it("DBの読込失敗を成功として返さない", async () => {
    mocks.readError = { message: "offline" };
    expect((await getTodayPlanState(findTodayPlan(menuData))).loadError).toBe(true);
  });
});
