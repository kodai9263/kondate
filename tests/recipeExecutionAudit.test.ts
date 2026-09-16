import { describe, expect, it } from "vitest";
import { officialRecipeDetails } from "@/lib/nutrition/recipeDetails";
import { auditedCommunityRecipe } from "@/lib/recipes/communityRecipeDetails";

const recipes = [...Object.entries(officialRecipeDetails), ["community", auditedCommunityRecipe.detail] as const];
// 呼び方の違いだけを吸収する。名前の出現は使用方法の正しさを保証しないため、全品の文章点検と併用する。
const ingredientReferences: Record<string, string[]> = {
  鶏もも肉: ["鶏肉"], 鶏むね肉: ["鶏肉"], 鶏ひき肉: ["ひき肉"], 豚ひき肉: ["ひき肉"], 合いびき肉: ["ひき肉"],
  豚こま肉: ["豚肉"], 豚ロース薄切り: ["豚肉"], 豚バラ薄切り: ["豚肉"], 豚しゃぶしゃぶ肉: ["豚肉"], 豚バラしゃぶしゃぶ用肉: ["豚肉"],
  牛こま肉: ["牛肉"], 豚レバー: ["レバー"], 木綿豆腐: ["豆腐"], 絹ごし豆腐: ["豆腐"],
  生鮭: ["鮭"], 生たら: ["たら"], さば切り身: ["さば"], ぶり切り身: ["ぶり"],
  かつお切り身: ["かつお"], かつお刺身用さく: ["かつお"], 三枚おろしあじ: ["あじ"], 白身魚: ["魚"],
  加熱用牡蠣: ["牡蠣"], 新じゃがいも: ["じゃが"], 春キャベツ: ["キャベツ"], 新玉ねぎ: ["玉ねぎ"],
  温かいごはん: ["ご飯"], 蒸し中華麺: ["麺"], ゆでうどん: ["うどん"], うなぎ蒲焼き: ["うなぎ"],
  ミックスビーンズ: ["ミックスビーンズ", "水気を切った豆"], カットトマト: ["トマト"],
  プレーンヨーグルト: ["ヨーグルト"], そのまま食べられる細切りチーズ: ["チーズ"],
  かに風味かまぼこ: ["かにかま"], 好みのドレッシング: ["ドレッシング"], 中濃ソース: ["ソース"],
  粗びき黒こしょう: ["黒こしょう"], 西京味噌: ["味噌"], 付属の蒲焼きのたれ: ["付属のたれ"],
  きゅうり用の塩: ["下処理用の塩"], 衣用片栗粉: ["衣用片栗粉"], 鶏肉用の油: ["鶏肉用の油"],
  顆粒鶏がらスープ: ["鶏がら"], 顆粒だし: ["だし"], 大豆水煮: ["大豆"], たけのこ水煮: ["たけのこ"], うずら卵水煮: ["うずら卵"],
  白菜キムチ: ["キムチ"],
};

