import { getCampaignFields } from "@/lib/marketing/campaignParams";
import Link from "next/link";
import { officialNutritionRecipes } from "@/lib/nutrition/catalog";
import { isDinnerCandidate } from "@/lib/nutrition/cookingTime";
import { getSupabaseServer, isSupabaseConfigured } from "@/lib/supabase/server";
import { buttonClass } from "@/components/ui/Button";

export default async function PublicMenusPage({ searchParams }: { searchParams: Promise<{ q?: string } & Record<string, string | undefined>> }) {
  const params = await searchParams;
  const { q = "" } = params;
  const campaignFields = getCampaignFields(params);
  const campaignQuery = new URLSearchParams(campaignFields).toString();
  const campaignSuffix = campaignQuery ? `?${campaignQuery}` : "";
  const query = q.trim().slice(0, 100).normalize("NFKC").toLocaleLowerCase("ja");
  const official = officialNutritionRecipes.filter((recipe) => isDinnerCandidate(recipe)).map((recipe) => ({ id: recipe.id, name: recipe.name, minutes: recipe.totalMinutes ?? recipe.cookMinutes, kind: "official" }));
  let community: typeof official = [];
  if (isSupabaseConfigured()) {
    const supabase = await getSupabaseServer();
    const { data } = await supabase.from("recipes").select("id,name,cook_minutes,meta").is("household_id", null).is("archived_at", null).contains("meta", { visibility: "community" });
    community = (data ?? []).filter((row) => typeof row.meta?.total_minutes === "number" && row.meta.total_minutes <= 40).map((row) => ({ id: row.id, name: row.name, minutes: row.meta.total_minutes, kind: "community" }));
  }
  const recipes = [...official, ...community].filter((recipe) => recipe.name.normalize("NFKC").toLocaleLowerCase("ja").includes(query));
  return <main className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
    <nav className="flex items-center justify-between gap-3"><Link href="/" className="font-mincho font-bold">きょうのごはん</Link><Link href="/login" className="inline-flex min-h-11 items-center text-sm underline">ログイン</Link></nav>
    <header className="mt-8"><h1 className="font-mincho text-3xl font-bold">今日、何を作ろう？</h1><p className="mt-3 leading-7 text-kondate-muted">メニュー・材料・作り方は、登録なしで無料で見られます。</p></header>
    <form className="mt-6 flex gap-2" role="search">{Object.entries(campaignFields).map(([name,value]) => <input type="hidden" key={name} name={name} value={value} />)}<label htmlFor="menu-search" className="sr-only">料理名で検索</label><input id="menu-search" name="q" defaultValue={q} maxLength={100} placeholder="料理名で検索" className="min-w-0 flex-1 rounded border border-kondate-line px-3 py-3 text-base" /><button className={buttonClass({ variant: "ink" })}>検索</button></form>
    <p className="mt-4 text-sm text-kondate-muted">{recipes.length}品・完成まで40分以内</p>
    <section className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3" aria-label="公開メニュー">{recipes.map((recipe) => <Link key={`${recipe.kind}:${recipe.id}`} href={`/menus/${recipe.kind}/${recipe.id}${campaignSuffix}`} className="rounded-lg border border-kondate-line bg-white p-4 hover:border-kondate-accent"><h2 className="font-mincho text-lg font-bold">{recipe.name}</h2><p className="mt-2 text-sm text-kondate-muted">完成まで約{recipe.minutes}分</p></Link>)}</section>
    {!recipes.length ? <p className="mt-8">料理が見つかりませんでした。別の料理名で検索してください。</p> : null}
    <aside className="mt-8 rounded-lg border border-kondate-line bg-white p-5"><h2 className="font-semibold">献立と買い物も、まとめて準備</h2><p className="mt-2 text-sm leading-7 text-kondate-muted">無料登録で最初の7日分を試せます。期限なし・カード登録なし・自動課金なし。次の7日分から月480円、年払いは4,800円です。</p><Link href={{ pathname: "/signup", query: campaignFields }} className={buttonClass({ className: "mt-4" })}>無料登録して献立を試す</Link></aside>
  </main>;
}
