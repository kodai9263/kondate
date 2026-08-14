"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { isActiveSubscriptionStatus } from "@/lib/billing/entitlements";
import { getSupabaseServer } from "@/lib/supabase/server";

const recipeSchema = z.object({
  name: z.string().trim().min(1).max(80),
  side: z.string().trim().max(120),
  cookMinutes: z.coerce.number().int().min(0).max(240),
  proteinSource: z.enum(["fish", "meat", "soy", "egg", "noodle"]),
  ingredients: z.string().trim().min(1).max(4000),
  steps: z.string().trim().min(1).max(4000),
  energyKcal: z.coerce.number().min(0).max(5000),
  proteinG: z.coerce.number().min(0).max(500),
  fatG: z.coerce.number().min(0).max(500),
  carbsG: z.coerce.number().min(0).max(1000),
  fiberG: z.coerce.number().min(0).max(200),
  saltG: z.coerce.number().min(0).max(100),
  vegetablesG: z.coerce.number().min(0).max(2000),
});

export async function createRecipe(formData: FormData) {
  const parsed = recipeSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) redirect("/app/recipes/new?error=invalid");

  const supabase = await getSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase.from("profiles").select("household_id").eq("id", user.id).single();
  if (!profile?.household_id) redirect("/app/recipes/new?error=profile");

  const { data: subscription } = await supabase
    .from("household_subscriptions")
    .select("status,current_period_end")
    .eq("household_id", profile.household_id)
    .maybeSingle();
  if (!subscription || !isActiveSubscriptionStatus(subscription.status, subscription.current_period_end)) {
    redirect("/pricing?required=custom_recipes");
  }

  const values = parsed.data;
  const { error } = await supabase.rpc("create_household_recipe", {
    recipe_name: values.name,
    recipe_side: values.side,
    recipe_cook_minutes: values.cookMinutes,
    recipe_protein_source: values.proteinSource,
    recipe_image_url: "",
    recipe_ingredients: values.ingredients,
    recipe_steps: values.steps,
    nutrition_energy_kcal: values.energyKcal,
    nutrition_protein_g: values.proteinG,
    nutrition_fat_g: values.fatG,
    nutrition_carbs_g: values.carbsG,
    nutrition_fiber_g: values.fiberG,
    nutrition_salt_g: values.saltG,
    nutrition_vegetables_g: values.vegetablesG,
  });
  if (error) redirect("/app/recipes/new?error=save");
  redirect("/app/recipes?created=1");
}
