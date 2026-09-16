import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PlanMeal } from "@/types/domain";

const mocks = vi.hoisted(() => ({
  recipes: [] as Record<string, unknown>[], saved: [] as Record<string, unknown>[], daily: [] as Record<string, unknown>[],
  upsert: vi.fn(), rpc: vi.fn(), recipeError: null as unknown, savedError: null as unknown,
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ getSupabaseServer: async () => ({
  auth: { getUser: async () => ({ data: { user: { id: "user" } } }) },
  rpc: mocks.rpc,
  from: (table: string) => {
    const result = () => table === "profiles" ? { data: { household_id: "household" } }
      : table === "recipes" ? { data: mocks.recipes, error: mocks.recipeError }
      : table === "v_daily_plan" ? { data: mocks.daily }
      : { data: mocks.saved, error: mocks.savedError };
    const query = {
      select: () => query, eq: () => query, in: () => query, is: () => query, gte: () => query, lte: () => query,
      maybeSingle: async () => result(), upsert: mocks.upsert,
      then: (resolve: (value: unknown) => unknown) => Promise.resolve(result()).then(resolve),
    };
    return query;
  },
}) }));
import { saveMonthlyDinnerPlan } from "@/app/app/planner/actions";
import { getTodayPlanState } from "@/lib/today/server";

const shortId = "10000000-0000-4000-8000-000000000001";
const longId = "10000000-0000-4000-8000-000000000002";
const short = { id: shortId, name: "短い料理", cook_minutes: 40, meta: {}, category: "dinner", household_id: "household" };
const long = { ...short, id: longId, name: "長い料理", cook_minutes: 15, meta: { total_minutes: 41 } };
const input = () => ({ year: 2026, month: 9, servings: 4, entries: Array.from({ length: 30 }, (_, i) => ({ date: `2026-09-${String(i + 1).padStart(2, "0")}`, recipeId: shortId, locked: false })) });
const fallback: PlanMeal = {
  date: "2026-09-17", dayIndex: 0, dow: "木", breakfast: null,
  dinner: { dow: "木", dinner: "短い料理", side: "", fish: false, kids: true, prepMin: 0, cookMin: 40, morning: [], evening: [], seasonings: [] },
};
beforeEach(() => {
  vi.clearAllMocks();
  mocks.recipes = [short]; mocks.saved = []; mocks.daily = [];
  mocks.recipeError = null; mocks.savedError = null;
  mocks.upsert.mockResolvedValue({ error: null }); mocks.rpc.mockResolvedValue({ error: null });
});

describe("献立保存の時間制限", () => {
  it("40分以内の献立を保存できる", async () => {
    expect(await saveMonthlyDinnerPlan(input())).toEqual({ ok: true });
    expect(mocks.upsert).toHaveBeenCalledOnce();
  });
  it("画面を経由しなくても新しい長時間レシピの指定は拒否する", async () => {
    mocks.recipes = [short, long];
    const value = input(); value.entries[0].recipeId = longId;
    expect((await saveMonthlyDinnerPlan(value)).ok).toBe(false);
    expect(mocks.upsert).not.toHaveBeenCalled();
  });
  it("公式メニューは古いDBの夜の時間より完成までの時間を優先する", async () => {
    mocks.recipes = [{ ...short, name: "さわらの西京焼き", household_id: null, meta: { nutrition_catalog_id: "sawara-saikyo" }, cook_minutes: 15 }];
    expect((await saveMonthlyDinnerPlan(input())).ok).toBe(false);
  });
  it("時間未確認のアレンジは新規保存の候補にしない", async () => {
    mocks.recipes = [{ ...short, meta: { step_customization: true } }];
    expect((await saveMonthlyDinnerPlan(input())).ok).toBe(false);
  });
  it("同じ日付の保存済み料理は維持できるが別日への追加は拒否する", async () => {
    mocks.recipes = [short, long];
    mocks.saved = [{ date: "2026-09-01", recipe_id: longId }];
    const value = input(); value.entries[0].recipeId = longId;
    expect((await saveMonthlyDinnerPlan(value)).ok).toBe(true);
    mocks.upsert.mockClear(); value.entries[1].recipeId = longId;
    expect((await saveMonthlyDinnerPlan(value)).ok).toBe(false);
    expect(mocks.upsert).not.toHaveBeenCalled();
  });
  it("既存献立の取得に失敗したら変更しない", async () => {
    mocks.savedError = new Error("offline");
    expect((await saveMonthlyDinnerPlan(input())).ok).toBe(false);
    expect(mocks.upsert).not.toHaveBeenCalled();
  });
});

describe("今日の献立の補充", () => {
  it("候補がなければ旧テンプレートから夕食を作らない", async () => {
    const state = await getTodayPlanState(fallback);
    expect(state.loadError).toBeUndefined();
    expect(mocks.upsert).not.toHaveBeenCalled();
    expect(mocks.rpc).toHaveBeenCalledWith("ensure_today_breakfast", { target_date: fallback.date });
    expect(mocks.rpc).not.toHaveBeenCalledWith("ensure_today_plan", expect.anything());
  });
  it("選んだ夕食の保存に失敗しても旧テンプレートへ切り替えない", async () => {
    mocks.upsert.mockResolvedValue({ error: new Error("offline") });
    const state = await getTodayPlanState(fallback, { recipeId: shortId, servings: 4 });
    expect(state.loadError).toBe(true);
    expect(state.today.dinner.dinner).toBe("短い料理");
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("選んだ夕食が確定してから朝食とチェック状態を準備する", async () => {
    await getTodayPlanState(fallback, { recipeId: shortId, servings: 4 });
    expect(mocks.upsert).toHaveBeenCalledOnce();
    expect(mocks.rpc).toHaveBeenCalledWith("ensure_today_breakfast", { target_date: fallback.date });
    expect(mocks.upsert.mock.invocationCallOrder[0]).toBeLessThan(mocks.rpc.mock.invocationCallOrder[0]);
  });
});
