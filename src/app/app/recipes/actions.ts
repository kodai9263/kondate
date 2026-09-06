"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { officialNutritionRecipes } from "@/lib/nutrition/catalog";
import { getSupabaseServer } from "@/lib/supabase/server";

const officialRecipeKeys = new Set(officialNutritionRecipes.map((recipe) => recipe.id));

const removeRecipeSchema = z.discriminatedUnion("recipeKind", [
  z.object({ recipeKind: z.literal("custom"), recipeId: z.string().uuid() }),
  z.object({ recipeKind: z.literal("official"), recipeKey: z.string().min(1).max(120) }),
]);

export async function removeRecipe(formData: FormData) {
  const parsed = removeRecipeSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) redirect("/app/recipes?error=delete");

  const supabase = await getSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("household_id")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile?.household_id) redirect("/app/recipes?error=delete");

  if (parsed.data.recipeKind === "official") {
    if (!officialRecipeKeys.has(parsed.data.recipeKey)) redirect("/app/recipes?error=delete");

    const { error } = await supabase.from("household_recipe_exclusions").insert({
      household_id: profile.household_id,
      recipe_key: parsed.data.recipeKey,
      created_by: user.id,
    });
    if (error && error.code !== "23505") redirect("/app/recipes?error=delete");

    revalidateRecipePaths();
    redirect("/app/recipes?deleted=1");
  }

  const { data: archivedRecipe, error } = await supabase
    .from("recipes")
    .update({ archived_at: new Date().toISOString() })
    .eq("id", parsed.data.recipeId)
    .eq("household_id", profile.household_id)
    .is("archived_at", null)
    .select("id")
    .maybeSingle();

  if (error || !archivedRecipe) redirect("/app/recipes?error=delete");

  revalidateRecipePaths();
  redirect("/app/recipes?deleted=1");
}

function revalidateRecipePaths() {
  revalidatePath("/app");
  revalidatePath("/app/planner");
  revalidatePath("/app/recipes");
}
