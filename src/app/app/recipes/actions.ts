"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getSupabaseServer } from "@/lib/supabase/server";

const archiveRecipeSchema = z.object({
  recipeId: z.string().uuid(),
});

export async function archiveRecipe(formData: FormData) {
  const parsed = archiveRecipeSchema.safeParse(Object.fromEntries(formData.entries()));
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

  const { data: archivedRecipe, error } = await supabase
    .from("recipes")
    .update({ archived_at: new Date().toISOString() })
    .eq("id", parsed.data.recipeId)
    .eq("household_id", profile.household_id)
    .is("archived_at", null)
    .select("id")
    .maybeSingle();

  if (error || !archivedRecipe) redirect("/app/recipes?error=delete");

  revalidatePath("/app");
  revalidatePath("/app/planner");
  revalidatePath("/app/recipes");
  redirect("/app/recipes?deleted=1");
}
