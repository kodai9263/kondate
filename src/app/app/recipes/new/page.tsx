import { ArrowLeft, Info, Salad } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createRecipe } from "@/app/app/recipes/new/actions";
import { PendingButton } from "@/components/ui/PendingButton";
import { isActiveSubscriptionStatus } from "@/lib/billing/entitlements";
import { getSupabaseServer } from "@/lib/supabase/server";

const errors: Record<string, string> = {
  invalid: "入力内容を確認してください。必須項目と数値を見直せます。",
  profile: "家族グループを確認できませんでした。",
  save: "メニューを保存できませんでした。時間をおいて再度お試しください。",
};

export default async function NewRecipePage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  const supabase = await getSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: profile } = await supabase.from("profiles").select("household_id").eq("id", user.id).maybeSingle();
  if (!profile?.household_id) redirect("/app/recipes");
  const { data: subscription } = await supabase.from("household_subscriptions").select("status,current_period_end").eq("household_id", profile.household_id).maybeSingle();
  if (!subscription || !isActiveSubscriptionStatus(subscription.status, subscription.current_period_end)) {
    redirect("/pricing?required=custom_recipes");
  }
  return (
    <main className="mx-auto min-h-dvh w-full max-w-3xl px-4 pb-28 pt-5 sm:px-6">
      <Link href="/app/recipes" className="inline-flex min-h-11 items-center gap-2 text-sm font-black text-kondate-muted"><ArrowLeft size={18} />メニュー一覧</Link>
      <header className="mt-4 border-b-2 border-kondate-ink pb-5"><p className="flex items-center gap-2 text-sm font-black text-kondate-accent"><Salad size={18} />MY RECIPE</p><h1 className="font-mincho mt-2 text-3xl font-black">自分のメニューを登録</h1><p className="mt-2 text-sm leading-6 text-kondate-muted">登録した料理は、翌月の栄養バランス献立にも使われます。</p></header>
      {error ? <p role="alert" className="mt-5 rounded-lg border border-red-200 bg-red-50 p-3 text-sm font-bold leading-6 text-red-800">{errors[error] ?? errors.save}</p> : null}

      <form action={createRecipe} className="mt-6 space-y-8">
        <fieldset className="space-y-4"><legend className="mb-4 text-lg font-black">料理の基本</legend>
          <Field label="料理名" name="name" required />
          <Field label="副菜・汁物" name="side" helper="一緒に食べたい副菜や汁物を入力します。" />
          <div className="grid gap-4 sm:grid-cols-2"><NumberField label="調理時間" name="cookMinutes" unit="分" defaultValue="25" /><label className="block text-sm font-black">主なたんぱく源 <Required /><select name="proteinSource" required defaultValue="meat" className="mt-2 min-h-12 w-full rounded-lg border-2 border-kondate-ink bg-white px-3 text-base"><option value="fish">魚</option><option value="meat">肉</option><option value="soy">大豆・豆腐</option><option value="egg">卵</option><option value="noodle">麺・その他</option></select></label></div>
          <TextArea label="材料" name="ingredients" helper="1行に1つずつ書くと、あとから買い物リストへ変換しやすくなります。" />
          <TextArea label="作り方" name="steps" />
        </fieldset>

        <fieldset><legend className="text-lg font-black">1人分の栄養目安</legend><p className="mt-2 flex gap-2 rounded-lg bg-kondate-sage p-3 text-xs leading-5 text-[#285b35]"><Info size={17} className="shrink-0" />レシピや商品表示を参考に、わかる範囲の目安を入力してください。医療上の栄養指導ではありません。</p>
          <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4"><NumberField label="エネルギー" name="energyKcal" unit="kcal" defaultValue="650" /><NumberField label="たんぱく質" name="proteinG" unit="g" defaultValue="28" /><NumberField label="脂質" name="fatG" unit="g" defaultValue="20" /><NumberField label="炭水化物" name="carbsG" unit="g" defaultValue="85" /><NumberField label="食物繊維" name="fiberG" unit="g" defaultValue="8" /><NumberField label="塩分" name="saltG" unit="g" defaultValue="2.2" step="0.1" /><NumberField label="野菜量" name="vegetablesG" unit="g" defaultValue="160" /></div>
        </fieldset>
        <PendingButton>メニューを保存</PendingButton>
      </form>
    </main>
  );
}

function Required() { return <span className="text-xs text-kondate-muted">（必須）</span>; }
function Field({ label, name, required = false, helper }: { label: string; name: string; required?: boolean; helper?: string }) { return <label className="block text-sm font-black">{label} {required ? <Required /> : null}<input name={name} required={required} className="mt-2 min-h-12 w-full rounded-lg border-2 border-kondate-ink px-3 text-base" />{helper ? <span className="mt-1 block text-xs font-normal leading-5 text-kondate-muted">{helper}</span> : null}</label>; }
function TextArea({ label, name, helper }: { label: string; name: string; helper?: string }) { return <label className="block text-sm font-black">{label} <Required /><textarea name={name} required rows={5} className="mt-2 w-full rounded-lg border-2 border-kondate-ink p-3 text-base" />{helper ? <span className="mt-1 block text-xs font-normal leading-5 text-kondate-muted">{helper}</span> : null}</label>; }
function NumberField({ label, name, unit, defaultValue, step = "1" }: { label: string; name: string; unit: string; defaultValue: string; step?: string }) { return <label className="block text-sm font-black">{label} <Required /><span className="mt-2 flex min-h-12 items-center rounded-lg border-2 border-kondate-ink bg-white"><input name={name} type="number" inputMode="decimal" min="0" step={step} required defaultValue={defaultValue} className="min-w-0 flex-1 bg-transparent px-3 text-base outline-none" /><span className="pr-3 text-xs text-kondate-muted">{unit}</span></span></label>; }
