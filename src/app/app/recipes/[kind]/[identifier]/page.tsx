import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { resetRecipeSteps, saveRecipeSteps } from "@/app/app/recipes/[kind]/[identifier]/actions";
import { ResetRecipeStepsButton } from "@/components/features/recipes/ResetRecipeStepsButton";
import { PendingButton } from "@/components/ui/PendingButton";
import { officialNutritionRecipes } from "@/lib/nutrition/catalog";
import { getSupabaseServer } from "@/lib/supabase/server";

type RecipeStep = { phase: "morning" | "seasoning" | "evening"; position: number; text: string };

export default async function RecipeStepsPage({
  params,
  searchParams,
}: {
  params: Promise<{ kind: string; identifier: string }>;
  searchParams: Promise<{ saved?: string; reset?: string; error?: string }>;
}) {
  const [{ kind, identifier }, query] = await Promise.all([params, searchParams]);
  if (kind !== "official" && kind !== "custom") notFound();

  const supabase = await getSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: profile } = await supabase.from("profiles").select("household_id").eq("id", user.id).maybeSingle();
  if (!profile?.household_id) redirect("/app/recipes");

  const recipe = kind === "official"
    ? await getOfficialRecipe(identifier, profile.household_id)
    : await getCustomRecipe(identifier, profile.household_id);
  if (!recipe) notFound();

  const { data: stepRows } = await supabase
    .from("recipe_steps")
    .select("phase,position,text")
    .eq("recipe_id", recipe.displayRecipeId)
    .order("position", { ascending: true });
  const steps = (stepRows ?? []) as RecipeStep[];

  return (
    <main className="mx-auto min-h-dvh w-full max-w-3xl px-4 pb-28 pt-5 sm:px-6">
      <Link href="/app/recipes" className="inline-flex min-h-11 items-center gap-2 text-sm text-kondate-muted transition-colors hover:text-kondate-ink"><ArrowLeft size={18} aria-hidden="true" />メニュー一覧</Link>
      <header className="mt-4 border-b border-kondate-line pb-5">
        <div className="flex flex-wrap items-center gap-2"><h1 className="font-mincho text-[26px] font-bold">{recipe.name}</h1>{recipe.hasCustomization ? <span className="rounded-sm bg-kondate-doneSoft px-2 py-1 text-xs text-kondate-done">アレンジ済み</span> : null}</div>
        <p className="mt-1.5 text-sm text-kondate-muted">1行が1つの工程です。行の順番を変えると、今日の手順にも同じ順番で表示されます。</p>
      </header>

      {query.saved ? <p role="status" className="mt-5 rounded border border-kondate-done/30 bg-kondate-doneSoft p-3 text-sm">工程を保存し、今日以降の献立へ反映しました。</p> : null}
      {query.reset ? <p role="status" className="mt-5 rounded border border-kondate-done/30 bg-kondate-doneSoft p-3 text-sm">公式の工程に戻しました。</p> : null}
      {query.error ? <p role="alert" className="mt-5 rounded border border-kondate-alert/30 bg-kondate-alertSoft p-3 text-sm text-kondate-alert">工程を保存できませんでした。入力内容を確認して、もう一度お試しください。</p> : null}

      <form action={saveRecipeSteps} className="mt-6 space-y-6">
        <input type="hidden" name="kind" value={kind} />
        <input type="hidden" name="identifier" value={identifier} />
        <input type="hidden" name="recipeId" value={recipe.sourceRecipeId} />
        <StepField label="朝の仕込み" name="morningSteps" steps={stepsForPhase(steps, "morning")} optional />
        <StepField label="夜の手順" name="eveningSteps" steps={stepsForPhase(steps, "evening")} />
        <PendingButton>工程を保存</PendingButton>
      </form>

      {kind === "official" && recipe.hasCustomization ? <form action={resetRecipeSteps} className="mt-8 border-t border-kondate-line pt-6">
        <input type="hidden" name="identifier" value={identifier} />
        <input type="hidden" name="recipeId" value={recipe.sourceRecipeId} />
        <ResetRecipeStepsButton />
      </form> : null}
    </main>
  );

  async function getOfficialRecipe(recipeKey: string, householdId: string) {
    const catalogRecipe = officialNutritionRecipes.find((item) => item.id === recipeKey);
    if (!catalogRecipe) return null;

    let { data: source } = await supabase.from("recipes").select("id,name").is("household_id", null).contains("meta", { nutrition_catalog_id: recipeKey }).maybeSingle();
    if (!source) {
      const fallback = await supabase.from("recipes").select("id,name").is("household_id", null).eq("name", catalogRecipe.name).maybeSingle();
      source = fallback.data;
    }
    if (!source) return null;

    const { data: householdRecipes } = await supabase.from("recipes").select("id,meta").eq("household_id", householdId).is("archived_at", null);
    const customization = (householdRecipes ?? []).find((row) => isCustomizationOf(row.meta, source.id));
    return {
      name: catalogRecipe.name,
      sourceRecipeId: source.id,
      displayRecipeId: customization?.id ?? source.id,
      hasCustomization: Boolean(customization),
    };
  }

  async function getCustomRecipe(recipeId: string, householdId: string) {
    const { data } = await supabase.from("recipes").select("id,name,meta").eq("id", recipeId).eq("household_id", householdId).is("archived_at", null).maybeSingle();
    if (!data || isStepCustomization(data.meta)) return null;
    return { name: data.name, sourceRecipeId: data.id, displayRecipeId: data.id, hasCustomization: false };
  }
}

function StepField({ label, name, steps, optional = false }: { label: string; name: string; steps: string[]; optional?: boolean }) {
  return <label className="block text-sm font-semibold">{label} {optional ? <span className="text-xs font-normal text-kondate-faint">（任意）</span> : <span className="text-xs font-normal text-kondate-faint">（必須）</span>}<textarea name={name} required={!optional} rows={Math.max(5, Math.min(10, steps.length + 2))} defaultValue={steps.join("\n")} className="mt-2 w-full rounded border border-kondate-line bg-white p-3 text-base font-normal leading-7 outline-none focus:border-kondate-ink" /><span className="mt-1 block text-xs font-normal leading-6 text-kondate-faint">追加・削除・書き換え・並べ替えができます。</span></label>;
}

function stepsForPhase(steps: RecipeStep[], phase: RecipeStep["phase"]) {
  return steps.filter((step) => step.phase === phase).sort((a, b) => a.position - b.position).map((step) => step.text);
}

function isStepCustomization(meta: unknown) {
  return Boolean(meta && typeof meta === "object" && (meta as Record<string, unknown>).step_customization === true);
}

function isCustomizationOf(meta: unknown, sourceRecipeId: string) {
  if (!isStepCustomization(meta)) return false;
  return (meta as Record<string, unknown>).source_recipe_id === sourceRecipeId;
}
