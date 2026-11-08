import type { ProteinSource } from "@/types/nutrition";

const allowedRecipeHosts = new Set([
  "cookpad.com",
  "www.cookpad.com",
  "oceans-nadia.com",
  "www.oceans-nadia.com",
]);

export type ImportedRecipe = {
  sourceUrl: string;
  sourceServings: number | null;
  name: string;
  cookMinutes: number | null;
  proteinSource: ProteinSource;
  ingredients: string;
  steps: string;
  nutrition: {
    energyKcal?: number;
    proteinG?: number;
    fatG?: number;
    carbsG?: number;
    fiberG?: number;
    saltG?: number;
  };
  warnings: string[];
};

export type RecipeImportErrorCode = "invalid_url" | "unsupported_site" | "fetch_failed" | "recipe_not_found";

export class RecipeImportError extends Error {
  constructor(public readonly code: RecipeImportErrorCode) {
    super(code);
  }
}

export async function fetchImportedRecipe(rawUrl: string): Promise<ImportedRecipe> {
  let url = parseAllowedRecipeUrl(rawUrl);
  const signal = AbortSignal.timeout(12_000);
  try {
    for (let redirects = 0; redirects <= 3; redirects++) {
      const response = await fetch(url, {
        headers: { Accept: "text/html,application/xhtml+xml", "User-Agent": "KyouNoGohanRecipeImporter/1.0" },
        redirect: "manual", signal, cache: "no-store",
      });
      if (response.status >= 300 && response.status < 400) {
        await response.body?.cancel();
        const location = response.headers.get("location");
        if (!location || redirects === 3) throw new RecipeImportError("fetch_failed");
        // 転送先も毎回検証し、対応外サイトや内部ネットワークへはアクセスしない。
        url = parseAllowedRecipeUrl(new URL(location, url).toString());
        continue;
      }
      if (!response.ok || !response.body) {
        await response.body?.cancel();
        throw new RecipeImportError("fetch_failed");
      }
      if (!/text\/html|application\/xhtml\+xml/i.test(response.headers.get("content-type") ?? "")) {
        await response.body.cancel();
        throw new RecipeImportError("recipe_not_found");
      }
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let bytes = 0;
      let html = "";
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          bytes += value.byteLength;
          if (bytes > 2_000_000) throw new RecipeImportError("fetch_failed");
          html += decoder.decode(value, { stream: true });
        }
        html += decoder.decode();
      } finally {
        await reader.cancel();
      }
      return parseRecipeHtml(html, url.toString());
    }
  } catch (error) {
    if (error instanceof RecipeImportError) throw error;
    throw new RecipeImportError("fetch_failed");
  }
  throw new RecipeImportError("fetch_failed");
}

export function parseRecipeHtml(html: string, sourceUrl: string): ImportedRecipe {
  const recipe = findRecipeJsonLd(html);
  if (!recipe) throw new RecipeImportError("recipe_not_found");

  const name = readText(recipe.name).trim();
  const rawIngredients = readStringArray(recipe.recipeIngredient);
  const rawSteps = flattenInstructions(recipe.recipeInstructions);
  if (!name || rawIngredients.length === 0 || rawSteps.length === 0) {
    throw new RecipeImportError("recipe_not_found");
  }

  const yieldText = readText(recipe.recipeYield).normalize("NFKC").trim();
  const yieldMatch = yieldText.match(/^(\d+)\s*(?:人分|人前|servings?)?\s*[〜~]?$/i);
  const count = yieldMatch ? Number(yieldMatch[1]) : 0;
  const sourceServings = count >= 1 && count <= 20 ? count : null;
  const warnings: string[] = [];
  if (sourceServings && /[〜~]/.test(yieldText)) warnings.push("元レシピの人数は目安です。保存前に何人分かを確認してください。");
  if (!sourceServings) warnings.push("何人分かを読み取れませんでした。元のレシピを確認して入力してください。");
  const ingredients = rawIngredients.map(cleanLine).filter(Boolean).join("\n");
  const steps = rawSteps.map(cleanLine).filter(Boolean).join("\n");
  // 材料や加熱手順を途中で切り捨てた状態で保存しない。
  if (name.length > 80 || ingredients.length > 4000 || steps.length > 4000) throw new RecipeImportError("recipe_not_found");

  const nutritionSource = isRecord(recipe.nutrition) ? recipe.nutrition : {};
  const nutrition = compactNutrition({
    energyKcal: parseNutritionNumber(nutritionSource.calories),
    proteinG: parseNutritionNumber(nutritionSource.proteinContent),
    fatG: parseNutritionNumber(nutritionSource.fatContent),
    carbsG: parseNutritionNumber(nutritionSource.carbohydrateContent),
    fiberG: parseNutritionNumber(nutritionSource.fiberContent),
    saltG: parseSaltEquivalent(nutritionSource, sourceUrl),
  });

  warnings.push("材料・分量・作り方を確認してから保存してください。栄養値は自動登録しません。");

  return {
    sourceUrl,
    sourceServings,
    name,
    cookMinutes: parseDurationMinutes(recipe.totalTime) ?? parseDurationMinutes(recipe.cookTime),
    proteinSource: detectProteinSource(rawIngredients.join(" ")),
    ingredients,
    steps,
    nutrition,
    warnings,
  };
}

