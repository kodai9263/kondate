import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { RecipeCookingGuide } from "@/components/features/recipes/RecipeCookingGuide";
import { scaleRecipeIngredient } from "@/lib/family/servings";
import { officialRecipeDetails } from "@/lib/nutrition/recipeDetails";
import { auditedCommunityRecipe } from "@/lib/recipes/communityRecipeDetails";

const recipes = [...Object.entries(officialRecipeDetails), ["community", auditedCommunityRecipe.detail] as const];

// 単位の実装に依存せず、材料に書かれた全数値が同じ倍率になることを検査する。
function quantities(text: string) {
  return [...text.matchAll(/\d+(?:\.\d+)?(?:\/\d+)?(?:と\d+\/\d+)?/g)].map(([raw]) =>
    raw.split("と").reduce((sum, part) => {
      const [numerator, denominator = 1] = part.split("/").map(Number);
      return sum + numerator / denominator;
    }, 0));
}

describe("95品の整合性の再検証", () => {
  it.each(Array.from({ length: 16 }, (_, index) => index + 1))("全95品を%d人分にしても分量の比率と材料名が変わらない", (servings) => {
    for (const [id, recipe] of recipes) {
      for (const ingredient of recipe.ingredients) {
        const scaled = scaleRecipeIngredient(ingredient, servings);
        const before = quantities(ingredient);
        const after = quantities(scaled);
        expect(after.length, `${id}: ${ingredient}`).toBe(before.length);
        before.forEach((amount, index) => expect(after[index], `${id}: ${scaled}`).toBeCloseTo(amount * servings / 4, 3));
        expect(scaled.replace(/[\d./と]/g, ""), id).toBe(ingredient.replace(/[\d./と]/g, ""));
        expect(scaled).not.toMatch(/NaN|Infinity/);
      }
    }
  });

  it("生米を炊く料理に炊飯済みという前提を置かず、合数と容量の注意を示す", () => {
    const rawRiceRecipes = recipes.filter(([, recipe]) => recipe.ingredients.some((line) => /米 \d/.test(line)));
    expect(rawRiceRecipes).toHaveLength(7);
    for (const [id, recipe] of rawRiceRecipes) {
      expect(recipe.notes.join("\n"), id).not.toContain("温かいごはんを用意した状態");
      expect(recipe.notes.join("\n"), id).toContain("対応する目盛りがない場合");
      expect(recipe.totalMinutes, id).toBeGreaterThanOrEqual(75);
      if (recipe.steps.join("\n").includes("30分浸す")) expect(recipe.totalMinutes, id).toBeGreaterThanOrEqual(105);
    }
    const takenoko = officialRecipeDetails["takenoko-chicken-rice"];
    expect(takenoko.ingredients.join("\n")).not.toContain("【炊飯用】水");
    expect(takenoko.notes.join("\n")).toContain("水を別に追加しない");
  });

  it("切り方の寸法と説明に別の等分数を混ぜない", () => {
    const pork = officialRecipeDetails["pork-ginger"].steps[0];
    expect(pork).toContain("縦半分にし、それぞれを放射状に4等分");
    expect(pork).not.toContain("6等分");
    const beef = officialRecipeDetails["mushroom-beef-rice"].steps.find((step) => step.includes("かぶは"));
    expect(beef).toContain("5mm");
    expect(beef).not.toMatch(/等分/);
  });

  it("追加加熱の器具をグリル・オーブンそれぞれに合わせる", () => {
    const grill = officialRecipeDetails["sawara-saikyo"].steps.join("\n");
    expect(grill).toContain("グリルで1〜2分ずつ追加");
    const oven = officialRecipeDetails["aji-herb-grill"].steps.join("\n");
    expect(oven).toContain("オーブンで2分ずつ追加");
    expect(oven).not.toContain("ふたをして弱火");
  });

  it("主菜の作業中はスープの火を止め、食べる前に温め直す", () => {
    for (const id of ["greenpea-omelet", "aji-herb-grill", "nanohana-chicken", "takenoko-chicken-rice"]) {
      const steps = officialRecipeDetails[id].steps.join("\n");
      expect(steps, id).toMatch(/火を止め/);
      expect(steps, id).toContain("温め直");
    }
  });

  it("特殊な道具を工程本文だけでなく道具一覧に表示する", () => {
    for (const [id, tool] of [["nanohana-chicken", "ハンドブレンダー"], ["aji-nanban", "揚げ物用温度計"]]) {
      const recipe = officialRecipeDetails[id];
      const html = renderToStaticMarkup(<RecipeCookingGuide ingredients={recipe.ingredients} steps={recipe.steps} morning={[]} baseServings={4} />);
      const equipmentSection = html.match(/<section><h2[^>]*>使う道具<\/h2>(.*?)<\/section>/)?.[1];
      expect(equipmentSection, id).toContain(tool);
    }
    const frying = officialRecipeDetails["aji-nanban"].steps.join("\n");
    expect(frying).toContain("底から3cm");
    expect(frying).toContain("最低油量");
    const blending = officialRecipeDetails["nanohana-chicken"].steps.join("\n");
    expect(blending).toContain("扱える温度まで冷まして");
  });
});
