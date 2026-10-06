import { beforeEach, describe, expect, it, vi } from "vitest";

const mock = vi.hoisted(() => ({ rows: [] as Record<string, unknown>[], official: [] as Record<string, unknown>[] }));
vi.mock("@/lib/family/server", () => ({ getCurrentHouseholdPreferences: async () => ({ allergies: [] }) }));
vi.mock("@/lib/nutrition/catalog", () => ({ officialNutritionRecipes: [{ id: "karaage", name: "鶏のから揚げ", side: "キャベツ", cookMinutes: 30, proteinSource: "meat", nutrition: {} }] }));
vi.mock("@/lib/supabase/server", () => ({ getSupabaseServer: async () => ({
  from: (table: string) => {
    let publicRows = false;
    const query = {
      select: () => query, not: () => query, neq: () => query, eq: () => query,
      is: (column: string, value: unknown) => { if (column === "household_id" && value === null) publicRows = true; return query; },
      order: () => query, limit: () => query, gte: () => query, lte: () => query,
      then: (resolve: (value: unknown) => unknown) => Promise.resolve({ data: table === "recipes" ? publicRows ? mock.official : mock.rows : [], error: null }).then(resolve),
    };
    return query;
  },
}) }));

import { getHouseholdPlannerContext } from "@/lib/nutrition/server";

const row = (id: string, name: string, meta: Record<string, unknown> = {}) => ({ id, name, meta, cook_minutes: 30, protein_source: "meat", recipe_nutrition: {} });
beforeEach(() => { mock.rows = []; mock.official = [row("official-db-id", "鶏のから揚げ", { nutrition_catalog_id: "karaage" })]; });

describe("献立の保存用IDと作り方の識別子", () => {
  it("公式料理は保存用DB IDを維持し、詳細にはカタログのキーを使う", async () => {
    const { recipes } = await getHouseholdPlannerContext(2026, 10);
    expect(recipes[0]).toMatchObject({ id: "official-db-id", detailIdentifier: "karaage" });
  });

  it("公式料理の工程をアレンジしても同じ公式詳細を開く", async () => {
    mock.rows = [row("customized-id", "鶏のから揚げ", { step_customization: true, source_recipe_id: "official-db-id" })];
    const { recipes } = await getHouseholdPlannerContext(2026, 10);
    expect(recipes[0]).toMatchObject({ id: "customized-id", detailIdentifier: "karaage", isCustom: false });
  });

  it("みんなの料理のアレンジは元料理の詳細識別子を引き継ぐ", async () => {
    mock.official.push(row("community-id", "みんなの煮物", { visibility: "community" }));
    mock.rows = [row("community-customized-id", "みんなの煮物", { step_customization: true, source_recipe_id: "community-id" })];
    const { recipes } = await getHouseholdPlannerContext(2026, 10);
    expect(recipes.find((recipe) => recipe.isCommunity)).toMatchObject({ id: "community-customized-id", detailIdentifier: "community-id" });
  });

  it("自作料理は自身のDB IDをそのまま利用できる", async () => {
    mock.rows = [row("custom-id", "わが家の煮物")];
    const { recipes } = await getHouseholdPlannerContext(2026, 10);
    expect(recipes.find((recipe) => recipe.isCustom)).toMatchObject({ id: "custom-id" });
  });
});
