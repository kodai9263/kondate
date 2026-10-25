import { beforeEach, describe, expect, it, vi } from "vitest";
import { officialNutritionRecipes } from "@/lib/nutrition/catalog";
import { resolveMonthlyDinnerPlan } from "@/lib/nutrition/planner";
import { toSavedDinnerEntries } from "@/lib/nutrition/month";
import { buildPlannedShopping } from "@/lib/shopping/build";
const mocks = vi.hoisted(() => ({ authorize: vi.fn(), access: vi.fn(), context: vi.fn(), save: vi.fn() }));
vi.mock("@/lib/mobile/request", async (original) => ({ ...await original<typeof import("@/lib/mobile/request")>(), authorizeMobileRequest: mocks.authorize }));
vi.mock("@/lib/billing/firstWeek.server", () => ({ getFirstWeekAccess: mocks.access }));
vi.mock("@/lib/nutrition/server", () => ({ getHouseholdPlannerContext: mocks.context }));
vi.mock("@/lib/nutrition/savePlan.server", () => ({ saveMonthlyDinnerPlanForClient: mocks.save }));
import { GET, PATCH, OPTIONS } from "@/app/api/mobile/v1/planner/route";
const recipes = officialNutritionRecipes.filter((recipe) => (recipe.totalMinutes ?? recipe.cookMinutes) <= 40).slice(0, 4).map((recipe, index) => ({ ...recipe,
  id: `10000000-0000-4000-8000-00000000000${index + 1}`, isCustom: true, servingsBase: 4,
  ingredientsText: index === 0 ? "鶏もも肉 300g" : "大根 100g",
}));
let context: { recipes: typeof recipes; preferences: { adultCount: number; childCount: number; shoppingDay: number; allergies: string[] }; preferredRecipeIds: string[]; initialRecipeIds: Record<string, string>; initialLockedRecipeIds: Record<string, string>; initialSkippedDates: string[]; sideDishes: { id: string; name: string; ingredientsText: string; steps: string[] }[]; initialSideSelections: Record<string, { mode: "custom"; sideDishId: string }> };
const request = (method = "GET", body?: unknown, query = "date=2026-10-25&view=week", origin = "capacitor://localhost") => new Request(`https://example.test/api/mobile/v1/planner?${query}`, { method, headers: { origin, authorization: "Bearer valid-token-for-test", "content-type": "application/json" }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
async function snapshot(query?: string) { const response = await GET(request("GET", undefined, query)); expect(response.status).toBe(200); return response.json(); }
beforeEach(() => {
  vi.clearAllMocks();
  context = { recipes, preferences: { adultCount: 2, childCount: 2, shoppingDay: 6, allergies: [] }, preferredRecipeIds: [], initialRecipeIds: {}, initialLockedRecipeIds: {}, initialSkippedDates: [], sideDishes: [], initialSideSelections: {} };
  mocks.authorize.mockResolvedValue({ supabase: { name: "request-scoped" }, accessToken: "valid-token-for-test" });
  mocks.access.mockResolvedValue({ canPlan: true, paid: true });
  mocks.context.mockImplementation(async () => context);
  mocks.save.mockImplementation(async (input) => {
    for (const entry of input.entries) {
      context.initialRecipeIds[entry.date] = entry.recipeId;
      if (entry.locked) context.initialLockedRecipeIds[entry.date] = entry.recipeId;
      else delete context.initialLockedRecipeIds[entry.date];
      context.initialSkippedDates = context.initialSkippedDates.filter((date) => date !== entry.date);
      if (entry.skipped) context.initialSkippedDates.push(entry.date);
    }
    return { ok: true };
  });
});
describe("アプリの献立調整", () => {
  it("認証失敗と利用期限切れでは献立を返さず保存もしない", async () => {
    mocks.authorize.mockResolvedValueOnce(new Response(null, { status: 401 }));
    expect((await GET(request())).status).toBe(401);
    mocks.access.mockResolvedValue({ canPlan: false });
    expect((await PATCH(request("PATCH", {}))).status).toBe(403);
    expect(mocks.context).not.toHaveBeenCalled(); expect(mocks.save).not.toHaveBeenCalled();
  });
  it("出所の制限とiPhone用プリフライトを適用する", async () => {
    expect(OPTIONS(request("OPTIONS")).status).toBe(204);
    expect((await PATCH(request("PATCH", {}, undefined, "https://other.test"))).status).toBe(403);
    expect(mocks.authorize).not.toHaveBeenCalled();
  });
  it("不正な日付・表示を受け付けない", async () => {
    expect((await GET(request("GET", undefined, "date=2026-02-30"))).status).toBe(400);
    expect((await GET(request("GET", undefined, "view=invalid"))).status).toBe(400);
  });
  it("買い物曜日を起点に月をまたぐ週をWebと同じ日付で返す", async () => {
    const value = await snapshot("date=2026-11-01&view=week");
    expect(value.days.map((day: { date: string }) => day.date)).toEqual(["2026-10-31", "2026-11-01", "2026-11-02", "2026-11-03", "2026-11-04", "2026-11-05", "2026-11-06"]);
  });
  it("主菜変更を月全体で保存し、ほかの日は保持して再読込できる", async () => {
    const original = toSavedDinnerEntries(resolveMonthlyDinnerPlan(2026, 10, context));
    const value = await snapshot(); const day = value.days[0]; const recipeId = day.alternatives[0].id;
    expect((await PATCH(request("PATCH", { date: day.date, revision: day.revision, change: { kind: "recipe", recipeId } }))).status).toBe(200);
    const saved = mocks.save.mock.calls[0][0];
    expect(saved.entries).toHaveLength(31); expect(saved.servings).toBe(4);
    expect(saved.entries.filter((entry: { date: string }) => entry.date !== day.date)).toEqual(original.filter((entry) => entry.date !== day.date));
    expect((await snapshot()).days[0].recipeId).toBe(recipeId);
  });
  it("作らない日は夕食の材料を除外し、戻すと元の料理・固定・副菜を保持する", async () => {
    const date = "2026-10-24"; const side = { id: "20000000-0000-4000-8000-000000000001", name: "冷ややっこ", ingredientsText: "豆腐 100g", steps: ["盛り付ける"] };
    context.initialLockedRecipeIds[date] = recipes[0].id; context.sideDishes = [side]; context.initialSideSelections[date] = { mode: "custom", sideDishId: side.id };
    const day = (await snapshot()).days[0];
    expect((await PATCH(request("PATCH", { date, revision: day.revision, change: { kind: "skip", skipped: true } }))).status).toBe(200);
    const skipped = (await snapshot()).days[0]; expect(skipped).toMatchObject({ skipped: true, locked: true, sideDishId: side.id, recipeId: recipes[0].id });
    const dinners = resolveMonthlyDinnerPlan(2026, 10, context);
    const shopping = buildPlannedShopping({ start: date, end: date, dinners, breakfastVersions: [], servings: 4 });
    expect(shopping.groups.flatMap((group) => group.items)).toEqual([]);
    expect((await PATCH(request("PATCH", { date, revision: skipped.revision, change: { kind: "skip", skipped: false } }))).status).toBe(200);
    expect((await snapshot()).days[0]).toMatchObject({ skipped: false, locked: true, sideDishId: side.id, recipeId: recipes[0].id });
  });
  it("表示後に献立が変わった場合は古い状態で上書きしない", async () => {
    const day = (await snapshot()).days[0]; context.initialSkippedDates.push(day.date);
    expect((await PATCH(request("PATCH", { date: day.date, revision: day.revision, change: { kind: "skip", skipped: true } }))).status).toBe(409);
    expect(mocks.save).not.toHaveBeenCalled();
  });
  it("家族の候補にない料理や副菜を保存しない", async () => {
    const day = (await snapshot()).days[0];
    for (const change of [{ kind: "recipe", recipeId: "90000000-0000-4000-8000-000000000001" }, { kind: "side", mode: "custom", sideDishId: "90000000-0000-4000-8000-000000000001" }]) {
      expect((await PATCH(request("PATCH", { date: day.date, revision: day.revision, change }))).status).toBe(422);
    }
    expect(mocks.save).not.toHaveBeenCalled();
  });
  it("家族のアレルギーに一致する副菜は候補と保存の両方で除外する", async () => {
    context.preferences.allergies = ["卵"];
    const side = { id: "20000000-0000-4000-8000-000000000002", name: "卵焼き", ingredientsText: "卵 2個", steps: ["焼く"] };
    context.sideDishes = [side];
    const value = await snapshot(); expect(value.sideDishes).toEqual([]);
    const day = value.days[0];
    expect((await PATCH(request("PATCH", { date: day.date, revision: day.revision, change: { kind: "side", mode: "custom", sideDishId: side.id } }))).status).toBe(422);
    expect(mocks.save).not.toHaveBeenCalled();
  });
  it("保存失敗を成功として返さない", async () => {
    const day = (await snapshot()).days[0]; mocks.save.mockResolvedValue({ ok: false });
    expect((await PATCH(request("PATCH", { date: day.date, revision: day.revision, change: { kind: "skip", skipped: true } }))).status).toBe(422);
  });
});
