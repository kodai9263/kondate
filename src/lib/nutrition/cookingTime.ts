export const MAX_DINNER_MINUTES = 40;

type RecipeTime = { cookMinutes: number; totalMinutes?: number; timeUnconfirmed?: boolean };

export function isDinnerCandidate(recipe: RecipeTime, maxMinutes = MAX_DINNER_MINUTES) {
  const minutes = recipe.totalMinutes ?? recipe.cookMinutes;
  return !recipe.timeUnconfirmed && Number.isFinite(minutes) && minutes > 0
    && minutes <= Math.min(maxMinutes, MAX_DINNER_MINUTES);
}

export function databaseRecipeTime(recipe: { cook_minutes: number; meta: unknown }): RecipeTime {
  const meta = recipe.meta && typeof recipe.meta === "object" ? recipe.meta as Record<string, unknown> : {};
  return {
    cookMinutes: recipe.cook_minutes,
    totalMinutes: typeof meta.total_minutes === "number" ? meta.total_minutes : undefined,
    // 工程を変えた料理には、元レシピの所要時間を流用しない。
    timeUnconfirmed: meta.step_customization === true,
  };
}
