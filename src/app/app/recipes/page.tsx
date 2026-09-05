import { Crown, Plus } from "lucide-react";
import Link from "next/link";
import { ArchiveRecipeButton } from "@/components/features/recipes/ArchiveRecipeButton";
import { officialNutritionRecipes } from "@/lib/nutrition/catalog";
import { isActiveSubscriptionStatus } from "@/lib/billing/entitlements";
import { getSupabaseServer } from "@/lib/supabase/server";

export default async function RecipesPage({ searchParams }: { searchParams: Promise<{ created?: string; deleted?: string; error?: string }> }) {
  const { created, deleted, error } = await searchParams;
  const supabase = await getSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = await supabase.from("profiles").select("household_id").eq("id", user?.id ?? "").maybeSingle();
  const [{ data: customRecipes }, { data: subscription }, { data: exclusions }] = await Promise.all([
    supabase.from("recipes").select("id,name,cook_minutes,protein_source,meta").not("household_id", "is", null).is("archived_at", null).order("created_at", { ascending: false }),
    profile?.household_id ? supabase.from("household_subscriptions").select("status,current_period_end").eq("household_id", profile.household_id).maybeSingle() : Promise.resolve({ data: null }),
    supabase.from("household_recipe_exclusions").select("recipe_key"),
  ]);
  const paid = subscription ? isActiveSubscriptionStatus(subscription.status, subscription.current_period_end) : false;
  const excludedRecipeKeys = new Set((exclusions ?? []).map((row) => row.recipe_key));
  const visibleOfficialRecipes = officialNutritionRecipes.filter((recipe) => !excludedRecipeKeys.has(recipe.id));
  return <main className="mx-auto min-h-dvh w-full max-w-5xl px-4 pb-28 pt-5 sm:px-6"><header className="flex items-end justify-between gap-4 border-b border-kondate-line pb-5"><div><h1 className="font-mincho text-[26px] font-bold">メニュー</h1><p className="mt-1.5 text-sm text-kondate-muted">公式レシピと、わが家の料理。</p></div><Link href={paid ? "/app/recipes/new" : "/pricing?required=custom_recipes"} className="inline-flex min-h-12 shrink-0 items-center gap-2 rounded bg-kondate-accent px-4 text-sm font-semibold text-white transition-colors hover:bg-kondate-accentDark">{paid ? <Plus size={18} aria-hidden="true" /> : <Crown size={18} aria-hidden="true" />}{paid ? "登録" : "家族プラン"}</Link></header>
    {created ? <p role="status" className="mt-5 rounded border border-kondate-done/30 bg-kondate-doneSoft p-3 text-sm">新しいメニューを登録しました。次の月間生成から候補に入ります。</p> : null}
    {deleted ? <p role="status" className="mt-5 rounded border border-kondate-done/30 bg-kondate-doneSoft p-3 text-sm">メニューを削除しました。今後の献立候補には入りません。</p> : null}
    {error === "delete" ? <p role="alert" className="mt-5 rounded border border-kondate-alert/30 bg-kondate-alertSoft p-3 text-sm text-kondate-alert">メニューを削除できませんでした。時間をおいて、もう一度お試しください。</p> : null}
    {customRecipes && customRecipes.length > 0 ? <section className="mt-8"><h2 className="text-sm font-semibold">わが家のメニュー</h2><div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{customRecipes.map((recipe) => <RecipeCard key={recipe.id} id={recipe.id} name={recipe.name} minutes={recipe.cook_minutes} kind="custom" />)}</div></section> : <section className="mt-8 border-y border-kondate-line py-10 text-center"><p className="font-mincho text-lg font-bold">まだ自分のメニューはありません</p><p className="mt-2 text-sm text-kondate-muted">よく作る料理を登録すると、自動献立に混ぜられます。</p></section>}
    <section className="mt-10"><div className="flex items-baseline justify-between gap-3"><h2 className="text-sm font-semibold">公式バランスメニュー</h2><p className="text-xs tabular-nums text-kondate-faint">{visibleOfficialRecipes.length}品</p></div>{visibleOfficialRecipes.length > 0 ? <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{visibleOfficialRecipes.map((recipe) => <RecipeCard key={recipe.id} recipeKey={recipe.id} name={recipe.name} minutes={recipe.cookMinutes} kind="official" />)}</div> : <p className="mt-4 border-y border-kondate-line py-10 text-center text-sm text-kondate-muted">表示できる公式メニューはありません。</p>}</section>
  </main>;
}

type RecipeCardProps = { name: string; minutes: number } & (
  | { kind: "custom"; id: string }
  | { kind: "official"; recipeKey: string }
);

function RecipeCard(props: RecipeCardProps) {
  const { kind, name, minutes } = props;
  return <article className="rounded border border-kondate-line bg-white px-4 py-3"><div className="flex items-start justify-between gap-3"><h3 className="font-mincho text-base font-bold leading-snug">{name}</h3>{kind === "custom" ? <span className="shrink-0 rounded-sm bg-kondate-accentSoft px-2 py-0.5 text-xs text-kondate-accent">わが家</span> : null}</div><div className="mt-1 flex items-center justify-between gap-2"><p className="text-xs tabular-nums text-kondate-faint">調理 {minutes}分</p>{kind === "custom" ? <ArchiveRecipeButton recipeKind="custom" recipeId={props.id} recipeName={name} /> : <ArchiveRecipeButton recipeKind="official" recipeKey={props.recipeKey} recipeName={name} />}</div></article>;
}
