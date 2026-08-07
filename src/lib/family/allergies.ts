export const commonAllergens = ["えび", "かに", "くるみ", "小麦", "そば", "卵", "乳", "落花生"] as const;

const aliases: Record<(typeof commonAllergens)[number], string[]> = {
  えび: ["えび", "エビ", "海老"],
  かに: ["かに", "カニ", "蟹"],
  くるみ: ["くるみ", "クルミ", "胡桃"],
  小麦: ["小麦", "パン", "うどん", "そうめん", "ラーメン", "パスタ", "マカロニ", "パン粉", "麺", "麩", "餃子", "シュウマイ"],
  そば: ["そば", "蕎麦"],
  卵: ["卵", "玉子", "たまご", "オムレツ", "親子丼", "マヨネーズ"],
  乳: ["牛乳", "乳製品", "チーズ", "バター", "ヨーグルト", "生クリーム", "ホワイトソース", "グラタン", "クリーム煮", "ポタージュ"],
  落花生: ["落花生", "ピーナッツ"],
};

type RecipeSearchTarget = {
  name: string;
  side?: string;
  ingredientsText?: string;
};

export function normalizeAllergies(values: unknown): string[] {
  if (!Array.isArray(values)) return [];
  return [...new Set(values.flatMap((value) => {
    if (typeof value !== "string") return [];
    const normalized = value.normalize("NFKC").trim();
    return normalized ? [normalized] : [];
  }))];
}

export function parseCustomAllergies(value: unknown): string[] {
  if (typeof value !== "string") return [];
  return normalizeAllergies(value.split(/[\n,、，]+/));
}

export function getCustomAllergies(values: unknown): string[] {
  const common = new Set<string>(commonAllergens);
  return normalizeAllergies(values).filter((value) => !common.has(value));
}

export function detectRecipeAllergens(recipe: RecipeSearchTarget, registeredAllergies: unknown): string[] {
  const searchText = normalizeForSearch([recipe.name, recipe.side, recipe.ingredientsText].filter(Boolean).join(" "));

  return normalizeAllergies(registeredAllergies).filter((allergen) => {
    const knownAliases = aliases[allergen as keyof typeof aliases];
    const terms = knownAliases ?? [allergen];
    return terms.some((term) => searchText.includes(normalizeForSearch(term)));
  });
}

export function filterRecipesForAllergies<T extends RecipeSearchTarget>(recipes: T[], registeredAllergies: unknown) {
  const allowed: T[] = [];
  const excluded: Array<{ recipe: T; matches: string[] }> = [];

  recipes.forEach((recipe) => {
    const matches = detectRecipeAllergens(recipe, registeredAllergies);
    if (matches.length > 0) excluded.push({ recipe, matches });
    else allowed.push(recipe);
  });

  return { allowed, excluded };
}

function normalizeForSearch(value: string) {
  return value.normalize("NFKC").toLocaleLowerCase("ja").replace(/\s+/g, "");
}
