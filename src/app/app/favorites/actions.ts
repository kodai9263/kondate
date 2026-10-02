"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { normalizeRecipeSelection } from "@/lib/billing/firstWeek";
import { getFirstWeekAccess } from "@/lib/billing/firstWeek.server";
import { officialNutritionRecipes } from "@/lib/nutrition/catalog";

export async function saveFavorite(formData: FormData) {
  const recipe = normalizeRecipeSelection(formData.get("recipe"));
  if (!recipe) redirect("/app/favorites?error=invalid");
  const { supabase, householdId } = await getFirstWeekAccess();
  const [kind, id] = recipe.split(":");
  if (kind === "official") {
    if (!officialNutritionRecipes.some((item) => item.id === id)) redirect("/app/favorites?error=invalid");
  } else {
    const { data } = await supabase.from("recipes").select("id").eq("id", id).is("household_id", null).is("archived_at", null).contains("meta", { visibility: "community" }).maybeSingle();
    if (!data) redirect("/app/favorites?error=invalid");
  }
  const { error } = await supabase.from("recipe_favorites").upsert({ household_id: householdId, recipe_key: recipe }, { onConflict: "household_id,recipe_key", ignoreDuplicates: true });
  if (error) redirect(`/app/favorites?error=save&recipe=${encodeURIComponent(recipe)}`);
  revalidatePath("/app/favorites");
  redirect("/app/favorites?saved=1");
}
