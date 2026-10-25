export type MenuItem = { id: string; name: string; minutes: number; kind: "official" | "community" | "custom"; customized: boolean };
export type MenuRecipe = MenuItem & { servings: number; ingredients: string[]; morning: string[]; steps: string[]; notes: string[]; sourceUrl: string | null };
export type MenuResponse = { version: 1; items?: MenuItem[]; recipe?: MenuRecipe };
export async function loadMenu(token: string, selected: MenuItem | null, signal: AbortSignal): Promise<MenuResponse> {
  const query = selected ? `?${new URLSearchParams({ id: selected.id, kind: selected.kind })}` : "";
  const response = await fetch(`${import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, "") ?? ""}/api/mobile/v1/recipes${query}`, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store", signal });
  if (response.status === 401) throw new Error("ログインの有効期限が切れました。ログインし直してください。");
  if (response.status === 404) throw new Error("このメニューは表示できなくなりました。一覧に戻って確認してください。");
  if (!response.ok) throw new Error("メニューを読み込めませんでした。通信を確認して再度お試しください。");
  const value = await response.json() as MenuResponse;
  const validItem = (item: MenuItem) => item && typeof item.id === "string" && typeof item.name === "string" && Number.isFinite(item.minutes) && ["official", "community", "custom"].includes(item.kind);
  const validLines = (lines: string[]) => Array.isArray(lines) && lines.every((line) => typeof line === "string");
  if (value.version !== 1 || (selected ? !value.recipe || !validItem(value.recipe) || ![value.recipe.ingredients, value.recipe.morning, value.recipe.steps, value.recipe.notes].every(validLines)
    : !Array.isArray(value.items) || !value.items.every(validItem))) throw new Error("メニューの形式を確認できませんでした。");
  return value;
}
