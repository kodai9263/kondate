import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ custom: [] as unknown[], community: [] as unknown[], official: [] as unknown[], sources: [] as unknown[], owner: false, exclusions: [] as unknown[] }));
vi.mock("@/lib/supabase/server", () => ({ getSupabaseServer: async () => ({
  auth: { getUser: async () => ({ data: { user: { id: "user" } } }) },
  from: (table: string) => {
    let householdRecipes = false; let communityOnly = false;
    const result = () => ({ data: table === "profiles" ? { household_id: "household" }
      : table === "recipe_sources" ? mocks.sources : table === "recipe_permission_owner" ? mocks.owner ? { user_id: "user" } : null
      : table === "household_billing_access" ? null : table === "household_recipe_exclusions" ? mocks.exclusions
      : householdRecipes ? mocks.custom : communityOnly ? mocks.community : mocks.official });
    const query = {
      select: () => query, eq: () => query, is: () => query, neq: () => query, contains: () => { communityOnly = true; return query; },
      not: () => { householdRecipes = true; return query; }, order: () => query,
      maybeSingle: async () => result(), then: (resolve: (value: unknown) => unknown) => Promise.resolve(result()).then(resolve),
    };
    return query;
  },
}) }));
vi.mock("@/components/features/recipes/ArchiveRecipeButton", () => ({ ArchiveRecipeButton: () => <button>削除</button> }));
import RecipesPage from "@/app/app/recipes/page";

beforeEach(() => { mocks.sources = []; mocks.owner = false; mocks.custom = []; mocks.community = []; mocks.exclusions = []; mocks.official = ["肉豆腐", "鮭のムニエル", "さわらの西京焼き"].map(name => ({ id: name, name, meta: {} })); });
const row = (id: string, minutes: number, meta = {}) => ({ id, name: id, cook_minutes: minutes, meta });
describe("メニュー一覧と出典", () => {
  it("自分と共有の料理は時間に関係なく表示し、調理時間を表示しない", async () => {
    mocks.custom = [row("自分の短い料理", 40), row("自分の長い料理", 15, { total_minutes: 41 }), row("時間不明の料理", 0)];
    mocks.community = [row("共有の短い料理", 40), row("共有の長い料理", 41)];
    const html = renderToStaticMarkup(await RecipesPage({ searchParams: Promise.resolve({}) }));
    expect(html).toContain("自分の短い料理");
    expect(html).toContain("共有の短い料理");
    expect(html).toContain("肉豆腐");
    expect(html).toContain("自分の長い料理");
    expect(html).toContain("時間不明の料理");
    expect(html).not.toContain("40分");
    expect(html).not.toContain("調理 ");
    expect(html).toContain("共有の長い料理");
    expect(html).toContain("鮭のムニエル");
    expect(html).not.toContain("さわらの西京焼き");
  });
  it("家庭の除外設定と時間未確認のアレンジも反映する", async () => {
    mocks.custom = [row("アレンジ", 15, { step_customization: true, source_recipe_id: "共有の短い料理", nutrition_catalog_id: "quick-nikudofu" })];
    mocks.community = [row("共有の短い料理", 40)];
    mocks.exclusions = [{ recipe_key: "gyudon" }];
    const html = renderToStaticMarkup(await RecipesPage({ searchParams: Promise.resolve({}) }));
    expect(html).not.toContain("共有の短い料理");
    expect(html).not.toContain("肉豆腐");
    expect(html).not.toContain("牛丼");
    expect(html).not.toContain("提供元・承諾管理");
  });
  it("一般画面には出典だけを表示し、管理者だけに管理画面へのリンクを表示する", async () => {
    mocks.custom = [row("動画の料理", 90, { source_url: "https://youtu.be/example" })];
    mocks.sources = [{ recipe_id: "動画の料理", provider_name: "YouTube", author_name: "料理チャンネル", source_url: "https://youtu.be/example", video_start_seconds: 90 }];
    const html = renderToStaticMarkup(await RecipesPage({ searchParams: Promise.resolve({}) }));
    expect(html).toContain("料理チャンネル");
    expect(html).toContain("https://youtu.be/example?t=90s");
    expect(html).not.toContain("承諾");
    mocks.owner = true;
    const ownerHtml = renderToStaticMarkup(await RecipesPage({ searchParams: Promise.resolve({}) }));
    expect(ownerHtml).toContain("/admin/recipe-sources");
  });
});
