import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(), canAccessHousehold: vi.fn(),
  planningAccess: vi.fn(),
  getHouseholdPlannerContext: vi.fn(), getBreakfastVersions: vi.fn(),
  findTodayPlan: vi.fn(), resolveMonthlyDinnerPlan: vi.fn(), dailyRows: [] as Record<string, unknown>[],
}));

vi.mock("@/lib/supabase/mobile", () => ({ createMobileRequestClient: mocks.createClient }));
vi.mock("@/lib/billing/firstWeek.server", () => ({ getFirstWeekAccess: mocks.planningAccess }));
vi.mock("@/lib/billing/entitlements", () => ({ canAccessHousehold: mocks.canAccessHousehold }));
vi.mock("@/lib/nutrition/server", () => ({ getHouseholdPlannerContext: mocks.getHouseholdPlannerContext }));
vi.mock("@/lib/breakfast/server", () => ({ getBreakfastVersions: mocks.getBreakfastVersions }));
vi.mock("@/lib/services/planService", () => ({ findTodayPlan: mocks.findTodayPlan }));
vi.mock("@/lib/nutrition/planner", () => ({
  resolveMonthlyDinnerPlan: mocks.resolveMonthlyDinnerPlan, plannedSideName: vi.fn(),
}));

import { GET, OPTIONS } from "@/app/api/mobile/v1/today/route";

const token = "test-token-for-mobile-request";

function request(origin = "capacitor://localhost", authorization?: string) {
  return new Request("https://example.test/api/mobile/v1/today", {
    headers: { origin, ...(authorization ? { authorization } : {}) },
  });
}

function fakeClient() {
  const from = vi.fn((table: string) => {
    const chain = {
      select: () => chain, eq: () => chain, order: () => chain, limit: () => chain,
      single: async () => ({ data: { household_id: "household-1" }, error: null }),
      maybeSingle: async () => ({ data: table === "profiles" ? { id: "user-1" }
        : { status: "active", current_period_end: null }, error: null }),
      then: (resolve: (value: unknown) => unknown) => Promise.resolve({ data: table === "v_daily_plan" ? mocks.dailyRows : [], error: null }).then(resolve),
    };
    return chain;
  });
  return { auth: { getUser: vi.fn(async () => ({ data: { user: { id: "user-1" } }, error: null })) }, from };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.dailyRows = [];
  mocks.planningAccess.mockResolvedValue({ paid: true, canPlan: true, trial: null });
  mocks.createClient.mockReturnValue(fakeClient());
  mocks.canAccessHousehold.mockReturnValue(true);
  mocks.getHouseholdPlannerContext.mockResolvedValue({
    preferences: { adultCount: 2, childCount: 0 }, recipes: [],
  });
  mocks.getBreakfastVersions.mockResolvedValue({ versions: [], error: false });
  mocks.findTodayPlan.mockReturnValue({ date: "2026-09-27", dow: "日", breakfast: null,
    dinner: { dinner: "元の夕食", side: "", prepMin: 0, cookMin: 0, morning: [], evening: [], seasonings: [] },
  });
  mocks.resolveMonthlyDinnerPlan.mockReturnValue([]);
});

describe("スマホ向け今日の献立API", () => {
  it("作らない日は元の夕食と調理手順を返さず、朝食は維持する", async () => {
    mocks.resolveMonthlyDinnerPlan.mockReturnValue([{ date: "2026-09-27", skipped: true, recipe: { name: "元の料理" } }]);
    mocks.dailyRows = [{ meal_type: "dinner", recipe_name: "元の料理", steps: [{ phase: "evening", text: "調理する" }] }, { meal_type: "breakfast", recipe_name: "朝食", cook_minutes: 5, steps: [] }];
    const response = await GET(request("capacitor://localhost", `Bearer ${token}`));
    expect(response.status).toBe(200);
    const value = await response.json();
    expect(value.today.dinner).toMatchObject({ dinner: "今日は作らない日", evening: [], seasonings: [], sideSteps: [] });
    expect(value.today.breakfast.name).toBe("朝食");
    expect(value.taskBindings.evening).toEqual([]);
  });

  it("認証のない端末と許可外の出所には献立を返さない", async () => {
    expect((await GET(request())).status).toBe(401);
    expect((await GET(request("https://other.example", `Bearer ${token}`))).status).toBe(403);
    expect(mocks.getHouseholdPlannerContext).not.toHaveBeenCalled();
  });

  it("家族の利用権がない場合は献立を返さない", async () => {
    mocks.canAccessHousehold.mockReturnValue(false);
    expect((await GET(request("capacitor://localhost", `Bearer ${token}`))).status).toBe(403);
    expect(mocks.getHouseholdPlannerContext).not.toHaveBeenCalled();
  });

  it("本人の家族と日付で今日の内容を読み、端末に返す", async () => {
    const response = await GET(request("capacitor://localhost", `Bearer ${token}`));
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(response.headers.get("access-control-allow-origin")).toBe("capacitor://localhost");
    expect(await response.json()).toMatchObject({ version: 1,
      today: { date: "2026-09-27", dinner: { dinner: "夕食の候補がありません" } },
      familySize: { adultCount: 2, childCount: 0 },
    });
    expect(mocks.getHouseholdPlannerContext).toHaveBeenCalledWith(2026, 9, true, expect.any(Object), token);
    expect(OPTIONS(request()).status).toBe(204);
  });
});

it("体験終了後はモバイルAPIでも新しい献立を生成しない", async () => {
  mocks.planningAccess.mockResolvedValue({ paid: false, canPlan: false, trial: null });
  const response = await GET(request("capacitor://localhost", `Bearer ${token}`));
  expect(response.status).toBe(403);
  expect(mocks.getHouseholdPlannerContext).not.toHaveBeenCalled();
});
