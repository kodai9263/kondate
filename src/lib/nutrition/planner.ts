import type { Nutrition, NutritionRecipe, NutritionSummary, PlannedDinner, ProteinSource } from "@/types/nutrition";

export const dinnerNutritionTarget: Nutrition = {
  energyKcal: 650,
  proteinG: 28,
  fatG: 20,
  carbsG: 85,
  fiberG: 8,
  saltG: 2.2,
  vegetablesG: 160,
};

type GenerateOptions = {
  year: number;
  month: number;
  recipes: NutritionRecipe[];
  lockedRecipeIds?: Record<string, string>;
  seed?: number;
  maxCookMinutes?: number;
  preferredRecipeIds?: string[];
};

export function generateMonthlyDinnerPlan({
  year,
  month,
  recipes,
  lockedRecipeIds = {},
  seed = year * 100 + month,
  maxCookMinutes,
  preferredRecipeIds = [],
}: GenerateOptions): PlannedDinner[] {
  if (recipes.length === 0) return [];
  const available = maxCookMinutes ? recipes.filter((item) => item.cookMinutes <= maxCookMinutes) : recipes;
  const candidates = available.length > 0 ? available : recipes;
  const byId = new Map(recipes.map((recipe) => [recipe.id, recipe]));
  const random = seededRandom(seed);
  const preferred = new Set(preferredRecipeIds);
  const days = new Date(year, month, 0).getDate();
  const plan: PlannedDinner[] = [];

  for (let day = 1; day <= days; day += 1) {
    const date = formatDate(year, month, day);
    const lockedRecipe = byId.get(lockedRecipeIds[date]);
    if (lockedRecipe) {
      plan.push({ date, recipe: lockedRecipe, locked: true });
      continue;
    }

    const recent = plan.slice(-4);
    const week = plan.slice(Math.max(0, plan.length - ((day - 1) % 7)));
    const ranked = candidates
      .map((recipe) => ({ recipe, score: candidateScore(recipe, recent, week, month, preferred) + random() * 7 }))
      .sort((a, b) => a.score - b.score);
    const poolSize = Math.min(3, ranked.length);
    const selected = ranked[Math.floor(random() * poolSize)].recipe;
    plan.push({ date, recipe: selected, locked: false });
  }

  return plan;
}

export function materializeDinnerPlan(
  generatedPlan: PlannedDinner[],
  recipes: NutritionRecipe[],
  changedRecipeIds: Record<string, string>,
  lockedRecipeIds: Record<string, string>,
) {
  const recipeById = new Map(recipes.map((recipe) => [recipe.id, recipe]));
  return generatedPlan.map((day) => ({
    ...day,
    recipe: recipeById.get(changedRecipeIds[day.date]) ?? day.recipe,
    locked: Boolean(lockedRecipeIds[day.date]),
  }));
}

export function isRecipeInSeason(recipe: NutritionRecipe, month: number) {
  return recipe.seasonMonths?.includes(month) ?? false;
}

export function rankAlternativeRecipes({
  currentRecipe,
  recipes,
  month,
  maxCookMinutes,
  nearbyRecipeIds = [],
  preferredRecipeIds = [],
}: {
  currentRecipe: NutritionRecipe;
  recipes: NutritionRecipe[];
  month: number;
  maxCookMinutes?: number;
  nearbyRecipeIds?: string[];
  preferredRecipeIds?: string[];
}) {
  const nearby = new Set(nearbyRecipeIds);
  const preferred = new Set(preferredRecipeIds);
  const withinTime = maxCookMinutes ? recipes.filter((recipe) => recipe.cookMinutes <= maxCookMinutes) : recipes;
  const candidates = (withinTime.length > 1 ? withinTime : recipes).filter((recipe) => recipe.id !== currentRecipe.id);

  return [...candidates].sort((a, b) => alternativeScore(a) - alternativeScore(b));

  function alternativeScore(recipe: NutritionRecipe) {
    let score = nutritionDeviation(recipe.nutrition) * 28;
    if (isRecipeInSeason(recipe, month)) score -= 14;
    else if (recipe.seasonMonths && recipe.seasonMonths.length > 0) score += 6;
    if (recipe.proteinSource === currentRecipe.proteinSource) score += 8;
    if (nearby.has(recipe.id)) score += 120;
    if (preferred.has(recipe.id)) score -= 16;
    if (recipe.nutrition.saltG > dinnerNutritionTarget.saltG * 1.2) score += 12;
    return score;
  }
}

