import { beforeEach, describe, expect, it, vi } from "vitest";
import { officialNutritionRecipes } from "@/lib/nutrition/catalog";
const mocks = vi.hoisted(() => ({ authorize: vi.fn(), from: vi.fn() }));
vi.mock("@/lib/mobile/request", async (original) => ({ ...await original<typeof import("@/lib/mobile/request")>(), authorizeMobileRequest: mocks.authorize }));
import { GET, OPTIONS } from "@/app/api/mobile/v1/recipes/route";
import { menuEntries, type MenuRow } from "@/lib/recipes/mobileCatalog";
const row: MenuRow = { id: "own", name: "わが家のカレー", household_id: "family", cook_minutes: 30, servings_base: 4, meta: { total_minutes: 30, ingredients_text: "玉ねぎ 1個" } };
let tables: Record<string, { data: unknown[]; error: unknown }>;
function request(query = "", origin = "capacitor://localhost") { return new Request(`https://example.com/api/mobile/v1/recipes${query}`, { headers: { Origin: origin } }); }
beforeEach(() => {
  tables = { recipes: { data: [row], error: null }, household_recipe_exclusions: { data: [], error: null }, recipe_steps: { data: [{ phase: "evening", position: 1, text: "煮る" }], error: null } };
  mocks.from.mockImplementation((name) => { const chain = { select: () => chain, eq: () => chain, is: () => chain, order: () => chain, then: (resolve: (value: unknown) => unknown) => Promise.resolve(tables[name]).then(resolve) }; return chain; });
  mocks.authorize.mockResolvedValue({ householdId: "family", supabase: { from: mocks.from } });
});
describe("アプリのメニュー", () => {
  it("本人の家族の料理だけを返す", async () => { tables.recipes.data.push({ ...row, id: "other", household_id: "another" }); const value = await (await GET(request())).json(); expect(value.items.filter((item: { kind: string; id: string }) => item.kind === "custom").map((item: MenuRow) => item.id)).toEqual(["own"]); });
  it("別の家族の詳細を返さない", async () => { tables.recipes.data.push({ ...row, id: "other", household_id: "another" }); expect((await GET(request("?kind=custom&id=other"))).status).toBe(404); });
  it("材料・順序付き工程を返す", async () => { const value = await (await GET(request("?kind=custom&id=own"))).json(); expect(value.recipe).toMatchObject({ name: row.name, ingredients: ["玉ねぎ 1個"], steps: ["煮る"], servings: 4 }); });
  it("材料工程があればメタデータより優先する", async () => { tables.recipe_steps.data.push({ phase: "seasoning", position: 1, text: "玉ねぎ 2個" }); const value = await (await GET(request("?kind=custom&id=own"))).json(); expect(value.recipe.ingredients).toEqual(["玉ねぎ 2個"]); });
  it("認証失敗とDB障害を成功にしない", async () => { mocks.authorize.mockResolvedValueOnce(new Response(null, { status: 401 })); expect((await GET(request())).status).toBe(401); tables.recipes.error = {}; expect((await GET(request())).status).toBe(503); });
  it("不許可の接続元を拒否する", async () => { expect((await GET(request("", "https://evil.example"))).status).toBe(403); expect(OPTIONS(request()).status).toBe(204); });
  it("Web同様、除外した標準料理と40分を超える料理を一覧に含めない", () => { const id = officialNutritionRecipes[0].id; const result = menuEntries([row, { ...row, id: "slow", meta: { total_minutes: 60 } }], [id], "family"); expect(result.some((item) => item.id === id || item.id === "slow")).toBe(false); expect(result.some((item) => item.id === "own")).toBe(true); });
  it("非公開の共通データや工程アレンジ用の複製を一覧に含めない", () => { const result = menuEntries([{ ...row, id: "hidden", household_id: null }, { ...row, id: "copy", meta: { step_customization: true, total_minutes: 30 } }], [], "family"); expect(result.some((item) => ["hidden", "copy"].includes(item.id))).toBe(false); });
});
