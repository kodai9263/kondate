"use server";

import { randomUUID } from "node:crypto";
import { redirect } from "next/navigation";
import { z } from "zod";
import { fetchImportedRecipe, parseAllowedRecipeUrl, RecipeImportError } from "@/lib/recipes/importer";
import { getSupabaseServer } from "@/lib/supabase/server";

const recipeSchema = z.object({
  name: z.string().trim().min(1).max(80),
  side: z.string().trim().max(120),
  cookMinutes: z.coerce.number().int().min(1).max(240),
  servings: z.coerce.number().int().min(1).max(20),
  proteinSource: z.enum(["fish", "meat", "soy", "egg", "noodle"]),
  ingredients: z.string().trim().min(1).max(4000),
  steps: z.string().trim().min(1).max(4000),
});

export async function importRecipeFromUrl(input: unknown) {
  if (typeof input !== "string" || input.length > 2048) return { ok: false as const, message: "レシピのURLを確認してください。" };
  const supabase = await getSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, message: "ログインしてから取り込んでください。" };
  const { data: allowed, error } = await supabase.rpc("can_use_breakfast_settings");
  if (error || !allowed) return { ok: false as const, message: "家族の利用状態を確認してください。" };
  try {
    return { ok: true as const, recipe: await fetchImportedRecipe(input.trim()) };
  } catch (error) {
    const messages = {
      invalid_url: "レシピのURLを確認してください。httpsから始まるURLを使用できます。",
      unsupported_site: "現在はクックパッドとNadiaに対応しています。ほかのサイトは材料と作り方を手入力してください。",
      fetch_failed: "ページを読み取れませんでした。元サイトを開いて確認するか、手入力してください。",
      recipe_not_found: "材料・作り方を揃えて読み取れませんでした。元ページを確認し、手入力してください。",
    };
    return { ok: false as const, message: error instanceof RecipeImportError ? messages[error.code] : messages.fetch_failed };
  }
}

export async function createRecipe(formData: FormData) {
  if (formData.get("visibility") === "community") redirect("/app/recipes/new?error=publish");
  let sourceUrl: string | undefined;
  const rawSource = formData.get("sourceUrl");
  if (rawSource) {
    try {
      if (typeof rawSource !== "string" || rawSource.length > 2048) throw new Error("invalid_source");
      sourceUrl = parseAllowedRecipeUrl(rawSource).toString();
    } catch { redirect("/app/recipes/new?error=source"); }
    if (formData.get("importConfirmed") !== "yes") redirect("/app/recipes/new?error=confirm");
  }
  const parsed = recipeSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) redirect("/app/recipes/new?error=invalid");
  const supabase = await getSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  // iOSと同じ、家族の権限・入力値を検証するRPCを使用する。栄養値は捏造しない。
  const payload = {
    target_id: randomUUID(), request_id: randomUUID(), expected_revision: null,
    fields: { ...parsed.data, morning: "", ...(sourceUrl ? { sourceUrl } : {}) },
  };
  const { error } = await supabase.rpc("save_household_recipe_editor", payload);
  if (error) redirect("/app/recipes/new?error=save");
  redirect("/app/recipes?created=household");
}
