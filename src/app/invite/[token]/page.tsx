import { ArrowLeft, Users } from "lucide-react";
import Link from "next/link";
import { PendingButton } from "@/components/ui/PendingButton";
import { AuthShell } from "@/components/features/auth/AuthShell";
import { acceptFamilyInvite } from "@/app/invite/[token]/actions";
import { normalizeInviteToken } from "@/lib/family/invites";
import { getSupabaseServer, isSupabaseConfigured } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type InvitePreview = {
  household_name: string;
  expires_at: string;
  accepted_at: string | null;
};

export default async function InvitePage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { token } = await params;
  const { error } = await searchParams;
  const inviteToken = normalizeInviteToken(token);

  if (!inviteToken || !isSupabaseConfigured()) {
    return (
      <AuthShell title="招待リンクを確認できません" description="リンクが途中で切れていないか確認してください。">
        <Link href="/" className="inline-flex min-h-11 items-center gap-2 font-black text-kondate-accent"><ArrowLeft size={18} />トップへ戻る</Link>
      </AuthShell>
    );
  }

  const supabase = await getSupabaseServer();
  const [{ data: { user } }, { data: rawInvite }] = await Promise.all([
    supabase.auth.getUser(),
    supabase.rpc("get_household_invite", { invite_token_input: inviteToken }).maybeSingle(),
  ]);
  const invite = rawInvite as InvitePreview | null;

  if (!invite) {
    return (
      <AuthShell title="招待リンクが使えません" description="期限切れ・使用済み・共有解除、または家族プランの終了が考えられます。招待した家族に確認してください。">
        <Link href="/" className="inline-flex min-h-11 items-center gap-2 font-black text-kondate-accent"><ArrowLeft size={18} />トップへ戻る</Link>
      </AuthShell>
    );
  }

  return (
    <AuthShell title="家族グループに参加" description={`${invite.household_name} の献立と買い物リストを共有します。`}>
      {error === "accept" ? <p role="alert" className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm font-bold text-red-800">参加できませんでした。招待リンクの期限を確認してください。</p> : null}
      {error === "guest" ? <p role="alert" className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm font-bold text-red-800">この端末での参加を開始できませんでした。時間をおいて再度お試しいただくか、登録済みのアカウントでログインしてください。</p> : null}
      <div className="rounded-lg border border-kondate-line bg-white p-4">
        <p className="flex items-center gap-2 font-black"><Users size={18} />{invite.household_name}</p>
        <p className="mt-2 text-sm leading-6 text-kondate-muted">献立や買い物リスト、家族の設定を一緒に使えます。{!user || user.is_anonymous ? "メールアドレス・パスワードの入力は不要です。" : "現在ログイン中のアカウントで参加します。"}</p>
      </div>
      <form action={acceptFamilyInvite} className="mt-5">
          <input type="hidden" name="inviteToken" value={inviteToken} />
          <PendingButton pendingLabel="参加しています...">この家族グループに参加</PendingButton>
      </form>
      {!user || user.is_anonymous ? <p className="mt-4 text-xs leading-6 text-kondate-muted">参加状態はこのブラウザに保存されます。LINE内で開いている場合は、普段使うSafariやChromeで開いてから参加してください。機種変更やブラウザのデータ削除、ログアウト後は、家族から新しい招待リンクをもらってください。</p> : <p className="mt-4 text-xs leading-6 text-kondate-muted">参加すると、このアカウントの表示先が招待された家族に切り替わります。これまでの家族のデータは削除されません。</p>}
      {!user ? <p className="mt-4 text-center text-sm text-kondate-muted">登録済みの方は <Link href={`/login?invite=${inviteToken}`} className="font-semibold text-kondate-accent underline underline-offset-4">ログインして参加</Link></p> : null}
    </AuthShell>
  );
}
