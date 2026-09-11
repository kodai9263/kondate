import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { RecipeForm } from "@/components/features/recipes/RecipeForm";
import { isActiveSubscriptionStatus } from "@/lib/billing/entitlements";
import { isRecipePublisher } from "@/lib/recipes/publisher";
import { getSupabaseServer } from "@/lib/supabase/server";

const errors: Record<string, string> = {
  invalid: "入力内容を確認してください。必須項目と数値を見直せます。",
  profile: "家族グループを確認できませんでした。",
  save: "メニューを保存できませんでした。時間をおいて再度お試しください。",
  source: "元のレシピURLを確認できませんでした。もう一度読み取ってください。",
  publish: "このアカウントには、みんなのメニューへ公開する権限がありません。",
  duplicate: "同じ料理名またはURLのメニューが、すでに公開されています。",
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
      <Link href="/app/recipes" className="inline-flex min-h-11 items-center gap-2 text-sm text-kondate-muted transition-colors hover:text-kondate-ink"><ArrowLeft size={18} aria-hidden="true" />メニュー一覧</Link>
      <header className="mt-4 border-b border-kondate-line pb-5"><h1 className="font-mincho text-[26px] font-bold">メニューを登録</h1><p className="mt-1.5 text-sm text-kondate-muted">URLから読み取るか、今までどおり手入力できます。</p></header>
      {error ? <p role="alert" className="mt-5 rounded border border-kondate-alert/30 bg-kondate-alertSoft p-3 text-sm text-kondate-alert">{errors[error] ?? errors.save}</p> : null}
      <RecipeForm canPublish={isRecipePublisher(user)} />
    </main>
  );
}
