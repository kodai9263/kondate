import { ChevronRight, Crown, Plus } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import { buttonClass } from "@/components/ui/Button";
import { ArchiveRecipeButton } from "@/components/features/recipes/ArchiveRecipeButton";
import { officialNutritionRecipes } from "@/lib/nutrition/catalog";
import { isActiveSubscriptionStatus } from "@/lib/billing/entitlements";
import { getSupabaseServer } from "@/lib/supabase/server";

export default async function RecipesPage({ searchParams }: { searchParams: Promise<{ created?: string; deleted?: string; error?: string }> }) {
  const { created, deleted, error } = await searchParams;
  const supabase = await getSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = await supabase.from("profiles").select("household_id").eq("id", user?.id ?? "").maybeSingle();
  const [{ data: customRecipeRows }, { data: communityRecipeRows }, { data: subscription }, { data: exclusions }] = await Promise.all([
    supabase.from("recipes").select("id,name,cook_minutes,protein_source,meta").not("household_id", "is", null).is("archived_at", null).order("created_at", { ascending: false }),
    supabase.from("recipes").select("id,name,cook_minutes,meta").is("household_id", null).is("archived_at", null).contains("meta", { visibility: "community" }).order("created_at", { ascending: false }),
    profile?.household_id ? supabase.from("household_subscriptions").select("status,current_period_end").eq("household_id", profile.household_id).maybeSingle() : Promise.resolve({ data: null }),
    supabase.from("household_recipe_exclusions").select("recipe_key"),
  ]);
  const customRecipes = (customRecipeRows ?? []).filter((recipe) => !isStepCustomization(recipe.meta));
  const customizedOfficialKeys = new Set((customRecipeRows ?? []).flatMap((recipe) => {
    if (!isStepCustomization(recipe.meta)) return [];
    const key = getMetaString(recipe.meta, "nutrition_catalog_id");
    return key ? [key] : [];
  }));
  const customizedSourceIds = new Set((customRecipeRows ?? []).flatMap((recipe) => {
    if (!isStepCustomization(recipe.meta)) return [];
    const sourceId = getMetaString(recipe.meta, "source_recipe_id");
    return sourceId ? [sourceId] : [];
  }));
  const paid = subscription ? isActiveSubscriptionStatus(subscription.status, subscription.current_period_end) : false;
  const excludedRecipeKeys = new Set((exclusions ?? []).map((row) => row.recipe_key));
  const visibleCommunityRecipes = (communityRecipeRows ?? []).filter((recipe) => {
    const exclusionKey = getMetaString(recipe.meta, "community_key") ?? `community:${recipe.id}`;
    return !excludedRecipeKeys.has(exclusionKey);
  });
  const visibleOfficialRecipes = officialNutritionRecipes.filter((recipe) => !excludedRecipeKeys.has(recipe.id));
  return <main className="mx-auto min-h-dvh w-full max-w-5xl px-4 pb-28 pt-5 sm:px-6"><header className="flex items-end justify-between gap-4 border-b border-kondate-line pb-5"><div><h1 className="font-mincho text-[26px] font-bold">メニュー</h1><p className="mt-1.5 text-sm text-kondate-muted">わが家・みんな・公式の料理。</p></div><Link href={paid ? "/app/recipes/new" : "/pricing?required=custom_recipes"} className={buttonClass({ className: "shrink-0 px-4 text-sm" })}>{paid ? <Plus size={18} aria-hidden="true" /> : <Crown size={18} aria-hidden="true" />}{paid ? "登録" : "家族プラン"}</Link></header>
    {created ? <p role="status" className="mt-5 rounded border border-kondate-done/30 bg-kondate-doneSoft p-3 text-sm">{created === "community" ? "みんなのメニューに追加しました。各家庭の次の月間生成から候補に入ります。" : "新しいメニューを登録しました。次の月間生成から候補に入ります。"}</p> : null}
    {deleted ? <p role="status" className="mt-5 rounded border border-kondate-done/30 bg-kondate-doneSoft p-3 text-sm">メニューを削除しました。今後の献立候補には入りません。</p> : null}
    {error === "delete" ? <p role="alert" className="mt-5 rounded border border-kondate-alert/30 bg-kondate-alertSoft p-3 text-sm text-kondate-alert">メニューを削除できませんでした。時間をおいて、もう一度お試しください。</p> : null}
    {customRecipes && customRecipes.length > 0 ? <section className="mt-8"><h2 className="text-sm font-semibold">わが家のメニュー</h2><div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{customRecipes.map((recipe) => <RecipeCard key={recipe.id} id={recipe.id} name={recipe.name} minutes={recipe.cook_minutes} kind="custom" />)}</div></section> : <section className="mt-8 border-y border-kondate-line py-10 text-center"><p className="font-mincho text-lg font-bold">まだ自分のメニューはありません</p><p className="mt-2 text-sm text-kondate-muted">よく作る料理を登録すると、自動献立に混ぜられます。</p></section>}
    <section className="mt-10"><div className="flex items-baseline justify-between gap-3"><h2 className="text-sm font-semibold">みんなのメニュー</h2><p className="text-xs tabular-nums text-kondate-faint">{visibleCommunityRecipes.length}品</p></div><p className="mt-1 text-xs text-kondate-muted">運営がレシピサイトから追加した料理です。不要な料理は各家庭で非表示にできます。</p>{visibleCommunityRecipes.length > 0 ? <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{visibleCommunityRecipes.map((recipe) => <RecipeCard key={recipe.id} id={recipe.id} name={recipe.name} minutes={recipe.cook_minutes} kind="community" customized={customizedSourceIds.has(recipe.id)} />)}</div> : <p className="mt-4 border-y border-kondate-line py-8 text-center text-sm text-kondate-muted">みんなのメニューはまだありません。</p>}</section>
    <section className="mt-10"><div className="flex items-baseline justify-between gap-3"><h2 className="text-sm font-semibold">公式バランスメニュー</h2><p className="text-xs tabular-nums text-kondate-faint">{visibleOfficialRecipes.length}品</p></div>{visibleOfficialRecipes.length > 0 ? <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{visibleOfficialRecipes.map((recipe) => <RecipeCard key={recipe.id} recipeKey={recipe.id} name={recipe.name} minutes={recipe.cookMinutes} kind="official" customized={customizedOfficialKeys.has(recipe.id)} />)}</div> : <p className="mt-4 border-y border-kondate-line py-10 text-center text-sm text-kondate-muted">表示できる公式メニューはありません。</p>}</section>
  </main>;
}

