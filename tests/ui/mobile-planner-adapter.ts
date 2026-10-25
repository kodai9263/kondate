import { officialNutritionRecipes } from "@/lib/nutrition/catalog";
export const mobileNoStore = { "Cache-Control": "no-store" };
export const mobileOrigin = () => null;
export const mobileResponseHeaders = () => mobileNoStore;
export const mobileJsonError = (error: string, status: number) => Response.json({ error }, { status });
export const authorizeMobileRequest = async () => ({ supabase: {}, accessToken: "local-preview" });
export const getFirstWeekAccess = async () => ({ canPlan: true, paid: true });
const recipes = officialNutritionRecipes.filter((recipe) => (recipe.totalMinutes ?? recipe.cookMinutes) <= 40).slice(0, 12).map((recipe, index) => ({ ...recipe, id: `10000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}` }));
const context = { recipes, preferences: { adultCount: 2, childCount: 2, shoppingDay: 6, allergies: [] }, preferredRecipeIds: [], initialRecipeIds: {} as Record<string, string>, initialLockedRecipeIds: {} as Record<string, string>, initialSkippedDates: [] as string[], sideDishes: [{ id: "20000000-0000-4000-8000-000000000001", name: "冷ややっこ", ingredientsText: "豆腐 100g", steps: ["盛り付ける"] }], initialSideSelections: {} as Record<string, { mode: string; sideDishId: string | null }> };
export const getHouseholdPlannerContext = async () => context;
export async function saveMonthlyDinnerPlanForClient(input: { entries: { date: string; recipeId: string; locked: boolean; skipped?: boolean; sideMode: string; sideDishId: string | null }[] }) {
  for (const entry of input.entries) {
    context.initialRecipeIds[entry.date] = entry.recipeId;
    if (entry.locked) context.initialLockedRecipeIds[entry.date] = entry.recipeId;
    else delete context.initialLockedRecipeIds[entry.date];
    context.initialSkippedDates = context.initialSkippedDates.filter((date) => date !== entry.date);
    if (entry.skipped) context.initialSkippedDates.push(entry.date);
    context.initialSideSelections[entry.date] = { mode: entry.sideMode, sideDishId: entry.sideDishId };
  }
  return { ok: true };
}
