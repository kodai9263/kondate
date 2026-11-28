import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchPrivateRecipe, parsePrivateRecipe, privateRecipeUrl } from "@/lib/recipes/privateImport";
import { organizeSteps } from "@/lib/recipes/organizeSteps";
import { parseIngredientLine } from "@/lib/shopping/ingredients";
const url = "https://www.kikkoman.co.jp/homecook/search/recipe/00002478/";
const page = (extra = {}) => `<script type="application/ld+json">${JSON.stringify({ "@type": "Recipe", name: "検証用の豆腐料理", recipeYield: "3〜4人分", totalTime: "PT20M", recipeIngredient: ["豆腐 1丁", "水 100ml"], recipeInstructions: [{ "@type": "HowToStep", text: "豆腐を2cm角に切る。（A）を混ぜる。" }, { "@type": "HowToStep", text: "中火で3分煮る。沸いたら弱火にし、中心まで火を通す。" }], image: "https://example.test/photo.jpg", description: "紹介文は保存しない", ...extra })}</script><section><div class="recipe-detail-ingredient"><ul><li><div class="recipe-detail-ingredient__name">豆腐</div><div class="recipe-detail-ingredient__portion">1丁</div></li></ul><div class="recipe-detail-ingredient__heading__title">（A）煮汁</div><ul><li><div class="recipe-detail-ingredient__name">水</div><div class="recipe-detail-ingredient__portion">100ml</div></li></ul></div></section>`;
afterEach(() => vi.unstubAllGlobals());
describe("対応元の私用取り込み", () => {
  it("工程順と条件・材料グループを保持し、範囲人数を決めつけない", () => {
    const recipe = parsePrivateRecipe(page(), url);
    expect(recipe).toMatchObject({ sourceServings: null, sourceServingsText: "3〜4人分", cookMinutes: 20, ingredients: "豆腐 1丁\n【（A）煮汁】水 100ml", steps: "豆腐を2cm角に切る。（A）を混ぜる。\n中火で3分煮る。沸いたら弱火にし、中心まで火を通す。" });
    expect(recipe).not.toHaveProperty("image"); expect(recipe).not.toHaveProperty("nutrition"); expect(JSON.stringify(recipe)).not.toContain("紹介文");
    expect(parseIngredientLine(recipe.ingredients.split("\n")[1])).toMatchObject([{ name: "水", amount: 100, unit: "ml" }]);
  });
  it("材料にないグループや空工程・人数表記の肥大化を失敗にする", () => {
    for (const extra of [{recipeInstructions:["（B）を加える。"]},{recipeInstructions:[]},{recipeYield:"x".repeat(81)}]) expect(() => parsePrivateRecipe(page(extra), url)).toThrow();
    expect(() => parsePrivateRecipe(page().replace("recipe-detail-ingredient__portion", "missing"), url)).toThrow();
  });
  it("URLを対応する公開レシピに限定し追跡値を保存しない", () => {
    expect(privateRecipeUrl(url+"?tracking=1#hash").toString()).toBe(url);
    for (const bad of ["http://127.0.0.1/x","https://user:pass@www.kikkoman.co.jp/homecook/search/recipe/00002478/",url.replace("www.kikkoman.co.jp","www.kikkoman.co.jp.evil.test"),url.replace("/homecook/","/private/"),"https://www.sbfoods.co.jp/recipe/1"]) expect(() => privateRecipeUrl(bad)).toThrow();
  });
  it("認めていない転送先やエラーを迂回しない", async () => {
    const fetch=vi.fn().mockResolvedValue(new Response(null,{status:302,headers:{location:"https://127.0.0.1/"}})); vi.stubGlobal("fetch",fetch);
    await expect(fetchPrivateRecipe(url)).rejects.toThrow(); expect(fetch).toHaveBeenCalledTimes(1);
  });
  it("正しいHTMLからだけ読み取る", async () => {
    vi.stubGlobal("fetch",vi.fn().mockResolvedValue(new Response(page(),{headers:{"content-type":"text/html"}})));
    expect((await fetchPrivateRecipe(url)).sourceUrl).toBe(url);
  });
});
describe("貼り付けた作り方の整理",()=>{
  it("文の区切りだけを改行し、火加減・時間と条件を保つ",()=>expect(organizeSteps("  水を加える。沸いたら弱火にして3分煮る。 ")).toBe("水を加える。\n沸いたら弱火にして3分煮る。"));
  it("番号参照と既存の工程単位を変えない",()=>{expect(organizeSteps("1. 切る。混ぜる。\n\n2. (1)を180℃で15分焼く。 ")).toBe("1. 切る。混ぜる。\n2. (1)を180℃で15分焼く。");expect(organizeSteps("切る。混ぜる。\r\n煮る。")).toBe("切る。混ぜる。\n煮る。");});
  it("空入力や長すぎる入力を切り捨てない",()=>{expect(()=>organizeSteps(" ")).toThrow();expect(()=>organizeSteps("あ".repeat(4001))).toThrow();});
});
