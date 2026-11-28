import { describe, expect, it } from "vitest";
import { readKikkomanIngredients, readRecipeServings } from "@/lib/recipes/kikkomanIngredients";

// レシピ本文を転載せず、サイトの材料欄と同じ構造で検証する。
const item = (name: string, amount: string) => `<li><div class="recipe-detail-ingredient__name"><span>${name}</span></div><div class="recipe-detail-ingredient__portion">${amount}</div></li>`;
const group = (name: string) => `<div class="recipe-detail-ingredient__heading__title">${name}</div>`;
const page = (body: string) => `<section><div class="recipe-detail-ingredient"><ul>${body}</ul></div></section><img src="https://example.test/photo.jpg"><p>紹介文は取り込まない</p>`;

describe("材料と人数の事実情報", () => {
  it("材料・分量・調味料グループを順番どおり保持し、換算しない", () => {
    expect(readKikkomanIngredients(page(item("豆腐（木綿）", "1/2丁（150g）") + group("（A）合わせ調味料") + item("水", "大さじ1/2") + item("塩", "少々") + group("（B）仕上げ") + item("ごま", "適量")))).toEqual([
      { name: "豆腐（木綿）", amount: "1/2丁（150g）", group: null },
      { name: "水", amount: "大さじ1/2", group: "（A）合わせ調味料" },
      { name: "塩", amount: "少々", group: "（A）合わせ調味料" },
      { name: "ごま", amount: "適量", group: "（B）仕上げ" },
    ]);
  });
  it("商品リンクは文字だけにして、画像・紹介文を返さない", () => {
    expect(readKikkomanIngredients(page(item('<a href="/product/1">調味料</a>', "100ml")))).toEqual([{ name: "調味料", amount: "100ml", group: null }]);
  });
  it("文字参照を解釈し、分量に含まれる全角や分数は変えない", () => {
    expect(readKikkomanIngredients(page(item("豆&#x8150;", "１／２丁&nbsp;（150g）")))[0]).toMatchObject({ name: "豆腐", amount: "１／２丁 （150g）" });
  });
  it.each([page(item("水", "")), page('<li><div class="recipe-detail-ingredient__name">水</div></li>'), page(item('<img src="x">水', "100ml")), '<section>材料なし</section>', "x".repeat(2_000_001)])("欠損・予期しない構造は部分成功にしない", html => {
    expect(() => readKikkomanIngredients(html)).toThrow();
  });
  it("人数の範囲・個数・不明な表記は元の表記を残して確認対象にする", () => {
    expect(readRecipeServings("3～4人分")).toEqual({ label: "3~4人分", count: null });
    expect(readRecipeServings("１２個")).toEqual({ label: "12個", count: null });
    expect(readRecipeServings("４人分")).toEqual({ label: "4人分", count: 4 });
    expect(readRecipeServings("0人分").count).toBeNull();
    expect(readRecipeServings("100人分").count).toBeNull();
  });
});
