import Link from "next/link";
import { redirect } from "next/navigation";
import { requestAccountDeletion } from "./actions";
import { getSupabaseServer } from "@/lib/supabase/server";
import { PortalButton } from "@/components/features/billing/PortalButton";

export const dynamic = "force-dynamic";

export default async function DeleteAccountPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  const supabase = await getSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/account/delete");
  const { data: profile } = await supabase.from("profiles").select("household_id").eq("id", user.id).maybeSingle();
  if (!profile) redirect("/account/deletion-status");
  const [{ count, error: membersError }, { data: subscription, error: subscriptionError }] = await Promise.all([
    supabase.from("profiles").select("id", { count: "exact", head: true }).eq("household_id", profile.household_id),
    supabase.from("household_subscriptions").select("stripe_customer_id").eq("household_id", profile.household_id).maybeSingle(),
  ]);
  const previewReady = !membersError && !subscriptionError && typeof count === "number" && count > 0;
  const enabled = previewReady && process.env.ACCOUNT_DELETION_ENABLED === "true";
  return <main className="mx-auto min-h-dvh w-full max-w-[560px] px-4 py-8">
    <Link href="/account" className="text-sm underline">設定へ戻る</Link>
    <h1 className="mt-6 font-mincho text-3xl font-bold">アカウントを削除</h1>
    {previewReady ? <div className="mt-6 space-y-4 rounded border border-kondate-line bg-white p-5 text-sm leading-7">
      <p>ログイン情報とあなたのプロフィールを削除します。削除後はこのアカウントでログインできません。</p>
      <p>{count === 1 ? "家族の最後の一人のため、共有していた献立・買い物などの家族データも削除します。" : "ほかの家族が残るため、共有中の献立・買い物は残し、あなたの操作履歴の名前を外します。"}</p>
      {subscription?.stripe_customer_id && <p>退会してもStripeの定期購入は自動解約されません。契約元の管理画面で別途解約してください。</p>}
      {subscription?.stripe_customer_id && <PortalButton />}
      <p>削除に時間がかかる場合は、受付番号で状況を確認できます。</p>
    </div> : <p role="alert" className="mt-6 text-sm text-kondate-alert">家族と契約の状態を確認できませんでした。通信を確認して再度お試しください。</p>}
    {error && <p role="alert" className="mt-4 text-sm text-kondate-alert">{error === "confirmation" ? "確認欄に「削除」と入力してください。" : error === "storage" ? "共有写真の移管が必要なため、退会をまだ受け付けられません。サポートへご連絡ください。" : "退会を受け付けられませんでした。時間をおいて再度お試しください。"}</p>}
    {enabled ? <form action={requestAccountDeletion} className="mt-6 space-y-4">
      <label className="block text-sm font-semibold">確認のため「削除」と入力してください<input name="confirmation" required autoComplete="off" className="mt-2 min-h-12 w-full rounded-lg border border-kondate-line bg-white px-3 text-base" /></label>
      <button type="submit" className="min-h-12 w-full rounded-lg bg-kondate-alert px-4 font-bold text-white">アカウントを削除する</button>
    </form> : <p className="mt-6 text-sm" role="status">退会受付は準備中です。</p>}
  </main>;
}
