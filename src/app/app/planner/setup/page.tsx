import { redirect } from "next/navigation";
import Link from "next/link";
import { getFirstWeekAccess } from "@/lib/billing/firstWeek.server";
import { normalizeRecipeSelection } from "@/lib/billing/firstWeek";
import { getCurrentHouseholdPreferences } from "@/lib/family/server";
import { commonAllergens, getCustomAllergies } from "@/lib/family/allergies";
import { toDateKey, toTokyoCalendarDate } from "@/lib/dates";
import { configureFirstWeek } from "./actions";
import { PendingButton } from "@/components/ui/PendingButton";

export default async function FirstWeekSetupPage({ searchParams }: { searchParams: Promise<{ recipe?: string; error?: string }> }) {
  const params = await searchParams;
  const recipe = normalizeRecipeSelection(params.recipe);
  const [access, preferences] = await Promise.all([getFirstWeekAccess(), getCurrentHouseholdPreferences(true)]);
  if (!access.canPlan) redirect("/pricing?required=trial_expired");
  if (access.user.is_anonymous) redirect("/app");
  const start = access.trial?.start_date ?? access.trial?.selected_start ?? toDateKey(toTokyoCalendarDate(new Date()));
  const field = "mt-2 min-h-12 w-full rounded border border-kondate-line bg-white px-3 text-base";
  return <main className="mx-auto max-w-xl px-4 pb-28 pt-6"><Link href="/app/recipes" className="inline-flex min-h-11 items-center text-sm underline">メニューを見る</Link><h1 className="font-mincho mt-4 text-2xl font-bold">まずは人数とアレルギーを確認</h1>
    <p className="mt-3 text-sm leading-7 text-kondate-muted">{access.paid ? "設定を確認して献立を作ります。" : "登録から14日間、献立と買い物リストを無料で使えます。体験終了後の継続利用は月480円・年4,800円。カード登録なし・自動課金なし。"}</p>
    {!access.paid ? <p className="mt-3 text-xs leading-6 text-kondate-muted">体験終了後も保存済みの献立は残り、閲覧できます。登録からの14日間は、設定を変更しても延長されません。</p> : null}
    {params.error ? <p role="alert" className="mt-4 text-sm text-kondate-alert">{params.error === "invalid" ? "人数・開始日を確認し、アレルギーの確認にチェックしてください。" : "設定を保存できませんでした。再度お試しください。"}</p> : null}
    {recipe ? <p className="mt-4 text-sm">選んだ料理を献立へ引き継ぎます。アレルギー等で候補外の場合は選び直せます。</p> : null}
    <form action={configureFirstWeek} className="mt-6 space-y-5">
      <input type="hidden" name="recipe" value={recipe ?? ""} />
      <div className="grid grid-cols-2 gap-4"><label className="text-sm font-semibold">大人<input className={field} name="adults" type="number" required min={1} max={10} defaultValue={preferences.adultCount} /></label><label className="text-sm font-semibold">子ども<input className={field} name="children" type="number" required min={0} max={10} defaultValue={preferences.childCount} /></label></div>
      <label className="block text-sm font-semibold">献立の表示開始日<input className={field} name="start" type="date" required min="2020-01-01" max="2100-12-25" defaultValue={start} /><span className="mt-2 block text-xs font-normal text-kondate-muted">この日付を変更しても無料体験の終了日時は変わりません。</span></label>
      <fieldset><legend className="text-sm font-semibold">避けたいアレルギー食材</legend><div className="mt-3 grid grid-cols-2 gap-2">{commonAllergens.map((allergen) => <label key={allergen} className="flex min-h-11 items-center gap-3 rounded border border-kondate-line bg-white px-3 text-sm"><input type="checkbox" name="allergies" value={allergen} defaultChecked={preferences.allergies.includes(allergen)} />{allergen}</label>)}</div><label className="mt-3 block text-sm">その他の食材<input name="otherAllergies" className={field} defaultValue={getCustomAllergies(preferences.allergies).join("、")} placeholder="食材を読点で区切って入力" maxLength={500} /></label></fieldset>
      <p className="text-xs leading-6 text-kondate-muted">食材照合は補助です。調味料・加工品の原材料表示も確認してください。</p>
      <label className="flex min-h-11 items-center gap-3 text-sm"><input required type="checkbox" name="confirmed" value="yes" />アレルギーを確認しました（ない場合もチェック）</label>
      <PendingButton>献立を確認する</PendingButton>
    </form>
  </main>;
}
