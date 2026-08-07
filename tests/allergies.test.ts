import { describe, expect, it } from "vitest";
import { detectRecipeAllergens, filterRecipesForAllergies, getCustomAllergies, normalizeAllergies, parseCustomAllergies } from "@/lib/family/allergies";

describe("アレルギー設定", () => {
  it("空白と重複を除いて正規化する", () => {
    expect(normalizeAllergies([" 卵 ", "卵", "えび", null])).toEqual(["卵", "えび"]);
  });

  it("改行と読点で自由入力を分割する", () => {
    expect(parseCustomAllergies("キウイ、山芋\n青魚")).toEqual(["キウイ", "山芋", "青魚"]);
  });

  it("主要項目を除いて自由入力分だけ返す", () => {
    expect(getCustomAllergies(["卵", "キウイ", "乳"])).toEqual(["キウイ"]);
  });

  it("料理名、副菜、材料の別名から一致を判定する", () => {
    expect(detectRecipeAllergens({ name: "豆腐ハンバーグ", side: "ヨーグルトサラダ" }, ["乳", "卵"])).toEqual(["乳"]);
    expect(detectRecipeAllergens({ name: "野菜炒め", ingredientsText: "鶏肉\nピーナッツ 20g" }, ["落花生"])).toEqual(["落花生"]);
  });

  it("一致した献立候補を除外する", () => {
    const recipes = [
      { name: "親子丼", side: "味噌汁" },
      { name: "鮭の塩焼き", side: "青菜のおひたし" },
    ];
    const result = filterRecipesForAllergies(recipes, ["卵"]);
    expect(result.allowed.map((recipe) => recipe.name)).toEqual(["鮭の塩焼き"]);
    expect(result.excluded[0]?.matches).toEqual(["卵"]);
  });
});
