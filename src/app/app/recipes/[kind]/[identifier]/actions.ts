"use server";

import { revalidatePath } from "next/cache";
import type { Route } from "next";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getSupabaseServer } from "@/lib/supabase/server";

const saveStepsSchema = z.object({
  kind: z.enum(["official", "community", "custom"]),
  identifier: z.string().min(1).max(120),
  recipeId: z.string().uuid(),
  morningSteps: z.string().max(6000),
  eveningSteps: z.string().trim().min(1).max(6000),
});

const resetStepsSchema = z.object({
  kind: z.enum(["official", "community"]),
  identifier: z.string().min(1).max(120),
  recipeId: z.string().uuid(),
});

export async function saveRecipeSteps(formData: FormData) {
  const parsed = saveStepsSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) redirectToEditor(formData, "invalid");

  const supabase = await getSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { error } = await supabase.rpc("save_recipe_step_customization", {
    target_recipe_id: parsed.data.recipeId,
    morning_steps_text: parsed.data.morningSteps,
    evening_steps_text: parsed.data.eveningSteps,
  });
  if (error) redirect(editorUrl(parsed.data.kind, parsed.data.identifier, "error=save"));

  revalidateRecipePaths();
  redirect(editorUrl(parsed.data.kind, parsed.data.identifier, "saved=1"));
}

export async function resetRecipeSteps(formData: FormData) {
  const parsed = resetStepsSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) redirect("/app/recipes");

  const supabase = await getSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { error } = await supabase.rpc("reset_recipe_step_customization", {
    target_recipe_id: parsed.data.recipeId,
  });
  if (error) redirect(editorUrl(parsed.data.kind, parsed.data.identifier, "error=reset"));

  revalidateRecipePaths();
  redirect(editorUrl(parsed.data.kind, parsed.data.identifier, "reset=1"));
}

function redirectToEditor(formData: FormData, error: string): never {
  const rawKind = formData.get("kind");
  const kind = rawKind === "custom" || rawKind === "community" ? rawKind : "official";
  const rawIdentifier = formData.get("identifier");
  const identifier = typeof rawIdentifier === "string" ? rawIdentifier.slice(0, 120) : "";
  redirect(editorUrl(kind, identifier, `error=${error}`));
}

function editorUrl(kind: "official" | "community" | "custom", identifier: string, query: string): Route {
  return `/app/recipes/${kind}/${encodeURIComponent(identifier)}?${query}` as Route;
}

function revalidateRecipePaths() {
  revalidatePath("/app");
  revalidatePath("/app/planner");
  revalidatePath("/app/recipes");
}
