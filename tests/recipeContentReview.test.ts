import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchImportedRecipe } from "@/lib/recipes/importer";
import { heldRecipePlaceholder, heldRecipeMessage } from "@/lib/recipes/contentReview";
import { resolveMonthlyDinnerPlan } from "@/lib/nutrition/planner";
import { buildPlannedShopping } from "@/lib/shopping/build";
import { isDinnerCandidate, isManualDinnerCandidate } from "@/lib/nutrition/cookingTime";
import { menuEntries } from "@/lib/recipes/mobileCatalog";

afterEach(() => vi.unstubAllGlobals());
describe("公開確認待ちの本文", () => {
  it("対応外URLでは外部へ通信しない", async () => {
    const fetch = vi.fn(); vi.stubGlobal("fetch", fetch);
    await expect(fetchImportedRecipe("https://example.com/recipes/123456")).rejects.toMatchObject({ code: "unsupported_site" });
    expect(fetch).not.toHaveBeenCalled();
  });
  it("DBで配信されない静的メニューを一覧へ復活させない", () => { expect(menuEntries([], [], "household")).toEqual([]); });
  it("予定のIDとロックを保持し、新しい候補には入れず、買い物に欠落を明示する", () => {
    const held = heldRecipePlaceholder({ recipe_id: "held", recipe_name: "元の料理" });
    expect(isDinnerCandidate(held)).toBe(false); expect(isManualDinnerCandidate(held)).toBe(false);
    const plan = resolveMonthlyDinnerPlan(2026, 11, { recipes: [held], preferredRecipeIds: [], initialRecipeIds: { "2026-11-08": "held" }, initialLockedRecipeIds: { "2026-11-08": "held" } });
    const day = plan.find(day => day.date === "2026-11-08")!;
    expect(day.recipe.id).toBe("held"); expect(day.locked).toBe(true); expect(day.recipe.eveningSteps).toEqual([heldRecipeMessage]);
    const shopping = buildPlannedShopping({ start: "2026-11-08", end: "2026-11-08", dinners: plan, breakfastVersions: [], servings: 4 });
    expect(shopping.groups).toEqual([]);
    expect(shopping.warnings.some(w => w.includes("主菜を選び直してください"))).toBe(true);
  });
});
