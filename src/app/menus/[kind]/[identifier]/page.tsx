import { getCampaignFields } from "@/lib/marketing/campaignParams";
import Link from "next/link";
import { notFound } from "next/navigation";
import { officialNutritionRecipes } from "@/lib/nutrition/catalog";
import { officialRecipeDetails } from "@/lib/nutrition/recipeDetails";
import { RecipeCookingGuide } from "@/components/features/recipes/RecipeCookingGuide";
import { TrackedLink } from "@/components/features/analytics/TrackedLink";
import { buttonClass } from "@/components/ui/Button";
import { normalizeRecipeSelection, recipeSelectionDestination } from "@/lib/billing/firstWeek";
import { getSupabaseServer, isSupabaseConfigured } from "@/lib/supabase/server";

export default async function PublicRecipePage({ params, searchParams }: { params: Promise<{ kind: string; identifier: string }>; searchParams?: Promise<Record<string, string | undefined>> }) {
  const { kind, identifier } = await params;
  const campaignQuery = new URLSearchParams(getCampaignFields(await searchParams ?? {})).toString();
  const campaignSuffix = campaignQuery ? `&${campaignQuery}` : "";
  const selection = normalizeRecipeSelection(`${kind}:${identifier}`);
  if (!selection) notFound();
  let name: string;
  let ingredients: string[];
  let steps: string[];
  let notes: string[] = [];
  let minutes: number | undefined;
  let baseServings = 4;
  let scalable = true;
  if (kind === "official") {
    const recipe = officialNutritionRecipes.find((item) => item.id === identifier);
    const detail = officialRecipeDetails[identifier];
    if (!recipe || !detail) notFound();
    name = recipe.name; ingredients = detail.ingredients; steps = detail.steps; notes = detail.notes; minutes = detail.totalMinutes;
  } else {
    if (!isSupabaseConfigured()) notFound();
    const supabase = await getSupabaseServer();
    const { data: recipe, error } = await supabase.from("recipes").select("id,name,meta,servings_base").eq("id", identifier).is("household_id", null).is("archived_at", null).contains("meta", { visibility: "community" }).maybeSingle();
    if (error || !recipe) notFound();
    const { data: rows, error: stepError } = await supabase.from("recipe_steps").select("phase,position,text").eq("recipe_id", recipe.id).order("position");
    if (stepError) notFound();
    name = recipe.name; ingredients = (rows ?? []).filter((row) => row.phase === "seasoning").map((row) => row.text); steps = (rows ?? []).filter((row) => row.phase === "evening").map((row) => row.text);
    baseServings = Number(recipe.servings_base) || 4; scalable = recipe.meta?.recipe_detail_version === 2;
    minutes = typeof recipe.meta?.total_minutes === "number" ? recipe.meta.total_minutes : undefined;
  }
  const plannerNext = recipeSelectionDestination(selection);
  const favoriteNext = recipeSelectionDestination(selection, true);
  return <main className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
    <Link href="/menus" className="inline-flex min-h-11 items-center text-sm underline">メニュー一覧に戻る</Link>
    <h1 className="font-mincho mt-4 text-3xl font-bold">{name}</h1><p className="mt-3 text-sm text-kondate-muted">材料・作り方は無料です。</p>
    <RecipeCookingGuide ingredients={ingredients} morning={[]} steps={steps} notes={notes} baseServings={baseServings} scalable={scalable} totalMinutes={minutes} />
    <section className="mt-6 rounded-lg border border-kondate-line bg-white p-5"><h2 className="font-semibold">この料理から、1週間の準備を始める</h2><p className="mt-2 text-sm leading-7 text-kondate-muted">登録後もこの料理を引き継ぎます。登録から14日間、献立と買い物リストを無料で使えます。体験終了後の継続利用は月480円・年4,800円。カード登録なし・自動課金なし。</p><div className="mt-4 flex flex-wrap gap-3"><TrackedLink href={`/signup?next=${encodeURIComponent(plannerNext)}${campaignSuffix}`} eventName="menu_plan_cta" eventParams={{ recipe: selection }} className={buttonClass({})}>この料理を献立に入れる</TrackedLink><TrackedLink href={`/signup?next=${encodeURIComponent(favoriteNext)}${campaignSuffix}`} eventName="menu_favorite_cta" className={buttonClass({ variant: "secondary" })}>お気に入りに保存</TrackedLink></div></section>
  </main>;
}
