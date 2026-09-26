import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ context: vi.fn() }));
vi.mock("@/lib/nutrition/server", () => ({ getHouseholdPlannerContext: mocks.context }));
vi.mock("@/components/features/planner/MonthlyPlanner", () => ({ MonthlyPlanner: () => null }));
import PlannerPage from "@/app/app/planner/page";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.context.mockImplementation(async (_year: number, month: number) => ({
    recipes: [], sideDishes: [], initialSideSelections: month === 10 ? { "2026-10-01": { mode: "none", sideDishId: null } } : {}, preferences: { adultCount: 2, childCount: 0, allergies: [] },
    excludedRecipeCount: 0, preferredRecipeIds: [], preferenceExcludedCount: 0,
    initialRecipeIds: { [`2026-${month === 9 ? "09-30" : "10-01"}`]: `recipe-${month}` },
    initialLockedRecipeIds: month === 10 ? { "2026-10-01": "recipe-10" } : {},
  }));
});

describe("献立ページの保存済みデータ読み込み", () => {
  it("月またぎでは両月を取得し、翌月の変更と固定も渡す", async () => {
    const page = await PlannerPage({ searchParams: Promise.resolve({ view: "week", date: "2026-10-01" }) });
    expect(mocks.context.mock.calls).toEqual([[2026, 9, true], [2026, 10, true]]);
    expect(page.props.initialRecipeIds).toEqual({ "2026-09-30": "recipe-9", "2026-10-01": "recipe-10" });
    expect(page.props.initialLockedRecipeIds).toEqual({ "2026-10-01": "recipe-10" });
    expect(page.props.initialSideSelections).toEqual({ "2026-10-01": { mode: "none", sideDishId: null } });
  });
  it("月間は対象月だけを読み、従来のURLも開ける", async () => {
    const page = await PlannerPage({ searchParams: Promise.resolve({ month: "2026-10" }) });
    expect(mocks.context.mock.calls).toEqual([[2026, 10, true]]);
    expect(page.props.initialView).toBe("month");
  });
  it("どちらかの月の取得に失敗したら編集画面を出さない", async () => {
    mocks.context.mockRejectedValueOnce(new Error("offline"));
    await expect(PlannerPage({ searchParams: Promise.resolve({ view: "week", date: "2026-10-01" }) })).rejects.toThrow("offline");
  });
});
