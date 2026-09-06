import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migrationSource = readFileSync("supabase/migrations/202609060030_recipe_step_customizations.sql", "utf8");
const recipesPageSource = readFileSync("src/app/app/recipes/page.tsx", "utf8");
const editorPageSource = readFileSync("src/app/app/recipes/[kind]/[identifier]/page.tsx", "utf8");
const actionSource = readFileSync("src/app/app/recipes/[kind]/[identifier]/actions.ts", "utf8");
const plannerServerSource = readFileSync("src/lib/nutrition/server.ts", "utf8");
const resetButtonSource = readFileSync("src/components/features/recipes/ResetRecipeStepsButton.tsx", "utf8");

describe("メニュー工程のアレンジ", () => {
  it("公式レシピを直接変更せず、家庭用のアレンジ版を作る", () => {
    expect(migrationSource).toContain("save_recipe_step_customization");
    expect(migrationSource).toContain("'step_customization', true");
    expect(migrationSource).toContain("'source_recipe_id', source_recipe.id::text");
    expect(migrationSource).toContain("recipes_active_step_customization_idx");
    expect(migrationSource).not.toMatch(/delete from public\.recipes/i);
  });

  it("工程の追加・削除・並べ替えを改行順で保存する", () => {
    expect(editorPageSource).toContain("1行が1つの工程");
    expect(editorPageSource).toContain('name="morningSteps"');
    expect(editorPageSource).toContain('name="eveningSteps"');
    expect(migrationSource).toContain("with ordinality as line(text, position)");
    expect(migrationSource).toContain("phase in ('morning', 'evening')");
  });

  it("Server Action内で入力検証と認証を行う", () => {
    expect(actionSource).toContain("saveStepsSchema.safeParse");
    expect(actionSource).toContain("supabase.auth.getUser()");
    expect(actionSource).toContain('.rpc("save_recipe_step_customization"');
  });

  it("アレンジ版を今日以降の献立と月間候補へ反映する", () => {
    expect(migrationSource).toContain("date >= (timezone('Asia/Tokyo', now()))::date");
    expect(migrationSource).toContain("set recipe_id = customized_recipe_id");
    expect(plannerServerSource).toContain("stepCustomizationIds.set(sourceRecipeId, row.id)");
    expect(plannerServerSource).toContain("stepCustomizationIds.get(databaseId)");
    expect(plannerServerSource.indexOf("stepCustomizationIds.set")).toBeLessThan(plannerServerSource.indexOf("mapCustomRecipe(row"));
  });

  it("カードから編集画面を開き、公式工程へ戻せる", () => {
    expect(recipesPageSource).toContain("/app/recipes/official/");
    expect(recipesPageSource).toContain("/app/recipes/custom/");
    expect(editorPageSource).toContain("resetRecipeSteps");
    expect(resetButtonSource).toContain("window.confirm");
    expect(migrationSource).toContain("reset_recipe_step_customization");
    expect(migrationSource).toContain("set archived_at = now()");
  });
});