describe("全品の材料と実行順序", () => {
  it.each(recipes)("%s: 材料欄の全材料に工程中の参照がある", (_id, recipe) => {
    const steps = recipe.steps.join("\n");
    const names = recipe.ingredients.flatMap((line) => line.replace(/【[^】]+】|（[^）]*）/g, "").split("・")).flatMap((item) =>
      item.trim().split(/[\s\d（]/)[0].split("/"));
    for (const name of names) {
      const references = ingredientReferences[name] ?? [name.replace(/^(乾燥|おろし|砂抜き|むき|ゆで)/, "")];
      expect(references.some((reference) => reference.length > 0 && steps.includes(reference)), `${name}の使用工程`).toBe(true);
    }
  });

  it("冷たい水から作る汁物は、沸いてから煮る時間を数える", () => {
    for (const [id, recipe] of recipes) {
      for (const step of recipe.steps) {
        if (!/鍋に.*水.*入れ.*(?:中火|弱火)で\d+(?:〜\d+)?分.*(?:煮|温め)/.test(step)) continue;
        // 牛乳を主体にしたスープは、沸騰させず湯気が出るまで温める。
        if (step.includes("牛乳") && step.includes("沸騰させず")) continue;
        expect(step, id).toMatch(/沸|煮立/);
      }
    }
  });

  it.each(["yurinchi-fried-rice", "beef-pepper-rice", "yaki-udon", "black-fried-rice", "chestnut-chicken-rice", "daikon-pork"])("%s: 生肉より先に野菜や薬味を切る", (id) => {
    const step = officialRecipeDetails[id].steps.find((text) => /肉.*切/.test(text))!;
    const vegetablePosition = step.search(/長ねぎ|小ねぎ|なす|生姜/);
    const meatPosition = step.search(/鶏肉|豚肉|牛肉/);
    expect(vegetablePosition, id).toBeGreaterThanOrEqual(0);
    expect(vegetablePosition, id).toBeLessThan(meatPosition);
    expect(step).toMatch(/手を洗う/);
  });

  it("別工程へ移る煮物・汁物に火止めと再加熱の両方がある", () => {
    for (const id of ["soy-hamburg", "pork-soup", "okra-plum-chicken", "tenshin-bowl", "buri-daikon", "daikon-pork", "yuzu-chicken", "beef-burdock", "new-potato-soboro", "asari-cabbage", "summer-veg-whitefish", "gyudon", "basic-curry"]) {
      const steps = officialRecipeDetails[id].steps;
      const stopIndex = steps.findIndex((step) => step.includes("いったん火を止める"));
      expect(stopIndex, id).toBeGreaterThanOrEqual(0);
      expect(steps.slice(stopIndex + 1).join("\n"), id).toMatch(/温め直|再び中火/);
    }
  });

  it("乾物の状態と戻し時間を明記し、塩蔵もずくや塊肉と取り違えない", () => {
    for (const id of ["chinese-bowl", "pork-vegetable-stir-fry", "pork-wood-ear-egg"]) {
      const recipe = officialRecipeDetails[id];
      expect(recipe.ingredients.join("\n"), id).toContain("乾燥きくらげ");
      expect(recipe.notes.join("\n"), id).toContain("戻す約30分を含む");
      expect(recipe.totalMinutes, id).toBeGreaterThanOrEqual(65);
    }
    expect(officialRecipeDetails["goya-champuru"].ingredients.join("\n")).toContain("豚バラ薄切り");
    expect(officialRecipeDetails["goya-champuru"].ingredients.join("\n")).toContain("味付けなし・塩抜き済み");
    expect(officialRecipeDetails.hamburg.ingredients.join("\n")).toContain("コーン（水煮）");
  });

  it("缶の大きさと一度に調理する量を判断できる", () => {
    expect(officialRecipeDetails["chicken-tomato"].ingredients.join("\n")).toContain("カットトマト 400g");
    expect(officialRecipeDetails.napolitan.ingredients.join("\n")).toContain("クリームコーン 400g");
    expect(officialRecipeDetails.napolitan.steps.join("\n")).toContain("1回2人分まで");
    expect(officialRecipeDetails["sardine-bowl"].steps.join("\n")).toContain("その回のたれ");
  });

  it("鶏肉入り炊飯の加熱不足時はご飯も再加熱し、予約炊飯を避ける", () => {
    for (const id of ["takenoko-chicken-rice", "corn-chicken-rice", "chestnut-chicken-rice", "spicy-hiyayakko"]) {
      const recipe = officialRecipeDetails[id];
      expect(recipe.steps.join("\n"), id).toContain("鶏肉とご飯を一緒に");
      expect(recipe.steps.join("\n"), id).not.toMatch(/肉を取り出.*フライパン/);
      expect(recipe.notes.join("\n"), id).toContain("予約炊飯はせず");
    }
  });
});
