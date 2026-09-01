import { AlertTriangle, ArrowLeft, CalendarDays, CreditCard, Link2, LogOut, MessageSquare, Save, Send, UserRound, Users } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { PortalButton } from "@/components/features/billing/PortalButton";
import { getSupabaseServer, isSupabaseConfigured } from "@/lib/supabase/server";
import { createFamilyInvite, signOut, updateAccount } from "@/app/account/actions";
import { commonAllergens, getCustomAllergies, normalizeAllergies } from "@/lib/family/allergies";
import { defaultShoppingDay, formatServingLabel, normalizeFamilySize, normalizeShoppingDay, shoppingWeekdays } from "@/lib/family/servings";
import { submitAppFeedback } from "@/app/feedback/actions";
import { buildInviteUrl, normalizeInviteToken } from "@/lib/family/invites";
import { isActiveSubscriptionStatus } from "@/lib/billing/entitlements";

export const dynamic = "force-dynamic";

const errorMessages: Record<string, string> = {
  invalid: "入力内容を確認してください。",
  profile: "アカウント情報を読み込めませんでした。",
  update: "変更を保存できませんでした。時間をおいて再度お試しください。",
  invite: "招待リンクを作成できませんでした。時間をおいて再度お試しください。",
};

const successMessages: Record<string, string> = {
  invite: "招待リンクを作成しました。",
  updated: "変更を保存しました。",
};

