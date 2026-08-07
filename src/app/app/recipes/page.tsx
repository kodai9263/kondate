import { BookOpen, Clock3, Plus } from "lucide-react";
import Link from "next/link";
import { officialNutritionRecipes } from "@/lib/nutrition/catalog";
import { getSupabaseServer } from "@/lib/supabase/server";

export default async function RecipesPage({ searchParams }: { searchParams: Promise<{ created?: string }> }) {
  const { created } = await searchParams;
  const supabase = await getSupabaseServer();
  const { data: customRecipes } = await supabase.from("recipes").select("id,name,cook_minutes,protein_source,meta").not("household_id", "is", null).order("created_at", { ascending: false });
  return <main className="mx-auto min-h-dvh w-full max-w-5xl px-4 pb-28 pt-5 sm:px-6"><header className="flex items-end justify-between gap-4 border-b-2 border-kondate-ink pb-5"><div><p className="flex items-center gap-2 text-sm font-black text-kondate-accent"><BookOpen size={18} />RECIPE LIBRARY</p><h1 className="font-mincho mt-2 text-3xl font-black">メニュー</h1><p className="mt-2 text-sm text-kondate-muted">公式レシピと、わが家の料理。</p></div><Link href="/app/recipes/new" className="inline-flex min-h-12 shrink-0 items-center gap-2 rounded-lg bg-kondate-accent px-4 text-sm font-black text-white"><Plus size={18} />登録</Link></header>
    {created ? <p role="status" className="mt-5 rounded-lg bg-kondate-sage p-3 text-sm font-bold text-[#285b35]">新しいメニューを登録しました。次の月間生成から候補に入ります。</p> : null}
    {customRecipes && customRecipes.length > 0 ? <section className="mt-8"><h2 className="text-lg font-black">わが家のメニュー</h2><div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{customRecipes.map((recipe) => <RecipeCard key={recipe.id} name={recipe.name} minutes={recipe.cook_minutes} custom />)}</div></section> : <section className="mt-8 border-y border-kondate-line py-8 text-center"><p className="font-black">まだ自分のメニューはありません</p><p className="mt-2 text-sm text-kondate-muted">よく作る料理を登録すると、自動献立に混ぜられます。</p></section>}
    <section className="mt-10"><div className="flex items-baseline justify-between gap-3"><h2 className="text-lg font-black">公式バランスメニュー</h2><p className="text-xs font-black text-kondate-muted">{officialNutritionRecipes.length}品</p></div><div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{officialNutritionRecipes.map((recipe) => <RecipeCard key={recipe.id} name={recipe.name} minutes={recipe.cookMinutes} />)}</div></section>
  </main>;
}

function RecipeCard({ name, minutes, custom = false }: { name: string; minutes: number; custom?: boolean }) { return <article className="grid min-h-28 grid-rows-[1fr_auto] border border-kondate-line bg-white p-4"><div className="flex items-start justify-between gap-3"><h3 className="font-mincho text-lg font-black leading-snug">{name}</h3>{custom ? <span className="shrink-0 bg-kondate-sage px-2 py-1 text-xs font-black text-[#285b35]">わが家</span> : null}</div><p className="mt-4 flex items-center gap-1.5 border-t border-kondate-line pt-3 text-xs font-bold text-kondate-muted"><Clock3 size={15} aria-hidden="true" />調理 {minutes}分</p></article>; }
