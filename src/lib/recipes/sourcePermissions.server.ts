import "server-only";
import { notFound, redirect } from "next/navigation";
import { getSupabaseServer } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { recipeSource, type RecipeSource, type RecipePermission, type SourceInventoryItem } from "./sources";

type ServerClient = Awaited<ReturnType<typeof getSupabaseServer>>;
export async function isRecipePermissionOwner(supabase: ServerClient, userId: string) {
  const { data, error } = await supabase.from("recipe_permission_owner").select("user_id").eq("user_id", userId).maybeSingle();
  return !error && data?.user_id === userId;
}
export async function requireRecipePermissionOwner() {
  const supabase = await getSupabaseServer();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) redirect("/login");
  if (!await isRecipePermissionOwner(supabase, user.id)) notFound();
  const { data: profile, error: profileError } = await supabase.from("profiles").select("household_id").eq("id", user.id).maybeSingle();
  if (profileError) throw new Error("アカウント情報を取得できませんでした。");
  return { supabase, householdId: profile?.household_id as string | null };
}

// 保留中の名前と出典も確認するための限定取得。管理者判定後のみ呼ぶ。
// 他の家庭の料理や材料・手順は取得しない。
export function sourceInventoryQuery(householdId: string | null) {
  const query = getSupabaseAdmin().from("recipes").select("id,name,household_id,archived_at,source_url:meta->>source_url,source_name:meta->>source_name,author_name:meta->>author_name,channel_name:meta->>channel_name").order("id");
  if (!householdId) return query.is("household_id", null);
  if (!/^[0-9a-f-]{36}$/i.test(householdId)) throw new Error("家庭情報が不正です。");
  return query.or(`household_id.is.null,household_id.eq.${householdId}`);
}
export async function loadSourceInventory(): Promise<SourceInventoryItem[]> {
  const { supabase, householdId } = await requireRecipePermissionOwner();
  const items: SourceInventoryItem[] = [];
  // APIの取得上限を超える件数も落とさず、安定したID順で読む。
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await sourceInventoryQuery(householdId).range(offset, offset + 499);
    if (error) throw new Error("メニュー一覧を取得できませんでした。");
    if (!data?.length) break;
    const ids = data.map(row => row.id);
    const [sources, permissions, holds] = await Promise.all([
      supabase.from("recipe_sources").select("recipe_id,provider_name,author_name,source_url,video_start_seconds").in("recipe_id", ids),
      supabase.from("recipe_source_permissions").select("recipe_id,status,allowed_scope,checked_on,evidence").in("recipe_id", ids),
      supabase.from("recipe_content_holds").select("recipe_id").in("recipe_id", ids),
    ]);
    if (sources.error || permissions.error || holds.error) throw new Error("提供元・承諾情報を取得できませんでした。");
    const sourceMap = new Map((sources.data as RecipeSource[]).map(row => [row.recipe_id, row]));
    const permissionMap = new Map((permissions.data as RecipePermission[]).map(row => [row.recipe_id, row]));
    const held = new Set((holds.data ?? []).map(row => row.recipe_id));
    items.push(...data.map(row => ({ id: row.id, name: row.name, household_id: row.household_id, archived_at: row.archived_at,
      source: recipeSource(row.id, row, sourceMap.get(row.id)), permission: permissionMap.get(row.id) ?? null, held: held.has(row.id) })));
    if (data.length < 500) break;
  }
  return items;
}
