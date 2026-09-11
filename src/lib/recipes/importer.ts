import type { ProteinSource } from "@/types/nutrition";

const allowedRecipeHosts = new Set([
  "cookpad.com",
  "www.cookpad.com",
  "oceans-nadia.com",
  "www.oceans-nadia.com",
]);
const maxHtmlBytes = 1_000_000;
const maxRedirects = 3;

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
  let currentUrl = parseAllowedRecipeUrl(rawUrl);

  for (let redirectCount = 0; redirectCount <= maxRedirects; redirectCount += 1) {
    let response: Response;
    try {
      response = await fetch(currentUrl, {
        headers: {
          Accept: "text/html,application/xhtml+xml",
          "User-Agent": "KyouNoGohanRecipeImporter/1.0",
        },
        redirect: "manual",
        signal: AbortSignal.timeout(10_000),
        cache: "no-store",
      });
    } catch {
      throw new RecipeImportError("fetch_failed");
    }

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location || redirectCount === maxRedirects) throw new RecipeImportError("fetch_failed");
      currentUrl = parseAllowedRecipeUrl(new URL(location, currentUrl).toString());
      continue;
    }

    if (!response.ok) throw new RecipeImportError("fetch_failed");
    if (!response.headers.get("content-type")?.toLowerCase().includes("text/html")) {
      throw new RecipeImportError("recipe_not_found");
    }

    const contentLength = Number(response.headers.get("content-length") ?? 0);
    if (contentLength > maxHtmlBytes) throw new RecipeImportError("fetch_failed");

    const html = await response.text();
    if (Buffer.byteLength(html, "utf8") > maxHtmlBytes) throw new RecipeImportError("fetch_failed");
    return parseRecipeHtml(html, currentUrl.toString());
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

  const sourceServings = parseFirstNumber(readText(recipe.recipeYield));
  const warnings: string[] = [];
  let ingredientLines = rawIngredients;
  if (sourceServings && sourceServings > 0 && sourceServings !== 4) {
    const factor = 4 / sourceServings;
    ingredientLines = rawIngredients.map((line) => scaleIngredientLine(line, factor));
  } else if (!sourceServings) {
    warnings.push("元レシピの人数を確認できないため、材料は掲載量のままです。");
  }

  const nutritionSource = isRecord(recipe.nutrition) ? recipe.nutrition : {};
  const nutrition = compactNutrition({
    energyKcal: parseNutritionNumber(nutritionSource.calories),
    proteinG: parseNutritionNumber(nutritionSource.proteinContent),
    fatG: parseNutritionNumber(nutritionSource.fatContent),
    carbsG: parseNutritionNumber(nutritionSource.carbohydrateContent),
    fiberG: parseNutritionNumber(nutritionSource.fiberContent),
    saltG: parseSaltEquivalent(nutritionSource, sourceUrl),
  });

  if (Object.keys(nutrition).length < 6) {
    warnings.push("取得できない栄養項目は、フォームの初期値を残しています。");
  }
  warnings.push("野菜量は元ページから自動計算できないため、フォームの初期値を確認してください。");

  return {
    sourceUrl,
    sourceServings,
    name: name.slice(0, 80),
    cookMinutes: parseDurationMinutes(recipe.totalTime) ?? parseDurationMinutes(recipe.cookTime),
    proteinSource: detectProteinSource(rawIngredients.join(" ")),
    ingredients: ingredientLines.map(cleanLine).filter(Boolean).join("\n").slice(0, 4000),
    steps: rawSteps.map(cleanLine).filter(Boolean).join("\n").slice(0, 4000),
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

function scaleIngredientLine(line: string, factor: number) {
  const normalized = line.normalize("NFKC");
  const prefixUnits = /(大さじ|小さじ|カップ)(\d+\s+\d+\/\d+|\d+\/\d+|\d+(?:\.\d+)?)/gi;
  const suffixUnits = /(\d+\s+\d+\/\d+|\d+\/\d+|\d+(?:\.\d+)?)(\s*(?:kg|g|mg|ml|l|本|枚|個|玉|束|袋|缶|パック|片|かけ|合|丁|株|房))/gi;

  return normalized
    .replace(prefixUnits, (_match, unit: string, amount: string) => `${unit}${formatAmount(parseAmount(amount) * factor)}`)
    .replace(suffixUnits, (_match, amount: string, unit: string) => `${formatAmount(parseAmount(amount) * factor)}${unit}`);
}

function parseAmount(value: string) {
  const mixed = value.match(/^(\d+)\s+(\d+)\/(\d+)$/);
  if (mixed) return Number(mixed[1]) + Number(mixed[2]) / Number(mixed[3]);
  const fraction = value.match(/^(\d+)\/(\d+)$/);
  if (fraction) return Number(fraction[1]) / Number(fraction[2]);
  return Number(value);
}

function formatAmount(value: number) {
  const rounded = roundNumber(value, 2);
  if (Number.isInteger(rounded)) return String(rounded);
  const whole = Math.floor(rounded);
  const fraction = rounded - whole;
  const fractionText = Math.abs(fraction - 0.5) < 0.001 ? "1/2"
    : Math.abs(fraction - 0.25) < 0.001 ? "1/4"
      : Math.abs(fraction - 0.75) < 0.001 ? "3/4"
        : null;
  if (!fractionText) return String(rounded);
  return whole > 0 ? `${whole} ${fractionText}` : fractionText;
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
