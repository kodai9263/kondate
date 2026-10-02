import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
vi.mock("@/lib/supabase/server", () => ({ isSupabaseConfigured: () => false }));
import PublicMenusPage from "@/app/menus/page";
import { officialNutritionRecipes } from "@/lib/nutrition/catalog";
import { isDinnerCandidate } from "@/lib/nutrition/cookingTime";

describe("登録不要の公開メニュー", () => {
  it("カタログの順序にかかわらず40分以内の料理をすべて表示する", async () => {
    const page = await PublicMenusPage({ searchParams: Promise.resolve({}) });
    const html = renderToStaticMarkup(page);
    const expected = officialNutritionRecipes.filter((recipe) => isDinnerCandidate(recipe));
    for (const recipe of expected) expect(html).toContain(`/menus/official/${recipe.id}`);
    expect((html.match(/href="\/menus\/official\//g) ?? [])).toHaveLength(expected.length);
  });
  it("検索で料理を絞り、結果ゼロも案内する", async () => {
    const page = await PublicMenusPage({ searchParams: Promise.resolve({ q: "牛丼" }) });
    const html = renderToStaticMarkup(page);
    expect(html).toContain("/menus/official/gyudon");
    expect(html).not.toContain("/menus/official/salmon");
    const empty = renderToStaticMarkup(await PublicMenusPage({ searchParams: Promise.resolve({ q: "存在しない検証料理名" }) }));
    expect(empty).toContain("料理が見つかりませんでした");
  });
});