export function summarizeNutrition(plan: PlannedDinner[]): NutritionSummary {
  if (plan.length === 0) return { average: zeroNutrition(), score: 0, message: "献立を作成すると栄養バランスを確認できます" };
  const total = plan.reduce((sum, day) => addNutrition(sum, day.recipe.nutrition), zeroNutrition());
  const average = mapNutrition(total, (value) => value / plan.length);
  const deviation = nutritionDeviation(average);
  const score = Math.max(0, Math.round(100 - deviation * 42));
  const message = score >= 85 ? "主菜と野菜のバランスが整っています" : score >= 70 ? "おおむね良好です。野菜量と塩分を確認しましょう" : "偏りがあります。献立を再生成して調整できます";
  return { average: roundNutrition(average), score, message };
}

function candidateScore(recipe: NutritionRecipe, recent: PlannedDinner[], week: PlannedDinner[], month: number, preferred: Set<string>) {
  let score = nutritionDeviation(recipe.nutrition) * 28;
  if (recent.some((item) => item.recipe.id === recipe.id)) score += 120;
  if (recent.at(-1)?.recipe.proteinSource === recipe.proteinSource) score += 24;
  if (preferred.has(recipe.id)) score -= 16;

  if (isRecipeInSeason(recipe, month)) score -= 14;
  else if (recipe.seasonMonths && recipe.seasonMonths.length > 0) score += 6;

  const sourceCounts = countSources(week);
  if (recipe.proteinSource === "fish" && (sourceCounts.fish ?? 0) < 2) score -= 7;
  if (recipe.proteinSource === "soy" && (sourceCounts.soy ?? 0) < 1) score -= 5;
  if (recipe.nutrition.saltG > dinnerNutritionTarget.saltG * 1.2) score += 12;
  return score;
}

function nutritionDeviation(nutrition: Nutrition) {
  const ratios = [
    Math.abs(nutrition.energyKcal - dinnerNutritionTarget.energyKcal) / dinnerNutritionTarget.energyKcal,
    Math.abs(nutrition.proteinG - dinnerNutritionTarget.proteinG) / dinnerNutritionTarget.proteinG,
    Math.abs(nutrition.fatG - dinnerNutritionTarget.fatG) / dinnerNutritionTarget.fatG,
    Math.abs(nutrition.carbsG - dinnerNutritionTarget.carbsG) / dinnerNutritionTarget.carbsG,
    Math.abs(nutrition.fiberG - dinnerNutritionTarget.fiberG) / dinnerNutritionTarget.fiberG,
    Math.abs(nutrition.saltG - dinnerNutritionTarget.saltG) / dinnerNutritionTarget.saltG,
    Math.abs(nutrition.vegetablesG - dinnerNutritionTarget.vegetablesG) / dinnerNutritionTarget.vegetablesG,
  ];
  return ratios.reduce((sum, ratio) => sum + ratio, 0) / ratios.length;
}

function countSources(plan: PlannedDinner[]) {
  return plan.reduce<Partial<Record<ProteinSource, number>>>((counts, day) => {
    const source = day.recipe.proteinSource;
    counts[source] = (counts[source] ?? 0) + 1;
    return counts;
  }, {});
}

function zeroNutrition(): Nutrition {
  return { energyKcal: 0, proteinG: 0, fatG: 0, carbsG: 0, fiberG: 0, saltG: 0, vegetablesG: 0 };
}

function addNutrition(a: Nutrition, b: Nutrition): Nutrition {
  return mapNutrition(a, (value, key) => value + b[key]);
}

function mapNutrition(nutrition: Nutrition, mapper: (value: number, key: keyof Nutrition) => number): Nutrition {
  return Object.fromEntries(Object.entries(nutrition).map(([key, value]) => [key, mapper(value, key as keyof Nutrition)])) as Nutrition;
}

function roundNutrition(nutrition: Nutrition): Nutrition {
  return mapNutrition(nutrition, (value) => Math.round(value * 10) / 10);
}

function formatDate(year: number, month: number, day: number) {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function seededRandom(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
}
