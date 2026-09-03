import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migrationSource = readFileSync("supabase/migrations/202609020024_archive_household_recipes.sql", "utf8");
const actionSource = readFileSync("src/app/app/recipes/actions.ts", "utf8");
const buttonSource = readFileSync("src/components/features/recipes/ArchiveRecipeButton.tsx", "utf8");
const recipesPageSource = readFileSync("src/app/app/recipes/page.tsx", "utf8");
const plannerServerSource = readFileSync("src/lib/nutrition/server.ts", "utf8");
const plannerActionSource = readFileSync("src/app/app/planner/actions.ts", "utf8");

describe("わが家のメニュー削除", () => {
  it("既存データを物理削除せず非表示にする列と索引を追加する", () => {
    expect(migrationSource).toContain("add column if not exists archived_at timestamptz");
    expect(migrationSource).toContain("recipes_household_active_idx");
    expect(migrationSource).toContain("where archived_at is null");
    expect(migrationSource).not.toMatch(/delete\s+from/i);
  });

  it("認証ユーザーと同じ家族のメニューだけを非表示にする", () => {
    expect(actionSource).toContain("z.string().uuid()");
    expect(actionSource).toContain('.from("profiles")');
    expect(actionSource).toContain('.update({ archived_at: new Date().toISOString() })');
    expect(actionSource).toContain('.eq("id", parsed.data.recipeId)');
    expect(actionSource).toContain('.eq("household_id", profile.household_id)');
    expect(actionSource).not.toMatch(/\.delete\(\)/);
  });

  it("削除前に確認し、公式メニューには削除操作を表示しない", () => {
    expect(buttonSource).toContain("window.confirm");
    expect(buttonSource).toContain("メニュー一覧と今後の献立候補から非表示になります。");
    expect(recipesPageSource).toContain("custom && id ? <ArchiveRecipeButton");
  });

  it("一覧・献立生成・保存から非表示メニューを除外する", () => {
    expect(recipesPageSource).toContain('.is("archived_at", null)');
    expect(plannerServerSource).toContain('.is("archived_at", null)');
    expect(plannerActionSource).toContain('.is("archived_at", null)');
  });
});
