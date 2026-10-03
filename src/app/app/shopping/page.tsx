import Link from "next/link";
import { getFirstWeekAccess } from "@/lib/billing/firstWeek.server";
import { ShoppingPageView } from "@/components/features/shopping/ShoppingPageView";
import { getPlannedShopping, getSavedShoppingState } from "@/lib/shopping/server";

export default async function ShoppingPage() {
  const access = await getFirstWeekAccess();
  if (!access.canPlan) return <main className="mx-auto max-w-xl p-6"><h1 className="font-mincho text-2xl">買い物リスト</h1><p className="mt-4 leading-7">14日間の無料体験が終了しました。保存したデータは残っています。買い物リストの継続利用には家族プランをご利用ください。自動課金はありません。</p><Link href="/pricing?required=trial_expired" className="mt-4 inline-flex min-h-11 items-center underline">継続利用のプランを見る</Link></main>;
  if (!access.paid && !access.trial) return <main className="mx-auto max-w-xl p-6"><h1 className="font-mincho text-2xl">買い物リスト</h1><p className="mt-4 leading-7">まず人数とアレルギーを確認して、献立と買い物リストを試しましょう。</p><Link href="/app/planner/setup" className="mt-4 inline-flex min-h-11 items-center underline">無料体験で献立を作る</Link></main>;
  let shopping;
  let saved;
  try {
    shopping = await getPlannedShopping();
    saved = await getSavedShoppingState(shopping);
  } catch {
    return <main className="mx-auto min-h-dvh w-full max-w-[640px] px-4 pb-28 pt-5">
      <h1 className="font-mincho text-[26px] font-bold">買い物リスト</h1>
      <p role="alert" className="mt-5 rounded border border-kondate-alert/30 bg-kondate-alertSoft p-4 text-sm leading-7 text-kondate-alert">献立・朝食・保存状態を読み込めなかったため、買い物リストを表示できません。再読み込みしてください。</p>
      <a href="/app/shopping" className="mt-4 inline-flex min-h-11 items-center underline">再読み込みする</a>
    </main>;
  }
  const { period, groups, warnings, meals, preferences, listId, latestCompletion } = shopping;
  return <ShoppingPageView period={period} groups={groups} warnings={warnings} meals={meals}
    trialExpiresAt={!access.paid ? access.freeTrial?.expires_at : undefined} preferences={preferences} listId={listId ?? null} latestCompletion={latestCompletion} saved={saved} />;
}
