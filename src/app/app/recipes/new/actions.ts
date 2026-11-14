"use server";

import { randomUUID } from "node:crypto";
import { redirect } from "next/navigation";
import { z } from "zod";
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

// 旧画面から呼ばれても、権利確認が完了するまで外部サイトへ接続しない。
export async function importRecipeFromUrl(_input: unknown) {
  void _input;
  return { ok: false as const, message: "URL取り込みは現在休止中です。ご自身のレシピを手入力で登録できます。" };
}

export async function createRecipe(formData: FormData) {
  if (formData.get("visibility") === "community") redirect("/app/recipes/new?error=publish");
  if (formData.get("sourceUrl")) redirect("/app/recipes/new?error=import_paused");
  const parsed = recipeSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) redirect("/app/recipes/new?error=invalid");
  const supabase = await getSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  // iOSと同じ、家族の権限・入力値を検証するRPCを使用する。栄養値は捏造しない。
  const payload = {
    target_id: randomUUID(), request_id: randomUUID(), expected_revision: null,
    fields: { ...parsed.data, morning: "" },
  };
  const { error } = await supabase.rpc("save_household_recipe_editor", payload);
  if (error) redirect("/app/recipes/new?error=save");
  redirect("/app/recipes?created=household");
}
