import { afterEach, describe, expect, it } from "vitest";
import { parseAllowedRecipeUrl, parseRecipeHtml, RecipeImportError } from "@/lib/recipes/importer";
import { isRecipePublisher } from "@/lib/recipes/publisher";

const originalPublisherIds = process.env.RECIPE_PUBLISHER_USER_IDS;

afterEach(() => {
  if (originalPublisherIds === undefined) delete process.env.RECIPE_PUBLISHER_USER_IDS;
  else process.env.RECIPE_PUBLISHER_USER_IDS = originalPublisherIds;
});

describe("レシピURL取り込み", () => {
  it("JSON-LDを読み取り、2人分の材料だけを4人分へ換算する", () => {
    const html = `<script data-test="recipe" type="application/ld+json">
      {"@context":"https://schema.org","@type":"Recipe","name":"なすの豚しゃぶ香味だれ","recipeYield":"2人分","totalTime":"PT10M","recipeIngredient":["なす 2本(200g)","豚肉 150g","醤油、酢 各大さじ1","ごま油 大さじ1/2","めんつゆ(3倍濃縮) 大さじ1"],"recipeInstructions":[{"@type":"HowToSection","itemListElement":[{"@type":"HowToStep","text":"なすを切る"},{"@type":"HowToStep","text":"豚肉をゆでる"}]}],"nutrition":{"calories":"350 kcal","proteinContent":"20 g","fatContent":"12 g","carbohydrateContent":"30 g","fiberContent":"4 g","saltContent":"2.1 g"}}
    </script>`;

    const recipe = parseRecipeHtml(html, "https://oceans-nadia.com/user/1/recipe/2");

    expect(recipe.name).toBe("なすの豚しゃぶ香味だれ");
    expect(recipe.sourceServings).toBe(2);
    expect(recipe.cookMinutes).toBe(10);
    expect(recipe.proteinSource).toBe("meat");
    expect(recipe.ingredients).toContain("なす 4本(400g)");
    expect(recipe.ingredients).toContain("豚肉 300g");
    expect(recipe.ingredients).toContain("醤油、酢 各大さじ2");
    expect(recipe.ingredients).toContain("ごま油 大さじ1");
    expect(recipe.ingredients).toContain("めんつゆ(3倍濃縮) 大さじ2");
    expect(recipe.steps).toBe("なすを切る\n豚肉をゆでる");
    expect(recipe.nutrition).toEqual({ energyKcal: 350, proteinG: 20, fatG: 12, carbsG: 30, fiberG: 4, saltG: 2.1 });
  });

  it("NadiaのsodiumContentは掲載上の食塩相当量として扱う", () => {
    const html = `<script type="application/ld+json">{"@type":"Recipe","name":"料理","recipeYield":"4人分","recipeIngredient":["豚肉 200g"],"recipeInstructions":["焼く"],"nutrition":{"sodiumContent":"2.1 g"}}</script>`;
    const recipe = parseRecipeHtml(html, "https://oceans-nadia.com/user/1/recipe/2");
    expect(recipe.nutrition.saltG).toBe(2.1);
  });

  it.each([
    "http://oceans-nadia.com/recipe/1",
    "https://example.com/recipe/1",
    "https://oceans-nadia.com.evil.example/recipe/1",
    "https://user:pass@oceans-nadia.com/recipe/1",
    "https://oceans-nadia.com:8443/recipe/1",
  ])("許可していないURLを拒否する: %s", (url) => {
    expect(() => parseAllowedRecipeUrl(url)).toThrow(RecipeImportError);
  });

  it("登録者IDは環境変数の完全一致だけを許可する", () => {
    process.env.RECIPE_PUBLISHER_USER_IDS = "user-a, user-b";
    expect(isRecipePublisher({ id: "user-b" })).toBe(true);
    expect(isRecipePublisher({ id: "user" })).toBe(false);
    expect(isRecipePublisher(null)).toBe(false);
  });
});