type RecipeCardProps = { name: string; minutes: number } & (
  | { kind: "custom"; id: string }
  | { kind: "community"; id: string; customized: boolean }
  | { kind: "official"; recipeKey: string; customized: boolean }
);

function RecipeCard(props: RecipeCardProps) {
  const { kind, name, minutes } = props;
  const href = (kind === "official" ? `/app/recipes/official/${props.recipeKey}` : kind === "community" ? `/app/recipes/community/${props.id}` : `/app/recipes/custom/${props.id}`) as Route;
  const customized = kind !== "custom" && props.customized;
  return <article className="grid min-h-18 grid-cols-[minmax(0,1fr)_auto] items-center rounded border border-kondate-line bg-white transition-colors hover:border-kondate-ink"><Link href={href} className="group flex min-w-0 items-center justify-between gap-3 px-4 py-3"><div className="min-w-0"><div className="flex flex-wrap items-start gap-2"><h3 className="font-mincho text-base font-bold leading-snug">{name}</h3>{kind === "custom" ? <span className="shrink-0 rounded-sm bg-kondate-accentSoft px-2 py-0.5 text-xs text-kondate-accent">わが家</span> : kind === "community" ? <span className="shrink-0 rounded-sm bg-kondate-accentSoft px-2 py-0.5 text-xs text-kondate-accent">みんな</span> : null}{customized ? <span className="shrink-0 rounded-sm bg-kondate-doneSoft px-2 py-0.5 text-xs text-kondate-done">アレンジ済み</span> : null}</div><p className="mt-1 text-xs tabular-nums text-kondate-faint">調理 {minutes}分</p></div><ChevronRight size={18} aria-hidden="true" className="shrink-0 text-kondate-faint transition-transform group-hover:translate-x-0.5" /></Link><div className="pr-3">{kind === "custom" ? <ArchiveRecipeButton recipeKind="custom" recipeId={props.id} recipeName={name} /> : kind === "community" ? <ArchiveRecipeButton recipeKind="community" recipeId={props.id} recipeName={name} /> : <ArchiveRecipeButton recipeKind="official" recipeKey={props.recipeKey} recipeName={name} />}</div></article>;
}

function isStepCustomization(meta: unknown) {
  return Boolean(meta && typeof meta === "object" && (meta as Record<string, unknown>).step_customization === true);
}

function getMetaString(meta: unknown, key: string) {
  if (!meta || typeof meta !== "object") return null;
  const value = (meta as Record<string, unknown>)[key];
  return typeof value === "string" ? value : null;
}
