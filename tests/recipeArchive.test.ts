import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migrationSource = readFileSync("supabase/migrations/202609020024_archive_household_recipes.sql", "utf8");
const exclusionMigrationSource = readFileSync("supabase/migrations/202609050027_household_recipe_exclusions.sql", "utf8");
const actionSource = readFileSync("src/app/app/recipes/actions.ts", "utf8");
const buttonSource = readFileSync("src/components/features/recipes/ArchiveRecipeButton.tsx", "utf8");
const recipesPageSource = readFileSync("src/app/app/recipes/page.tsx", "utf8");
const plannerServerSource = readFileSync("src/lib/nutrition/server.ts", "utf8");
const plannerActionSource = readFileSync("src/app/app/planner/actions.ts", "utf8");

describe("メニュー削除", () => {
  it("既存データを物理削除せず非表示にする列と索引を追加する", () => {
    expect(migrationSource).toContain("add column if not exists archived_at timestamptz");
    expect(migrationSource).toContain("recipes_household_active_idx");
    expect(migrationSource).toContain("where archived_at is null");
    expect(migrationSource).not.toMatch(/delete\s+from/i);
  });

  it("わが家のメニューは認証ユーザーと同じ家族のデータだけを非表示にする", () => {
    expect(actionSource).toContain('recipeKind: z.literal("custom")');
    expect(actionSource).toContain('.from("profiles")');
    expect(actionSource).toContain('.update({ archived_at: new Date().toISOString() })');
    expect(actionSource).toContain('.eq("id", parsed.data.recipeId)');
    expect(actionSource).toContain('.eq("household_id", profile.household_id)');
    expect(actionSource).not.toMatch(/\.delete\(\)/);
  });

  it("公式メニューは家庭ごとに安全に除外する", () => {
    expect(exclusionMigrationSource).toContain("create table if not exists public.household_recipe_exclusions");
    expect(exclusionMigrationSource).toContain("primary key (household_id, recipe_key)");
    expect(exclusionMigrationSource).toContain("enable row level security");
    expect(exclusionMigrationSource).toContain("grant update (archived_at) on table public.recipes to authenticated");
    expect(actionSource).toContain('recipeKind: z.literal("official")');
    expect(actionSource).toContain('.from("household_recipe_exclusions").insert');
    expect(actionSource).toContain("officialRecipeKeys.has");
  });

  it("公式・わが家のどちらも削除前に確認する", () => {
    expect(buttonSource).toContain("window.confirm");
    expect(buttonSource).toContain("メニュー一覧と今後の献立候補から非表示になります。");
    expect(recipesPageSource).toContain('recipeKind="custom"');
    expect(recipesPageSource).toContain('recipeKind="official"');
  });

  it("一覧・献立生成・保存から非表示メニューを除外する", () => {
    expect(recipesPageSource).toContain('.is("archived_at", null)');
    expect(recipesPageSource).toContain('.from("household_recipe_exclusions").select("recipe_key")');
    expect(plannerServerSource).toContain('.is("archived_at", null)');
    expect(plannerServerSource).toContain('.from("household_recipe_exclusions").select("recipe_key")');
    expect(plannerServerSource).toContain("excludedOfficialRecipeKeys.has(recipe.id)");
    expect(plannerActionSource).toContain('.is("archived_at", null)');
  });
});