export function parseAllowedRecipeUrl(rawUrl: string) {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new RecipeImportError("invalid_url");
  }

  if (url.protocol !== "https:") throw new RecipeImportError("invalid_url");
  if (url.username || url.password || url.port) throw new RecipeImportError("invalid_url");
  if (!allowedRecipeHosts.has(url.hostname.toLowerCase())) throw new RecipeImportError("unsupported_site");
  url.hash = "";
  return url;
}

function findRecipeJsonLd(html: string): Record<string, unknown> | null {
  const scriptPattern = /<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  for (const match of html.matchAll(scriptPattern)) {
    try {
      const parsed = JSON.parse(decodeJsonLd(match[1]));
      const found = findRecipeNode(parsed);
      if (found) return found;
    } catch {
      continue;
    }
  }
  return null;
}

function findRecipeNode(value: unknown): Record<string, unknown> | null {
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findRecipeNode(item);
      if (found) return found;
    }
    return null;
  }
  if (!isRecord(value)) return null;

  const type = value["@type"];
  if (type === "Recipe" || (Array.isArray(type) && type.includes("Recipe"))) return value;

  const graphMatch = findRecipeNode(value["@graph"]);
  if (graphMatch) return graphMatch;

  for (const child of Object.values(value)) {
    if (!Array.isArray(child) && !isRecord(child)) continue;
    const found = findRecipeNode(child);
    if (found) return found;
  }
  return null;
}

function flattenInstructions(value: unknown): string[] {
  if (typeof value === "string") return value.split(/\r?\n/).map(cleanLine).filter(Boolean);
  if (Array.isArray(value)) return value.flatMap(flattenInstructions);
  if (!isRecord(value)) return [];

  const nested = value.itemListElement ?? value.steps;
  if (nested) return flattenInstructions(nested);
  const text = readText(value.text ?? value.name);
  return text ? [cleanLine(text)] : [];
}

function readStringArray(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    const text = readText(item).trim();
    return text ? [text] : [];
  });
}

function readText(value: unknown): string {
  if (typeof value === "string") return value;
  if (typeof value === "number") return String(value);
  if (Array.isArray(value)) return value.map(readText).find(Boolean) ?? "";
  return "";
}

function parseDurationMinutes(value: unknown) {
  const text = readText(value).trim();
  if (!text) return null;
  const iso = text.match(/^PT(?:(\d+)H)?(?:(\d+)M)?$/i);
  if (iso) return Number(iso[1] ?? 0) * 60 + Number(iso[2] ?? 0);
  const minutes = text.match(/(\d+)\s*分/);
  return minutes ? Number(minutes[1]) : null;
}

function parseFirstNumber(value: string) {
  const match = value.normalize("NFKC").match(/\d+(?:\.\d+)?/);
  return match ? Number(match[0]) : null;
}

function parseNutritionNumber(value: unknown) {
  const number = parseFirstNumber(readText(value));
  return number === null || !Number.isFinite(number) ? undefined : number;
}

function parseSaltEquivalent(nutrition: Record<string, unknown>, sourceUrl: string) {
  const explicitSalt = parseNutritionNumber(nutrition.saltContent);
  if (explicitSalt !== undefined) return explicitSalt;

  const sodiumText = readText(nutrition.sodiumContent);
  const sodium = parseFirstNumber(sodiumText);
  if (sodium === null) return undefined;
  if (new URL(sourceUrl).hostname.toLowerCase().endsWith("oceans-nadia.com") && !/mg/i.test(sodiumText)) {
    return sodium;
  }
  const sodiumMg = /mg/i.test(sodiumText) ? sodium : sodium * 1000;
  return roundNumber((sodiumMg * 2.54) / 1000, 1);
}

function compactNutrition(values: ImportedRecipe["nutrition"]): ImportedRecipe["nutrition"] {
  return Object.fromEntries(Object.entries(values).filter((entry): entry is [string, number] => entry[1] !== undefined));
}

function detectProteinSource(ingredientsText: string): ProteinSource {
  const normalized = ingredientsText.normalize("NFKC").toLowerCase();
  const groups: Array<[ProteinSource, string[]]> = [
    ["fish", ["魚", "鮭", "さけ", "さば", "たら", "まぐろ", "かつお", "あじ", "いわし", "えび", "海老", "かに", "ぶり"]],
    ["meat", ["豚", "牛", "鶏", "ひき肉", "ベーコン", "ハム", "ソーセージ"]],
    ["soy", ["豆腐", "厚揚げ", "大豆", "納豆", "豆乳"]],
    ["egg", ["卵", "たまご", "玉子"]],
    ["noodle", ["うどん", "そば", "そうめん", "パスタ", "麺", "ラーメン"]],
  ];

  let best: { source: ProteinSource; position: number } | null = null;
  for (const [source, terms] of groups) {
    for (const term of terms) {
      const position = normalized.indexOf(term.toLowerCase());
      if (position < 0 || (best && position >= best.position)) continue;
      best = { source, position };
    }
  }
  return best?.source ?? "noodle";
}

function roundNumber(value: number, digits: number) {
  const multiplier = 10 ** digits;
  return Math.round(value * multiplier) / multiplier;
}

function cleanLine(value: string) {
  return value.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

function decodeJsonLd(value: string) {
  return value
    .replace(/&quot;/g, '"')
    .replace(/&#34;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}
