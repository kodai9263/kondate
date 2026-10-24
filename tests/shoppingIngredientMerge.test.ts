import { describe, expect, it } from "vitest";
import { buildPlannedShopping } from "@/lib/shopping/build";
import { normalizedQuantity, parseIngredientLine } from "@/lib/shopping/ingredients";
import { officialNutritionRecipes } from "@/lib/nutrition/catalog";

const make = (text: string, servingsBase: number | undefined = 4) => ({ date: "2026-10-24", locked: false,
  recipe: { ...officialNutritionRecipes[0], isCustom: true, name: "テスト献立", ingredientsText: text, servingsBase } });
const build = (text: string, servings = 4, purchasedContributionKeys: string[] = []) => buildPlannedShopping({
  start: "2026-10-24", end: "2026-10-24", dinners: [make(text)], breakfastVersions: [], servings, purchasedContributionKeys,
});
const items = (text: string, servings = 4) => build(text, servings).groups.flatMap((group) => group.items);
const labels = (text: string, servings = 4) => items(text, servings).map((item) => item.label);

describe("全材料の買い物集約", () => {
  it("画面にあった野菜の表記ゆれ・コ・サイズ・重量に添えた個数を合算する", () => {
    expect(labels("にんじん 150g（約1本）\nにんじん 1本\n人参 大 1本\n玉ねぎ 200g（約1個）\n玉ねぎ 2個\n玉ねぎ 大1コ\nじゃがいも 300g（約2個）\nじゃがいも 大きめ6コ")).toEqual([
      "にんじん 約3本 大を含む", "玉ねぎ 約4個 大を含む", "じゃがいも 約8個 大きめを含む",
    ]);
  });
  it("人数換算を先に適用し、材料を丸めてから足さない", () => {
    expect(labels("人参 150g（約1本）\nにんじん 1/3本\nニンジン 1/3本", 2)).toEqual(["にんじん 約0.84本"]);
  });
  it("分数と全角の個数注記も読める", () => {
    expect(labels("玉葱 １００g（約１／２個）\nたまねぎ 1コ")).toEqual(["玉ねぎ 約1.5個"]);
  });
  it("異なる単位は推測せず内訳として一行にまとめる", () => {
    expect(labels("トマト 200g\nトマト 2個\nトマト 100g\nトマト 1パック")).toEqual(["トマト 300g ＋ 2個 ＋ 1パック"]);
  });
  it("種類・部位・加工状態を勝手にまとめない", () => {
    const result = items("木綿豆腐 1丁\n絹ごし豆腐 1丁\n豚バラ肉 100g\n豚こま肉 100g\n鶏もも肉 100g\n鶏むね肉 100g\n生わかめ 10g\n乾燥わかめ 10g\n米 1合\nご飯 100g");
    expect(result).toHaveLength(10);
  });
  it("範囲・不明量の原文を残して確定量と同じ行にする", () => {
    const result = items("卵 2個\n玉子 1〜2個\n卵 適量");
    expect(result).toHaveLength(1);
    expect(result[0].label).toBe("卵 2個 ＋ 1回分・数量確認 1〜2個 ＋ 1回分・数量確認 適量");
    expect(result[0].needsReview).toBe(true);
    expect(result[0].contributions.map((item) => item.original)).toEqual(["卵 2個", "玉子 1〜2個", "卵 適量"]);
  });
  it("代替食材を単一食材へ決めつけない", () => {
    expect(items("牛乳 100ml\n牛乳 または 豆乳 100ml")).toHaveLength(2);
  });
  it("体積同士は合算し、重量とは分ける", () => {
    expect(labels("牛乳 100ml\n牛乳 大さじ2\n牛乳 小さじ1\n牛乳 20g")).toEqual(["牛乳 135ml ＋ 20g"]);
  });
  it("約・程度・味噌の表記ゆれを解釈して原文を残す", () => {
    expect(labels("にんじん 約1本\n人参 1本\nみそ 大さじ2程度\n味噌 小さじ1")).toEqual(["にんじん 約2本", "味噌"]);
  });
  it("旧形式の購入完了キーは名前・単位の統一後もそのまま引き継ぐ", () => {
    const text = "人参 大 1本\nにんじん 150g（約1本）\nにんじん 1本";
    const oldKeys = parseIngredientLine(text).slice(0, 2).map((ingredient) => {
      const [amount, unit] = ingredient.amount === null ? [null, ""] : normalizedQuantity(ingredient.amount, ingredient.unit);
      return JSON.stringify([JSON.stringify(["2026-10-24", "テスト献立", ingredient.original, ingredient.name, amount, unit, ingredient.note, 1, false]), 0]);
    });
    const result = build(text, 4, oldKeys).groups.flatMap((group) => group.items);
    expect(result.map((item) => item.label)).toEqual(["にんじん 1本"]);
    expect(result[0].contributions).toHaveLength(1);
  });
  it("集約行の完了対象に全材料を含め、同じ材料が重複しても履歴を落とさない", () => {
    const text = "トマト 1個\nトマト 100g\nトマト 1個\nトマト 適量";
    const row = items(text)[0];
    expect(row.contributions).toHaveLength(4);
    expect(new Set(row.contributions.map((item) => item.key)).size).toBe(4);
    expect(build(text, 4, row.contributions.map((item) => item.key)).groups).toEqual([]);
  });
  it("内訳の量変更でチェック識別子を更新し、材料の順番だけなら維持する", () => {
    expect(items("トマト 1個\nトマト 100g")[0].name).toBe(items("トマト 100g\nトマト 1個")[0].name);
    expect(items("トマト 1個\nトマト 100g")[0].name).not.toBe(items("トマト 2個\nトマト 100g")[0].name);
  });
  it("基準人数の不明な分量は合算せず、同じ行に確認事項を残す", () => {
    const result = buildPlannedShopping({ start: "2026-10-24", end: "2026-10-25", servings: 2, breakfastVersions: [],
      dinners: [make("人参 1本"), { ...make("にんじん 1本"), date: "2026-10-25", recipe: { ...make("にんじん 1本").recipe, servingsBase: undefined } }] });
    const rows = result.groups.flatMap((group) => group.items);
    expect(rows).toHaveLength(1);
    expect(rows[0].label).toBe("にんじん 0.5本 ＋ 1本・人数分を確認");
    expect(rows[0].needsReview).toBe(true);
  });
});
