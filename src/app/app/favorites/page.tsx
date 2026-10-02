import Link from "next/link";
import { getFirstWeekAccess } from "@/lib/billing/firstWeek.server";
import { normalizeRecipeSelection } from "@/lib/billing/firstWeek";
import { officialNutritionRecipes } from "@/lib/nutrition/catalog";
import { PendingButton } from "@/components/ui/PendingButton";
import { saveFavorite } from "./actions";

export default async function FavoritesPage({ searchParams }: { searchParams: Promise<{ recipe?: string; saved?: string; error?: string }> }) {
  const params = await searchParams;
  const selected = normalizeRecipeSelection(params.recipe);
  const { supabase, householdId } = await getFirstWeekAccess();
  const { data: favorites, error } = await supabase.from("recipe_favorites").select("recipe_key").eq("household_id", householdId).order("created_at", { ascending: false });
  const communityIds = [...new Set([...(favorites ?? []).map((item) => item.recipe_key), ...(selected ? [selected] : [])].filter((key) => key.startsWith("community:")).map((key) => key.split(":")[1]))];
  const { data: community } = communityIds.length ? await supabase.from("recipes").select("id,name").in("id", communityIds).is("household_id", null).is("archived_at", null).contains("meta", { visibility: "community" }) : { data: [] };
  const name = (key: string) => key.startsWith("official:") ? officialNutritionRecipes.find((item) => item.id === key.split(":")[1])?.name : community?.find((item) => item.id === key.split(":")[1])?.name;
  return <main className="mx-auto max-w-3xl px-4 pb-28 pt-6"><h1 className="font-mincho text-2xl font-bold">お気に入り</h1><p className="mt-3 text-sm text-kondate-muted">お気に入りの保存は無料です。</p>
    {params.saved ? <p role="status" className="mt-4">お気に入りに保存しました。</p> : null}
    {params.error || error ? <p role="alert" className="mt-4 text-kondate-alert">お気に入りを読み込み・保存できませんでした。</p> : null}
    {selected && name(selected) ? <form action={saveFavorite} className="mt-5 rounded border border-kondate-line bg-white p-4"><input type="hidden" name="recipe" value={selected} /><p className="mb-3 font-semibold">{name(selected)}</p><PendingButton>お気に入りに保存</PendingButton></form> : null}
    <ul className="mt-6 space-y-3">{(favorites ?? []).filter((item) => name(item.recipe_key)).map((item) => { const [kind, id] = item.recipe_key.split(":"); return <li key={item.recipe_key}><Link href={`/menus/${kind}/${id}`} className="flex min-h-14 items-center rounded border border-kondate-line bg-white p-4">{name(item.recipe_key)}</Link></li>; })}</ul>
    <Link href="/menus" className="mt-6 inline-flex min-h-11 items-center underline">メニューを探す</Link>
  </main>;
}
