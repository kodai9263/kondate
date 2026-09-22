import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { RecipeCookingGuide } from "@/components/features/recipes/RecipeCookingGuide";
import { getRecipeServings, scaleRecipeIngredient } from "@/lib/family/servings";
import { officialRecipeDetails } from "@/lib/nutrition/recipeDetails";
import { officialNutritionRecipes } from "@/lib/nutrition/catalog";
import { auditedCommunityRecipe } from "@/lib/recipes/communityRecipeDetails";
import { mergeTodayPlan, type DailyPlanRow } from "@/lib/today/server";
import { menuData } from "@/lib/menuData";
import { findTodayPlan } from "@/lib/services/planService";
import { getSeasoningGroups, getStepSeasoningIds } from "@/lib/recipes/seasoningGroups";

describe("初心者向けレシピの分量と表示", () => {
  it("4人分を2人分にすると、少量の調味料や端数の材料も同じ比率になる", () => {
    expect(scaleRecipeIngredient("卵 3個・米 3合・大根 8cm・魚 2尾・チーズ 15g・水 150ml", 2)).toBe("卵 1.5個・米 1.5合・大根 4cm・魚 1尾・チーズ 7.5g・水 75ml");
    expect(scaleRecipeIngredient("醤油/みりん 各大さじ1.5・塩 小さじ1/4・豆腐 1/2丁", 2)).toBe("醤油/みりん 各大さじ3/4・塩 小さじ1/8・豆腐 1/4丁");
    expect(scaleRecipeIngredient("キャベツ 1/6個", 2)).toBe("キャベツ 1/12個");
    expect(scaleRecipeIngredient("油 大さじ1と1/2・牛乳 1 1/2カップ", 2)).toBe("油 大さじ3/4・牛乳 3/4カップ");
  });

  it("4人分・適量・少々を変えず、人数不明では無理に換算しない", () => {
    const line = "醤油 大さじ1/2・塩 少々・だし汁 適量";
    expect(scaleRecipeIngredient(line, 4)).toBe(line);
    expect(scaleRecipeIngredient(line, 2, 0)).toBe(line);
    expect(scaleRecipeIngredient(line, NaN)).toBe(line);
    expect(getRecipeServings({ adultCount: 2, childCount: 3 })).toBe(4);
    expect(getRecipeServings({ adultCount: 2, childCount: 0 })).toBe(2);
  });

  it("全95品が材料と番号付き工程を表示できる", () => {
    const recipes = [...Object.values(officialRecipeDetails), auditedCommunityRecipe.detail];
    expect(recipes).toHaveLength(95);
    for (const recipe of recipes) {
      const html = renderToStaticMarkup(<RecipeCookingGuide ingredients={recipe.ingredients} steps={recipe.steps} morning={[]} baseServings={4} totalMinutes={recipe.totalMinutes} notes={recipe.notes} scalable />);
      expect(html).toContain("材料・調味料");
      expect(html).toContain(`工程${recipe.steps.length}：`);
      expect(html).toContain("作る人数");
      expect(recipe.steps.join("\n")).not.toMatch(/工程\d+の材料/);
      const groupIds = new Set(getSeasoningGroups(recipe.ingredients).map((group) => group.id));
      expect(recipe.steps.flatMap(getStepSeasoningIds).every((id) => groupIds.has(id))).toBe(true);
      expect(recipe.totalMinutes).toBeGreaterThanOrEqual(25);
    }
  });

  it("欠落していた副菜を材料から仕上げまで用意し、炊き込みご飯の名前をそろえる", () => {
    for (const key of ["chinese-bowl", "mapo-fried-rice", "liver-chive-stir-fry"]) {
      expect(officialRecipeDetails[key].ingredients.join("\n")).toContain("【スープ】");
      expect(officialRecipeDetails[key].steps.join("\n")).toMatch(/スープ.*鍋|鍋.*スープ/);
      expect(officialRecipeDetails[key].steps.at(-1)).toMatch(/スープ/);
    }
    expect(officialNutritionRecipes.find((recipe) => recipe.id === "spicy-hiyayakko")?.side).toContain("炊き込みご飯");
    expect(officialRecipeDetails["spicy-hiyayakko"].totalMinutes).toBeGreaterThanOrEqual(60);
    expect(officialRecipeDetails["omelet-rice"].steps.join("\n")).toContain("卵液と卵用の油を人数分に分ける");
  });

  it("牡蠣は別鍋で加熱し、レバーは厚みと中心温度を確認する", () => {
    const oyster = officialRecipeDetails["oyster-rice"].steps.join("\n");
    expect(oyster).toMatch(/別鍋.*牡蠣/);
    expect(oyster).toContain("85〜90℃で90秒以上");
    expect(oyster).toContain("加熱済みの牡蠣");
    const liver = officialRecipeDetails["liver-chive-stir-fry"].steps.join("\n");
    expect(liver).toContain("5mm");
    expect(liver).toContain("75℃以上で1分");
    for (const key of ["salmon", "sanma", "salt-grilled-mackerel"]) {
      expect(officialRecipeDetails[key].steps.join("\n")).toContain("グリルで1〜2分ずつ追加");
    }
  });

  it("今日画面へ新しい材料基準を渡し、家庭アレンジに自動換算を適用しない", () => {
    const row: DailyPlanRow = {
      plan_entry_id: "entry", meal_type: "dinner", recipe_name: "レシピ", prep_minutes: 0, cook_minutes: 20,
      meta: { total_minutes: 40, servings_base: 4, recipe_detail_version: 2, recipe_notes: ["待ち時間を含む"], ingredients_text: "卵 3個" },
      steps: [{ id: "step", phase: "evening", text: "卵を焼く", checked: false }],
    };
    const fallback = findTodayPlan(menuData);
    const result = mergeTodayPlan(fallback, [row]).dinner;
    expect(result).toMatchObject({ totalMin: 40, servingsBase: 4, ingredientsScalable: true, morning: [], evening: ["卵を焼く"], seasonings: ["卵 3個"] });
    expect(mergeTodayPlan(fallback, [{ ...row, meta: { ...row.meta, step_customization: true } }]).dinner.ingredientsScalable).toBe(false);
  });
});