export default async function AccountPage({ searchParams }: { searchParams: Promise<{ error?: string; success?: string; feedback?: string; invite?: string }> }) {
  if (!isSupabaseConfigured()) redirect("/login?error=setup");
  const params = await searchParams;
  const supabase = await getSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  await supabase.rpc("ensure_current_user_household");
  const { data: profile } = await supabase.from("profiles").select("display_name, household_id").eq("id", user.id).single();
  if (!profile) redirect("/login?error=profile");

  const [{ data: household }, { data: subscription }, { data: settings }, { data: invites }, { data: members }] = await Promise.all([
    supabase.from("households").select("name").eq("id", profile.household_id).single(),
    supabase.from("household_subscriptions").select("plan_id, status, current_period_end, cancel_at_period_end").eq("household_id", profile.household_id).maybeSingle(),
    supabase.from("household_settings").select("adult_count, child_count, shopping_day, allergies").eq("household_id", profile.household_id).maybeSingle(),
    supabase.from("household_invites").select("invite_token, expires_at, accepted_at").eq("household_id", profile.household_id).is("accepted_at", null).gt("expires_at", new Date().toISOString()).order("created_at", { ascending: false }).limit(3),
    supabase.from("profiles").select("id, display_name, created_at").eq("household_id", profile.household_id).order("created_at", { ascending: true }),
  ]);
  const paid = subscription ? isActiveSubscriptionStatus(subscription.status, subscription.current_period_end) : false;
  const familySize = normalizeFamilySize(settings ? { adultCount: settings.adult_count, childCount: settings.child_count } : null);
  const shoppingDay = normalizeShoppingDay(settings?.shopping_day ?? defaultShoppingDay);
  const allergies = normalizeAllergies(settings?.allergies);
  const selectedAllergies = new Set(allergies);
  const customAllergies = getCustomAllergies(allergies);
  const createdInviteToken = normalizeInviteToken(params.invite);
  const createdInviteUrl = createdInviteToken ? buildInviteUrl(createdInviteToken) : null;

  return (
    <main id="account-top" className="mx-auto min-h-dvh w-full max-w-[560px] scroll-mt-4 px-4 pb-16 pt-5">
      <Link href="/app" className="mb-5 inline-flex min-h-11 items-center gap-2 text-sm font-black text-kondate-muted"><ArrowLeft size={18} />今日画面へ</Link>
      <div className="mb-6"><p className="flex items-center gap-2 text-sm font-black text-kondate-accent"><UserRound size={18} />アカウント</p><h1 className="mt-1 text-2xl font-black">家族と契約の設定</h1></div>

      {params.error ? <p role="alert" className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm font-bold text-red-800">{errorMessages[params.error] ?? errorMessages.update}</p> : null}
      {params.success ? <p role="status" className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm font-bold text-emerald-900">{successMessages[params.success] ?? successMessages.updated}</p> : null}

      <section className="rounded-lg border border-kondate-line bg-white p-5">
        <h2 className="font-black">基本情報</h2>
        <form action={updateAccount} className="mt-4 space-y-4">
          <label className="block text-sm font-black">表示名 <span className="text-xs text-kondate-muted">（必須）</span><input name="displayName" required defaultValue={profile.display_name} autoComplete="name" className="mt-2 min-h-12 w-full rounded-lg border border-kondate-line px-3 text-base" /></label>
          <label className="block text-sm font-black">家族グループ名 <span className="text-xs text-kondate-muted">（必須）</span><input name="householdName" required defaultValue={household?.name ?? "わが家"} className="mt-2 min-h-12 w-full rounded-lg border border-kondate-line px-3 text-base" /></label>
          <label className="block text-sm font-black">メールアドレス<input value={user.email ?? ""} readOnly className="mt-2 min-h-12 w-full rounded-lg border border-kondate-line bg-kondate-bg px-3 text-base text-kondate-muted" /></label>
          <fieldset className="border-t border-kondate-line pt-5"><legend className="flex items-center gap-2 px-1 font-black"><Users size={18} />家族の人数</legend><div className="mt-4 grid grid-cols-2 gap-3"><label className="text-sm font-black">大人<input name="adultCount" type="number" inputMode="numeric" min="1" max="10" required defaultValue={familySize.adultCount} className="mt-2 min-h-12 w-full rounded-lg border border-kondate-line px-3 text-base" /></label><label className="text-sm font-black">子ども<input name="childCount" type="number" inputMode="numeric" min="0" max="10" required defaultValue={familySize.childCount} className="mt-2 min-h-12 w-full rounded-lg border border-kondate-line px-3 text-base" /></label></div><p className="mt-3 text-xs font-bold leading-5 text-kondate-muted">{formatServingLabel(familySize)}。子どもは大人の0.6人前として献立と買い物を調整します。</p></fieldset>
          <label className="block border-t border-kondate-line pt-5 text-sm font-black"><span className="flex items-center gap-2"><CalendarDays size={18} />まとめ買いの曜日</span><select name="shoppingDay" defaultValue={shoppingDay} className="mt-3 min-h-12 w-full rounded-lg border border-kondate-line bg-white px-3 text-base">{shoppingWeekdays.map((weekday, index) => <option key={weekday} value={index}>{weekday}曜日</option>)}</select></label>
          <fieldset className="border-t border-kondate-line pt-5">
            <legend className="flex items-center gap-2 px-1 font-black"><AlertTriangle size={18} />アレルギー・避けたい食材</legend>
            <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {commonAllergens.map((allergen) => <label key={allergen} className="flex min-h-11 items-center gap-2 rounded-lg border border-kondate-line px-3 text-sm font-black"><input type="checkbox" name="allergies" value={allergen} defaultChecked={selectedAllergies.has(allergen)} className="size-4 accent-kondate-accent" />{allergen}</label>)}
            </div>
            <label className="mt-4 block text-sm font-black">その他の食材<textarea name="customAllergies" defaultValue={customAllergies.join("\n")} maxLength={500} rows={3} placeholder="例：キウイ、山芋、青魚" className="mt-2 w-full rounded-lg border border-kondate-line px-3 py-3 text-base leading-6" /></label>
            <p className="mt-3 text-xs font-bold leading-5 text-kondate-muted">献立候補との照合に使います。自動判定は補助機能のため、原材料表示は必ず確認してください。</p>
          </fieldset>
          <button type="submit" className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-kondate-accent px-4 font-black text-white"><Save size={18} />変更を保存</button>
        </form>
      </section>

      <section className="mt-4 rounded-lg border border-kondate-line bg-white p-5">
        <div className="flex items-start justify-between gap-3"><div><p className="flex items-center gap-2 font-black"><CreditCard size={18} />契約プラン</p><p className="mt-1 text-sm text-kondate-muted">{paid ? "家族プランを利用中" : "無料プラン"}</p></div><span className="rounded-lg bg-kondate-sage px-3 py-1 text-xs font-black text-[#285b35]">{paid ? "有効" : "無料"}</span></div>
        {paid ? <div className="mt-4"><PortalButton /></div> : <Link href="/pricing" className="mt-4 inline-flex min-h-11 w-full items-center justify-center rounded-lg border border-kondate-accent font-black text-kondate-accent">家族プランを見る</Link>}
      </section>

      <section className="mt-4 rounded-lg border border-kondate-line bg-white p-5">
        <div className="flex items-start justify-between gap-3"><div><p className="flex items-center gap-2 font-black"><Users size={18} />家族共有</p><p className="mt-1 text-sm leading-6 text-kondate-muted">招待リンクは7日間だけ有効です。家族プラン利用中は、参加した家族と献立・買い物・設定を共有できます。</p></div><span className="rounded-lg bg-kondate-sage px-3 py-1 text-xs font-black text-[#285b35]">家族プラン</span></div>
        <div className="mt-4 rounded-lg border border-kondate-line bg-kondate-bg p-3">
          <p className="text-xs font-black text-kondate-muted">参加済みメンバー</p>
          <div className="mt-3 space-y-2">
            {(members?.length ? members : [{ id: user.id, display_name: profile.display_name, created_at: "" }]).map((member) => (
              <div key={member.id} className="flex min-h-11 items-center justify-between gap-3 rounded-lg bg-white px-3">
                <span className="truncate text-sm font-black text-kondate-ink">{member.display_name}{member.id === user.id ? "（あなた）" : ""}</span>
                <span className="shrink-0 text-xs font-bold text-kondate-muted">{member.created_at ? `${new Date(member.created_at).toLocaleDateString("ja-JP")} 参加` : "参加中"}</span>
              </div>
            ))}
          </div>
        </div>
        {createdInviteUrl ? <div className="mt-4 rounded-lg border border-kondate-line bg-kondate-bg p-3"><p className="text-xs font-black text-kondate-muted">作成した招待リンク</p><input readOnly value={createdInviteUrl} className="mt-2 min-h-11 w-full rounded-lg border border-kondate-line bg-white px-3 text-sm font-bold text-kondate-ink" /></div> : null}
        {invites?.length ? <div className="mt-4 space-y-2">{invites.map((invite) => <div key={invite.invite_token} className="rounded-lg border border-kondate-line p-3"><p className="truncate text-sm font-bold">{buildInviteUrl(invite.invite_token)}</p><p className="mt-1 text-xs font-bold text-kondate-muted">期限: {new Date(invite.expires_at).toLocaleDateString("ja-JP")}</p></div>)}</div> : null}
        {paid ? <form action={createFamilyInvite} className="mt-4"><button type="submit" className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-kondate-ink px-4 font-black text-white"><Link2 size={18} />招待リンクを作成</button></form> : <Link href="/pricing?required=family_sharing" className="mt-4 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-kondate-ink px-4 font-black text-white"><CreditCard size={18} />家族プランで招待する</Link>}
      </section>

      <section className="mt-4 border border-kondate-line bg-white p-5">
        <div><p className="flex items-center gap-2 font-black"><MessageSquare size={18} />アプリへのご意見</p><p className="mt-1 text-sm leading-6 text-kondate-muted">不具合や改善してほしいことを運営へ送れます。</p></div>
        {params.feedback === "thanks" ? <p role="status" className="mt-4 bg-kondate-sage p-3 text-sm font-bold text-[#285b35]">ご意見を受け付けました。ありがとうございます。</p> : null}
        {params.feedback === "error" ? <p role="alert" className="mt-4 bg-red-50 p-3 text-sm font-bold text-red-800">送信できませんでした。内容を確認してもう一度お試しください。</p> : null}
        <form action={submitAppFeedback} className="mt-4 space-y-4"><label className="block text-sm font-black">種類<select name="category" defaultValue="improvement" className="mt-2 min-h-12 w-full border border-kondate-line bg-white px-3 text-base"><option value="bug">不具合</option><option value="improvement">改善してほしい</option><option value="praise">良かった</option></select></label><label className="block text-sm font-black">内容 <span className="text-xs text-kondate-muted">（必須）</span><textarea name="message" required maxLength={2000} rows={5} className="mt-2 w-full border border-kondate-line p-3 text-base" placeholder="気づいたことをご記入ください" /></label><button type="submit" className="inline-flex min-h-12 w-full items-center justify-center gap-2 bg-kondate-ink px-4 font-black text-white"><Send size={18} />フィードバックを送る</button></form>
      </section>

      <section className="mt-8 border-t border-kondate-line pt-5">
        <form action={signOut}><button type="submit" className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border border-kondate-line bg-white font-black text-kondate-muted"><LogOut size={18} />ログアウト</button></form>
      </section>
    </main>
  );
}
