"use server";

import { revalidatePath } from "next/cache";
import { sourcePermissionSchema } from "@/lib/recipes/sources";
import { requireRecipePermissionOwner, sourceInventoryQuery } from "@/lib/recipes/sourcePermissions.server";

export type SourceSaveState = { ok: boolean; message: string };
export async function saveSourcePermission(_previous: SourceSaveState, formData: FormData): Promise<SourceSaveState> {
  const { supabase, householdId } = await requireRecipePermissionOwner();
  const parsed = sourcePermissionSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, message: "入力内容を確認してください。承諾済みには許可範囲・確認日・承諾記録が必要です。開始位置はYouTubeのみ指定できます。" };
  const value = parsed.data;
  const { data: recipe, error: recipeError } = await sourceInventoryQuery(householdId).eq("id", value.recipeId).maybeSingle();
  if (recipeError || !recipe) return { ok: false, message: "対象のメニューを確認できませんでした。" };
  const { error } = await supabase.rpc("save_recipe_source_permission", {
    target_id: value.recipeId,
    source_fields: { provider_name: value.providerName, author_name: value.authorName, source_url: value.sourceUrl, video_start_seconds: value.videoStartSeconds },
    permission_fields: { status: value.status, allowed_scope: value.allowedScope, checked_on: value.checkedOn || null, evidence: value.evidence },
  });
  if (error) return { ok: false, message: "保存できませんでした。入力内容は残っています。時間をおいて再度お試しください。" };
  revalidatePath("/admin/recipe-sources");
  revalidatePath("/app/recipes", "layout");
  return { ok: true, message: "保存しました。公開状態は変更していません。" };
}
