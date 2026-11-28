"use server";

import { randomUUID } from "node:crypto";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getSupabaseServer } from "@/lib/supabase/server";
import { recipeEditorFields, recipeImportFields } from "@/lib/recipes/editorSchema";
import { fetchPrivateRecipe, privateImportMessage, privateRecipeUrl } from "@/lib/recipes/privateImport";

export async function importRecipeFromUrl(input: unknown) {
  const url = z.string().trim().max(2048).safeParse(input);
  if (!url.success) return { ok: false as const, message: "レシピのURLを入力してください。" };
  try {
    privateRecipeUrl(url.data);
    const supabase = await getSupabaseServer();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { ok: false as const, message: "ログインしてから取り込んでください。" };
    const access = await supabase.rpc("reserve_household_recipe_import");
    if (access.error || access.data !== true) return { ok: false as const, message: "取り込めませんでした。家族の利用状況を確認し、10秒ほど待ってから再試行してください。" };
    return { ok: true as const, recipe: await fetchPrivateRecipe(url.data) };
  } catch (error) { return { ok: false as const, message: privateImportMessage(error) }; }
}

// 画面遷移せずに失敗を返し、入力と同じ保存IDを残して再試行できるようにする。
export async function saveRecipe(formData: FormData) {
  if (formData.get("visibility") === "community") return { ok: false as const, code: "publish", message: "全体への公開登録はできません。" };
  const sourceUrl = formData.get("sourceUrl");
  const source = sourceUrl ? recipeImportFields.safeParse({ sourceUrl, sourceServingsText: formData.get("sourceServingsText"), importConfirmed: formData.get("importConfirmed") }) : null;
  if (source && !source.success) return { ok: false as const, code: "import_paused", message: "対応URL、元の人数、取り込み内容の確認を見直してください。" };
  const parsed = recipeEditorFields.safeParse({
    name: formData.get("name"), side: formData.get("side") ?? "",
    cookMinutes: Number(formData.get("cookMinutes")), servings: Number(formData.get("servings")),
    proteinSource: formData.get("proteinSource"), ingredients: formData.get("ingredients"),
    morning: "", steps: formData.get("steps"), ...(source?.success ? source.data : {}),
  });
  if (!parsed.success) return { ok: false as const, code: "invalid", message: "料理名・人数・時間・材料・作り方を確認してください。" };
  const ids = z.object({ id: z.string().uuid(), requestId: z.string().uuid() }).safeParse({ id: formData.get("id") ?? randomUUID(), requestId: formData.get("requestId") ?? randomUUID() });
  if (!ids.success) return { ok: false as const, code: "invalid", message: "保存IDを確認できません。入力内容を控えて画面を開き直してください。" };
  try {
    const supabase = await getSupabaseServer();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { ok: false as const, code: "login", message: "ログインし直してください。入力内容はコピーして控えてください。" };
    const { error } = await supabase.rpc("save_household_recipe_editor", {
      target_id: ids.data.id, request_id: ids.data.requestId, expected_revision: null, fields: parsed.data,
    });
    if (error) return { ok: false as const, code: "save", message: "保存を確認できませんでした。同じ内容でもう一度保存を押してください。" };
    for (const path of ["/app/recipes", "/app/planner", "/app/shopping"]) revalidatePath(path, "layout");
    return { ok: true as const, id: ids.data.id };
  } catch { return { ok: false as const, code: "save", message: "保存を確認できませんでした。同じ内容でもう一度保存を押してください。" }; }
}

// 旧画面の送信にも同じ検証を適用する。
export async function createRecipe(formData: FormData) {
  const result = await saveRecipe(formData);
  if (!result.ok) redirect(result.code === "login" ? "/login" : `/app/recipes/new?error=${result.code}`);
  redirect("/app/recipes?created=household");
}
