import { beforeEach, describe, expect, it, vi } from "vitest";
const mock = vi.hoisted(() => ({ settings: {} as Record<string, unknown>, planner: vi.fn(), resolve: vi.fn() }));
vi.mock("@/lib/family/server", () => ({ getCurrentHouseholdPreferences: async () => ({ shoppingDay: 6, adultCount: 4, childCount: 0 }) }));
vi.mock("@/lib/breakfast/server", () => ({ getBreakfastVersions: async () => ({ versions: [], error: null }) }));
vi.mock("@/lib/nutrition/server", () => ({ getHouseholdPlannerContext: mock.planner }));
vi.mock("@/lib/nutrition/planner", () => ({ resolveMonthlyDinnerPlan: mock.resolve }));
vi.mock("@/lib/supabase/server", () => ({ getSupabaseServer: async () => ({
  auth: { getUser: async () => ({ data: { user: { id: "member" } } }) },
  from: (table: string) => {
    const result = () => ({ data: table === "profiles" ? { household_id: "family" } : table === "household_settings" ? mock.settings : { id: "existing-list" }, error: null });
    const query = { select: () => query, eq: () => query, single: async () => result(), maybeSingle: async () => result() };
    return query;
  },
}) }));
import { getPlannedShopping } from "@/lib/shopping/server";

beforeEach(() => {
  vi.clearAllMocks();
  mock.settings = { shopping_day: 6, shopping_period_mode: "custom", shopping_range_start: "2026-09-30", shopping_range_end: "2026-11-01" };
  mock.planner.mockImplementation(async (year, month) => ({ year, month }));
  mock.resolve.mockImplementation((year: number, month: number) => {
    const dates = month === 9 ? ["2026-09-29", "2026-09-30"] : month === 10 ? ["2026-10-01", "2026-10-31"] : ["2026-11-01", "2026-11-02"];
    return dates.map((date) => ({ date, recipe: { name: date, ingredientsText: "にんじん 1本", servingsBase: 4, isCustom: true } }));
  });
});

describe("買い物の対象月と集計", () => {
  it("3か月にまたがる指定期間の献立を読み込み、前日と翌日を含めない", async () => {
    const shopping = await getPlannedShopping();
    expect(mock.planner.mock.calls).toEqual([[2026, 9, true], [2026, 10, true], [2026, 11, true]]);
    expect(shopping.meals).toHaveLength(33);
    expect(shopping.meals.at(0)?.date).toBe("2026-09-30");
    expect(shopping.meals.at(-1)?.date).toBe("2026-11-01");
    expect(shopping.groups.flatMap((group) => group.items.map((item) => item.label))).toEqual(["にんじん 4本"]);
    expect(shopping.listId).toBe("existing-list");
  });
  it("同日指定は1日分だけ読み込む", async () => {
    mock.settings.shopping_range_end = "2026-09-30";
    const shopping = await getPlannedShopping();
    expect(mock.planner.mock.calls).toEqual([[2026, 9, true]]);
    expect(shopping.meals).toHaveLength(1);
    expect(shopping.groups[0].items[0].label).toBe("にんじん 1本");
  });
  it("調味料の分量変更で在庫確認の保存キーを変えず、食材の分量変更は区別する", async () => {
    mock.settings.shopping_range_end = "2026-09-30";
    const plannedDinner = (ingredientsText: string) => [{ date: "2026-09-30", recipe: {
      name: "夕食", ingredientsText, servingsBase: 4, isCustom: true,
    } }];
    mock.resolve.mockReturnValue(plannedDinner("塩 小さじ0.5\nにんじん 1本"));
    const before = await getPlannedShopping();
    mock.resolve.mockReturnValue(plannedDinner("塩 大さじ1\n塩 少々\nにんじん 2本"));
    const after = await getPlannedShopping();
    const saltBefore = before.groups.find((group) => group.category === "調味料(在庫確認)")!.items;
    const saltAfter = after.groups.find((group) => group.category === "調味料(在庫確認)")!.items;
    expect(saltAfter).toHaveLength(1);
    expect(saltAfter[0].label).toBe("塩");
    expect(saltAfter[0].name).toBe(saltBefore[0].name);
    expect(saltAfter[0].name).toMatch(/^planned-v1:[a-f0-9]{64}$/);
    expect(after.groups.find((group) => group.category === "野菜・その他")!.items[0].name)
      .not.toBe(before.groups.find((group) => group.category === "野菜・その他")!.items[0].name);
  });
  it("対象月の読み込み失敗で一部分だけのリストを表示しない", async () => {
    mock.planner.mockRejectedValueOnce(new Error("unavailable"));
    await expect(getPlannedShopping()).rejects.toThrow("unavailable");
  });
});
