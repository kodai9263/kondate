import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchImportedRecipe, parseRecipeHtml } from "@/lib/recipes/importer";
import { buildPlannedShopping } from "@/lib/shopping/build";
import type { NutritionRecipe } from "@/types/nutrition";
const url = "https://cookpad.com/jp/recipes/123456";
const html = (extra = {}) => `<script type="application/ld+json">${JSON.stringify({ "@type": "Recipe", name: "テスト料理", recipeYield: "2人分", recipeIngredient: ["大根 1/2本", "卵 2個", "醤油 大さじ1"], recipeInstructions: ["切る", "加熱する"], ...extra })}</script>`;
afterEach(() => vi.unstubAllGlobals());
describe("家族内URL取り込み", () => {
  it("公開ページの材料・工程・元人数を取得する", async () => {
    const fetch = vi.fn().mockResolvedValue(new Response(html(), { headers: { "content-type": "text/html" } }));
    vi.stubGlobal("fetch", fetch);
    expect(await fetchImportedRecipe(url)).toMatchObject({ name: "テスト料理", sourceServings: 2, steps: "切る\n加熱する", sourceUrl: url });
    expect(fetch.mock.calls[0][1]).toMatchObject({ redirect: "manual", cache: "no-store" });
  });
  it("転送先が内部アドレスなら取得しない", async () => {
    const fetch = vi.fn().mockResolvedValue(new Response(null, { status: 302, headers: { location: "http://127.0.0.1/private" } }));
    vi.stubGlobal("fetch", fetch);
    await expect(fetchImportedRecipe(url)).rejects.toMatchObject({ code: "invalid_url" });
    expect(fetch).toHaveBeenCalledOnce();
  });
  it("アクセス制限されたページは迂回せず失敗する", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("denied", { status: 403 })));
    await expect(fetchImportedRecipe(url)).rejects.toMatchObject({ code: "fetch_failed" });
  });
  it("大きすぎるページを途中で打ち切る", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("x".repeat(2_000_001), { headers: { "content-type": "text/html" } })));
    await expect(fetchImportedRecipe(url)).rejects.toMatchObject({ code: "fetch_failed" });
  });
  it("長い材料を切り捨てて成功にしない", () => {
    expect(() => parseRecipeHtml(html({ recipeIngredient: ["あ".repeat(4001)] }), url)).toThrow();
  });
  it("曖昧な人数は確認を促し、個数を人数と誤認しない", () => {
    expect(parseRecipeHtml(html({ recipeYield: "４人分〜" }), url)).toMatchObject({ sourceServings: 4, warnings: expect.arrayContaining([expect.stringContaining("目安")]) });
    expect(parseRecipeHtml(html({ recipeYield: "12個" }), url).sourceServings).toBeNull();
  });
  it("取り込んだ2人分を献立に選ぶと買い物リストだけを4人分に換算する", () => {
    const imported = parseRecipeHtml(html(), url);
    const recipe: NutritionRecipe = { id: "recipe", name: imported.name, side: "", cookMinutes: 25, proteinSource: imported.proteinSource, imageUrl: "", nutrition: null, isCustom: true, ingredientsText: imported.ingredients, servingsBase: imported.sourceServings! };
    const shopping = buildPlannedShopping({ start: "2026-11-08", end: "2026-11-08", servings: 4, breakfastVersions: [], dinners: [{ date: "2026-11-08", recipe, locked: false }] });
    const items = shopping.groups.flatMap(group => group.items);
    expect(items.find(item => item.label.startsWith("大根 "))?.label).toContain("1本");
    expect(items.find(item => item.label.startsWith("卵 "))?.label).toContain("4個");
    expect(imported.ingredients).toContain("大根 1/2本");
  });
});
