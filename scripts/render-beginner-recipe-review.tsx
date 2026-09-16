import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { RecipeCookingGuide } from "../src/components/features/recipes/RecipeCookingGuide";
import { officialNutritionRecipes } from "../src/lib/nutrition/catalog";
import { officialRecipeDetails } from "../src/lib/nutrition/recipeDetails";
import { auditedCommunityRecipe } from "../src/lib/recipes/communityRecipeDetails";

const css = readdirSync(".next/static/css").filter((file) => file.endsWith(".css")).map((file) => readFileSync(`.next/static/css/${file}`, "utf8")).join("\n");
const recipes = officialNutritionRecipes.map((recipe) => ({ id: recipe.id, name: recipe.name, side: recipe.side, detail: officialRecipeDetails[recipe.id] }));
recipes.push({ id: "community", name: auditedCommunityRecipe.name, side: "共有メニュー", detail: auditedCommunityRecipe.detail });
const body = renderToStaticMarkup(<main className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
  <h1 className="font-mincho text-2xl font-bold">初心者向けに組み直した95品</h1>
  <p className="my-4 text-sm leading-7 text-kondate-muted">2026年9月16日・本番反映前の確認用。すべて4人分。時間は実測ではなく目安です。料理名を押すと材料と作り方が開きます。</p>
  <label className="block text-sm">料理名で絞り込む<input id="recipe-filter" type="search" className="mt-2 mb-6 block min-h-11 w-full rounded border border-kondate-line bg-white px-3" /></label>
  {recipes.map(({ id, name, side, detail }) => <details key={id} id={id} data-recipe-name={`${name} ${side}`} className="mb-4 rounded border border-kondate-line bg-white p-4 sm:p-6">
    <summary className="cursor-pointer font-mincho text-lg font-bold">{name}<span className="mt-1 block text-sm font-normal text-kondate-muted">{side}</span></summary>
    <RecipeCookingGuide ingredients={detail.ingredients} steps={detail.steps} morning={[]} baseServings={4} totalMinutes={detail.totalMinutes} notes={detail.notes} />
  </details>)}
</main>);
const filterScript = `document.getElementById('recipe-filter').addEventListener('input', function () { const query = this.value.trim(); document.querySelectorAll('[data-recipe-name]').forEach(function (item) { item.hidden = !item.dataset.recipeName.includes(query); }); });`;
writeFileSync("docs/beginner-menu-review.html", `<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>95品の作り方・確認用</title><style>${css}\n[hidden]{display:none!important}</style></head><body>${body}<script>${filterScript}</script></body></html>`);
