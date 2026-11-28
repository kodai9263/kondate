import reviewedRecipes from "../../src/lib/nutrition/reviewedRecipes.json";

export type GuestRecipe = { id: string; name: string; minutes: number; servings: number; ingredients: string[]; steps: string[]; custom: boolean };
export type GuestState = {
  version: 1;
  recipes: GuestRecipe[];
  plans: Record<string, GuestRecipe | null>;
  shopping: { id: string; name: string; checked: boolean; source?: string }[];
};
export const guestStorageKey = "kondate-local-household-v1";
type StoragePort = Pick<Storage, "getItem" | "setItem">;
export const guestCatalog: GuestRecipe[] = reviewedRecipes.map(recipe => ({
  id: `reviewed-${recipe.key.toLowerCase()}`, name: recipe.name, minutes: recipe.totalMinutes,
  servings: recipe.servings, ingredients: recipe.ingredients, steps: recipe.steps, custom: false,
}));
export function emptyGuestState(): GuestState { return { version: 1, recipes: [], plans: {}, shopping: [] }; }
const lines = (value: unknown): value is string[] => Array.isArray(value) && value.length <= 200 && value.every(line => typeof line === "string" && line.length <= 4000);
export function isGuestRecipe(value: unknown): value is GuestRecipe {
  if (!value || typeof value !== "object") return false;
  const r = value as GuestRecipe;
  return typeof r.id === "string" && typeof r.name === "string" && r.name.length > 0 && r.name.length <= 80
    && Number.isInteger(r.minutes) && r.minutes >= 1 && r.minutes <= 240
    && Number.isInteger(r.servings) && r.servings >= 1 && r.servings <= 20
    && typeof r.custom === "boolean" && lines(r.ingredients) && lines(r.steps);
}
export function isGuestState(value: unknown): value is GuestState {
  if (!value || typeof value !== "object") return false;
  const s = value as GuestState;
  return s.version === 1 && Array.isArray(s.recipes) && s.recipes.every(isGuestRecipe)
    && !!s.plans && typeof s.plans === "object" && !Array.isArray(s.plans)
    && Object.entries(s.plans).every(([day, recipe]) => /^\d{4}-\d{2}-\d{2}$/.test(day) && (recipe === null || isGuestRecipe(recipe)))
    && Array.isArray(s.shopping) && s.shopping.every(item => item && typeof item.id === "string"
      && typeof item.name === "string" && item.name.length <= 4000 && typeof item.checked === "boolean"
      && (item.source === undefined || typeof item.source === "string"));
}
export function readGuestState(storage: StoragePort): GuestState {
  const raw = storage.getItem(guestStorageKey);
  if (raw === null) return emptyGuestState();
  const value: unknown = JSON.parse(raw);
  if (!isGuestState(value)) throw new Error("保存データの形式を確認できませんでした。");
  return value;
}
export function writeGuestState(storage: StoragePort, value: GuestState) {
  if (!isGuestState(value)) throw new Error("保存する内容を確認してください。");
  storage.setItem(guestStorageKey, JSON.stringify(value));
}
export function localDay(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
export function daysFrom(start: string, count: number): string[] {
  const [year, month, day] = start.split("-").map(Number);
  return Array.from({ length: count }, (_, offset) => localDay(new Date(year, month - 1, day + offset, 12)));
}
export function saveGuestRecipe(state: GuestState, recipe: GuestRecipe): GuestState {
  if (!recipe.custom || !isGuestRecipe(recipe)) throw new Error("料理名・人数・時間・材料・作り方を確認してください。");
  return { ...state, recipes: [...state.recipes.filter(item => item.id !== recipe.id), recipe],
    plans: Object.fromEntries(Object.entries(state.plans).map(([day, saved]) => [day, saved?.id === recipe.id ? recipe : saved])) };
}
export function addPlanIngredients(state: GuestState, day: string): GuestState {
  const recipe = state.plans[day];
  if (!recipe) return state;
  const prefix = `plan:${day}:`;
  const previous = state.shopping.filter(item => item.source === day);
  return { ...state, shopping: [...state.shopping.filter(item => item.source !== day), ...recipe.ingredients.map((name, index) => ({
    id: `${prefix}${index}`, name, source: day, checked: previous.find(item => item.name === name)?.checked ?? false,
  }))] };
}
