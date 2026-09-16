import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ custom: [] as unknown[], community: [] as unknown[], exclusions: [] as unknown[] }));
vi.mock("@/lib/supabase/server", () => ({ getSupabaseServer: async () => ({
  auth: { getUser: async () => ({ data: { user: { id: "user" } } }) },
  from: (table: string) => {
    let householdRecipes = false;
    const result = () => ({ data: table === "profiles" ? { household_id: "household" }
      : table === "household_subscriptions" ? null : table === "household_recipe_exclusions" ? mocks.exclusions
      : householdRecipes ? mocks.custom : mocks.community });
    const query = {
      select: () => query, eq: () => query, is: () => query, neq: () => query, contains: () => query,
      not: () => { householdRecipes = true; return query; }, order: () => query,
      maybeSingle: async () => result(), then: (resolve: (value: unknown) => unknown) => Promise.resolve(result()).then(resolve),
    };
    return query;
  },
}) }));
vi.mock("@/components/features/recipes/ArchiveRecipeButton", () => ({ ArchiveRecipeButton: () => <button>削除</button> }));
import RecipesPage from "@/app/app/recipes/page";

beforeEach(() => { mocks.custom = []; mocks.community = []; mocks.exclusions = []; });
const row = (id: string, minutes: number, meta = {}) => ({ id, name: id, cook_minutes: minutes, meta });
describe("メニュー一覧の40分条件", () => {
  it("公式・共有・自分のメニューすべてに完成までの上限を適用する", async () => {
    mocks.custom = [row("自分の短い料理", 40), row("自分の長い料理", 15, { total_minutes: 41 })];
    mocks.community = [row("共有の短い料理", 40), row("共有の長い料理", 41)];
    const html = renderToStaticMarkup(await RecipesPage({ searchParams: Promise.resolve({}) }));
    expect(html).toContain("自分の短い料理");
    expect(html).toContain("共有の短い料理");
    expect(html).toContain("豚のしょうが焼き");
    expect(html).not.toContain("自分の長い料理");
    expect(html).not.toContain("共有の長い料理");
    expect(html).toContain("鮭の塩焼き");
    expect(html).not.toContain("さわらの西京焼き");
  });
  it("家庭の除外設定と時間未確認のアレンジも反映する", async () => {
    mocks.custom = [row("アレンジ", 15, { step_customization: true, source_recipe_id: "共有の短い料理", nutrition_catalog_id: "pork-ginger" })];
    mocks.community = [row("共有の短い料理", 40)];
    mocks.exclusions = [{ recipe_key: "gyudon" }];
    const html = renderToStaticMarkup(await RecipesPage({ searchParams: Promise.resolve({}) }));
    expect(html).not.toContain("共有の短い料理");
    expect(html).not.toContain("豚のしょうが焼き");
    expect(html).not.toContain("牛丼");
    expect(html).toContain("時間未確認の料理");
  });
});
