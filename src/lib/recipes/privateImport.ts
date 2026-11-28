import { fetchRecipePage, findRecipeJsonLd, parseRecipeHtml, RecipeImportError } from "./importer";
import { readKikkomanIngredients, readRecipeServings } from "./kikkomanIngredients";

export function privateRecipeUrl(value: string): URL {
  if (value.length > 2048) throw new RecipeImportError("invalid_url");
  let url: URL;
  try { url = new URL(value); } catch { throw new RecipeImportError("invalid_url"); }
  if (url.protocol !== "https:" || url.username || url.password || url.port) throw new RecipeImportError("invalid_url");
  if (url.hostname !== "www.kikkoman.co.jp" || !/^\/homecook\/search\/recipe\/\d{8,12}\/$/.test(url.pathname)) throw new RecipeImportError("unsupported_site");
  url.search = ""; url.hash = "";
  return url;
}

export function parsePrivateRecipe(html: string, sourceUrl: string) {
  const canonical = privateRecipeUrl(sourceUrl).toString();
  try {
    const parsed = parseRecipeHtml(html, canonical);
    const recipe = findRecipeJsonLd(html)!;
    const servings = readRecipeServings(String(recipe.recipeYield ?? ""));
    if (servings.label.length > 80) throw new Error("invalid_servings");
    const facts = readKikkomanIngredients(html);
    // 【グループ名】は買い物の集計対象から除外される既存形式。
    const ingredients = facts.map(fact => `${fact.group ? `【${fact.group}】` : ""}${fact.name} ${fact.amount}`).join("\n");
    if (ingredients.length > 4000) throw new Error("ingredients_too_long");
    // サイトが示す工程単位を保持し、工程番号への参照を壊さない。
    const steps = parsed.steps.split("\n").map(step => step.trim()).filter(Boolean).join("\n");
    for (const reference of steps.normalize("NFKC").matchAll(/\(([A-Z])\)/g)) {
      if (!facts.some(fact => fact.group?.normalize("NFKC").includes(`(${reference[1]})`))) throw new Error("missing_ingredient_group");
    }
    return {
      name: parsed.name, ingredients, steps, cookMinutes: parsed.cookMinutes,
      proteinSource: parsed.proteinSource, sourceUrl: canonical,
      sourceServings: servings.count, sourceServingsText: servings.label,
    };
  } catch { throw new RecipeImportError("recipe_not_found"); }
}

export async function fetchPrivateRecipe(url: string) {
  const page = await fetchRecipePage(url, privateRecipeUrl);
  return parsePrivateRecipe(page.html, page.url);
}

export type PrivateImportedRecipe = ReturnType<typeof parsePrivateRecipe>;
export function privateImportMessage(error: unknown): string {
  if (error instanceof RecipeImportError && error.code === "unsupported_site") return "URL取り込みはキッコーマンの対応レシピページのみです。他のサイトは利用条件を確認し、入力・貼り付けで登録してください。";
  if (error instanceof RecipeImportError && error.code === "invalid_url") return "キッコーマンのレシピページのHTTPS URLを入力してください。";
  return "材料・作り方を読み取れませんでした。元のページを確認して手入力してください。入力済みの内容は残っています。";
}
