"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { isActiveSubscriptionStatus } from "@/lib/billing/entitlements";
import { fetchImportedRecipe, parseAllowedRecipeUrl, RecipeImportError } from "@/lib/recipes/importer";
import { isRecipePublisher } from "@/lib/recipes/publisher";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
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
  sourceUrl: z.union([z.literal(""), z.string().url().max(2048)]),
  visibility: z.enum(["household", "community"]),
});

const importSchema = z.string().trim().url().max(2048);

export async function importRecipeFromUrl(input: unknown) {
  const parsed = importSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, message: "正しいレシピURLを入力してください。" };

  const supabase = await getSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, message: "ログイン状態を確認してください。" };

  const { data: profile } = await supabase.from("profiles").select("household_id").eq("id", user.id).maybeSingle();
  if (!profile?.household_id) return { ok: false as const, message: "家族情報を確認してください。" };

  const { data: subscription } = await supabase
    .from("household_subscriptions")
    .select("status,current_period_end")
    .eq("household_id", profile.household_id)
    .maybeSingle();
  if (!subscription || !isActiveSubscriptionStatus(subscription.status, subscription.current_period_end)) {
    return { ok: false as const, message: "URL取り込みは家族プランで利用できます。" };
  }

  try {
    return { ok: true as const, recipe: await fetchImportedRecipe(parsed.data) };
  } catch (error) {
    if (error instanceof RecipeImportError) {
      const messages = {
        invalid_url: "正しいHTTPSのレシピURLを入力してください。",
        unsupported_site: "現在はNadiaとCookpadの公開レシピに対応しています。",
        fetch_failed: "レシピページを読み取れませんでした。公開ページか確認して、もう一度お試しください。",
        recipe_not_found: "料理名・材料・作り方をページから確認できませんでした。",
      } satisfies Record<RecipeImportError["code"], string>;
      return { ok: false as const, message: messages[error.code] };
    }
    return { ok: false as const, message: "レシピを読み取れませんでした。時間をおいて再度お試しください。" };
  }
}

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
  let sourceUrl = "";
  try {
    sourceUrl = values.sourceUrl ? parseAllowedRecipeUrl(values.sourceUrl).toString() : "";
  } catch {
    redirect("/app/recipes/new?error=source");
  }

  const recipeArguments = {
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
    recipe_source_url: sourceUrl,
  };

  if (values.visibility === "community") {
    if (!sourceUrl || !isRecipePublisher(user)) redirect("/app/recipes/new?error=publish");
    const { error } = await getSupabaseAdmin().rpc("create_community_recipe", {
      ...recipeArguments,
      recipe_publisher_user_id: user.id,
    });
    if (error?.code === "23505") redirect("/app/recipes/new?error=duplicate");
    if (error) redirect("/app/recipes/new?error=save");
    redirect("/app/recipes?created=community");
  }

  const { error } = await supabase.rpc("create_household_recipe", recipeArguments);
  if (error) redirect("/app/recipes/new?error=save");
  redirect("/app/recipes?created=household");
}
