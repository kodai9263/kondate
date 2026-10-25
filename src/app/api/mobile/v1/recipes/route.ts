import { authorizeMobileRequest, mobileJsonError, mobileNoStore, mobileOrigin, mobileResponseHeaders } from "@/lib/mobile/request";
import { menuEntries, recipeMeta, type MenuRow } from "@/lib/recipes/mobileCatalog";
import { officialNutritionRecipes } from "@/lib/nutrition/catalog";

export function OPTIONS(request: Request) {
  const origin = mobileOrigin(request);
  return new Response(null, { status: origin ? 204 : 403, headers: origin ? { ...mobileResponseHeaders(origin), "Access-Control-Allow-Methods": "GET, OPTIONS" } : mobileNoStore });
}
export async function GET(request: Request) {
  const origin = mobileOrigin(request);
  if (origin === false) return mobileJsonError("origin_not_allowed", 403, null);
  try {
    const auth = await authorizeMobileRequest(request, origin);
    if (auth instanceof Response) return auth;
    const [recipes, exclusions] = await Promise.all([
      auth.supabase.from("recipes").select("id,name,household_id,category,cook_minutes,servings_base,meta").is("archived_at", null).order("created_at", { ascending: false }),
      auth.supabase.from("household_recipe_exclusions").select("recipe_key").eq("household_id", auth.householdId),
    ]);
    if (recipes.error || exclusions.error) return mobileJsonError("recipes_unavailable", 503, origin);
    // RLSに加え、家族の一致を明示して別の家族の料理を返さない。
    const rows = (recipes.data as MenuRow[]).filter((row) => row.household_id === null || row.household_id === auth.householdId);
    const items = menuEntries(rows, ((exclusions.data ?? []) as { recipe_key: string }[]).map((row) => row.recipe_key), auth.householdId);
    const params = new URL(request.url).searchParams;
    const id = params.get("id"); const kind = params.get("kind");
    if (!id && !kind) return Response.json({ version: 1, items }, { headers: mobileResponseHeaders(origin) });
    const item = items.find((entry) => entry.id === id && entry.kind === kind);
    if (!item) return mobileJsonError("recipe_not_found", 404, origin);
    const official = kind === "official" ? officialNutritionRecipes.find((recipe) => recipe.id === id) : null;
    const source = official ? rows.find((row) => row.household_id === null && recipeMeta(row.meta).nutrition_catalog_id === id)
      ?? rows.find((row) => row.household_id === null && recipeMeta(row.meta).visibility !== "community" && row.name === official.name)
      : rows.find((row) => row.id === id);
    if (!source) return mobileJsonError("recipe_not_found", 404, origin);
    const display = rows.find((row) => row.household_id === auth.householdId && recipeMeta(row.meta).step_customization === true && recipeMeta(row.meta).source_recipe_id === source.id) ?? source;
    const steps = await auth.supabase.from("recipe_steps").select("phase,position,text").eq("recipe_id", display.id).order("position", { ascending: true });
    if (steps.error) return mobileJsonError("recipes_unavailable", 503, origin);
    const phase = (name: string) => ((steps.data ?? []) as { phase: string; position: number; text: string }[]).filter((step) => step.phase === name).map((step) => step.text);
    const meta = recipeMeta(display.meta); const ingredients = phase("seasoning");
    const sourceUrl = typeof meta.source_url === "string" && /^https:\/\//i.test(meta.source_url) ? meta.source_url : null;
    return Response.json({ version: 1, recipe: { ...item, customized: display.id !== source.id,
      servings: Number(display.servings_base) || 4, ingredients: ingredients.length ? ingredients : typeof meta.ingredients_text === "string" ? meta.ingredients_text.split(/\r?\n/).filter(Boolean) : [],
      morning: phase("morning"), steps: phase("evening"), notes: Array.isArray(meta.recipe_notes) ? meta.recipe_notes.filter((note): note is string => typeof note === "string") : [], sourceUrl,
    } }, { headers: mobileResponseHeaders(origin) });
  } catch { return mobileJsonError("recipes_unavailable", 503, origin); }
}
